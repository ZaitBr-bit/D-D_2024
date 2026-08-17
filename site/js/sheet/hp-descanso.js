// ============================================================
// Pontos de vida, dados de vida e descansos
//
// Inclui o seletor numerico usado nos controles de PV e a restauracao
// de recursos por descanso curto e longo, que toca todas as classes.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { restaurarRecursosTalentos } from '../regras-cobertura.js';
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
import { char, classeData, especiesCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { mostrarTrocaMagiaConhecida, mostrarTrocaMagias, mostrarTrocaTruque, truquesTrocaveis } from './grimorio.js';
import { abrirModalTrocaMaestriaDescanso } from './maestrias.js';
import { ehSubclasseConjuradora, getConcentracaoAtiva, magiaContaNoLimite } from './magias.js';

export function sincronizarBonusPvDraconico() {
  if (char?.classe !== 'Feiticeiro') return;
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) return;

  const ehDraconica = semAcento(char.subclasse || '') === semAcento('Feitiçaria Dracônica');
  const esperado = ehDraconica && (char.nivel || 1) >= 3 ? ((char.nivel || 1) + 2) : 0;
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

export function setupEventosHP() {
  const pvMax = char.pv_max_override || char.pv_max;

  document.getElementById('hp-minus')?.addEventListener('click', () => {
    const furia = getEstadoFuria();
    const podeResistirFuria = !!(furia?.ativa && char.classe === 'Bárbaro');

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
    const info = CLASSES_INFO[char.classe];
    if (!info) return;
    const dvRestantes = char.nivel - (char.dados_vida_usados || 0);
    if (dvRestantes <= 0) { toast('Sem dados de vida restantes', 'error'); return; }
    const modCon = calcMod(char.atributos.constituicao);

    abrirModal('Usar Dados de Vida',
      numberPickerHtml('input-qtd-dv', 1, 1, dvRestantes, 'Quantos dados de vida usar?') +
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">
          Restantes: ${dvRestantes} / ${char.nivel} (🎲d${info.dado_vida}🎲 + ${modCon} CON por dado)<br>
          <em>Apenas desconta os dados — use seus dados reais para cura.</em>
        </div>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-dv">Usar</button>'
    );
    setupNumberPicker('input-qtd-dv');
    document.getElementById('btn-aplicar-dv')?.addEventListener('click', () => {
      const qtd = Math.min(dvRestantes, Math.max(1, parseInt(document.getElementById('input-qtd-dv-val')?.value) || 1));
      char.dados_vida_usados = (char.dados_vida_usados || 0) + qtd;
      salvar();
      window.fecharModal();
      toast(`${qtd}x 🎲d${info.dado_vida}🎲 usado(s). Role os dados e aplique a cura manualmente.`, 'success');
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
function restaurarHabilidades(tipoDescanso) {
  if (!char.usos_habilidades) return;
  const allFeats = [];
  // Coletar características da classe
  if (classeData?.caracteristicas) {
    classeData.caracteristicas.filter(c => c.nivel <= char.nivel).forEach(f => {
      allFeats.push({ key: `classe_${f.nome}`, descricao: f.descricao });
    });
  }
  // Coletar características da subclasse
  if (char.subclasse && classeData?.subclasses) {
    const sc = classeData.subclasses.find(s => s.nome === char.subclasse);
    if (sc?.caracteristicas) {
      sc.caracteristicas.filter(c => c.nivel <= char.nivel).forEach(f => {
        allFeats.push({ key: `subclasse_${f.nome}`, descricao: f.descricao });
      });
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
    const info = CLASSES_INFO[char.classe];
    const dvRestantes = char.nivel - (char.dados_vida_usados || 0);
    const pvMax = char.pv_max_override || char.pv_max;
    const modCon = calcMod(char.atributos.constituicao);
    const jaCheio = char.pv_atual >= pvMax;

    // Restaurar habilidades de descanso curto
    restaurarHabilidades('curto');
    restaurarRecursosTalentos(char, 'curto');

    // Bárbaro: recupera 1 uso de Fúria no descanso curto
    if (char.classe === 'Bárbaro') {
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_usos_gastos = Math.max(0, (char.recursos.furia_usos_gastos || 0) - 1);
      char.recursos.furia_implacavel_cd = 10; // Resetar CD da Fúria Implacável
    }

    // Bardo: a partir do nível 5, descanso curto restaura todos os usos
    if (char.classe === 'Bardo' && (char.nivel || 1) >= 5) {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;
    }

    // Bardo Glamour: Majestade Inquebrável recarrega em descanso curto ou longo
    if (char.classe === 'Bardo' && char.subclasse === 'Colégio do Glamour') {
      if (!char.recursos) char.recursos = {};
      if (char.recursos.bardo?.subclasses?.glamour) {
        char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada = false;
      }
    }

    // Clérigo: descanso curto recupera 1 uso de Canalizar Divindade
    if (char.classe === 'Clérigo') {
      const estadoClerigo = getEstadoRecursosClerigo();
      if (estadoClerigo) {
        char.recursos.clerigo.canalizar_divindade_usos_gastos = Math.max(
          0,
          (char.recursos.clerigo.canalizar_divindade_usos_gastos || 0) - 1
        );

        // Domínio da Guerra: Sacerdote da Guerra recarrega em descanso curto ou longo
        if (char.subclasse === 'Domínio da Guerra') {
          char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
        }

        // Domínio da Luz (nível 6+): Labareda Protetora recarrega em descanso curto ou longo
        if (char.subclasse === 'Domínio da Luz' && (char.nivel || 1) >= 6) {
          char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
        }
      }
    }

    // Bruxo: descanso curto recupera todos os espaços de Magia de Pacto
    if (char.classe === 'Bruxo') {
      recuperarEspacosMagiaBruxo(false);
      // Subclasses: Combatente Clarividente (Grande Antigo) recarrega em curto
      if (char.subclasse === 'Patrono O Grande Antigo' && char.recursos.bruxo?.subclasses?.grande_antigo) {
        char.recursos.bruxo.subclasses.grande_antigo.combatente_clarividente_usado = false;
      }
    }

    // Druida: descanso curto recupera 1 uso de Forma Selvagem
    if (char.classe === 'Druida') {
      recuperarUmUsoFormaSelvagem();
    }

    // Guerreiro: descanso curto recupera 1 uso de Recuperar Fôlego e restaura Surto de Ação
    if (char.classe === 'Guerreiro') {
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
        if (char.subclasse === 'Mestre da Batalha') {
          char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos = 0;
        }

        // Combatente Psíquico: recupera 1 dado psiônico no descanso curto
        if (char.subclasse === 'Combatente Psíquico') {
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
    if (char.classe === 'Feiticeiro') {
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
    if (char.classe === 'Paladino') {
      const estado = getEstadoRecursosPaladino();
      if (estado && estado.canalizarMax > 0) {
        char.recursos.paladino.canalizar_divindade_usos_gastos = Math.max(
          0,
          (char.recursos.paladino.canalizar_divindade_usos_gastos || 0) - 1
        );
      }
      // Devoção: desativar efeitos temporários (duração expirada)
      if (estado && char.subclasse === 'Juramento de Devoção' && char.recursos.paladino.subclasses?.devocao) {
        char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa = false;
        char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo = false;
      }
    }

    // Monge: descanso curto restaura todos os pontos de foco
    if (char.classe === 'Monge') {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        // Subclasses de Monge: descanso curto
        if (char.recursos.monge.subclasses) {
          // Elementos: Sintonia desativa
          if (char.subclasse === 'Combatente dos Elementos' && char.recursos.monge.subclasses.elementos) {
            char.recursos.monge.subclasses.elementos.sintonia_ativa = false;
          }
        }
      }
    }

    // Ladino: descanso curto restaura Golpe de Sorte (nível 20)
    if (char.classe === 'Ladino') {
      const estado = getEstadoRecursosLadino();
      if (estado) {
        char.recursos.ladino.golpe_sorte_usado = false;

        // Adaga Espiritual: recupera 1 dado psiônico no descanso curto
        if (char.subclasse === 'Adaga Espiritual') {
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos = Math.max(
            0,
            (char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos || 0) - 1
          );
        }
      }
    }

    // Mago: descanso curto permite Memorizar Magia (nível 5+) e restaura assinaturas (nível 20)
    if (char.classe === 'Mago') {
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
          if (char.subclasse === 'Adivinhador' && char.recursos.mago.subclasses.adivinhador) {
            char.recursos.mago.subclasses.adivinhador.terceiro_olho_usado = false;
          }
          // Ilusionista: Autoimagem Ilusória restaura
          if (char.subclasse === 'Ilusionista' && char.recursos.mago.subclasses.ilusionista) {
            char.recursos.mago.subclasses.ilusionista.autoimagem_usada = false;
          }
        }
      }
    }

    // Guardião: Incansável (nível 10+) reduz exaustão em 1 no descanso curto
    if (char.classe === 'Guardião' && (char.nivel || 1) >= 10) {
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
    const memorizarMagia = char.classe === 'Mago' && (char.nivel || 1) >= 5
      && (char.magias_preparadas || []).some(m => m.circulo > 0 && magiaContaNoLimite(m));
    const botaoMemorizar = memorizarMagia
      ? '<button class="btn btn-secondary" id="btn-memorizar-magia-curto">Memorizar Magia</button>'
      : '';
    const bindMemorizar = () => {
      document.getElementById('btn-memorizar-magia-curto')?.addEventListener('click', () => {
        window.fecharModal();
        mostrarTrocaMagias();
      });
    };

    // Se tem dados de vida restantes e nao esta com PV cheio, oferecer modal
    if (dvRestantes > 0 && !jaCheio && info?.dado_vida) {
      abrirModal('Descanso Curto',
        `<div class="info-box success" style="margin-bottom:12px">Habilidades de descanso curto restauradas!</div>` +
        (memorizarMagia ? `<div style="font-size:0.85rem;margin-bottom:8px">
            <strong>Memorizar Magia:</strong> você pode trocar 1 magia preparada por outra do seu livro.
          </div>` : '') +
        numberPickerHtml('input-qtd-dv-curto', 0, 0, dvRestantes, 'Quantos dados de vida usar para cura?') +
        `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">
            Restantes: ${dvRestantes} / ${char.nivel} (d${info.dado_vida} + ${modCon} CON por dado)<br>
            <em>Apenas desconta os dados - use seus dados reais para cura.</em>
        </div>`,
        `<button class="btn btn-secondary" onclick="fecharModal()">Pular Cura</button>${botaoMemorizar}<button class="btn btn-primary" id="btn-aplicar-dv-curto">Usar Dados de Vida</button>`
      );
      setupNumberPicker('input-qtd-dv-curto');
      bindMemorizar();
      document.getElementById('btn-aplicar-dv-curto')?.addEventListener('click', () => {
        const qtd = Math.min(dvRestantes, Math.max(0, parseInt(document.getElementById('input-qtd-dv-curto-val')?.value) || 0));
        if (qtd > 0) {
          char.dados_vida_usados = (char.dados_vida_usados || 0) + qtd;
          salvar();
          toast(`Descanso curto realizado! ${qtd}x d${info.dado_vida} usado(s). Role os dados e aplique a cura.`, 'success');
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
    char.dados_vida_usados = 0;
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
    if (char.classe === 'Bárbaro') {
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
    if (char.classe === 'Bardo') {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;

      // Glamour: restaurar todos os recursos de subclasse
      if (char.subclasse === 'Colégio do Glamour' && char.recursos.bardo?.subclasses?.glamour) {
        char.recursos.bardo.subclasses.glamour.magia_fascinante_usada = false;
        char.recursos.bardo.subclasses.glamour.manto_majestade_usado = false;
        char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada = false;
      }
    }

    // Guerreiro: descanso longo restaura todos os recursos
    if (char.classe === 'Guerreiro') {
      const estadoGuerreiro = getEstadoRecursosGuerreiro();
      if (estadoGuerreiro) {
        char.recursos.guerreiro.recuperar_folego_usos_gastos = 0;
        char.recursos.guerreiro.surto_acao_usos_gastos = 0;
        char.recursos.guerreiro.indomavel_usos_gastos = 0;

        // Mestre da Batalha: restaura todos os dados de superioridade e Conheça Seu Inimigo
        if (char.subclasse === 'Mestre da Batalha') {
          char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos = 0;
          char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = false;
        }

        // Combatente Psíquico: restaura todos os dados psiônicos e habilidades
        if (char.subclasse === 'Combatente Psíquico') {
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos = 0;
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = false;
        }
      }
    }

    // Clérigo: Intervenção Divina
    if (char.classe === 'Clérigo') {
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
    if (char.classe === 'Bruxo') {
      const estado = getEstadoRecursosBruxo();
      if (estado) {
        char.recursos.bruxo.astucia_usada = false;
        estado.circulosArcanum.forEach(c => {
          if (!char.recursos.bruxo.arcanum[c]) char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
          char.recursos.bruxo.arcanum[c].usado = false;
        });

        // Subclasses: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Patrono Arquifada') {
          char.recursos.bruxo.subclasses.arquifada.passos_feericos_usos_gastos = 0;
          char.recursos.bruxo.subclasses.arquifada.fuga_nevoa_usada = false;
          char.recursos.bruxo.subclasses.arquifada.defesas_sedutoras_usada = false;
        }
        if (char.subclasse === 'Patrono Celestial') {
          char.recursos.bruxo.subclasses.celestial.luz_medicinal_dados_gastos = 0;
          char.recursos.bruxo.subclasses.celestial.vinganca_calcinante_usada = false;
        }
        if (char.subclasse === 'Patrono O Grande Antigo') {
          char.recursos.bruxo.subclasses.grande_antigo.combatente_clarividente_usado = false;
        }
        if (char.subclasse === 'Patrono Ínfero') {
          char.recursos.bruxo.subclasses.infero.sorte_tenebroso_usos_gastos = 0;
          char.recursos.bruxo.subclasses.infero.lancar_inferno_usado = false;
          // resistencia_infera_escolha NÃO é resetada — é uma escolha persistente
        }
      }
    }

    // Druida: descanso longo restaura Forma Selvagem e limpa travas de recursos
    if (char.classe === 'Druida') {
      const estado = getEstadoRecursosDruida();
      if (estado) {
        char.recursos.druida.forma_selvagem_usos_gastos = 0;
        char.recursos.druida.forma_selvagem_ativa = false;
        char.recursos.druida.companheiro_selvagem_ativo = false;
        char.recursos.druida.ressurgimento_slot_recuperado_hoje = false;

        // Subclasses: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Círculo da Lua') {
          char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos = 0;
        }
        if (char.subclasse === 'Círculo da Terra') {
          char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada = false;
          char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada = false;
        }
        if (char.subclasse === 'Círculo das Estrelas') {
          char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos = 0;
          char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos = 0;
          // constelacao_ativa e pressagio_tipo NÃO são resetados — são escolhas persistentes
        }
      }
    }

    // Guardião: descanso longo restaura usos da classe e encerra efeitos temporários
    if (char.classe === 'Guardião') {
      const estado = getEstadoRecursosGuardiao();
      if (estado) {
        char.recursos.guardiao.inimigo_favorito_usos_gastos = 0;
        char.recursos.guardiao.incansavel_usos_gastos = 0;
        char.recursos.guardiao.veu_natureza_usos_gastos = 0;
        char.recursos.guardiao.marca_predador_ativa = false;

        // Subclasses: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Andarilho Feérico') {
          char.recursos.guardiao.subclasses.andarilho.reforcos_feericos_usado = false;
          char.recursos.guardiao.subclasses.andarilho.andarilho_nebuloso_usos_gastos = 0;
        }
        // Caçador: presa_escolha e taticas_escolha NÃO resetam — são escolhas que podem mudar em descansos
        // Senhor das Feras: companheiro_tipo NÃO reseta — é escolha persistente
        if (char.subclasse === 'Vigilante das Sombras') {
          char.recursos.guardiao.subclasses.vigilante.golpe_terrivel_usos_gastos = 0;
        }
      }
    }

    // Feiticeiro: descanso longo restaura pontos e usos por descanso longo
    if (char.classe === 'Feiticeiro') {
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
    if (char.classe === 'Paladino') {
      const estado = getEstadoRecursosPaladino();
      if (estado) {
        char.recursos.paladino.maos_consagradas_gastos = 0;
        char.recursos.paladino.canalizar_divindade_usos_gastos = 0;
        char.recursos.paladino.destruicao_gratuita_usada = false;

        // Glória: restaurar recursos de subclasse
        if (char.subclasse === 'Juramento de Glória' && char.recursos.paladino.subclasses?.gloria) {
          char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos = 0;
          char.recursos.paladino.subclasses.gloria.lenda_viva_usada = false;
        }
        // Vingança: restaurar recursos de subclasse
        if (char.subclasse === 'Juramento de Vingança' && char.recursos.paladino.subclasses?.vinganca) {
          char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado = false;
        }
        // Anciões: restaurar recursos de subclasse
        if (char.subclasse === 'Juramento dos Anciões' && char.recursos.paladino.subclasses?.ancioes) {
          char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada = false;
          char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado = false;
        }
        // Devoção: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Juramento de Devoção' && char.recursos.paladino.subclasses?.devocao) {
          char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa = false;
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_usado = false;
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo = false;
        }
      }
    }

    // Monge: descanso longo restaura pontos de foco e metabolismo
    if (char.classe === 'Monge') {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        char.recursos.monge.metabolismo_usado = false;
        // Subclasses de Monge: descanso longo
        if (char.recursos.monge.subclasses) {
          // Mão Espalmada
          if (char.subclasse === 'Combatente da Mão Espalmada' && char.recursos.monge.subclasses.mao_espalmada) {
            char.recursos.monge.subclasses.mao_espalmada.integridade_usos_gastos = 0;
            char.recursos.monge.subclasses.mao_espalmada.palma_vibrante_ativa = false;
          }
          // Misericórdia
          if (char.subclasse === 'Combatente da Misericórdia' && char.recursos.monge.subclasses.misericordia) {
            char.recursos.monge.subclasses.misericordia.torrente_usos_gastos = 0;
            char.recursos.monge.subclasses.misericordia.misericordia_final_usada = false;
          }
          // Elementos
          if (char.subclasse === 'Combatente dos Elementos' && char.recursos.monge.subclasses.elementos) {
            char.recursos.monge.subclasses.elementos.sintonia_ativa = false;
          }
        }
      }
    }

    // Ladino: descanso longo restaura golpe de sorte
    if (char.classe === 'Ladino') {
      const estado = getEstadoRecursosLadino();
      if (estado) {
        char.recursos.ladino.golpe_sorte_usado = false;

        // Adaga Espiritual: restaura todos os dados psiônicos e habilidades
        if (char.subclasse === 'Adaga Espiritual') {
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos = 0;
          char.recursos.ladino.subclasses.adaga_espiritual.sussurros_gratis_usado = false;
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = false;
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = false;
        }
      }
    }

    // Mago: descanso longo restaura recuperação arcana e assinaturas
    if (char.classe === 'Mago') {
      const estado = getEstadoRecursosMago();
      if (estado) {
        char.recursos.mago.recuperacao_arcana_usada = false;
        char.recursos.mago.assinatura_magia_1_usada = false;
        char.recursos.mago.assinatura_magia_2_usada = false;
        // Subclasses de Mago: descanso longo
        if (char.recursos.mago.subclasses) {
          // Abjurador: Proteção Arcana pode ser criada novamente
          if (char.subclasse === 'Abjurador' && char.recursos.mago.subclasses.abjurador) {
            char.recursos.mago.subclasses.abjurador.protecao_criada = false;
            char.recursos.mago.subclasses.abjurador.protecao_pv_atual = 0;
          }
          // Adivinhador: Prodígio re-rola dados + O Terceiro Olho restaura
          if (char.subclasse === 'Adivinhador' && char.recursos.mago.subclasses.adivinhador) {
            const s = char.recursos.mago.subclasses.adivinhador;
            const n = (char.nivel || 1) >= 14 ? 3 : 2;
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
          if (char.subclasse === 'Evocador' && char.recursos.mago.subclasses.evocador) {
            char.recursos.mago.subclasses.evocador.sobrecarga_usos = 0;
          }
          // Ilusionista: Criaturas Espectrais + Autoimagem restauram
          if (char.subclasse === 'Ilusionista' && char.recursos.mago.subclasses.ilusionista) {
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
    const infoClasse = CLASSES_INFO[char.classe] || {};
    const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
    const temMaestria = classesMaestria.includes(char.classe);
    const ehSubConj = ehSubclasseConjuradora();
    // Diferenciar troca completa (preparadas) vs troca unica (conhecidas/subclasse)
    const temTrocaPreparadas = infoClasse.conjurador && infoClasse.tipo_conjuracao === 'preparadas' && !ehSubConj;
    const temTrocaConhecida = (infoClasse.conjurador && infoClasse.tipo_conjuracao === 'conhecidas') || ehSubConj;
    const temTrocaMagia = temTrocaPreparadas || temTrocaConhecida;
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
        const trocaUma = ['Bárbaro', 'Guerreiro'].includes(char.classe);
        conteudoModal += `
          <p style="font-size:0.9rem">Deseja trocar suas maestrias de arma?</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Como ${escHtml(char.classe)}, você pode ${trocaUma ? 'alterar <strong>uma</strong> escolha de' : 'alterar suas escolhas de'} maestria após um Descanso Longo.
          </p>
        `;
      }
      if (temTrocaMagia) {
        if (temTrocaConhecida) {
          conteudoModal += `
            <p style="font-size:0.9rem">Deseja trocar uma magia conhecida?</p>
            <p style="font-size:0.8rem;color:var(--text-muted)">
              Como ${escHtml(char.classe)}${ehSubConj ? ' (' + escHtml(char.subclasse) + ')' : ''}, você pode trocar <strong>1 magia conhecida</strong> por outra da lista de classe após um Descanso Longo.
            </p>
          `;
        } else {
          conteudoModal += `
            <p style="font-size:0.9rem">Deseja trocar suas magias preparadas?</p>
            <p style="font-size:0.8rem;color:var(--text-muted)">
              Como ${escHtml(char.classe)}, você pode alterar sua lista de magias preparadas após um Descanso Longo.
            </p>
          `;
        }
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
      const abrirTrocaMagias = (callbackPos) => {
        if (temTrocaConhecida) {
          mostrarTrocaMagiaConhecida(callbackPos);
        } else {
          mostrarTrocaMagias(callbackPos);
        }
      };

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
