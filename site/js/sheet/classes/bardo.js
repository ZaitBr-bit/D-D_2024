// ============================================================
// Progressao e recursos do Bardo
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

function getProgressaoBardo() {
  if (char?.classe !== 'Bardo' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const dadoStr = String(row['Dados de Inspiração'] || 'D6');
  const dado = parseInt(dadoStr.replace(/[^\d]/g, '')) || 6;
  return { dado };
}

export function getEstadoInspiracaoBardo() {
  if (char?.classe !== 'Bardo') return null;
  if (!char.recursos) char.recursos = {};
  if (typeof char.recursos.inspiracao_bardo_usos_gastos !== 'number') char.recursos.inspiracao_bardo_usos_gastos = 0;

  const modCar = calcMod(char.atributos.carisma);
  const usosMax = Math.max(1, modCar);
  const usosDisponiveis = Math.max(0, usosMax - char.recursos.inspiracao_bardo_usos_gastos);
  const recuperaCurto = (char.nivel || 1) >= 5;
  const prog = getProgressaoBardo() || { dado: 6 };

  return {
    usosMax,
    usosGastos: char.recursos.inspiracao_bardo_usos_gastos,
    usosDisponiveis,
    dado: prog.dado,
    recuperaCurto
  };
}