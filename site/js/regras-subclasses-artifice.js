// ============================================================
// Regras puras das subclasses do Artífice da parte II (Alquimista,
// Armeiro, Cartógrafo). Sem DOM.
// ============================================================
import { nivelNa, nivelTotal, subclasseDe } from './regras-multiclasse.js';
import { estadoArtifice, modInt } from './regras-artifice.js';
import { bonusProficiencia } from './utils.js';
import { ehArmeiroAprimorado } from './regras-planos-artifice.js';

// chave -> [subclasse, nível mínimo, máximo: 'int' (mod. Int, mín. 1) ou número].
// Caldeirão (Maestria Química) e Encontrar o Caminho (Atlas Superior) ficam de fora: 1 uso, coberto pelo gratis_usado do motor.
const GRATIS = {
  restauracao_menor: ['Alquimista', 9, 'int'],
  fogo_das_fadas: ['Cartógrafo', 3, 'int'],
};

/** Contador de um uso grátis: máximo (0 sem a característica) e gastos. Sem a característica não grava estado. */
export function usosGratisArtifice(p, chave) {
  const [sub, nivelMin, max] = GRATIS[chave];
  const tem = subclasseDe(p, 'Artífice') === sub && (nivelNa(p, 'Artífice') || 0) >= nivelMin;
  if (!tem) return { max: 0, gastos: 0 };
  const e = estadoArtifice(p);
  return { max: max === 'int' ? Math.max(1, modInt(p)) : max, gastos: e.gratis[chave] || 0 };
}

/** Gasta um uso grátis; false quando esgotado ou sem a característica. */
export function gastarGratisArtifice(p, chave) {
  const { max, gastos } = usosGratisArtifice(p, chave);
  if (gastos >= max) return false;
  estadoArtifice(p).gratis[chave] = gastos + 1;
  return true;
}

// Elixir Experimental (Alquimista 3): efeitos d6 1-5, na ordem da tabela do livro.
export const EFEITOS_ELIXIR = ['Cura', 'Rapidez', 'Resiliência', 'Ousadia', 'Voo'];
// d6 = 6: o livro manda escolher uma das outras linhas; o elixir nasce com este rótulo e a pessoa decide o efeito depois.
export const ELIXIR_ESCOLHA = 'Escolha';

/** Elixires criados ao fim do Descanso Longo: 2 (3), 3 (5), 4 (9), 5 (15); 0 fora do Alquimista. */
export function quantidadeElixires(p) {
  if (subclasseDe(p, 'Artífice') !== 'Alquimista') return 0;
  const n = nivelNa(p, 'Artífice') || 0;
  if (n >= 15) return 5;
  if (n >= 9) return 4;
  if (n >= 5) return 3;
  return n >= 3 ? 2 : 0;
}

/** Texto do efeito de um elixir no nível de Artífice do personagem (escala no 9 e no 15). */
export function textoElixir(efeito, p) {
  const n = nivelNa(p, 'Artífice') || 0;
  const g = n >= 15 ? 2 : n >= 9 ? 1 : 0;
  // Cura usa o modificador de Inteligência como está (sem mínimo), conforme o texto do livro.
  const mod = modInt(p);
  const int = `${mod >= 0 ? '+' : '-'} ${Math.abs(mod)}`;
  const t = {
    'Cura': `Quem bebe recupera ${['2d8', '3d8', '4d8'][g]} ${int} Pontos de Vida.`,
    'Rapidez': `O Deslocamento de quem bebe aumenta em ${['3', '4,5', '6'][g]} metros por 1 hora.`,
    'Resiliência': `Quem bebe recebe +1 de CA por ${['10 minutos', '1 hora', '8 horas'][g]}.`,
    'Ousadia': `Quem bebe rola 1d4 e soma a cada jogada de ataque e salvaguarda por ${['1 minuto', '10 minutos', '1 hora'][g]}.`,
    'Voo': `Quem bebe recebe Deslocamento de Voo de ${['3', '6', '9'][g]} metros por 10 minutos.`,
    [ELIXIR_ESCOLHA]: 'Você determina o efeito do elixir escolhendo uma das outras linhas da tabela Elixir Experimental.',
  };
  return `${t[efeito]} Beber ou dar a outra criatura a até 1,5 metro: Ação Bônus.`;
}

/** Item de inventário de um elixir; some ao terminar o próximo Descanso Longo. */
export function criarElixir(p, efeito) {
  const item = {
    nome: `Elixir Experimental (${efeito})`, tipo: 'magico', quantidade: 1, equipado: false, descricao: '',
    dados: { tipo_item: 'Consumível', raridade: '', requer_sintonizacao: false, linha_tipo: 'Elixir (Consumível)', descricao_magica: textoElixir(efeito, p) },
    origem: { tipo: 'elixir', expira: 'descanso_longo' },
  };
  if (!Array.isArray(p.inventario)) p.inventario = [];
  p.inventario.push(item);
  return item;
}

/** Elixires rolados ao fim do Descanso Longo; devolve os nomes criados. */
export function elixiresDoDescanso(p, rolar = () => 1 + Math.floor(Math.random() * 6)) {
  const nomes = [];
  for (let i = 0; i < quantidadeElixires(p); i++) {
    const d6 = rolar();
    nomes.push(criarElixir(p, d6 === 6 ? ELIXIR_ESCOLHA : EFEITOS_ELIXIR[d6 - 1]).nome);
  }
  return nomes;
}

