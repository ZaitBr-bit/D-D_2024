// ============================================================
// Pontos de vida, dados de vida e descansos
//
// Inclui o seletor numerico usado nos controles de PV e a restauracao
// de recursos por descanso curto e longo, que toca todas as classes.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { restaurarRecursosTalentos } from '../regras-cobertura.js';
import { gastarDadosVida, nivelNa, reservasDadosVida, restaurarTodosDadosVida, subclasseDe, temClasse } from '../regras-multiclasse.js';
import { trocaNoDescansoLongo } from '../regras-preparo-magias.js';
import { removerPersonagem } from '../store.js';
import { abrirModal, calcMod, detectarRecarga, escHtml, getEspacosMagia, semAcento, toast } from '../utils.js';
import { gerarTracoSinteticoEspecie } from './caracteristicas.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { getEstadoRecursosBruxo, recuperarEspacosMagiaBruxo } from './classes/bruxo.js';
import { getEstadoRecursosClerigo } from './classes/clerigo.js';
import { getEstadoRecursosDruida, recuperarUmUsoFormaSelvagem } from './classes/druida.js';
import { getEstadoRecursosFeiticeiro } from './classes/feiticeiro.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { getEstadoRecursosGuerreiro } from './classes/guerreiro.js';
import { getEstadoRecursosLadino } from './classes/ladino.js';
import { getEstadoRecursosMago } from './classes/mago.js';
import { getEstadoRecursosMonge } from './classes/monge.js';
import { getEstadoRecursosPaladino } from './classes/paladino.js';
import { contextosDeClasse } from './contexto-classe.js';
import { char, classeData, especiesCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { mostrarTrocaMagiaConhecida, mostrarTrocaTruque, truquesTrocaveis } from './grimorio.js';
import { abrirModalTrocaMaestriaDescanso, classesComMaestria, trocaTodasNoDescanso } from './maestrias.js';
import { ehSubclasseConjuradora, getConcentracaoAtiva, magiaContaNoLimite } from './magias.js';

/**
 * Sincroniza o bonus de PV da Resiliencia Draconica (Feiticeiro).
 *
 * DUAS correcoes num lugar so, e as duas sao do livro:
 *
 * 1. FONTE. `char.classe`/`char.subclasse`/`char.nivel` sao espelhos da
 *    classe INICIAL, entao num Mago 5/Feiticeiro 5 (Draconica) o bonus
 *    SUMIA inteiro (a subclasse do Mago e ""), e num Feiticeiro
 *    5/Mago 5 valia 12 (o nivel TOTAL). O que manda e o nivel NA CLASSE.
 *
 * 2. FORMULA. Classes.md:3074 diz "aumentam em 3, e aumentam em 1 sempre
 *    que voce atinge outro nivel de Feiticeiro" -- ou seja +3 no nivel 3
 *    e +1 por nivel depois, que da +N no nivel N. O app calculava N+2.
 *    Isso e divergencia de CLASSE UNICA, anterior a multiclasse; corrigir
 *    junto evita escrever a formula errada com uma fonte nova. Feiticeiros
 *    Draconicos existentes perdem 2 PV -- esta na nota de versao 2.2.21, e
 *    bonus_pv_aplicado reconcilia sozinho no proximo render.
 */
export function sincronizarBonusPvDraconico() {
  if (!temClasse(char, 'Feiticeiro')) return;
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) return;

  const ehDraconica = semAcento(subclasseDe(char, 'Feiticeiro')) === semAcento('Feitiçaria Dracônica');
  const nivelFeiticeiro = nivelNa(char, 'Feiticeiro');
  const esperado = ehDraconica && nivelFeiticeiro >= 3 ? nivelFeiticeiro : 0;
  const aplicado = char.recursos.feiticeiro.subclasses.draconica.bonus_pv_aplicado || 0;

  if (esperado === aplicado) return;

  const diff = esperado - aplicado;
  char.pv_max = Math.max(1, (char.pv_max || 1) + diff);
  char.pv_atual = Math.max(0, Math.min((char.pv_max_override || char.pv_max), (char.pv_atual || 0) + diff));
  char.recursos.feiticeiro.subclasses.draconica.bonus_pv_aplicado = esperado;
  salvar();
}

/** Sincroniza bonus de PV da Tenacidade Anã (+1 por nivel) */
export function sincronizarBonusPvAnao() {
  const ehAnao = char?.especie === 'Anão';
  const esperado = ehAnao ? (char.nivel || 1) : 0;
  const aplicado = char.bonus_pv_anao_aplicado || 0;

  if (esperado === aplicado) return;

  const diff = esperado - aplicado;
  char.pv_max = Math.max(1, (char.pv_max || 1) + diff);
  char.pv_atual = Math.max(0, Math.min((char.pv_max_override || char.pv_max), (char.pv_atual || 0) + diff));
  char.bonus_pv_anao_aplicado = esperado;
  salvar();
}

/** Sincroniza bonus de PV do talento Vigoroso (+2 por nivel) */
export function sincronizarBonusPvVigoroso() {
  const temVigoroso = (char.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Vigoroso');
  const esperado = temVigoroso ? (char.nivel || 1) * 2 : 0;
  const aplicado = char.bonus_pv_vigoroso_aplicado || 0;

  if (esperado === aplicado) return;

  const diff = esperado - aplicado;
  char.pv_max = Math.max(1, (char.pv_max || 1) + diff);
  char.pv_atual = Math.max(0, Math.min((char.pv_max_override || char.pv_max), (char.pv_atual || 0) + diff));
  char.bonus_pv_vigoroso_aplicado = esperado;
  salvar();
}

// --- HP e Dados de Vida ---

/** Gera HTML para seletor numérico com rolagem (estilo alarme iPhone) */
export function numberPickerHtml(id, valor, min, max, label) {
  // Limitar itens no picker para performance (campo manual cobre valores maiores)
  const pickerMax = Math.min(max, min + 49);
  const items = [];
  for (let i = min; i <= pickerMax; i++) items.push(i);

  return `
    <div class="form-group" style="text-align:center">
      <label class="form-label">${label}</label>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px">
        <div class="scroll-picker-wrapper" id="${id}-wrapper">
          <div class="scroll-picker-fade-top"></div>
          <div class="scroll-picker-highlight"></div>
          <div class="scroll-picker-fade-bottom"></div>
          <div class="scroll-picker-list" id="${id}-list">
            <div class="scroll-picker-spacer"></div>
            ${items.map(i => `<div class="scroll-picker-item" data-value="${i}">${i}</div>`).join('')}
            <div class="scroll-picker-spacer"></div>
          </div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase">ou digite</div>
          <input type="number" class="form-input" id="${id}-manual"
            min="${min}" max="${max}" value="${valor}"
            style="width:80px;text-align:center;font-size:1.1rem;font-weight:700;padding:8px">
        </div>
      </div>
      <input type="hidden" id="${id}-val" value="${valor}" data-min="${min}" data-max="${max}">
    </div>
  `;
}

/** Configura eventos do scroll picker */
export function setupNumberPicker(id) {
  const list = document.getElementById(`${id}-list`);
  const input = document.getElementById(`${id}-val`);
  const manual = document.getElementById(`${id}-manual`);
  if (!list || !input) return;

  const items = list.querySelectorAll('.scroll-picker-item');
  if (items.length === 0) return;

  const itemHeight = 40;
  const min = parseInt(input.dataset.min) || 0;
  const max = parseInt(input.dataset.max) || 999;
  const valor = parseInt(input.value) || min;

  // Posicionar no valor inicial
  const idxInicial = Math.min(Math.max(0, valor - min), items.length - 1);
  requestAnimationFrame(() => {
    list.scrollTop = idxInicial * itemHeight;
    atualizarDestaque(idxInicial);
  });

  // Atualizar ao scrollar
  let scrollRaf;
  list.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const idx = Math.round(list.scrollTop / itemHeight);
      const clampedIdx = Math.max(0, Math.min(idx, items.length - 1));
      const val = Math.min(max, Math.max(min, min + clampedIdx));
      input.value = val;
      if (manual && document.activeElement !== manual) manual.value = val;
      atualizarDestaque(clampedIdx);
    });
  });

  // Input manual (secundário)
  if (manual) {
    manual.addEventListener('change', () => {
      let val = parseInt(manual.value);
      if (isNaN(val)) return;
      val = Math.min(max, Math.max(min, val));
      manual.value = val;
      input.value = val;
      const idx = val - min;
      if (idx >= 0 && idx < items.length) {
        list.scrollTop = idx * itemHeight;
        atualizarDestaque(idx);
      }
    });
  }

  function atualizarDestaque(selIdx) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selIdx);
    });
  }
}

