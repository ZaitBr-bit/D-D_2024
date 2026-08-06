// ============================================================
// Progressao e recursos do Clerigo
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

export function getProgressaoClerigo() {
  if (char?.classe !== 'Clérigo' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    canalizarDivindadeMax: parseInt(row['Canalizar Divindade']) || 0
  };
}

export function getEstadoRecursosClerigo() {
  if (char?.classe !== 'Clérigo') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.clerigo) char.recursos.clerigo = {};

  const prog = getProgressaoClerigo() || { canalizarDivindadeMax: 0 };
  if (typeof char.recursos.clerigo.canalizar_divindade_usos_gastos !== 'number') {
    char.recursos.clerigo.canalizar_divindade_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.intervencao_divina_bloqueada !== 'boolean') {
    char.recursos.clerigo.intervencao_divina_bloqueada = false;
  }
  if (typeof char.recursos.clerigo.intervencao_divina_descansos_restantes !== 'number') {
    char.recursos.clerigo.intervencao_divina_descansos_restantes = 0;
  }
  if (!char.recursos.clerigo.subclasses) {
    char.recursos.clerigo.subclasses = {
      guerra: {
        sacerdote_guerra_usos_gastos: 0
      },
      luz: {
        labareda_protetora_usos_gastos: 0,
        coroa_luz_usos_gastos: 0
      },
      trapaca: {
        bencao_trapaceiro_ativa: false,
        invocar_duplicidade_ativa: false
      },
      vida: {}
    };
  }

  if (typeof char.recursos.clerigo.subclasses?.guerra?.sacerdote_guerra_usos_gastos !== 'number') {
    char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.subclasses?.luz?.labareda_protetora_usos_gastos !== 'number') {
    char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.subclasses?.luz?.coroa_luz_usos_gastos !== 'number') {
    char.recursos.clerigo.subclasses.luz.coroa_luz_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.subclasses?.trapaca?.bencao_trapaceiro_ativa !== 'boolean') {
    char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa = false;
  }
  if (typeof char.recursos.clerigo.subclasses?.trapaca?.invocar_duplicidade_ativa !== 'boolean') {
    char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = false;
  }

  const usosDisponiveis = Math.max(0, prog.canalizarDivindadeMax - char.recursos.clerigo.canalizar_divindade_usos_gastos);

  return {
    canalizarDivindadeMax: prog.canalizarDivindadeMax,
    canalizarDivindadeUsosGastos: char.recursos.clerigo.canalizar_divindade_usos_gastos,
    canalizarDivindadeUsosDisponiveis: usosDisponiveis,
    intervencaoDivinaBloqueada: !!char.recursos.clerigo.intervencao_divina_bloqueada,
    intervencaoDivinaDescansosRestantes: char.recursos.clerigo.intervencao_divina_descansos_restantes
  };
}

export function getEstadoSubclassesClerigo() {
  if (char?.classe !== 'Clérigo') return null;
  const estado = getEstadoRecursosClerigo();
  if (!estado) return null;

  const modSab = Math.max(1, calcMod(char.atributos.sabedoria));
  const sub = char.recursos.clerigo.subclasses;

  const sacerdoteMax = modSab;
  const sacerdoteGastos = sub.guerra.sacerdote_guerra_usos_gastos;

  const labaredaMax = modSab;
  const labaredaGastos = sub.luz.labareda_protetora_usos_gastos;

  const coroaMax = modSab;
  const coroaGastos = sub.luz.coroa_luz_usos_gastos;

  return {
    guerra: {
      sacerdoteUsosMax: sacerdoteMax,
      sacerdoteUsosGastos: sacerdoteGastos,
      sacerdoteUsosDisponiveis: Math.max(0, sacerdoteMax - sacerdoteGastos)
    },
    luz: {
      labaredaUsosMax: labaredaMax,
      labaredaUsosGastos: labaredaGastos,
      labaredaUsosDisponiveis: Math.max(0, labaredaMax - labaredaGastos),
      coroaUsosMax: coroaMax,
      coroaUsosGastos: coroaGastos,
      coroaUsosDisponiveis: Math.max(0, coroaMax - coroaGastos)
    },
    trapaca: {
      bencaoTrapaceiroAtiva: !!sub.trapaca.bencao_trapaceiro_ativa,
      invocarDuplicidadeAtiva: !!sub.trapaca.invocar_duplicidade_ativa
    }
  };
}