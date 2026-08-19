// ============================================================
// Progressao e recursos do Monge
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { bonusProficiencia, calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

// ============================================================
// Progressão e recursos do Monge
// ============================================================
export function getProgressaoMonge() {
  if (char?.classe !== 'Monge' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  // A tabela do livro traz o dado escrito por inteiro ("1d6", "1d8", "1d10",
  // "1d12"), e o que interessa aqui e o NUMERO DE FACES -- a ficha ja escreve
  // o "1d" na frente. Apagar todo nao-digito colava a quantidade nas faces
  // (1d6 -> 16, 1d10 -> 110) e a ficha exibia "d16" e "cure 1d110 + SAB".
  const dadoStr = String(row['Artes Marciais'] || '1d6');
  const dado = parseInt(dadoStr.match(/d\s*(\d+)/i)?.[1], 10) || 6;
  const pontos = parseInt(row['Pontos de Foco']) || 0;
  const movTexto = String(row['Movimento sem Armadura'] || '—');
  const movMatch = movTexto.match(/[\+]?\s*(\d+(?:[\.,]\d+)?)/);
  const bonusMovimento = movMatch ? parseFloat(movMatch[1].replace(',', '.')) : 0;
  return { dado, pontosMax: pontos, bonusMovimento };
}

export function getEstadoRecursosMonge() {
  if (char?.classe !== 'Monge') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.monge) {
    char.recursos.monge = {
      pontos_foco_gastos: 0,
      metabolismo_usado: false
    };
  }

  const r = char.recursos.monge;
  if (typeof r.pontos_foco_gastos !== 'number') r.pontos_foco_gastos = 0;
  if (typeof r.metabolismo_usado !== 'boolean') r.metabolismo_usado = false;

  const nivel = char.nivel || 1;
  const prog = getProgressaoMonge() || { dado: 6, pontosMax: 0, bonusMovimento: 0 };

  const pontosMax = prog.pontosMax;
  const pontosAtuais = Math.max(0, pontosMax - r.pontos_foco_gastos);

  // CD de Foco: 8 + prof + mod Sabedoria
  const cdFoco = 8 + bonusProficiencia(nivel) + calcMod(char.atributos.sabedoria);

  // Desviar Ataques (nível 3+): 1d10 + mod Des + nível
  const desviarAtivo = nivel >= 3;
  const desviarReducao = `1d10 + ${calcMod(char.atributos.destreza)} + ${nivel}`;

  // Queda Lenta (nível 4+): reduz 5 × nível
  const quedaLentaAtiva = nivel >= 4;
  const quedaReducao = 5 * nivel;

  // Golpe Atordoante (nível 5+)
  const golpeAtordoanteAtivo = nivel >= 5;

  // Evasão (nível 7+)
  const evasaoAtiva = nivel >= 7;

  // Sobrevivente Disciplinado (nível 14+)
  const sobreviventeAtivo = nivel >= 14;

  // Defesa Superior (nível 18+)
  const defesaSuperiorAtiva = nivel >= 18;

  // Subclasses de Monge
  if (!r.subclasses) r.subclasses = {};
  const sub = char.subclasse || '';
  const sabMod = calcMod(char.atributos.sabedoria);
  let subData = {};

  if (sub === 'Combatente da Mão Espalmada') {
    if (!r.subclasses.mao_espalmada) r.subclasses.mao_espalmada = {};
    const s = r.subclasses.mao_espalmada;
    if (typeof s.integridade_usos_gastos !== 'number') s.integridade_usos_gastos = 0;
    if (typeof s.palma_vibrante_ativa !== 'boolean') s.palma_vibrante_ativa = false;
    const integridadeMax = Math.max(1, sabMod);
    subData = {
      integridadeMax,
      integridadeDisponiveis: integridadeMax - s.integridade_usos_gastos,
      integridadeAtiva: nivel >= 6,
      palmaVibranteAtiva: s.palma_vibrante_ativa,
      palmaVibranteNivel: nivel >= 17
    };
  }

  if (sub === 'Combatente da Misericórdia') {
    if (!r.subclasses.misericordia) r.subclasses.misericordia = {};
    const s = r.subclasses.misericordia;
    if (typeof s.torrente_usos_gastos !== 'number') s.torrente_usos_gastos = 0;
    if (typeof s.misericordia_final_usada !== 'boolean') s.misericordia_final_usada = false;
    const torrenteMax = Math.max(1, sabMod);
    subData = {
      torrenteMax,
      torrenteDisponiveis: torrenteMax - s.torrente_usos_gastos,
      torrenteAtiva: nivel >= 11,
      misericordiaFinalUsada: s.misericordia_final_usada,
      misericordiaFinalAtiva: nivel >= 17
    };
  }

  if (sub === 'Combatente dos Elementos') {
    if (!r.subclasses.elementos) r.subclasses.elementos = {};
    const s = r.subclasses.elementos;
    if (typeof s.sintonia_ativa !== 'boolean') s.sintonia_ativa = false;
    subData = {
      sintoniaAtiva: s.sintonia_ativa
    };
  }

  return {
    nivel,
    dadoArtesMarciais: prog.dado,
    pontosMax,
    pontosAtuais,
    pontosGastos: r.pontos_foco_gastos,
    cdFoco,
    bonusMovimento: prog.bonusMovimento,
    desviarAtivo,
    desviarReducao,
    quedaLentaAtiva,
    quedaReducao,
    golpeAtordoanteAtivo,
    evasaoAtiva,
    sobreviventeAtivo,
    defesaSuperiorAtiva,
    metabolismoUsado: r.metabolismo_usado,
    ...subData
  };
}