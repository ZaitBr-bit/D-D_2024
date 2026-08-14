// ============================================================
// Regras de equipamento: proficiencia e requisito de atributo.
//
// Modulo PURO (sem DOM, sem estado global): o personagem vem sempre por
// parametro. Ate 2026-08-13 estas regras existiam DUAS vezes, identicas
// linha a linha -- em creator/passo-equipamento.js (lendo `personagem`) e
// em sheet/condicoes.js (lendo `char`). Duas fontes da verdade para a
// mesma regra e o bug raiz; nao restaurar nenhuma das copias.
// ============================================================
import { CLASSES_INFO } from './dados-classes.js';

/** Verifica se o personagem tem proficiencia com uma arma especifica */
export function temProficienciaArma(personagem, arma) {
  const info = CLASSES_INFO[personagem?.classe];
  if (!info) return false;
  const cat = (arma?.categoria || '').toLowerCase();
  const extras = (personagem?.proficiencias_extra || []).map(p => p.toLowerCase());

  // Proficiencia completa na categoria
  if (info.armas.includes('Marcial') && cat.includes('marciai')) return true;
  if (info.armas.includes('Simples') && cat.includes('simples')) return true;

  // Proficiencias extras (ex.: Clerigo Protetor recebe "Armas Marciais")
  if (extras.includes('armas marciais') && cat.includes('marciai')) return true;
  if (extras.includes('armas simples') && cat.includes('simples')) return true;

  // Ladino: Marcial com Acuidade
  if (info.armas.some(a => a.includes('Acuidade'))) {
    if (cat.includes('marciai') && (arma?.propriedades || '').toLowerCase().includes('acuidade')) return true;
  }
  // Monge: Marcial com Leve
  if (info.armas.some(a => a.includes('Leve'))) {
    if (cat.includes('marciai') && (arma?.propriedades || '').toLowerCase().includes('leve')) return true;
  }

  return false;
}

/** Verifica se o personagem tem proficiencia com uma armadura especifica */
export function temProficienciaArmadura(personagem, armadura) {
  const info = CLASSES_INFO[personagem?.classe];
  if (!info) return false;
  const cat = (armadura?.categoria || '').toLowerCase();
  const nome = (armadura?.nome || '').toLowerCase();
  const extras = (personagem?.proficiencias_extra || []).map(p => p.toLowerCase());

  // Escudo e tratado a parte das categorias de armadura
  if (nome === 'escudo') return info.armaduras.includes('Escudo') || extras.includes('escudo');

  if (info.armaduras.includes('Pesada') && cat === 'pesada') return true;
  if (info.armaduras.includes('Média') && (cat === 'média' || cat === 'media')) return true;
  if (info.armaduras.includes('Leve') && cat === 'leve') return true;

  // Proficiencias extras (Clerigo Protetor etc.)
  if (extras.includes('armadura pesada') && cat === 'pesada') return true;
  if (extras.includes('armadura média') && (cat === 'média' || cat === 'media')) return true;

  return false;
}

/**
 * Verifica se o personagem atende ao requisito de Forca de uma armadura.
 * Armadura sem requisito (campo ausente ou "—") passa sempre.
 *
 * Formato real do campo em dados/equipamento/armaduras.json (conferido em
 * 2026-08-13): "For 13" e "For 15" -- SEM ponto apos "For" -- ou "—" quando
 * nao ha requisito. A regex abaixo ja cobre esse formato porque o ponto e
 * opcional (`\.?`); mantida assim para tambem aceitar "For. 13" caso o dado
 * mude no futuro.
 */
export function atendeRequisitoForca(personagem, armadura) {
  if (!armadura?.requisito_forca || armadura.requisito_forca === '—') return true;
  const match = String(armadura.requisito_forca).match(/For\.?\s*(\d+)/i);
  if (!match) return true;
  // `|| 10` (e nao `|| 0`) e o default do original em
  // creator/passo-equipamento.js: personagem sem `atributos` conta como
  // Forca 10, o valor padrao de D&D. Trocar por 0 mudaria a semantica --
  // esta task preserva comportamento, so move o personagem para parametro.
  return (personagem?.atributos?.forca || 10) >= parseInt(match[1], 10);
}

/** Badge compacta de proficiencia, usada nas listas de item */
export function badgeProficiencia(proficiente) {
  return proficiente
    ? '<span class="badge badge-prof-sm">Prof</span>'
    : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
}
