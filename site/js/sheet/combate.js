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
import { nivelNa, subclasseDe } from '../regras-multiclasse.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { getProgressaoMonge } from './classes/monge.js';
import { char, passivosTalentosCache } from './estado.js';
import { getEstadoCarga } from './inventario.js';

export function ehBardoComSegredosMagicos() {
  // Segredos Magicos e caracteristica de BARDO 10 (Classes.md:472): o
  // nivel que manda e o de Bardo, nao o total do personagem.
  return nivelNa(char, 'Bardo') >= 10;
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
  // Atleta Extraordinario e caracteristica de GUERREIRO/CAMPEAO 3
  // (Classes.md:3892): vale o nivel DE GUERREIRO e a subclasse DO
  // GUERREIRO -- `char.subclasse` e o espelho da classe INICIAL, entao
  // um Ladino/Guerreiro-Campeao lia a subclasse errada.
  if (nomePericia === 'Atletismo' && subclasseDe(char, 'Guerreiro') === 'Campeão'
      && nivelNa(char, 'Guerreiro') >= 3) {
    vantagens.push('Atleta Extraordinario');
  }

  // --- Golias - Forma Grande (nivel 5+, quando ativa): Vantagem em testes de Forca ---
  // NAO CONVERTER para nivelNa(): Forma Grande e traco de ESPECIE, nao
  // de classe, e o livro diz "a partir do nivel 5 DE PERSONAGEM"
  // (Especies.md:212). Especie nao tem "nivel na classe": o numero que
  // manda e o nivel TOTAL (livro:2037), e por isso `char.nivel` esta
  // CERTO aqui. Mesma familia do `pb` de Maos Curativas do Aasimar, que
  // o sub-projeto 3c preservou pelo mesmo motivo.
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

  // Movimento Rapido e caracteristica de BARBARO 5 (Classes.md:127): o
  // nivel que manda e o de Barbaro, nao o total do personagem.
  if (nivelNa(char, 'Bárbaro') >= 5 && !temArmaduraPesadaEquipada()) {
    final += 3;
  }
  // Errante e caracteristica de GUARDIAO 6 (Classes.md:3334): o nivel
  // que manda e o de Guardiao, nao o total do personagem.
  if (nivelNa(char, 'Guardião') >= 6 && !temArmaduraPesadaEquipada()) {
    final += 3;
  }
  // Movimento sem Armadura e caracteristica de MONGE 2
  // (Classes.md:5200): o nivel que manda e o de Monge, nao o total --
  // getProgressaoMonge() ja le a tabela por nivelNa(char, 'Monge').
  if (nivelNa(char, 'Monge') >= 2) {
    const inv = char?.inventario || [];
    const temArmadura = inv.some(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
    const temEscudo = inv.some(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo'));
    if (!temArmadura && !temEscudo) {
      const progMonge = getProgressaoMonge();
      if (progMonge) final += progMonge.bonusMovimento;
    }
  }

  // Paladino Juramento da Glória nível 7: Aura de Vivacidade (+3m para si)
  // Aura de Vivacidade e caracteristica de PALADINO/JURAMENTO DA GLORIA 7
  // (Classes.md:5783): valem o nivel DE PALADINO e a subclasse DO
  // PALADINO, nao o total nem o espelho da classe inicial.
  if (subclasseDe(char, 'Paladino') === 'Juramento da Glória'
      && nivelNa(char, 'Paladino') >= 7) {
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

  // Errante tambem concede Escalada e Natacao iguais ao Deslocamento --
  // GUARDIAO 6 (Classes.md:3334), pelo nivel DE GUARDIAO.
  if (nivelNa(char, 'Guardião') >= 6 && !temArmaduraPesadaEquipada()) {
    addExtraVelocidade(extras, 'Escalada', final);
    addExtraVelocidade(extras, 'Natação', final);
  }

  // Bárbaro Trilha do Coração Selvagem nível 6: Aspecto dos Selvagens
  const aspectoSelvagem = char?.recursos?.aspecto_selvagem;
  // Aspecto dos Selvagens e caracteristica de BARBARO/TRILHA DO CORACAO
  // SELVAGEM 6 (Classes.md:265): valem o nivel DE BARBARO e a subclasse
  // DO BARBARO, nao o total nem o espelho da classe inicial.
  if (subclasseDe(char, 'Bárbaro') === 'Trilha do Coração Selvagem'
      && nivelNa(char, 'Bárbaro') >= 6) {
    if (aspectoSelvagem === 'Pantera') addExtraVelocidade(extras, 'Escalada', final);
    if (aspectoSelvagem === 'Salmão') addExtraVelocidade(extras, 'Natação', final);
  }

  // Bárbaro Trilha do Coração Selvagem nível 14: Voo (Falcão) durante Fúria sem armadura
  const emFuria = !!char?.recursos?.furia_ativa;
  const animalFuria = char?.recursos?.furia_animal;
  const temQualquerArmaduraEquipada = (char?.inventario || []).some(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
  // Poder dos Selvagens e caracteristica de BARBARO/TRILHA DO CORACAO
  // SELVAGEM 14 (Classes.md:279): a opcao Falcao da Voo igual ao
  // Deslocamento sem armadura. Conta pelo nivel DE BARBARO.
  if (subclasseDe(char, 'Bárbaro') === 'Trilha do Coração Selvagem'
      && nivelNa(char, 'Bárbaro') >= 14
      && emFuria && animalFuria === 'Falcão' && !temQualquerArmaduraEquipada) {
    addExtraVelocidade(extras, 'Voo', final);
  }

  // Bárbaro Trilha do Fanático nível 14: Voo (pairar) durante Fúria dos Deuses
  const furiaDeusesAtiva = !!char?.recursos?.furia_deuses_ativa;
  // Furia dos Deuses e caracteristica de BARBARO/TRILHA DO FANATICO 14
  // (Classes.md:319): concede Voo com pairar. Conta pelo nivel DE
  // BARBARO e pela subclasse DO BARBARO.
  if (subclasseDe(char, 'Bárbaro') === 'Trilha do Fanático'
      && nivelNa(char, 'Bárbaro') >= 14
      && emFuria && furiaDeusesAtiva) {
    addExtraVelocidade(extras, 'Voo', final, '(pairar)');
  }

  // Ladino Ladrão nível 3: Andarilho de Telhados (Escalada = deslocamento)
  // Andarilho de Telhados e caracteristica de LADINO/LADRAO 3
  // (Classes.md:4413): valem o nivel DE LADINO e a subclasse DO LADINO,
  // nao o total nem o espelho da classe inicial.
  if (subclasseDe(char, 'Ladino') === 'Ladrão' && nivelNa(char, 'Ladino') >= 3) {
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

/**
 * Numero de ataques que o personagem faz com a acao Ataque.
 *
 * livro:2059-2063 -- as caracteristicas de Ataque Extra NAO se acumulam:
 * vale a MAIOR entre as classes, e cada classe conta pelo nivel NAQUELA
 * classe. O codigo antigo lia os ESPELHOS da classe inicial
 * (`char.classe`, `char.subclasse`) cruzados com o nivel TOTAL
 * (`char.nivel`), e errava nos dois sentidos: inflava (Guerreiro
 * 4/Barbaro 1, total 5, ganhava 2 ataques sem nenhuma classe no 5) e
 * apagava (Ladino 1/Guerreiro 11 recebia 1 em vez de 3, porque a inicial
 * nao era Guerreiro).
 * @returns {number} 1 a 4.
 */
export function getAtaquesPorAcao() {
  // O Guerreiro e a unica classe com mais de um patamar: Ataque Extra no
  // 5, Dois Ataques Extras no 11 e Tres Ataques Extras no 20.
  const nGuerreiro = nivelNa(char, 'Guerreiro');
  let ataques = 1;
  if (nGuerreiro >= 20) ataques = 4;
  else if (nGuerreiro >= 11) ataques = 3;
  else if (nGuerreiro >= 5) ataques = 2;

  // As demais fontes valem 2 e nunca somam -- por isso Math.max, nunca +=.
  for (const classe of ['Bárbaro', 'Guardião', 'Paladino', 'Monge']) {
    if (nivelNa(char, classe) >= 5) ataques = Math.max(ataques, 2);
  }
  // Bardo: so o Colegio da Bravura, e a subclasse tem de ser a DO BARDO,
  // nao o espelho `char.subclasse` (que e o da classe inicial).
  if (subclasseDe(char, 'Bardo') === 'Colégio da Bravura'
      && nivelNa(char, 'Bardo') >= 6) ataques = Math.max(ataques, 2);

  // Bruxo: a invocacao Lamina Sedenta (Classes.md:1002-1006, Bruxo 5 +
  // Pacto da Lamina) concede Ataque Extra a arma de pacto, e Lamina
  // Devoradora (Classes.md:996-1000, Bruxo 12) sobe esse mesmo Ataque
  // Extra para DOIS ataques extras -- 3 no total, como a Dois Ataques
  // Extras do Guerreiro. Math.max, nunca +=: o livro:2063 e explicito
  // que a Lamina Sedenta "nao oferece ataques adicionais se voce ja
  // tiver Ataque Extra". A restricao ja era satisfeita por vacuidade
  // enquanto a invocacao nao entrava aqui; o que faltava era o caso
  // simples -- um Bruxo 5 de CLASSE UNICA com a invocacao mostrava 1
  // ataque em vez de 2.
  //
  // RESSALVA CONHECIDA, a mesma das outras fontes desta funcao: o numero
  // vale para a ARMA DE PACTO, e a ficha exibe um so "Ataques" para
  // qualquer arma. Nao ha campo de "arma equipada e a de pacto?" para
  // consultar; exibir o teto e o mesmo criterio ja usado para Monge e
  // Barbaro.
  const invocacoesBruxo = (char.recursos?.bruxo?.invocacoes || [])
    .map((i) => (typeof i === 'string' ? i : i?.nome));
  if (invocacoesBruxo.includes('Lâmina Sedenta') && nivelNa(char, 'Bruxo') >= 5) {
    ataques = Math.max(ataques, 2);
    if (invocacoesBruxo.includes('Lâmina Devoradora') && nivelNa(char, 'Bruxo') >= 12) {
      ataques = Math.max(ataques, 3);
    }
  }

  return ataques;
}

export function getModIniciativa() {
  const base = calcMod(char.atributos.destreza);
  const passivos = passivosTalentosCache || {};
  // Duas fontes de Vantagem em Iniciativa, cada uma pelo nivel NA SUA
  // classe: Instintos Primitivos, de BARBARO 7 (Classes.md:135 -- o
  // comentario antigo o chamava de "Instinto Selvagem", nome que o livro
  // 2024 nao usa), e Atleta Extraordinario, de GUERREIRO/CAMPEAO 3
  // (Classes.md:3892). A subclasse tem de ser a DO GUERREIRO, nao o
  // espelho da classe inicial.
  const vantagem = nivelNa(char, 'Bárbaro') >= 7
    || (subclasseDe(char, 'Guerreiro') === 'Campeão' && nivelNa(char, 'Guerreiro') >= 3);
  return { valor: base + (passivos.bonusIniciativa || 0), vantagem };
}

export function forcaPrimordialAtiva() {
  // Conhecimento Primordial e caracteristica de BARBARO 3
  // (Classes.md:109): durante a Furia, pericias escolhidas podem ser
  // testadas como Forca. O nivel que manda e o de Barbaro.
  return nivelNa(char, 'Bárbaro') >= 3;
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