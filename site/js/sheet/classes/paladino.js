// ============================================================
// Progressao e recursos do Paladino
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

// ============================================================
// Progressão e recursos do Paladino
// ============================================================
function getProgressaoPaladino() {
  if (char?.classe !== 'Paladino' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const cdStr = String(row['Canalizar Divindade'] || '—');
  const canalizarMax = parseInt(cdStr) || 0;
  return { canalizarMax };
}

export function getEstadoRecursosPaladino() {
  if (char?.classe !== 'Paladino') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.paladino) {
    char.recursos.paladino = {
      maos_consagradas_gastos: 0,
      canalizar_divindade_usos_gastos: 0,
      destruicao_gratuita_usada: false
    };
  }

  const r = char.recursos.paladino;
  if (typeof r.maos_consagradas_gastos !== 'number') r.maos_consagradas_gastos = 0;
  if (typeof r.canalizar_divindade_usos_gastos !== 'number') r.canalizar_divindade_usos_gastos = 0;
  if (typeof r.destruicao_gratuita_usada !== 'boolean') r.destruicao_gratuita_usada = false;

  const nivel = char.nivel || 1;
  const prog = getProgressaoPaladino() || { canalizarMax: 0 };

  // Mãos Consagradas: reserva = 5 × nível
  const maosMax = 5 * nivel;
  const maosAtuais = Math.max(0, maosMax - r.maos_consagradas_gastos);

  // Canalizar Divindade (nível 3+)
  const canalizarMax = prog.canalizarMax;
  const canalizarDisponiveis = Math.max(0, canalizarMax - r.canalizar_divindade_usos_gastos);

  // Destruição gratuita (nível 2+, 1x/descanso longo)
  const destruicaoGratuitaAtiva = nivel >= 2;

  // Aura de Proteção (nível 6+)
  const modCar = Math.max(1, calcMod(char.atributos.carisma));
  const auraProtecaoAtiva = nivel >= 6;
  const auraRaio = nivel >= 18 ? 9 : 3;

  // Aura de Coragem (nível 10+)
  const auraCoragemAtiva = nivel >= 10;

  // Aura de Devoção (Juramento da Devoção, nível 7+)
  const auraDevocaoAtiva = char.subclasse === 'Juramento da Devoção' && nivel >= 7;

  // Golpes Radiantes (nível 11+)
  const golpesRadiantesAtivo = nivel >= 11;

  // Toque Restaurador (nível 14+)
  const toqueRestauradorAtivo = nivel >= 14;

  return {
    nivel,
    maosMax,
    maosAtuais,
    maosGastos: r.maos_consagradas_gastos,
    canalizarMax,
    canalizarDisponiveis,
    canalizarGastos: r.canalizar_divindade_usos_gastos,
    destruicaoGratuitaAtiva,
    destruicaoGratuitaUsada: r.destruicao_gratuita_usada,
    auraProtecaoAtiva,
    auraRaio,
    bonusAura: modCar,
    auraCoragemAtiva,
    auraDevocaoAtiva,
    golpesRadiantesAtivo,
    toqueRestauradorAtivo
  };
}