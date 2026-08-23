// ============================================================
// Progressao e recursos do Bardo
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char } from '../estado.js';
import { temClasse, nivelNa } from '../../regras-multiclasse.js';
import { dadosDe } from '../contexto-classe.js';

function getProgressaoBardo() {
  // temClasse/dadosDe/nivelNa: o portao e a leitura da tabela tem de ser
  // da classe Bardo, mesmo quando ela nao e a inicial do personagem.
  const dados = dadosDe('Bardo');
  if (!temClasse(char, 'Bardo') || !dados?.tabela_caracteristicas) return null;
  const row = dados.tabela_caracteristicas.find(
    r => parseInt(r['Nível']) === (nivelNa(char, 'Bardo') || 1));
  if (!row) return null;
  const dadoStr = String(row['Dados de Inspiração'] || 'D6');
  const dado = parseInt(dadoStr.replace(/[^\d]/g, '')) || 6;
  return { dado };
}

export function getEstadoInspiracaoBardo() {
  if (!temClasse(char, 'Bardo')) return null;
  if (!char.recursos) char.recursos = {};
  if (typeof char.recursos.inspiracao_bardo_usos_gastos !== 'number') char.recursos.inspiracao_bardo_usos_gastos = 0;

  const modCar = calcMod(char.atributos.carisma);
  const usosMax = Math.max(1, modCar);
  const usosDisponiveis = Math.max(0, usosMax - char.recursos.inspiracao_bardo_usos_gastos);
  const recuperaCurto = (nivelNa(char, 'Bardo') || 1) >= 5;
  const prog = getProgressaoBardo() || { dado: 6 };

  return {
    usosMax,
    usosGastos: char.recursos.inspiracao_bardo_usos_gastos,
    usosDisponiveis,
    dado: prog.dado,
    recuperaCurto
  };
}