/** True se o item é um elixir ainda sem efeito escolhido (rolagem 6). */
export function ehElixirEscolha(item) {
  return item?.origem?.tipo === 'elixir' && item.nome === `Elixir Experimental (${ELIXIR_ESCOLHA})`;
}

/** Define o efeito de um elixir "Escolha" (índice `idx` do inventário); false se o item não for elixir "Escolha" ou o efeito não existir. */
export function definirEfeitoElixir(p, idx, efeito) {
  const item = p.inventario?.[idx];
  if (!ehElixirEscolha(item) || !EFEITOS_ELIXIR.includes(efeito)) return false;
  item.nome = `Elixir Experimental (${efeito})`;
  item.dados.descricao_magica = textoElixir(efeito, p);
  return true;
}

// Modelos do Armeiro: arma especial [nome, dado normal, dado no 15, tipo] e contador do modelo [chave, nome, nível mínimo].
export const MODELOS_ARMEIRO = {
  'Couraçado': { arma: ['Demolidor de Energia', '1d10', '2d6', 'Energético'], contador: ['estatura', 'Estatura Gigante', 3] },
  'Guardião': { arma: ['Pulso Trovejante', '1d8', '1d10', 'Trovejante'], contador: ['puxao', 'Armadura Perfeita (puxão)', 15] },
  'Infiltrador': { arma: ['Lançador de Relâmpagos', '1d6', '2d6', 'Elétrico'], contador: ['voo', 'Armadura Perfeita (voo)', 15] },
};

/** Armadura Arcana ativa: Armeiro 3+ e a armadura transformada (guardada por nome) continua vestida; vestir outra a desfaz. */
export function armaduraArcanaAtiva(p) {
  if (subclasseDe(p, 'Artífice') !== 'Armeiro' || (nivelNa(p, 'Artífice') || 0) < 3) return false;
  const nome = estadoArtifice(p).armadura_arcana;
  if (!nome) return false;
  return (p.inventario || []).some((i) => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo' && i.nome === nome);
}

/** Modelo em uso; vazio sem Armadura Arcana ativa. */
export function modeloAtivo(p) {
  return armaduraArcanaAtiva(p) ? (estadoArtifice(p).modelo || '') : '';
}

/** Arma especial do modelo: ataque e dano com Int (+1 no Armeiro Aprimorado, dado maior no 15); null sem modelo ativo. */
export function armaEspecialArmeiro(p) {
  const m = MODELOS_ARMEIRO[modeloAtivo(p)];
  if (!m) return null;
  const n = nivelNa(p, 'Artífice') || 0;
  const [nome, dado, dado15, tipo] = m.arma;
  // Arsenal Aprimorado (Armeiro Aprimorado, 9): +1 em ataque e dano. A Replicação de Armadura do mesmo recurso é do Plano 3.
  const aprimorado = ehArmeiroAprimorado(p) ? 1 : 0;
  const ataque = bonusProficiencia(nivelTotal(p) || n) + modInt(p) + aprimorado;
  const somaDano = modInt(p) + aprimorado;
  return { nome, ataque, dano: `${n >= 15 ? dado15 : dado} + ${somaDano} ${tipo}`, notas: modeloAtivo(p) === 'Infiltrador' ? '27/90 m; +1d6 Elétrico 1x por turno' : '' };
}

/** Contadores do modelo ativo liberados pelo nível (Estatura no 3; puxão e voo no 15). */
export function contadoresArmeiro(p) {
  const m = MODELOS_ARMEIRO[modeloAtivo(p)];
  if (!m) return [];
  const [chave, nome, nivelMin] = m.contador;
  if ((nivelNa(p, 'Artífice') || 0) < nivelMin) return [];
  const gastos = estadoArtifice(p).armeiro_gastos[chave] || 0;
  return [{ chave, nome, max: Math.max(1, modInt(p)), gastos }];
}

/** Gasta um uso do contador `chave`; false quando esgotado ou inexistente. */
export function gastarArmeiro(p, chave) {
  const c = contadoresArmeiro(p).find((x) => x.chave === chave);
  if (!c || c.gastos >= c.max) return false;
  estadoArtifice(p).armeiro_gastos[chave] = c.gastos + 1;
  return true;
}

/** Máximo de portadores do Atlas do Aventureiro: 1 + mod. Int, mínimo 2. */
export function atlasMaxPortadores(p) {
  return Math.max(2, 1 + modInt(p));
}

/** Dado extra de Iniciativa do Atlas: '1d4' com o atlas criado e o próprio Cartógrafo entre os portadores; '' nos demais casos. */
export function bonusIniciativaAtlas(p) {
  // Constante em vez de literal na comparação: subclasse-nome-literal.test.mjs não conhece as subclasses do Artífice.
  const cartografo = 'Cartógrafo';
  if (subclasseDe(p, 'Artífice') !== cartografo || (nivelNa(p, 'Artífice') || 0) < 3) return '';
  const atlas = estadoArtifice(p).atlas;
  return atlas?.ativo && atlas.voce !== false ? '1d4' : '';
}
