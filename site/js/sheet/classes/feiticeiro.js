// ============================================================
// Progressao e recursos do Feiticeiro
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

function getProgressaoFeiticeiro() {
  if (char?.classe !== 'Feiticeiro' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const pontosStr = String(row['Pontos de Feitiçaria'] || '0').trim();
  const pontosMax = pontosStr === '—' ? 0 : (parseInt(pontosStr) || 0);
  return { pontosMax };
}

export function getEstadoRecursosFeiticeiro() {
  if (char?.classe !== 'Feiticeiro') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.feiticeiro) {
    char.recursos.feiticeiro = {
      pontos_feiticaria_gastos: 0,
      feiticaria_inata_usos_gastos: 0,
      feiticaria_inata_ativa: false,
      restauracao_feiticeira_usada: false,
      metamagias: [],
      subclasses: {
        aberrante: {
          telepatia_ativa: false,
          telepatia_duracao_min: 0,
          revelacao_carne_ativa: false
        },
        draconica: {
          afinidade_elemental: '',
          asas_ativas: false,
          asas_usada_desde_descanso: false,
          companheiro_draconico_usado: false,
          bonus_pv_aplicado: 0
        },
        mecanica: {
          restaurar_equilibrio_usos_gastos: 0,
          transe_ordem_ativo: false,
          transe_ordem_usado_desde_descanso: false,
          bastiao_dados: 0
        },
        selvagem: {
          mares_caos_disponivel: true,
          surto_pendente_automatico: false,
          surto_controlado_usado: false
        }
      }
    };
  }

  const r = char.recursos.feiticeiro;
  if (typeof r.pontos_feiticaria_gastos !== 'number') r.pontos_feiticaria_gastos = 0;
  if (typeof r.feiticaria_inata_usos_gastos !== 'number') r.feiticaria_inata_usos_gastos = 0;
  if (typeof r.feiticaria_inata_ativa !== 'boolean') r.feiticaria_inata_ativa = false;
  if (typeof r.restauracao_feiticeira_usada !== 'boolean') r.restauracao_feiticeira_usada = false;
  if (!Array.isArray(r.metamagias)) r.metamagias = [];
  if (!r.subclasses) r.subclasses = {};
  if (!r.subclasses.aberrante) r.subclasses.aberrante = { telepatia_ativa: false, telepatia_duracao_min: 0, revelacao_carne_ativa: false };
  if (!r.subclasses.draconica) r.subclasses.draconica = { afinidade_elemental: '', asas_ativas: false, asas_usada_desde_descanso: false, companheiro_draconico_usado: false, bonus_pv_aplicado: 0 };
  if (!r.subclasses.mecanica) r.subclasses.mecanica = { restaurar_equilibrio_usos_gastos: 0, transe_ordem_ativo: false, transe_ordem_usado_desde_descanso: false, bastiao_dados: 0 };
  if (!r.subclasses.selvagem) r.subclasses.selvagem = { mares_caos_disponivel: true, surto_pendente_automatico: false, surto_controlado_usado: false };
  if (typeof r.apoteose_gratis_usado_turno !== 'boolean') r.apoteose_gratis_usado_turno = false;
  if (!Array.isArray(r.metamagia_historico)) r.metamagia_historico = [];

  const prog = getProgressaoFeiticeiro() || { pontosMax: 0 };
  const pontosAtuais = Math.max(0, prog.pontosMax - r.pontos_feiticaria_gastos);
  const usosInataMax = 2;
  const usosInataDisponiveis = Math.max(0, usosInataMax - r.feiticaria_inata_usos_gastos);
  const modCar = Math.max(1, calcMod(char.atributos.carisma));

  return {
    pontosMax: prog.pontosMax,
    pontosAtuais,
    pontosGastos: r.pontos_feiticaria_gastos,
    feiticariaInataAtiva: !!r.feiticaria_inata_ativa,
    feiticariaInataUsosMax: usosInataMax,
    feiticariaInataUsosDisponiveis: usosInataDisponiveis,
    restauracaoFeiticeiraUsada: !!r.restauracao_feiticeira_usada,
    metamagias: r.metamagias,
    modCar,
    subclasses: r.subclasses
  };
}

export function gastarPontosFeiticaria(qtd) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado || qtd <= 0 || estado.pontosAtuais < qtd) return false;
  char.recursos.feiticeiro.pontos_feiticaria_gastos += qtd;
  return true;
}

export function recuperarPontosFeiticaria(qtd) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado || qtd <= 0) return false;
  char.recursos.feiticeiro.pontos_feiticaria_gastos = Math.max(0, char.recursos.feiticeiro.pontos_feiticaria_gastos - qtd);
  return true;
}