/**
 * Monta o seletor "De qual reserva?" de Dado de Vida e liga a troca de
 * tipo -- compartilhado pelos modais "Usar DV" (btn-usar-dv) e "Descanso
 * Curto" (btn-descanso-curto), que escolhem de qual reserva gastar quando
 * o personagem tem mais de um tipo de dado de vida (reservasDadosVida,
 * regras-multiclasse.js). Extraído na revisão da Tarefa 3 (Important 3):
 * os dois modais tinham o mesmo bloco -- construtor do HTML, handler de
 * troca e preâmbulo de aplicação -- idêntico em fluxo de controle e
 * expressão por expressão, e as duas cópias já haviam divergido no texto.
 *
 * @param {Array<{faces:number,total:number,usados:number,disponiveis:number}>} reservas
 *   Reservas com disponiveis > 0. reservasDadosVida ordena por faces
 *   DECRESCENTE -- a primeira é o MAIOR DADO, não a maior QUANTIDADE.
 * @param {string} sufixo '' no modal "Usar DV", '-curto' no "Descanso
 *   Curto" -- evita colisão de id entre os dois modais.
 * @param {object} opcoes
 * @param {number} opcoes.modCon Modificador de Constituição, para o texto
 *   "(... + N CON por dado)".
 * @param {boolean} opcoes.comEmoji true no "Usar DV" (🎲 em volta do
 *   dado, travessão na frase em itálico), false no "Descanso Curto" (sem
 *   emoji, hífen) -- diferença de texto herdada de antes do sub-projeto
 *   3e (cada modal já tinha o próprio estilo), preservada aqui em vez de
 *   unificada por decisão deliberada, não por descuido da extração.
 * @param {string} opcoes.labelPicker Rótulo do seletor numérico.
 * @param {number} opcoes.valorInicial Valor inicial do picker (1 no
 *   "Usar DV"; 0 no "Descanso Curto", que permite pular a cura).
 * @param {number} opcoes.minPicker Mínimo do picker (1 e 0, mesmo motivo).
 * @returns {{html: string, faceInicial: number, idPicker: string, ligar: () => object|null}}
 *   `html` vai dentro do corpo do modal. `ligar()` deve ser chamado DEPOIS
 *   de abrirModal() ter inserido esse HTML no DOM (mesma ordem que
 *   setupNumberPicker já segue) -- registra o listener de troca e devolve
 *   o `<select>`, para o chamador ler a reserva escolhida ao aplicar.
 */
function montarSeletorDeReserva(reservas, sufixo, { modCon, comEmoji, labelPicker, valorInicial, minPicker }) {
  const travessao = comEmoji ? '—' : '-';
  const textoDado = (faces) => comEmoji ? `🎲d${faces}🎲` : `d${faces}`;
  const textoRestantes = (r) =>
    `Restantes: ${r.disponiveis} / ${r.total} (${textoDado(r.faces)} + ${modCon} CON por dado)<br>`
    + `<em>Apenas desconta os dados ${travessao} use seus dados reais para cura.</em>`;

  const idSelect = `select-tipo-dv${sufixo}`;
  const idPicker = `input-qtd-dv${sufixo}`;
  const idInfo = `dv-restantes-info${sufixo}`;
  const idSlot = `${idPicker}-picker-slot`;

  // Seletor SO com mais de um tipo -- mesmo precedente do seletor de CA
  // do 3d: com uma candidata so, nada aparece na tela.
  const seletorHtml = reservas.length > 1
    ? `<div style="margin-bottom:8px">
         <label style="font-size:0.8rem;color:var(--text-muted)">De qual reserva?</label>
         <select id="${idSelect}" class="input" style="width:100%">
           ${reservas.map(r => `<option value="${r.faces}">d${r.faces} — ${r.disponiveis} de ${r.total}</option>`).join('')}
         </select>
       </div>`
    : '';

  const faceInicial = reservas[0].faces;
  const maxInicial = reservas[0].disponiveis;

  const html = seletorHtml
    + `<div id="${idSlot}">${numberPickerHtml(idPicker, valorInicial, minPicker, maxInicial, labelPicker)}</div>`
    + `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center" id="${idInfo}">`
    + textoRestantes(reservas[0])
    + `</div>`;

  // Trocar de reserva RE-RENDERIZA o picker inteiro para a nova reserva --
  // não remenda só `campo.max`. O campo oculto que numberPickerHtml gera
  // carrega `data-max` (não `max`); setupNumberPicker lê esse `data-max`
  // UMA VEZ, para dentro do closure dos listeners de scroll e digitação; o
  // campo visível `-manual` tem o próprio `max` renderizado uma vez; e a
  // lista de itens do picker é construída uma vez -- todos para a reserva
  // INICIAL. Como reservasDadosVida ordena por faces DECRESCENTE, a
  // inicial é o MAIOR DADO, não a maior QUANTIDADE: num Clérigo 5/
  // Paladino 3, a inicial é o d10 do Paladino (3 disponíveis) -- sem
  // re-renderizar, trocar para o d8 do Clérigo (5 disponíveis) deixava o
  // teto travado em 3, com dois dados que o jogador possui inalcançáveis
  // pelos dois modais.
  function ligar() {
    const selectTipo = document.getElementById(idSelect);
    selectTipo?.addEventListener('change', () => {
      const r = reservas.find(x => x.faces === Number(selectTipo.value));
      if (!r) return;
      const info = document.getElementById(idInfo);
      if (info) info.innerHTML = textoRestantes(r);

      const valorAtual = parseInt(document.getElementById(`${idPicker}-val`)?.value) || minPicker;
      const slot = document.getElementById(idSlot);
      if (slot) {
        slot.innerHTML = numberPickerHtml(
          idPicker, Math.min(r.disponiveis, Math.max(minPicker, valorAtual)),
          minPicker, r.disponiveis, labelPicker);
        setupNumberPicker(idPicker);
      }
    });
    return selectTipo;
  }

  return { html, faceInicial, idPicker, ligar };
}

