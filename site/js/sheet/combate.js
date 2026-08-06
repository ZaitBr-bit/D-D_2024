// ============================================================
// Deslocamento, ataques, iniciativa e pericias
//
// Tambem registra window.mostrarCalculoCarga e
// window.avisarSobrecargaDeslocamento, que o HTML gerado chama por
// onclick inline -- por isso continuam como globais.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { PERICIAS } from '../dados-classes.js';
import { abrirModal, calcMod, escHtml, fmtPeso, getMultiplicadorCarga, toast } from '../utils.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { getProgressaoMonge } from './classes/monge.js';
import { char, passivosTalentosCache } from './estado.js';
import { getEstadoCarga } from './inventario.js';

export function ehBardoComSegredosMagicos() {
  return char?.classe === 'Bardo' && (char?.nivel || 1) >= 10;
}

export function temArmaduraPesadaEquipada() {
  const inv = char?.inventario || [];
  return inv.some(i => i.equipado && i.tipo === 'armadura' && (i.dados?.categoria || '').toLowerCase() === 'pesada');
}

/** Verifica se a armadura equipada impoe Desvantagem em Furtividade */
function armaduraImpoeFurtividadeDesv() {
  const inv = char?.inventario || [];
  return inv.some(i => i.equipado && i.tipo === 'armadura' && i.dados?.furtividade === 'Desvantagem');
}

/**
 * Calcula vantagem/desvantagem para uma pericia especifica.
 * Retorna { vantagens: string[], desvantagens: string[] } com as fontes.
 */
export function calcVantagemDesvantagemPericia(nomePericia) {
  const vantagens = [];
  const desvantagens = [];
  const condicoes = char.condicoes || [];

  // --- Condicoes que impoem Desvantagem em todos os testes de atributo ---
  if (condicoes.includes('Amedrontado')) desvantagens.push('Amedrontado');
  if (condicoes.includes('Envenenado')) desvantagens.push('Envenenado');

  // --- Armadura equipada com Desvantagem em Furtividade ---
  if (nomePericia === 'Furtividade' && armaduraImpoeFurtividadeDesv()) {
    desvantagens.push('Armadura');
  }

  // --- Barbaro em Furia: Vantagem em testes de Forca ---
  const pericia = PERICIAS.find(p => p.nome === nomePericia);
  const emFuria = !!getEstadoFuria()?.ativa;
  if (emFuria && pericia?.atributo === 'Força') {
    vantagens.push('Furia');
  }

  // --- Guerreiro/Campeao nivel 3+: Vantagem em Atletismo ---
  if (nomePericia === 'Atletismo' && char.classe === 'Guerreiro' && char.subclasse === 'Campeão' && (char.nivel || 1) >= 3) {
    vantagens.push('Atleta Extraordinario');
  }

  // --- Golias - Forma Grande (nivel 5+, quando ativa): Vantagem em testes de Forca ---
  if (pericia?.atributo === 'Força' && char.especie === 'Golias' && (char.nivel || 1) >= 5) {
    const usosFormaGrande = char.usos_habilidades?.['Forma Grande'];
    if (usosFormaGrande?.ativa) {
      vantagens.push('Forma Grande');
    }
  }

  // --- Efeitos magicos: bonus_pericia com bonus='vantagem' (Aprimorar Atributo) ---
  const efMag = char.efeitos_magicos || [];
  efMag.forEach(e => {
    if (e.tipo === 'bonus_pericia' && e.bonus === 'vantagem' && e.atributo && pericia?.atributo === e.atributo) {
      vantagens.push(e.nome.replace(/ \(.*\)$/, ''));
    }
  });

  return { vantagens, desvantagens };
}

/**
 * Retorna quantidade de truques extras concedidos pelo Estilo de Luta
 * (Combatente Druídico = +2 truques de Druida, Combatente Abençoado = +2 truques de Clérigo)
 */
export function getTruquesExtraEstiloLuta() {
  const estilo = char?.escolhas_classe?.estilo_luta?.[0] || '';
  if (estilo === 'Combatente Druídico' || estilo === 'Combatente Abençoado') return 2;
  return 0;
}

