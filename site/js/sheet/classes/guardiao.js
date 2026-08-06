// ============================================================
// Progressao e recursos do Guardiao
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

function getProgressaoGuardiao() {
  if (char?.classe !== 'Guardião' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    inimigoFavoritoMax: parseInt(row['Inimigo Favorito']) || 0
  };
}

export function getEstadoRecursosGuardiao() {
  if (char?.classe !== 'Guardião') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.guardiao) {
    char.recursos.guardiao = {
      inimigo_favorito_usos_gastos: 0,
      marca_predador_ativa: false,
      incansavel_usos_gastos: 0,
      veu_natureza_usos_gastos: 0
    };
  }

  const r = char.recursos.guardiao;
  if (typeof r.inimigo_favorito_usos_gastos !== 'number') r.inimigo_favorito_usos_gastos = 0;
  if (typeof r.marca_predador_ativa !== 'boolean') r.marca_predador_ativa = false;
  if (typeof r.incansavel_usos_gastos !== 'number') r.incansavel_usos_gastos = 0;
  if (typeof r.veu_natureza_usos_gastos !== 'number') r.veu_natureza_usos_gastos = 0;
  if (typeof char.exaustao !== 'number') char.exaustao = 0;

  // Subclasses do Guardião
  if (!r.subclasses) r.subclasses = {};
  // Andarilho Feérico
  if (!r.subclasses.andarilho) {
    r.subclasses.andarilho = { reforcos_feericos_usado: false, andarilho_nebuloso_usos_gastos: 0 };
  }
  if (typeof r.subclasses.andarilho.reforcos_feericos_usado !== 'boolean') r.subclasses.andarilho.reforcos_feericos_usado = false;
  if (typeof r.subclasses.andarilho.andarilho_nebuloso_usos_gastos !== 'number') r.subclasses.andarilho.andarilho_nebuloso_usos_gastos = 0;
  // Caçador
  if (!r.subclasses.cacador) {
    r.subclasses.cacador = { presa_escolha: '', taticas_escolha: '' };
  }
  if (typeof r.subclasses.cacador.presa_escolha !== 'string') r.subclasses.cacador.presa_escolha = '';
  if (typeof r.subclasses.cacador.taticas_escolha !== 'string') r.subclasses.cacador.taticas_escolha = '';
  // Senhor das Feras
  if (!r.subclasses.feras) {
    r.subclasses.feras = { companheiro_tipo: '' };
  }
  if (typeof r.subclasses.feras.companheiro_tipo !== 'string') r.subclasses.feras.companheiro_tipo = '';
  // Vigilante das Sombras
  if (!r.subclasses.vigilante) {
    r.subclasses.vigilante = { golpe_terrivel_usos_gastos: 0 };
  }
  if (typeof r.subclasses.vigilante.golpe_terrivel_usos_gastos !== 'number') r.subclasses.vigilante.golpe_terrivel_usos_gastos = 0;

  const prog = getProgressaoGuardiao() || { inimigoFavoritoMax: 0 };
  const modSab = Math.max(1, calcMod(char.atributos.sabedoria));
  const nivel = char.nivel || 1;

  const inimigoFavoritoDisponiveis = Math.max(0, prog.inimigoFavoritoMax - r.inimigo_favorito_usos_gastos);
  const incansavelDisponiveis = Math.max(0, modSab - r.incansavel_usos_gastos);
  const veuDisponiveis = Math.max(0, modSab - r.veu_natureza_usos_gastos);

  return {
    nivel,
    modSab,
    inimigoFavoritoMax: prog.inimigoFavoritoMax,
    inimigoFavoritoDisponiveis,
    marcaPredadorAtiva: !!r.marca_predador_ativa,
    marcaPredadorDado: nivel >= 20 ? 'd10' : 'd6',
    incansavelAtivo: nivel >= 10,
    incansavelMax: modSab,
    incansavelDisponiveis,
    predadorImplacavelAtivo: nivel >= 13,
    veuNaturezaAtivo: nivel >= 14,
    veuNaturezaMax: modSab,
    veuNaturezaDisponiveis: veuDisponiveis,
    cacadorPrecisoAtivo: nivel >= 17,
    sentidosSelvagensAtivo: nivel >= 18,
    exaustao: Math.max(0, char.exaustao || 0),
    // Subclasses - propriedades computadas
    reforcosFeericosUsado: !!r.subclasses.andarilho.reforcos_feericos_usado,
    andarilhoNebulosoMax: modSab,
    andarilhoNebulosoDisponiveis: Math.max(0, modSab - r.subclasses.andarilho.andarilho_nebuloso_usos_gastos),
    presaCacadorEscolha: r.subclasses.cacador.presa_escolha || '',
    taticasDefensivasEscolha: r.subclasses.cacador.taticas_escolha || '',
    companheiroTipo: r.subclasses.feras.companheiro_tipo || '',
    golpeTerrivelMax: modSab,
    golpeTerrivelDisponiveis: Math.max(0, modSab - r.subclasses.vigilante.golpe_terrivel_usos_gastos)
  };
}