export function setupEventosHP() {
  const pvMax = char.pv_max_override || char.pv_max;

  document.getElementById('hp-minus')?.addEventListener('click', () => {
    const furia = getEstadoFuria();
    // temClasse: a Resistencia da Furia e do Barbaro, e `char.classe` e a
    // classe INICIAL -- num Ladino 1/Barbaro 5 com Furia ativa a opcao de
    // resistir sumia do modal de dano.
    const podeResistirFuria = !!(furia?.ativa && temClasse(char, 'Bárbaro'));

    abrirModal('Dano Recebido',
      numberPickerHtml('input-dano', 1, 1, 999, 'Valor do dano') +
      (podeResistirFuria
        ? `<label class="form-check" style="justify-content:center;margin-top:8px">
             <input type="checkbox" id="input-resistencia-furia"> Aplicar Resistência da Fúria (contundente/cortante/perfurante)
           </label>`
        : ''),
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-aplicar-dano">Aplicar Dano</button>'
    );
    setupNumberPicker('input-dano');
    document.getElementById('btn-aplicar-dano')?.addEventListener('click', () => {
      let dano = parseInt(document.getElementById('input-dano-val')?.value) || 0;
      if (dano <= 0) return;

      const aplicarResistenciaFuria = !!document.getElementById('input-resistencia-furia')?.checked;
      if (aplicarResistenciaFuria) {
        dano = Math.floor(dano / 2);
      }

      // Absorver pelo PV temporário primeiro
      if (char.pv_temporario > 0) {
        const absorvido = Math.min(dano, char.pv_temporario);
        char.pv_temporario -= absorvido;
        dano -= absorvido;
      }
      char.pv_atual = Math.max(0, char.pv_atual - dano);
      const estadoGuardiao = getEstadoRecursosGuardiao();
      if (estadoGuardiao?.predadorImplacavelAtivo && estadoGuardiao?.marcaPredadorAtiva && dano > 0) {
        toast('Predador Implacável: sua concentração de Marca do Caçador não é quebrada por dano.', 'info');
      }
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('hp-plus')?.addEventListener('click', () => {
    abrirModal('Cura',
      numberPickerHtml('input-cura', 1, 1, pvMax, 'Valor da cura'),
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-success" id="btn-aplicar-cura">Curar</button>'
    );
    setupNumberPicker('input-cura');
    document.getElementById('btn-aplicar-cura')?.addEventListener('click', () => {
      const cura = parseInt(document.getElementById('input-cura-val')?.value) || 0;
      if (cura <= 0) return;
      char.pv_atual = Math.min(pvMax, char.pv_atual + cura);
      // Reset death saves when healed from 0
      if (char.pv_atual > 0) {
        char.morte_sucessos = 0;
        char.morte_falhas = 0;
      }
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('hp-temp')?.addEventListener('click', () => {
    abrirModal('PV Temporário',
      numberPickerHtml('input-temp', char.pv_temporario || 0, 0, 999, 'Definir PV Temporário') +
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">PV temporário não se acumula. Use o maior valor.</div>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-temp">Aplicar</button>'
    );
    setupNumberPicker('input-temp');
    document.getElementById('btn-aplicar-temp')?.addEventListener('click', () => {
      char.pv_temporario = Math.max(0, parseInt(document.getElementById('input-temp-val')?.value) || 0);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('hp-max-override')?.addEventListener('click', () => {
    const pvBase = char.pv_max;
    const pvAtual = char.pv_max_override || pvBase;
    abrirModal('Sobrescrever PV Máximo',
      `<div style="font-size:0.85rem;color:var(--text-muted);text-align:center;margin-bottom:8px">PV Máximo Base (fixo): <strong>${pvBase}</strong></div>` +
      numberPickerHtml('input-pv-max', pvAtual, 1, Math.max(pvBase + 50, pvAtual + 20), 'PV Máximo Atual') +
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">
          Use para magias que aumentam PV máximo temporariamente (ex: Ajuda, Heróis do Banquete).
        </div>`,
      `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
       <button class="btn btn-warning" id="btn-resetar-pv-max">Resetar</button>
       <button class="btn btn-primary" id="btn-aplicar-pv-max">Aplicar</button>`
    );
    setupNumberPicker('input-pv-max');
    document.getElementById('btn-resetar-pv-max')?.addEventListener('click', () => {
      delete char.pv_max_override;
      char.pv_atual = Math.min(char.pv_atual, char.pv_max);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
    document.getElementById('btn-aplicar-pv-max')?.addEventListener('click', () => {
      const novoMax = parseInt(document.getElementById('input-pv-max-val')?.value) || char.pv_max;
      if (novoMax !== char.pv_max) {
        char.pv_max_override = novoMax;
      } else {
        delete char.pv_max_override;
      }
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('btn-usar-dv')?.addEventListener('click', () => {
    // reservasDadosVida: uma reserva por TIPO de dado (livro:2043). A
    // forma antiga usava o dado da classe INICIAL e o nivel TOTAL, entao
    // um Mago 5/Barbaro 5 recebia 10 dados rotulados d6 -- ele tem 5 d6 e
    // 5 d12. Com UMA reserva o modal e identico ao de antes.
    const reservas = reservasDadosVida(char).filter(r => r.disponiveis > 0);
    if (!reservas.length) { toast('Sem dados de vida restantes', 'error'); return; }
    const modCon = calcMod(char.atributos.constituicao);

    const seletor = montarSeletorDeReserva(reservas, '', {
      modCon, comEmoji: true, labelPicker: 'Quantos dados de vida usar?',
      valorInicial: 1, minPicker: 1,
    });

    abrirModal('Usar Dados de Vida', seletor.html,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-dv">Usar</button>'
    );
    setupNumberPicker(seletor.idPicker);
    const selectTipo = seletor.ligar();

    document.getElementById('btn-aplicar-dv')?.addEventListener('click', () => {
      const faces = Number(selectTipo?.value) || seletor.faceInicial;
      const reserva = reservas.find(r => r.faces === faces) || reservas[0];
      const pedido = Math.max(1, parseInt(document.getElementById(`${seletor.idPicker}-val`)?.value) || 1);
      // gastarDadosVida e o escritor AUTORIZADO: escreve a reserva
      // estruturada E o escalar legado. A forma antiga escrevia so o
      // escalar, que era descartado na sincronizacao seguinte num
      // personagem com dois tipos de dado.
      const qtd = gastarDadosVida(char, reserva.faces, pedido);
      if (!qtd) { toast('Sem dados de vida restantes', 'error'); return; }
      salvar();
      window.fecharModal();
      toast(`${qtd}x 🎲d${reserva.faces}🎲 usado(s). Role os dados e aplique a cura manualmente.`, 'success');
      renderFichaCompleta();
    });
  });

  // Salvaguarda contra morte checkboxes
  document.querySelectorAll('[data-morte-sucesso]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.morteSucesso);
      if (!char.morte_sucessos) char.morte_sucessos = 0;
      char.morte_sucessos = cb.checked ? idx + 1 : idx;
      salvar();
      renderFichaCompleta();
    });
  });
  document.querySelectorAll('[data-morte-falha]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.morteFalha);
      if (!char.morte_falhas) char.morte_falhas = 0;
      char.morte_falhas = cb.checked ? idx + 1 : idx;
      salvar();
      renderFichaCompleta();
    });
  });
}

// --- Descansos ---
// Exportada para o motor de unidade acionar diretamente (sem passar pelo
// clique do botão de descanso) -- ela nunca precisou de escopo de módulo,
// só não havia consumidor fora daqui até este ponto.
export function restaurarHabilidades(tipoDescanso) {
  if (!char.usos_habilidades) return;
  const allFeats = [];
  // contextosDeClasse: um contexto por classe do personagem. A forma
  // antiga lia `classeData`, que estado.js:16-18 documenta como "os dados
  // da classe INICIAL", e filtrava por `char.nivel`, o TOTAL. Num
  // Barbaro 2/Guerreiro 3 as caracteristicas do Guerreiro (Recuperar
  // Folego, Surto de Acao) NUNCA eram recarregadas -- recurso morto, nao
  // numero errado na tela. E o nivel que libera cada caracteristica e o
  // NAQUELA classe (Classes.md amarra toda caracteristica ao nivel da
  // propria classe).
  for (const ctx of contextosDeClasse()) {
    if (!ctx.dados) continue;
    // Caracteristicas da classe
    if (ctx.dados.caracteristicas) {
      ctx.dados.caracteristicas.filter(c => c.nivel <= ctx.nivelClasse).forEach(f => {
        allFeats.push({ key: `classe_${f.nome}`, descricao: f.descricao });
      });
    }
    // Caracteristicas da subclasse DAQUELA classe
    if (ctx.subclasse && ctx.dados.subclasses) {
      const sc = ctx.dados.subclasses.find(s => s.nome === ctx.subclasse);
      if (sc?.caracteristicas) {
        sc.caracteristicas.filter(c => c.nivel <= ctx.nivelClasse).forEach(f => {
          allFeats.push({ key: `subclasse_${f.nome}`, descricao: f.descricao });
        });
      }
    }
  }
  // Coletar traços da espécie
  if (char.especie && especiesCache?.especies) {
    const esp = especiesCache.especies.find(e => e.nome === char.especie);
    if (esp?.tracos) {
      esp.tracos.forEach(t => {
        allFeats.push({ key: `especie_${t.nome}`, descricao: t.descricao });
      });
    }
  }
  // Coletar traços sintéticos da espécie (Tiferino, Elfo, etc.)
  if (char.especie && char.tracos_escolhidos?.length > 0) {
    const tracosSinteticos = gerarTracoSinteticoEspecie(char.especie, char.tracos_escolhidos, char.nivel) || [];
    tracosSinteticos.forEach(t => {
      allFeats.push({ key: `especie_${t.nome}`, descricao: t.descricao });
    });
  }
  // Tracos Golias que herdam recarga "descanso longo" do pai "Ancestralidade Gigante"
  const TRACOS_HERDAM_ANCESTRALIDADE_RESTAURAR = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];

  allFeats.forEach(({ key, descricao }) => {
    let recarga = detectarRecarga(descricao);
    // Tracos de Ancestralidade Gigante nao mencionam recarga na propria descricao
    const nomeTraco = key.startsWith('especie_') ? key.substring(8) : '';
    if (!recarga && TRACOS_HERDAM_ANCESTRALIDADE_RESTAURAR.includes(nomeTraco)) {
      recarga = 'longo';
    }
    if (!recarga) return;
    if (tipoDescanso === 'longo') {
      // Long rest: reset all uses (handle both boolean and numeric tracking)
      char.usos_habilidades[key] = typeof char.usos_habilidades[key] === 'number' ? 0 : false;
    } else if (tipoDescanso === 'curto' && (recarga === 'curto' || recarga === 'curto_ou_longo')) {
      // Descanso curto: restaura todos os usos (mesmo comportamento do longo para habilidades genéricas)
      if (typeof char.usos_habilidades[key] === 'number') {
        char.usos_habilidades[key] = 0;
      } else {
        char.usos_habilidades[key] = false;
      }
    }
  });
}

export function setupEventosDescanso() {
  // Remover efeitos magicos ativos (badges)
  document.querySelectorAll('[data-remover-efeito]').forEach(el => {
    el.addEventListener('click', () => {
      const nome = el.dataset.removerEfeito;
      // Reverter bonus de PV maximo de efeitos compostos (ex: Banquete de Herois)
      const efsPVMax = (char.efeitos_magicos || []).filter(e => {
        const base = e.nome.replace(/ \(.*\)$/, '');
        return base === nome && e.tipo === 'bonus_pv_max';
      });
      for (const ef of efsPVMax) {
        if (char.pv_max_override) {
          char.pv_max_override -= ef.valor || 0;
          if (char.pv_max_override <= char.pv_max) delete char.pv_max_override;
          char.pv_atual = Math.min(char.pv_atual, char.pv_max_override || char.pv_max);
        }
      }
      // Remover todos os efeitos com mesmo nome base (filhos compostos)
      char.efeitos_magicos = (char.efeitos_magicos || []).filter(e => {
        const base = e.nome.replace(/ \(.*\)$/, '');
        return base !== nome;
      });
      salvar();
      renderFichaCompleta();
      toast(`Efeito de ${nome} removido.`, 'info');
    });
  });

  // Quebrar concentracao manualmente
  document.querySelectorAll('[data-quebrar-concentracao]').forEach(el => {
    el.addEventListener('click', () => {
      const concAtiva = getConcentracaoAtiva();
      if (!concAtiva) return;
      // Reverter bonus de PV maximo se necessario
      const efsPVMax = (char.efeitos_magicos || []).filter(e => e.concentracao && e.tipo === 'bonus_pv_max');
      for (const ef of efsPVMax) {
        if (char.pv_max_override) {
          char.pv_max_override -= ef.valor || 0;
          if (char.pv_max_override <= char.pv_max) delete char.pv_max_override;
          char.pv_atual = Math.min(char.pv_atual, char.pv_max_override || char.pv_max);
        }
      }
      char.efeitos_magicos = (char.efeitos_magicos || []).filter(e => !e.concentracao);
      salvar();
      renderFichaCompleta();
      toast(`Concentração em ${concAtiva} encerrada.`, 'info');
    });
  });

  // Inspiração Heroica (toggle estrela)
  document.getElementById('inspiracao-toggle')?.addEventListener('click', () => {
    char.inspiracao_heroica = !char.inspiracao_heroica;
    salvar();
    renderFichaCompleta();
    toast(char.inspiracao_heroica ? 'Inspiração Heroica concedida!' : 'Inspiração Heroica usada! Role um d20 adicional.', 'success');
  });

  // FAB toggle
  document.getElementById('fab-toggle-descanso')?.addEventListener('click', () => {
    const menu = document.getElementById('fab-menu-descanso');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('btn-descanso-curto')?.addEventListener('click', () => {
    // reservasDadosVida em vez do dado da classe INICIAL x nivel TOTAL:
    // o Descanso Curto pode gastar dado de qualquer classe (livro:2043).
    const reservasCurto = reservasDadosVida(char).filter(r => r.disponiveis > 0);
    const dvRestantes = reservasCurto.reduce((s, r) => s + r.disponiveis, 0);
    const pvMax = char.pv_max_override || char.pv_max;
    const modCon = calcMod(char.atributos.constituicao);
    const jaCheio = char.pv_atual >= pvMax;

    // Restaurar habilidades de descanso curto
    restaurarHabilidades('curto');
    restaurarRecursosTalentos(char, 'curto');

    // Bárbaro: recupera 1 uso de Fúria no descanso curto
    // temClasse: char.classe e a classe INICIAL -- um Ladino 5/Barbaro 5
    // teria a Furia presa sem recarga se a guarda lesse so o espelho.
    if (temClasse(char, 'Bárbaro')) {
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_usos_gastos = Math.max(0, (char.recursos.furia_usos_gastos || 0) - 1);
      char.recursos.furia_implacavel_cd = 10; // Resetar CD da Fúria Implacável
    }

    // Bardo: a partir do nível 5, descanso curto restaura todos os usos
    // nivelNa: Fonte de Inspiracao e BARDO 5 (Classes.md:462-464), nao
    // nivel TOTAL 5 -- um Bardo 2/Guerreiro 3 tem total 5 mas nao tem a
    // caracteristica; nivelNa devolve 0 para quem nao e Bardo, entao o
    // gate ja fecha sozinho sem precisar de temClasse junto.
    if (nivelNa(char, 'Bardo') >= 5) {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;
    }

    // Bardo Glamour: Majestade Inquebrável recarrega em descanso curto ou longo
    // subclasseDe: le a subclasse NA classe Bardo, nao o espelho -- mesmo
    // defeito documentado em sincronizarBonusPvDraconico, acima.
    if (subclasseDe(char, 'Bardo') === 'Colégio do Glamour') {
      if (!char.recursos) char.recursos = {};
      if (char.recursos.bardo?.subclasses?.glamour) {
        char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada = false;
      }
    }

    // Clérigo: descanso curto recupera 1 uso de Canalizar Divindade
    // temClasse: mesmo defeito do Bárbaro acima -- char.classe e o espelho
    // da classe INICIAL.
    if (temClasse(char, 'Clérigo')) {
      const estadoClerigo = getEstadoRecursosClerigo();
      if (estadoClerigo) {
        char.recursos.clerigo.canalizar_divindade_usos_gastos = Math.max(
          0,
          (char.recursos.clerigo.canalizar_divindade_usos_gastos || 0) - 1
        );

        // Domínio da Guerra: Sacerdote da Guerra recarrega em descanso curto ou longo
        // subclasseDe: subclasse NA classe Clérigo, nao o espelho.
        if (subclasseDe(char, 'Clérigo') === 'Domínio da Guerra') {
          char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
        }

        // Domínio da Luz (nível 6+): Labareda Protetora recarrega em descanso curto ou longo
        // subclasseDe/nivelNa: subclasse e nivel NA classe Clérigo -- mesmo
        // defeito da Fonte de Inspiracao do Bardo, acima.
        if (subclasseDe(char, 'Clérigo') === 'Domínio da Luz' && nivelNa(char, 'Clérigo') >= 6) {
          char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
        }
      }
    }

    // Bruxo: descanso curto recupera todos os espaços de Magia de Pacto
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Bruxo')) {
      // NAO CONVERTIDA DE PROPOSITO: recuperarEspacosMagiaBruxo() mexe em
      // espacos de Magia de Pacto -- escopo do sub-projeto 4 (magias), nao
      // desta tarefa (sub-projeto 3e). A Tarefa 11 declara esta linha como
      // excecao no guarda estatico.
      recuperarEspacosMagiaBruxo(false);
      // Subclasses: Combatente Clarividente (Grande Antigo) recarrega em curto
      // subclasseDe: subclasse NA classe Bruxo, nao o espelho.
      if (subclasseDe(char, 'Bruxo') === 'Patrono O Grande Antigo' && char.recursos.bruxo?.subclasses?.grande_antigo) {
        char.recursos.bruxo.subclasses.grande_antigo.combatente_clarividente_usado = false;
      }
    }

    // Druida: descanso curto recupera 1 uso de Forma Selvagem
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Druida')) {
      recuperarUmUsoFormaSelvagem();
    }

    // Guerreiro: descanso curto recupera 1 uso de Recuperar Fôlego e restaura Surto de Ação
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Guerreiro')) {
      const estadoGuerreiro = getEstadoRecursosGuerreiro();
      if (estadoGuerreiro) {
        // Recuperar Fôlego: recupera 1 uso em descanso curto
        char.recursos.guerreiro.recuperar_folego_usos_gastos = Math.max(
          0,
          (char.recursos.guerreiro.recuperar_folego_usos_gastos || 0) - 1
        );
        // Surto de Ação: restaura todos os usos em descanso curto
        char.recursos.guerreiro.surto_acao_usos_gastos = 0;

        // Mestre da Batalha: restaura TODOS os dados de superioridade no descanso curto
        // subclasseDe: subclasse NA classe Guerreiro, nao o espelho.
        if (subclasseDe(char, 'Guerreiro') === 'Mestre da Batalha') {
          char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos = 0;
        }

        // Combatente Psíquico: recupera 1 dado psiônico no descanso curto
        if (subclasseDe(char, 'Guerreiro') === 'Combatente Psíquico') {
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos = Math.max(
            0,
            (char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos || 0) - 1
          );
          // Restaura habilidades 1/descanso curto
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
        }
      }
    }

    // Feiticeiro: descanso curto não restaura automaticamente PF,
    // mas encerra efeitos temporários de 1 minuto para evitar estado preso.
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Feiticeiro')) {
      const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
      if (estadoFeiticeiro) {
        char.recursos.feiticeiro.feiticaria_inata_ativa = false;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_ativa = false;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_duracao_min = 0;
        char.recursos.feiticeiro.subclasses.aberrante.revelacao_carne_ativa = false;
        char.recursos.feiticeiro.subclasses.draconica.asas_ativas = false;
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_ativo = false;

        // Resetar flag Apoteose Arcana e efeitos temporarios de metamagia
        char.recursos.feiticeiro.apoteose_gratis_usado_turno = false;
        if (char.efeitos_magicos) {
          char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.temporario);
        }
      }
    }

    // Paladino: descanso curto recupera 1 uso de Canalizar Divindade
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Paladino')) {
      const estado = getEstadoRecursosPaladino();
      if (estado && estado.canalizarMax > 0) {
        char.recursos.paladino.canalizar_divindade_usos_gastos = Math.max(
          0,
          (char.recursos.paladino.canalizar_divindade_usos_gastos || 0) - 1
        );
      }
      // Devoção: desativar efeitos temporários (duração expirada)
      // subclasseDe: subclasse NA classe Paladino, nao o espelho.
      if (estado && subclasseDe(char, 'Paladino') === 'Juramento da Devoção' && char.recursos.paladino.subclasses?.devocao) {
        char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa = false;
        char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo = false;
      }
    }

    // Monge: descanso curto restaura todos os pontos de foco
    // temClasse: char.classe e a classe INICIAL -- um Monge 5/Ladino 5
    // ficava com o recurso morto se a ordem trocasse (Classes.md:5184).
    if (temClasse(char, 'Monge')) {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        // Subclasses de Monge: descanso curto
        if (char.recursos.monge.subclasses) {
          // Elementos: Sintonia desativa
          // subclasseDe: subclasse NA classe Monge, nao o espelho.
          if (subclasseDe(char, 'Monge') === 'Combatente dos Elementos' && char.recursos.monge.subclasses.elementos) {
            char.recursos.monge.subclasses.elementos.sintonia_ativa = false;
          }
        }
      }
    }

    // Ladino: descanso curto restaura Golpe de Sorte (nível 20)
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Ladino')) {
      const estado = getEstadoRecursosLadino();
      if (estado) {
        char.recursos.ladino.golpe_sorte_usado = false;

        // Adaga Espiritual: recupera 1 dado psiônico no descanso curto
        // subclasseDe: subclasse NA classe Ladino, nao o espelho.
        if (subclasseDe(char, 'Ladino') === 'Adaga Espiritual') {
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos = Math.max(
            0,
            (char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos || 0) - 1
          );
        }
      }
    }

    // Mago: descanso curto permite Memorizar Magia (nível 5+) e restaura assinaturas (nível 20)
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Mago')) {
      const estado = getEstadoRecursosMago();
      if (estado) {
        // Assinatura Mágica recupera em descanso curto ou longo
        if (estado.assinaturaMagicaAtiva) {
          char.recursos.mago.assinatura_magia_1_usada = false;
          char.recursos.mago.assinatura_magia_2_usada = false;
        }
        // Subclasses de Mago: descanso curto
        if (char.recursos.mago.subclasses) {
          // Adivinhador: O Terceiro Olho restaura
          // subclasseDe: subclasse NA classe Mago, nao o espelho.
          if (subclasseDe(char, 'Mago') === 'Adivinhador' && char.recursos.mago.subclasses.adivinhador) {
            char.recursos.mago.subclasses.adivinhador.terceiro_olho_usado = false;
          }
          // Ilusionista: Autoimagem Ilusória restaura
          if (subclasseDe(char, 'Mago') === 'Ilusionista' && char.recursos.mago.subclasses.ilusionista) {
            char.recursos.mago.subclasses.ilusionista.autoimagem_usada = false;
          }
        }
      }
    }

    // Guardião: Incansável (nível 10+) reduz exaustão em 1 no descanso curto
    // nivelNa: Incansavel e GUARDIAO 10 (Classes.md:3348), nao nivel TOTAL
    // 10 -- Guardiao 5/Guerreiro 5 (total 10) NAO tem direito, e Guerreiro
    // 5/Guardiao 10 TEM mesmo com classe inicial Guerreiro (a guarda velha
    // nem entrava no bloco, porque lia o espelho). nivelNa devolve 0 para
    // quem nao e Guardiao, entao o gate fecha sozinho sem temClasse junto.
    if (nivelNa(char, 'Guardião') >= 10) {
      if (typeof char.exaustao !== 'number') char.exaustao = 0;
      if (char.exaustao > 0) {
        char.exaustao = Math.max(0, char.exaustao - 1);
      }
    }

    salvar();

    // Memorizar Magia (Mago nível 5+): "Ao completar um Descanso Curto,
    // você pode estudar seu livro de magias e substituir uma das magias
    // preparadas". Antes o Descanso Curto não oferecia nada -- a
    // característica só existia como texto na ficha.
    // NAO CONVERTIDA DE PROPOSITO: memorizarMagia decide troca de magia
    // preparada -- escopo do sub-projeto 4 (magias), nao desta tarefa
    // (sub-projeto 3e). A Tarefa 11 declara esta linha como excecao no
    // guarda estatico.
    const memorizarMagia = char.classe === 'Mago' && (char.nivel || 1) >= 5
      && (char.magias_preparadas || []).some(m => m.circulo > 0 && magiaContaNoLimite(m));
    const botaoMemorizar = memorizarMagia
      ? '<button class="btn btn-secondary" id="btn-memorizar-magia-curto">Memorizar Magia</button>'
      : '';
    const bindMemorizar = () => {
      document.getElementById('btn-memorizar-magia-curto')?.addEventListener('click', () => {
        window.fecharModal();
        // Memorizar Magia troca UMA. O texto da caracteristica (Classes.md) diz
        // "substituir uma dessas magias por outra magia de 1o circulo ou
        // superior do seu livro de magias" -- e este botao abria a lista
        // COMPLETA (`mostrarTrocaMagias`), deixando remontar tudo. A fonte do
        // lado "entra" e o grimorio, que `mostrarTrocaMagiaConhecida` ja
        // resolve para o Mago.
        mostrarTrocaMagiaConhecida(null, {
          titulo: 'Memorizar Magia',
          explicacao: 'Apos um Descanso Curto, voce pode trocar <strong>1 magia preparada</strong> '
            + 'por outra do seu livro de magias.',
        });
      });
    };

    // Se tem dados de vida restantes e nao esta com PV cheio, oferecer modal
    if (dvRestantes > 0 && !jaCheio && reservasCurto.length) {
      // Mesmo seletor do modal "Usar DV" (btn-usar-dv, acima): SO aparece
      // com mais de um tipo de dado. Sufixo "-curto" para nao colidir com
      // os ids daquele modal.
      const seletor = montarSeletorDeReserva(reservasCurto, '-curto', {
        modCon, comEmoji: false, labelPicker: 'Quantos dados de vida usar para cura?',
        valorInicial: 0, minPicker: 0,
      });

      abrirModal('Descanso Curto',
        `<div class="info-box success" style="margin-bottom:12px">Habilidades de descanso curto restauradas!</div>` +
        (memorizarMagia ? `<div style="font-size:0.85rem;margin-bottom:8px">
            <strong>Memorizar Magia:</strong> você pode trocar 1 magia preparada por outra do seu livro.
          </div>` : '') +
        seletor.html,
        `<button class="btn btn-secondary" onclick="fecharModal()">Pular Cura</button>${botaoMemorizar}<button class="btn btn-primary" id="btn-aplicar-dv-curto">Usar Dados de Vida</button>`
      );
      setupNumberPicker(seletor.idPicker);
      bindMemorizar();
      const selectTipoCurto = seletor.ligar();

      document.getElementById('btn-aplicar-dv-curto')?.addEventListener('click', () => {
        const facesCurto = Number(selectTipoCurto?.value) || seletor.faceInicial;
        const reservaCurto = reservasCurto.find(r => r.faces === facesCurto) || reservasCurto[0];
        const pedidoCurto = Math.max(0, parseInt(document.getElementById(`${seletor.idPicker}-val`)?.value) || 0);
        if (pedidoCurto > 0) {
          // gastarDadosVida e o escritor AUTORIZADO -- mesmo motivo do
          // modal "Usar DV", acima.
          const qtd = gastarDadosVida(char, reservaCurto.faces, pedidoCurto);
          salvar();
          toast(`Descanso curto realizado! ${qtd}x d${reservaCurto.faces} usado(s). Role os dados e aplique a cura.`, 'success');
        } else {
          toast('Descanso curto realizado!', 'success');
        }
        window.fecharModal();
        renderFichaCompleta();
      });
    } else if (memorizarMagia) {
      abrirModal('Descanso Curto Concluído',
        `<div class="info-box success" style="margin-bottom:12px">Habilidades de descanso curto restauradas!</div>
         <div style="font-size:0.85rem">
           <strong>Memorizar Magia:</strong> você pode estudar seu livro de magias e trocar
           1 magia preparada por outra do livro.
         </div>`,
        `<button class="btn btn-secondary" onclick="fecharModal()">Manter Tudo</button>${botaoMemorizar}`
      );
      bindMemorizar();
    } else {
      toast('Descanso curto realizado!', 'success');
      renderFichaCompleta();
    }
  });

  document.getElementById('btn-descanso-longo')?.addEventListener('click', () => {
    // Reverter bonus de PV maximo de efeitos magicos antes de limpar
    const efsPVMax = (char.efeitos_magicos || []).filter(e => e.tipo === 'bonus_pv_max');
    for (const ef of efsPVMax) {
      if (char.pv_max_override) {
        char.pv_max_override -= ef.valor || 0;
        if (char.pv_max_override <= char.pv_max) delete char.pv_max_override;
      }
    }
    const pvMax = char.pv_max_override || char.pv_max;
    char.pv_atual = pvMax;
    char.pv_temporario = 0;
    // Regra 2024: Descanso Longo recupera TODOS os Dados de Vida
    // (Regras.md:379). restaurarTodosDadosVida zera TODAS as reservas por
    // tipo, nao so o escalar -- num Mago 5/Barbaro 5 zerar o escalar
    // deixava as reservas de d6 e d12 marcadas como gastas.
    restaurarTodosDadosVida(char);
    // Reset death saves
    char.morte_sucessos = 0;
    char.morte_falhas = 0;
    // Regra 2024: Exaustao reduzida em 1 nivel no Descanso Longo (todas as classes)
    if (typeof char.exaustao !== 'number') char.exaustao = 0;
    if (char.exaustao > 0) {
      char.exaustao = Math.max(0, char.exaustao - 1);
      if (char.exaustao === 0) {
        char.condicoes = (char.condicoes || []).filter(c => c !== 'Exaustão');
      }
    }
    // Restaurar espaços de magia
    if (char.espacos_magia) {
      Object.keys(char.espacos_magia).forEach(k => {
        char.espacos_magia[k].usados = 0;
      });
    }
    // Remover slots extras criados por Fonte de Magia e recalcular totais
    char.espacos_magia_extras = {};
    // Recalcular totais sem os extras (corrige exibição antes do próximo renderSheet)
    // NAO CONVERTIDA DE PROPOSITO: recalculo de espacos de magia -- escopo
    // do sub-projeto 4 (magias), nao desta tarefa (sub-projeto 3e). A porta
    // `CLASSES_INFO[char.classe].conjurador` e `getEspacosMagia(tabela,
    // char.nivel)` continuam lendo a classe INICIAL e o nivel TOTAL. A
    // Tarefa 11 declara estas linhas como excecao no guarda estatico.
    if (char.espacos_magia && classeData?.tabela_caracteristicas) {
      const _infoClasseRest = CLASSES_INFO[char.classe];
      if (_infoClasseRest?.conjurador) {
        const _espacosBase = getEspacosMagia(classeData.tabela_caracteristicas, char.nivel);
        Object.keys(char.espacos_magia).forEach(circ => {
          if (_espacosBase[circ]) {
            char.espacos_magia[circ].total = _espacosBase[circ].total;
          } else {
            // Círculo que não existe mais na tabela base — remover
            delete char.espacos_magia[circ];
          }
        });
      }
    }
    // Limpar efeitos mágicos ativos
    char.efeitos_magicos = [];
    // Resetar conjurações gratuitas de talentos (Tocado Por Fadas, Sombras, Iniciado em Magia)
    (char.magias_preparadas || []).forEach(m => {
      if (m.gratis_usado === true) m.gratis_usado = false;
    });
    // Restaurar Pontos de Sorte do Sortudo
    if (char.recursos?.sortudo) {
      char.recursos.sortudo.pontos_gastos = 0;
    }
    // Restaurar todas as habilidades
    restaurarHabilidades('longo');
    restaurarRecursosTalentos(char, 'longo');

    // Bárbaro: descanso longo restaura todos os usos e encerra Fúria
    // temClasse: char.classe e a classe INICIAL -- um Mago 5/Barbaro 5
    // nunca entrava neste bloco (a guarda antiga lia so o espelho), entao
    // Furia, Furia Implacavel e os recursos de subclasse ficavam presos
    // para sempre depois do Descanso Longo. temClasse olha as classes DE
    // VERDADE do personagem, nao so a inicial.
    if (temClasse(char, 'Bárbaro')) {
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_usos_gastos = 0;
      char.recursos.furia_ativa = false;
      char.recursos.furia_persistente_usada = false;
      char.recursos.furia_implacavel_cd = 10; // Resetar CD da Fúria Implacável
      char.recursos.furia_animal = null; // Limpar animal do Coração Selvagem
      char.recursos.furia_deuses_ativa = false; // Limpar Fúria dos Deuses do Fanático
      char.recursos.furia_deuses_usada = false;
      char.recursos.presenca_intimidante_usada = false; // Berserker nv10
      char.recursos.presenca_zelosa_usada = false; // Fanático nv10
      // Campeão dos Deuses (Fanático nv3): "Sua reserva restaura todos os
      // dados gastos ao completar um Descanso Longo". Este campo era
      // escrito ao gastar e lido para exibir "N/4 d12", mas nenhum ponto
      // do app o zerava -- na prática a reserva era de uso único por
      // personagem.
      char.recursos.campeao_deuses_gastos = 0;
    }

    // Bardo: descanso longo restaura todos os usos de Inspiração
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Bardo')) {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;

      // Glamour: restaurar todos os recursos de subclasse
      // subclasseDe: subclasse NA classe Bardo, nao o espelho.
      if (subclasseDe(char, 'Bardo') === 'Colégio do Glamour' && char.recursos.bardo?.subclasses?.glamour) {
        char.recursos.bardo.subclasses.glamour.magia_fascinante_usada = false;
        char.recursos.bardo.subclasses.glamour.manto_majestade_usado = false;
        char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada = false;
      }
    }

    // Guerreiro: descanso longo restaura todos os recursos
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Guerreiro')) {
      const estadoGuerreiro = getEstadoRecursosGuerreiro();
      if (estadoGuerreiro) {
        char.recursos.guerreiro.recuperar_folego_usos_gastos = 0;
        char.recursos.guerreiro.surto_acao_usos_gastos = 0;
        char.recursos.guerreiro.indomavel_usos_gastos = 0;

        // Mestre da Batalha: restaura todos os dados de superioridade e Conheça Seu Inimigo
        // subclasseDe: subclasse NA classe Guerreiro, nao o espelho.
        if (subclasseDe(char, 'Guerreiro') === 'Mestre da Batalha') {
          char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos = 0;
          char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = false;
        }

        // Combatente Psíquico: restaura todos os dados psiônicos e habilidades
        if (subclasseDe(char, 'Guerreiro') === 'Combatente Psíquico') {
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos = 0;
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = false;
        }
      }
    }

    // Clérigo: Intervenção Divina
    // temClasse: char.classe e a classe INICIAL -- um Mago 5/Clerigo 5
    // nunca entrava aqui (guarda antiga lia so o espelho), mas
    // getEstadoRecursosClerigo() ja devolve estado VALIDO porque os
    // recursos de Clerigo existem de qualquer forma -- a ficha exibia
    // "Canalizar Divindade 0/2" para sempre, sem o Descanso Longo jamais
    // devolver nada (Classes.md:1574). O par Clerigo 5/Paladino 5 tem DUAS
    // reservas separadas ("Canalizar Divindade DESTA classe" --
    // Classes.md:1574 e :5545); este bloco so cuida da reserva do Clerigo,
    // o bloco do Paladino abaixo cuida da dele.
    if (temClasse(char, 'Clérigo')) {
      const estadoClerigo = getEstadoRecursosClerigo();
      if (estadoClerigo) {
        // Recupera totalmente Canalizar Divindade no descanso longo
        char.recursos.clerigo.canalizar_divindade_usos_gastos = 0;

        const restantes = char.recursos.clerigo.intervencao_divina_descansos_restantes || 0;
        if (restantes > 0) {
          char.recursos.clerigo.intervencao_divina_descansos_restantes = Math.max(0, restantes - 1);
          char.recursos.clerigo.intervencao_divina_bloqueada = char.recursos.clerigo.intervencao_divina_descansos_restantes > 0;
        } else {
          char.recursos.clerigo.intervencao_divina_bloqueada = false;
        }

        // Reset de recursos de subclasses
        char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
        char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
        char.recursos.clerigo.subclasses.luz.coroa_luz_usos_gastos = 0;
        char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa = false;
        char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = false;
      }
    }

    // Bruxo: descanso longo restaura Astúcia Mágica e usos de Arcana Mística
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Bruxo')) {
      const estado = getEstadoRecursosBruxo();
      if (estado) {
        char.recursos.bruxo.astucia_usada = false;
        estado.circulosArcanum.forEach(c => {
          if (!char.recursos.bruxo.arcanum[c]) char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
          char.recursos.bruxo.arcanum[c].usado = false;
        });

        // Subclasses: restaurar todos os recursos de subclasse
        // subclasseDe: subclasse NA classe Bruxo, nao o espelho -- mesmo
        // defeito documentado no bloco do Bardo, acima.
        if (subclasseDe(char, 'Bruxo') === 'Patrono Arquifada') {
          char.recursos.bruxo.subclasses.arquifada.passos_feericos_usos_gastos = 0;
          char.recursos.bruxo.subclasses.arquifada.fuga_nevoa_usada = false;
          char.recursos.bruxo.subclasses.arquifada.defesas_sedutoras_usada = false;
        }
        if (subclasseDe(char, 'Bruxo') === 'Patrono Celestial') {
          char.recursos.bruxo.subclasses.celestial.luz_medicinal_dados_gastos = 0;
          char.recursos.bruxo.subclasses.celestial.vinganca_calcinante_usada = false;
        }
        if (subclasseDe(char, 'Bruxo') === 'Patrono O Grande Antigo') {
          char.recursos.bruxo.subclasses.grande_antigo.combatente_clarividente_usado = false;
        }
        if (subclasseDe(char, 'Bruxo') === 'Patrono Ínfero') {
          char.recursos.bruxo.subclasses.infero.sorte_tenebroso_usos_gastos = 0;
          char.recursos.bruxo.subclasses.infero.lancar_inferno_usado = false;
          // resistencia_infera_escolha NÃO é resetada — é uma escolha persistente
        }
      }
    }

    // Druida: descanso longo restaura Forma Selvagem e limpa travas de recursos
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Druida')) {
      const estado = getEstadoRecursosDruida();
      if (estado) {
        char.recursos.druida.forma_selvagem_usos_gastos = 0;
        char.recursos.druida.forma_selvagem_ativa = false;
        char.recursos.druida.companheiro_selvagem_ativo = false;
        char.recursos.druida.ressurgimento_slot_recuperado_hoje = false;

        // Subclasses: restaurar todos os recursos de subclasse
        // subclasseDe: subclasse NA classe Druida, nao o espelho.
        if (subclasseDe(char, 'Druida') === 'Círculo da Lua') {
          char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos = 0;
        }
        if (subclasseDe(char, 'Druida') === 'Círculo da Terra') {
          char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada = false;
          char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada = false;
        }
        if (subclasseDe(char, 'Druida') === 'Círculo das Estrelas') {
          char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos = 0;
          char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos = 0;
          // constelacao_ativa e pressagio_tipo NÃO são resetados — são escolhas persistentes
        }
      }
    }

    // Guardião: descanso longo restaura usos da classe e encerra efeitos temporários
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Guardião')) {
      const estado = getEstadoRecursosGuardiao();
      if (estado) {
        char.recursos.guardiao.inimigo_favorito_usos_gastos = 0;
        char.recursos.guardiao.incansavel_usos_gastos = 0;
        char.recursos.guardiao.veu_natureza_usos_gastos = 0;
        char.recursos.guardiao.marca_predador_ativa = false;

        // Subclasses: restaurar todos os recursos de subclasse
        // subclasseDe: subclasse NA classe Guardião, nao o espelho.
        if (subclasseDe(char, 'Guardião') === 'Andarilho Feérico') {
          char.recursos.guardiao.subclasses.andarilho.reforcos_feericos_usado = false;
          char.recursos.guardiao.subclasses.andarilho.andarilho_nebuloso_usos_gastos = 0;
        }
        // Caçador: presa_escolha e taticas_escolha NÃO resetam — são escolhas que podem mudar em descansos
        // Senhor das Feras: companheiro_tipo NÃO reseta — é escolha persistente
        if (subclasseDe(char, 'Guardião') === 'Vigilante das Sombras') {
          char.recursos.guardiao.subclasses.vigilante.golpe_terrivel_usos_gastos = 0;
        }
      }
    }

    // Feiticeiro: descanso longo restaura pontos e usos por descanso longo
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Feiticeiro')) {
      const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
      if (estadoFeiticeiro) {
        char.recursos.feiticeiro.pontos_feiticaria_gastos = 0;
        char.recursos.feiticeiro.feiticaria_inata_usos_gastos = 0;
        char.recursos.feiticeiro.feiticaria_inata_ativa = false;
        char.recursos.feiticeiro.restauracao_feiticeira_usada = false;

        char.recursos.feiticeiro.subclasses.aberrante.telepatia_ativa = false;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_duracao_min = 0;
        char.recursos.feiticeiro.subclasses.aberrante.revelacao_carne_ativa = false;

        char.recursos.feiticeiro.subclasses.draconica.asas_ativas = false;
        char.recursos.feiticeiro.subclasses.draconica.asas_usada_desde_descanso = false;
        char.recursos.feiticeiro.subclasses.draconica.companheiro_draconico_usado = false;

        char.recursos.feiticeiro.subclasses.mecanica.restaurar_equilibrio_usos_gastos = 0;
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_ativo = false;
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_usado_desde_descanso = false;
        char.recursos.feiticeiro.subclasses.mecanica.bastiao_dados = 0;

        char.recursos.feiticeiro.subclasses.selvagem.mares_caos_disponivel = true;
        char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = false;
        char.recursos.feiticeiro.subclasses.selvagem.surto_controlado_usado = false;

        // Resetar flag de Apoteose Arcana (uso gratuito por turno)
        char.recursos.feiticeiro.apoteose_gratis_usado_turno = false;
      }
    }

    // Paladino: descanso longo restaura todos os recursos
    // temClasse: char.classe e a classe INICIAL -- mesmo defeito do Bárbaro
    // acima. O Clerigo/Paladino tem DUAS reservas de "Canalizar Divindade
    // DESTA classe" (Classes.md:1574 e :5545); esta linha zera a reserva do
    // PALADINO, e so entra com temClasse mesmo quando o Paladino nao e a
    // classe inicial.
    if (temClasse(char, 'Paladino')) {
      const estado = getEstadoRecursosPaladino();
      if (estado) {
        char.recursos.paladino.maos_consagradas_gastos = 0;
        char.recursos.paladino.canalizar_divindade_usos_gastos = 0;
        char.recursos.paladino.destruicao_gratuita_usada = false;

        // Glória: restaurar recursos de subclasse
        // subclasseDe: subclasse NA classe Paladino, nao o espelho.
        if (subclasseDe(char, 'Paladino') === 'Juramento da Glória' && char.recursos.paladino.subclasses?.gloria) {
          char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos = 0;
          char.recursos.paladino.subclasses.gloria.lenda_viva_usada = false;
        }
        // Vingança: restaurar recursos de subclasse
        if (subclasseDe(char, 'Paladino') === 'Juramento da Vingança' && char.recursos.paladino.subclasses?.vinganca) {
          char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado = false;
        }
        // Anciões: restaurar recursos de subclasse
        if (subclasseDe(char, 'Paladino') === 'Juramento dos Anciões' && char.recursos.paladino.subclasses?.ancioes) {
          char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada = false;
          char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado = false;
        }
        // Devoção: restaurar todos os recursos de subclasse
        if (subclasseDe(char, 'Paladino') === 'Juramento da Devoção' && char.recursos.paladino.subclasses?.devocao) {
          char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa = false;
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_usado = false;
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo = false;
        }
      }
    }

    // Monge: descanso longo restaura pontos de foco e metabolismo
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Monge')) {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        char.recursos.monge.metabolismo_usado = false;
        // Subclasses de Monge: descanso longo
        if (char.recursos.monge.subclasses) {
          // Mão Espalmada
          // subclasseDe: subclasse NA classe Monge, nao o espelho.
          if (subclasseDe(char, 'Monge') === 'Combatente da Mão Espalmada' && char.recursos.monge.subclasses.mao_espalmada) {
            char.recursos.monge.subclasses.mao_espalmada.integridade_usos_gastos = 0;
            char.recursos.monge.subclasses.mao_espalmada.palma_vibrante_ativa = false;
          }
          // Misericórdia
          if (subclasseDe(char, 'Monge') === 'Combatente da Misericórdia' && char.recursos.monge.subclasses.misericordia) {
            char.recursos.monge.subclasses.misericordia.torrente_usos_gastos = 0;
            char.recursos.monge.subclasses.misericordia.misericordia_final_usada = false;
          }
          // Elementos
          if (subclasseDe(char, 'Monge') === 'Combatente dos Elementos' && char.recursos.monge.subclasses.elementos) {
            char.recursos.monge.subclasses.elementos.sintonia_ativa = false;
          }
        }
      }
    }

    // Ladino: descanso longo restaura golpe de sorte
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Ladino')) {
      const estado = getEstadoRecursosLadino();
      if (estado) {
        char.recursos.ladino.golpe_sorte_usado = false;

        // Adaga Espiritual: restaura todos os dados psiônicos e habilidades
        // subclasseDe: subclasse NA classe Ladino, nao o espelho.
        if (subclasseDe(char, 'Ladino') === 'Adaga Espiritual') {
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos = 0;
          char.recursos.ladino.subclasses.adaga_espiritual.sussurros_gratis_usado = false;
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = false;
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = false;
        }
      }
    }

    // Mago: descanso longo restaura recuperação arcana e assinaturas
    // temClasse: mesmo defeito do Bárbaro acima.
    if (temClasse(char, 'Mago')) {
      const estado = getEstadoRecursosMago();
      if (estado) {
        char.recursos.mago.recuperacao_arcana_usada = false;
        char.recursos.mago.assinatura_magia_1_usada = false;
        char.recursos.mago.assinatura_magia_2_usada = false;
        // Subclasses de Mago: descanso longo
        if (char.recursos.mago.subclasses) {
          // Abjurador: Proteção Arcana pode ser criada novamente
          // subclasseDe: subclasse NA classe Mago, nao o espelho.
          if (subclasseDe(char, 'Mago') === 'Abjurador' && char.recursos.mago.subclasses.abjurador) {
            char.recursos.mago.subclasses.abjurador.protecao_criada = false;
            char.recursos.mago.subclasses.abjurador.protecao_pv_atual = 0;
          }
          // Adivinhador: Prodígio re-rola dados + O Terceiro Olho restaura
          if (subclasseDe(char, 'Mago') === 'Adivinhador' && char.recursos.mago.subclasses.adivinhador) {
            const s = char.recursos.mago.subclasses.adivinhador;
            // nivelNa: o gate de nivel aqui NAO e da Assinatura Magica (essa
            // e Mago 20, sem gate algum neste bloco -- ver linhas acima) e
            // sim de Prodigio Maior (Mago 14, dados/classes/mago.json), que
            // aumenta as jogadas de previsao de Prodigio de duas para tres.
            // char.nivel e o nivel TOTAL do personagem; um Mago 5/Guerreiro
            // 9 (total 14) nao tem Prodigio Maior, mas o gate antigo o
            // liberaria; um Guerreiro 5/Mago 14 TEM, mas o bloco nem entrava
            // porque a classe inicial nao e Mago. nivelNa le o nivel NA
            // classe Mago.
            const n = nivelNa(char, 'Mago') >= 14 ? 3 : 2;
            s.prodigio_dado_1 = Math.floor(Math.random() * 20) + 1;
            s.prodigio_dado_1_usado = false;
            s.prodigio_dado_2 = Math.floor(Math.random() * 20) + 1;
            s.prodigio_dado_2_usado = false;
            if (n >= 3) {
              s.prodigio_dado_3 = Math.floor(Math.random() * 20) + 1;
              s.prodigio_dado_3_usado = false;
            }
            s.terceiro_olho_usado = false;
          }
          // Evocador: Sobrecarga reseta contador
          if (subclasseDe(char, 'Mago') === 'Evocador' && char.recursos.mago.subclasses.evocador) {
            char.recursos.mago.subclasses.evocador.sobrecarga_usos = 0;
          }
          // Ilusionista: Criaturas Espectrais + Autoimagem restauram
          if (subclasseDe(char, 'Mago') === 'Ilusionista' && char.recursos.mago.subclasses.ilusionista) {
            char.recursos.mago.subclasses.ilusionista.feerica_usada = false;
            char.recursos.mago.subclasses.ilusionista.fera_usada = false;
            char.recursos.mago.subclasses.ilusionista.autoimagem_usada = false;
          }
        }
      }
    }

    // Inspiração Heroica: Humanos (traço "Eficiente") ganham no descanso longo
    if (char.especie === 'Humano') {
      char.inspiracao_heroica = true;
    }

    salvar();

    // Verificar se a classe tem Maestria em Arma e/ou troca de magias
    // NAO CONVERTIDA DE PROPOSITO: `infoClasse`/`.conjurador` decide a troca
    // de magia/truque no fim do Descanso Longo -- escopo do sub-projeto 4
    // (magias), nao desta tarefa (sub-projeto 3e). Continua lendo a classe
    // INICIAL. A Tarefa 11 declara esta linha como excecao no guarda estatico.
    const infoClasse = CLASSES_INFO[char.classe] || {};
    // As classes DESTE personagem que concedem Maestria em Arma. Era
    // `classesMaestria.includes(char.classe)`, uma cópia da lista comparada
    // com o ESPELHO da classe inicial: num Mago 5/Guerreiro 5 a opção de
    // trocar maestria SUMIA da tela do Descanso Longo -- não mostrava número
    // errado, simplesmente não existia. A lista agora mora em maestrias.js,
    // ao lado do teto que a consome.
    const classesDeMaestria = classesComMaestria(char);
    const temMaestria = classesDeMaestria.length > 0;
    const ehSubConj = ehSubclasseConjuradora();
    // A quantidade vem de regras-preparo-magias.js, que guarda a REGRA DO
    // PRODUTO -- e ela se afasta da tabela do livro de proposito, com o
    // afastamento declarado la. No Descanso Longo e sempre UMA magia, para
    // toda classe conjuradora: remontar a lista inteira e da subida de nivel.
    //
    // Antes isto saia de `tipo_conjuracao`, um campo de dois valores, e o
    // resultado era desigual sem que ninguem tivesse decidido assim:
    // Clerigo/Druida/Mago abriam a lista COMPLETA e Bardo/Bruxo/Feiticeiro
    // nao tinham troca nenhuma aqui.
    //
    // Guerreiro e Ladino nao sao classes conjuradoras: conjuram por
    // subclasse, e a regra deles vem do texto da subclasse -- por isso
    // `ehSubConj` continua entrando por fora, com o comportamento que ja
    // tinha (tambem uma magia so).
    // NAO CONVERTIDA DE PROPOSITO: `trocaNoDescansoLongo(char.classe)` e os
    // rotulos "Como Classe (Subclasse), voce pode trocar..." abaixo (linhas
    // ~1417 e ~1425) decidem a troca de magia/truque no fim do Descanso
    // Longo -- escopo do sub-projeto 4 (magias), nao desta tarefa
    // (sub-projeto 3e). Continuam lendo a classe/subclasse INICIAL. A
    // Tarefa 11 declara estas linhas como excecao no guarda estatico.
    const temTrocaMagia = trocaNoDescansoLongo(char.classe) === 'uma' || ehSubConj;
    // Troca de truque no Descanso Longo (2026-08-13): antes NAO era
    // oferecida a ninguem aqui -- so existia na subida de nivel
    // (levelup-cards.js). Decisao do dono do produto: vale para toda classe
    // conjuradora, nas duas ocasioes. Depende de haver truque de classe
    // trocavel (truquesTrocaveis, grimorio.js) -- um Paladino sem
    // Combatente Abencoado, por exemplo, nao tem nenhum e nao ve a opcao.
    const temTrocaTruque = (infoClasse.conjurador || ehSubConj) && truquesTrocaveis().length > 0;

    if (temMaestria || temTrocaMagia || temTrocaTruque) {
      // Montar conteudo do modal conforme opcoes disponiveis
      let conteudoModal = `
        <div class="info-box success" style="margin-bottom:12px">
          PV, espaços de magia e habilidades restaurados!
        </div>
      `;
      if (temMaestria) {
        // Basta UMA classe de troca total (Guardião/Paladino/Ladino) para o
        // personagem poder refazer tudo -- ele tem a característica dela de
        // verdade, e as maestrias vivem num array único.
        const trocaUma = !trocaTodasNoDescanso(char);
        conteudoModal += `
          <p style="font-size:0.9rem">Deseja trocar suas maestrias de arma?</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Como ${escHtml(classesDeMaestria.join('/'))}, você pode ${trocaUma ? 'alterar <strong>uma</strong> escolha de' : 'alterar suas escolhas de'} maestria após um Descanso Longo.
          </p>
        `;
      }
      if (temTrocaMagia) {
        const rotuloMagia = infoClasse.tipo_conjuracao === 'preparadas' ? 'preparada' : 'conhecida';
        conteudoModal += `
          <p style="font-size:0.9rem">Deseja trocar uma magia ${rotuloMagia}?</p>
          <p style="font-size:0.8rem;color:var(--text-muted)">
            Como ${escHtml(char.classe)}${ehSubConj ? ' (' + escHtml(char.subclasse) + ')' : ''}, você pode trocar <strong>1 magia ${rotuloMagia}</strong> por outra da lista de classe após um Descanso Longo. Para remontar a lista inteira, use a subida de nível.
          </p>
        `;
      }
      if (temTrocaTruque) {
        conteudoModal += `
          <p style="font-size:0.9rem">Deseja trocar um truque?</p>
          <p style="font-size:0.8rem;color:var(--text-muted)">
            Você pode trocar <strong>1 truque</strong> por outro da lista de ${escHtml(char.classe)} após um Descanso Longo.
          </p>
        `;
      }

      let botoesModal = '<button class="btn btn-secondary" id="btn-pular-troca-dl">Manter Tudo</button>';
      if (temMaestria) {
        botoesModal += '<button class="btn btn-accent" id="btn-trocar-maestrias-dl">Trocar Maestrias</button>';
      }
      if (temTrocaMagia) {
        botoesModal += '<button class="btn btn-primary" id="btn-trocar-magias-dl">Trocar Magias</button>';
      }
      if (temTrocaTruque) {
        botoesModal += '<button class="btn btn-primary" id="btn-trocar-truque-dl">Trocar Truque</button>';
      }

      abrirModal('Descanso Longo Concluído', conteudoModal, botoesModal);

      // Funcao auxiliar para abrir o modal de troca correto
      // Uma rota so: o Descanso Longo troca UMA magia para todo mundo.
      // `mostrarTrocaMagiaConhecida` le `char.magias_preparadas` e serve
      // igual a conjurador preparado -- o que muda e so o rotulo.
      const abrirTrocaMagias = (callbackPos) => mostrarTrocaMagiaConhecida(callbackPos);

      // Encadeamento das trocas do Descanso Longo.
      //
      // Eram duas opcoes (maestria e magia) encadeadas na mao, uma chamando
      // a outra pelo callback. Com a terceira (truque, 2026-08-13) o
      // encadeamento par-a-par viraria seis combinacoes escritas a mao --
      // e a que faltasse sumiria em silencio. Aqui a ordem e fixa
      // (maestria -> magia -> truque) e cada botao roda dali para a frente:
      // quem clica "Trocar Magias" ainda recebe a troca de truque depois.
      const PASSOS = [
        { chave: 'maestria', ativo: temMaestria, abrir: (prox) => abrirModalTrocaMaestriaDescanso(prox) },
        { chave: 'magia', ativo: temTrocaMagia, abrir: (prox) => abrirTrocaMagias(prox) },
        { chave: 'truque', ativo: temTrocaTruque, abrir: (prox) => mostrarTrocaTruque(prox) },
      ].filter(p => p.ativo);

      /**
       * Monta a cadeia de modais a partir de `chave` (inclusive) e a inicia.
       * Cada modal recebe como callback a abertura do proximo passo ativo;
       * o ultimo recebe null e cai no renderFichaCompleta() proprio dele.
       */
      const iniciarTrocasAPartirDe = (chave) => {
        const restantes = PASSOS.slice(PASSOS.findIndex(p => p.chave === chave));
        if (restantes.length === 0) { renderFichaCompleta(); return; }
        const cadeia = restantes.reduceRight(
          (prox, passo) => () => passo.abrir(prox),
          null
        );
        cadeia();
      };

      document.getElementById('btn-pular-troca-dl')?.addEventListener('click', () => {
        window.fecharModal();
        renderFichaCompleta();
      });
      document.getElementById('btn-trocar-maestrias-dl')?.addEventListener('click', () => {
        window.fecharModal();
        iniciarTrocasAPartirDe('maestria');
      });
      document.getElementById('btn-trocar-magias-dl')?.addEventListener('click', () => {
        window.fecharModal();
        iniciarTrocasAPartirDe('magia');
      });
      document.getElementById('btn-trocar-truque-dl')?.addEventListener('click', () => {
        window.fecharModal();
        iniciarTrocasAPartirDe('truque');
      });
    } else {
      toast('Descanso longo realizado! PV, espaços e habilidades restaurados', 'success');
      renderFichaCompleta();
    }
  });

  document.getElementById('btn-excluir-char')?.addEventListener('click', () => {
    abrirModal('Excluir Personagem',
      `<p>Excluir <strong>${escHtml(char.nome)}</strong> permanentemente?</p>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-del">Excluir</button>'
    );
    document.getElementById('btn-confirmar-del')?.addEventListener('click', () => {
      removerPersonagem(char.id);
      window.fecharModal();
      window.navegar('home');
    });
  });
}