export function parseMetros(valor, fallback = 9) {
  const txt = String(valor ?? '');
  const m = txt.match(/(\d+(?:[\.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : fallback;
}

export function formatarMetros(valor) {
  return String(valor).replace('.', ',');
}

function addExtraVelocidade(extrasSet, tipo, metros, sufixo = '') {
  extrasSet.add(`${tipo} ${formatarMetros(metros)}m${sufixo ? ` ${sufixo}` : ''}`);
}

// Popup com o cálculo real da capacidade de carga (clique no peso do inventário).
window.mostrarCalculoCarga = function () {
  const forca = char?.atributos?.forca || 0;
  const tamanho = char?.tamanho || 'Médio';
  const mult = getMultiplicadorCarga(tamanho);
  const _c = getEstadoCarga();
  const disp = _c.capacidade - _c.pesoAtual;
  abrirModal('Capacidade de Carga', `
    <div style="font-size:0.9rem;line-height:1.7">
      <div style="font-weight:700;margin-bottom:4px">Cálculo do peso máximo</div>
      <div>Força ${forca} × ${fmtPeso(mult)} (${escHtml(tamanho)}) = <strong>${fmtPeso(_c.capacidade)} kg</strong></div>
      <hr style="border:none;border-top:1px solid var(--border-light);margin:8px 0">
      <div>Peso atual: <strong>${fmtPeso(_c.pesoAtual)} kg</strong></div>
      <div>${disp >= 0
        ? `Disponível: <strong>${fmtPeso(disp)} kg</strong>`
        : `<span style="color:var(--danger);font-weight:700">&#9888; Excede em ${fmtPeso(-disp)} kg</span>`}</div>
    </div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>');
};

// Aviso ao clicar no Deslocamento quando reduzido por sobrecarga de peso.
window.avisarSobrecargaDeslocamento = function () {
  const _c = getEstadoCarga();
  toast(`Deslocamento reduzido a 1,5 m: sobrecarga de peso (carga ${fmtPeso(_c.pesoAtual)} kg acima da capacidade de ${fmtPeso(_c.capacidade)} kg).`, 'info');
};

export function getDeslocamentoFinal(baseDeslocamento) {
  let final = parseMetros(baseDeslocamento, 9);

  // ── Fase 1: ajustes de valor base ──────────────────────────────────
  // Elfo Silvestre: deslocamento base mínimo de 10,5m
  if (char?.especie === 'Elfo' && (char?.tracos_escolhidos || []).includes('Elfo Silvestre')) {
    final = Math.max(final, 10.5);
  }

  if (char?.classe === 'Bárbaro' && (char?.nivel || 1) >= 5 && !temArmaduraPesadaEquipada()) {
    final += 3;
  }
  if (char?.classe === 'Guardião' && (char?.nivel || 1) >= 6 && !temArmaduraPesadaEquipada()) {
    final += 3;
  }
  if (char?.classe === 'Monge' && (char?.nivel || 1) >= 2) {
    const inv = char?.inventario || [];
    const temArmadura = inv.some(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
    const temEscudo = inv.some(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo'));
    if (!temArmadura && !temEscudo) {
      const progMonge = getProgressaoMonge();
      if (progMonge) final += progMonge.bonusMovimento;
    }
  }

  // Paladino Juramento da Glória nível 7: Aura de Vivacidade (+3m para si)
  if (char?.classe === 'Paladino' && char?.subclasse === 'Juramento da Glória' && (char?.nivel || 1) >= 7) {
    final += 3;
  }

  // Bônus de deslocamento de talentos (resolvido centralmente)
  const passivos = passivosTalentosCache || {};
  final += passivos.bonusDeslocamento || 0;

  if (char?.exaustao > 0) {
    final -= 1.5 * char.exaustao;
    if (final < 0) final = 0;
  }

  const efMag = char?.efeitos_magicos || [];
  for (const ef of efMag) {
    if (ef.tipo === 'deslocamento' && ef.tipo_velocidade === 'base_bonus' && ef.valor_metros) {
      final += ef.valor_metros;
    }
  }

  // Sobrecarga de peso (opcional, padrão desligado): carga acima da
  // capacidade de carregar limita o deslocamento a no máximo 1,5 m.
  if (char?.config?.sobrecarga_afeta_deslocamento) {
    const _carga = getEstadoCarga();
    if (_carga.sobrecarregado) {
      final = Math.min(final, 1.5);
    }
  }

  // ── Fase 2: velocidades derivadas (dependem de final) ──────────────
  const extras = new Set();

  if (char?.classe === 'Guardião' && (char?.nivel || 1) >= 6 && !temArmaduraPesadaEquipada()) {
    addExtraVelocidade(extras, 'Escalada', final);
    addExtraVelocidade(extras, 'Natação', final);
  }

  // Bárbaro Trilha do Coração Selvagem nível 6: Aspecto dos Selvagens
  const aspectoSelvagem = char?.recursos?.aspecto_selvagem;
  if (char?.classe === 'Bárbaro' && char?.subclasse === 'Trilha do Coração Selvagem' && (char?.nivel || 1) >= 6) {
    if (aspectoSelvagem === 'Pantera') addExtraVelocidade(extras, 'Escalada', final);
    if (aspectoSelvagem === 'Salmão') addExtraVelocidade(extras, 'Natação', final);
  }

  // Bárbaro Trilha do Coração Selvagem nível 14: Voo (Falcão) durante Fúria sem armadura
  const emFuria = !!char?.recursos?.furia_ativa;
  const animalFuria = char?.recursos?.furia_animal;
  const temQualquerArmaduraEquipada = (char?.inventario || []).some(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
  if (char?.classe === 'Bárbaro' && char?.subclasse === 'Trilha do Coração Selvagem' && (char?.nivel || 1) >= 14
      && emFuria && animalFuria === 'Falcão' && !temQualquerArmaduraEquipada) {
    addExtraVelocidade(extras, 'Voo', final);
  }

  // Bárbaro Trilha do Fanático nível 14: Voo (pairar) durante Fúria dos Deuses
  const furiaDeusesAtiva = !!char?.recursos?.furia_deuses_ativa;
  if (char?.classe === 'Bárbaro' && char?.subclasse === 'Trilha do Fanático' && (char?.nivel || 1) >= 14
      && emFuria && furiaDeusesAtiva) {
    addExtraVelocidade(extras, 'Voo', final, '(pairar)');
  }

  // Ladino Ladrão nível 3: Andarilho de Telhados (Escalada = deslocamento)
  if (char?.classe === 'Ladino' && char?.subclasse === 'Ladrão' && (char?.nivel || 1) >= 3) {
    addExtraVelocidade(extras, 'Escalada', final);
  }

  for (const ef of efMag) {
    if (ef.tipo === 'deslocamento') {
      if (ef.tipo_velocidade === 'voo' && ef.valor_metros) {
        addExtraVelocidade(extras, 'Voo', ef.valor_metros);
      } else if (ef.tipo_velocidade === 'escalada') {
        addExtraVelocidade(extras, 'Escalada', final); // escalada = igual ao deslocamento final (ef.valor_metros ignorado intencionalmente)
      } else if (ef.tipo_velocidade === 'levitacao' && ef.valor_metros) {
        addExtraVelocidade(extras, 'Levitação', ef.valor_metros);
      }
    }
  }

  let resultado = `${formatarMetros(final)} metros`;
  if (extras.size > 0) resultado += ` (${[...extras].join(', ')})`;
  return resultado;
}

export function getAtaquesPorAcao() {
  const nivel = char?.nivel || 1;
  if (char?.classe === 'Guerreiro') {
    if (nivel >= 20) return 4;
    if (nivel >= 11) return 3;
    if (nivel >= 5) return 2;
  }
  if (char?.classe === 'Bárbaro' && nivel >= 5) return 2;
  if (char?.classe === 'Guardião' && nivel >= 5) return 2;
  if (char?.classe === 'Paladino' && nivel >= 5) return 2;
  if (char?.classe === 'Monge' && nivel >= 5) return 2;
  if (char?.classe === 'Bardo' && char?.subclasse === 'Colégio da Bravura' && nivel >= 6) return 2;
  return 1;
}

export function getModIniciativa() {
  const base = calcMod(char.atributos.destreza);
  const passivos = passivosTalentosCache || {};
  // Bárbaro nível 7+ (Instinto Selvagem) ou Guerreiro/Campeão nível 3+ (Atleta Extraordinário)
  const vantagem = (char?.classe === 'Bárbaro' && (char?.nivel || 1) >= 7)
    || (char?.classe === 'Guerreiro' && char?.subclasse === 'Campeão' && (char?.nivel || 1) >= 3);
  return { valor: base + (passivos.bonusIniciativa || 0), vantagem };
}

export function forcaPrimordialAtiva() {
  return char?.classe === 'Bárbaro' && (char?.nivel || 1) >= 3;
}

export function ataqueImprudenteAtivo() {
  return !!char?.recursos?.ataque_imprudente_ativo;
}

/** Setup de eventos para badges de Vantagem/Desvantagem (toque mobile) */
export function setupEventosVantagemDesvantagem() {
  document.querySelectorAll('[data-vd-info]').forEach(el => {
    el.addEventListener('click', () => {
      toast(el.dataset.vdInfo, 'info');
    });
  });
}