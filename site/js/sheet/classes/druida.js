// ============================================================
// Progressao e recursos do Druida
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

function getProgressaoDruida() {
  if (char?.classe !== 'Druida' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    formaSelvagemMax: parseInt(row['Forma Selvagem']) || 0
  };
}

export function getEstadoRecursosDruida() {
  if (char?.classe !== 'Druida') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.druida) {
    char.recursos.druida = {
      forma_selvagem_usos_gastos: 0,
      forma_selvagem_ativa: false,
      companheiro_selvagem_ativo: false,
      ressurgimento_slot_recuperado_hoje: false
    };
  }

  if (typeof char.recursos.druida.forma_selvagem_usos_gastos !== 'number') char.recursos.druida.forma_selvagem_usos_gastos = 0;
  if (typeof char.recursos.druida.forma_selvagem_ativa !== 'boolean') char.recursos.druida.forma_selvagem_ativa = false;
  if (typeof char.recursos.druida.companheiro_selvagem_ativo !== 'boolean') char.recursos.druida.companheiro_selvagem_ativo = false;
  if (typeof char.recursos.druida.ressurgimento_slot_recuperado_hoje !== 'boolean') char.recursos.druida.ressurgimento_slot_recuperado_hoje = false;

  // Subclasses do Druida
  if (!char.recursos.druida.subclasses) char.recursos.druida.subclasses = {};
  // Circulo da Lua
  if (!char.recursos.druida.subclasses.lua) {
    char.recursos.druida.subclasses.lua = { passo_lunar_usos_gastos: 0 };
  }
  if (typeof char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos !== 'number') char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos = 0;
  // Circulo da Terra
  if (!char.recursos.druida.subclasses.terra) {
    char.recursos.druida.subclasses.terra = { recuperacao_natural_magia_usada: false, recuperacao_natural_slots_usada: false };
  }
  if (typeof char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada !== 'boolean') char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada = false;
  if (typeof char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada !== 'boolean') char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada = false;
  // Circulo das Estrelas
  if (!char.recursos.druida.subclasses.estrelas) {
    char.recursos.druida.subclasses.estrelas = { mapa_estelar_usos_gastos: 0, pressagio_cosmico_usos_gastos: 0, pressagio_tipo: '', constelacao_ativa: '' };
  }
  if (typeof char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos !== 'number') char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos = 0;
  if (typeof char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos !== 'number') char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos = 0;
  if (typeof char.recursos.druida.subclasses.estrelas.pressagio_tipo !== 'string') char.recursos.druida.subclasses.estrelas.pressagio_tipo = '';
  if (typeof char.recursos.druida.subclasses.estrelas.constelacao_ativa !== 'string') char.recursos.druida.subclasses.estrelas.constelacao_ativa = '';

  const prog = getProgressaoDruida() || { formaSelvagemMax: 0 };
  const usosDisponiveis = Math.max(0, prog.formaSelvagemMax - char.recursos.druida.forma_selvagem_usos_gastos);
  const modSab = Math.max(1, calcMod(char.atributos?.sabedoria || 10));

  return {
    formaSelvagemAtiva: !!char.recursos.druida.forma_selvagem_ativa,
    companheiroSelvagemAtivo: !!char.recursos.druida.companheiro_selvagem_ativo,
    usosGastos: char.recursos.druida.forma_selvagem_usos_gastos,
    usosMax: prog.formaSelvagemMax,
    usosDisponiveis,
    ressurgimentoSlotRecuperadoHoje: !!char.recursos.druida.ressurgimento_slot_recuperado_hoje,
    arquidruidaAtivo: (char.nivel || 1) >= 20,
    ressurgimentoAtivo: (char.nivel || 1) >= 5,
    // Subclasses - propriedades computadas
    passoLunarMax: modSab,
    passoLunarDisponiveis: Math.max(0, modSab - char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos),
    recuperacaoNaturalMagiaUsada: !!char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada,
    recuperacaoNaturalSlotsUsada: !!char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada,
    mapaEstelarMax: modSab,
    mapaEstelarDisponiveis: Math.max(0, modSab - char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos),
    pressagioMax: modSab,
    pressagioDisponiveis: Math.max(0, modSab - char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos),
    pressagioTipo: char.recursos.druida.subclasses.estrelas.pressagio_tipo || '',
    constelacaoAtiva: char.recursos.druida.subclasses.estrelas.constelacao_ativa || ''
  };
}

export function consumirUsoFormaSelvagem(qtd = 1) {
  const estado = getEstadoRecursosDruida();
  if (!estado || qtd <= 0 || estado.usosDisponiveis < qtd) return false;
  char.recursos.druida.forma_selvagem_usos_gastos += qtd;
  return true;
}

export function recuperarUmUsoFormaSelvagem() {
  const estado = getEstadoRecursosDruida();
  if (!estado || estado.usosDisponiveis >= estado.usosMax) return false;
  char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
  return true;
}