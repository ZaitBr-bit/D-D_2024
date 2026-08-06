// ============================================================
// Progressao e recursos do Barbaro
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { abrirModal, bonusProficiencia, calcMod, toast } from '../../utils.js';
import { char, classeData, salvar } from '../estado.js';
import { renderFichaCompleta } from '../ficha.js';

export function getProgressaoBarbaro() {
  if (char?.classe !== 'Bárbaro' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    furiasMax: parseInt(row['Fúrias']) || 0,
    danoFuria: parseInt(String(row['Dano da Fúria'] || '0').replace('+', '')) || 0,
    maestriasMax: parseInt(row['Maestria em Arma']) || 0
  };
}

export function getEstadoFuria() {
  if (char?.classe !== 'Bárbaro') return null;
  if (!char.recursos) char.recursos = {};
  if (typeof char.recursos.furia_ativa !== 'boolean') char.recursos.furia_ativa = false;
  if (typeof char.recursos.furia_usos_gastos !== 'number') char.recursos.furia_usos_gastos = 0;

  const prog = getProgressaoBarbaro() || { furiasMax: 0, danoFuria: 0, maestriasMax: 0 };
  const usosDisponiveis = Math.max(0, prog.furiasMax - char.recursos.furia_usos_gastos);
  const nivel = char.nivel || 1;

  // Fúria Irracional: Berserker nível 6+ — Imunidade a Amedrontado e Enfeitiçado durante Fúria
  const temFuriaIrracional = char.subclasse === 'Trilha do Berserker' && nivel >= 6;

  // Resistências durante a Fúria
  let resistenciasFuria = ['Contundente', 'Cortante', 'Perfurante'];
  // Coração Selvagem - Urso: Resistência a todos os tipos exceto Energético, Necrótico, Psíquico, Radiante
  if (char.subclasse === 'Trilha do Coração Selvagem' && nivel >= 3 && char.recursos.furia_animal === 'Urso') {
    resistenciasFuria = ['Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Gélido', 'Ígneo', 'Perfurante', 'Trovejante', 'Venenoso'];
  }

  // Fanático nv14 - Fúria dos Deuses: Resistência adicional a Necrótico, Psíquico, Radiante
  const furiaDeusesAtiva = char.subclasse === 'Trilha do Fanático' && nivel >= 14 && !!char.recursos.furia_deuses_ativa;
  if (furiaDeusesAtiva) {
    ['Necrótico', 'Psíquico', 'Radiante'].forEach(t => {
      if (!resistenciasFuria.includes(t)) resistenciasFuria.push(t);
    });
  }

  // Fúria Implacável (nível 11+): CD para não cair a 0 PV
  if (typeof char.recursos.furia_implacavel_cd !== 'number') char.recursos.furia_implacavel_cd = 10;

  // Bote Instintivo (nível 7+)
  const temBoteInstintivo = nivel >= 7;

  // Força Indomável (nível 18+)
  const temForcaIndomavel = nivel >= 18;

  return {
    ativa: !!char.recursos.furia_ativa,
    usosGastos: char.recursos.furia_usos_gastos,
    usosMax: prog.furiasMax,
    usosDisponiveis,
    dano: prog.danoFuria,
    maestriasMax: prog.maestriasMax,
    furiaIrracional: temFuriaIrracional,
    resistencias: resistenciasFuria,
    temBoteInstintivo,
    temForcaIndomavel,
    furiaImplacavelCD: char.recursos.furia_implacavel_cd,
    furiaImplacavel: nivel >= 11,
    furiaDeusesAtiva,
    animalFuria: char.recursos.furia_animal || null,
    subclasse: char.subclasse
  };
}

/** Abre modal para escolha de animal ao ativar Fúria (Coração Selvagem) */
export function _abrirEscolhaAnimalFuria() {
  const nivel = char.nivel || 1;
  let opcoes = [
    { id: 'Águia', label: 'Águia', desc: 'Correr e Desengajar como Ação Bônus ao ativar e durante a Fúria.' },
    { id: 'Lobo', label: 'Lobo', desc: 'Aliados têm Vantagem em ataques contra inimigos a até 1,5m de você.' },
    { id: 'Urso', label: 'Urso', desc: 'Resistência a todos os tipos de dano exceto Energético, Necrótico, Psíquico e Radiante.' }
  ];

  // Poder dos Selvagens (nível 14+): opções adicionais
  if (nivel >= 14) {
    opcoes.push(
      { id: 'Carneiro', label: 'Carneiro', desc: 'Pode impor Caído em criaturas Grandes ou menores com ataque corpo a corpo.' },
      { id: 'Falcão', label: 'Falcão', desc: 'Voo igual ao Deslocamento (sem armadura).' },
      { id: 'Leão', label: 'Leão', desc: 'Inimigos a 1,5m têm Desvantagem em ataques contra alvos que não sejam você.' }
    );
  }

  const html = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <p style="font-size:0.85rem;color:var(--text-muted);text-align:center">Escolha o espírito animal para esta Fúria:</p>
      ${opcoes.map(o => `
        <button class="btn btn-secondary" data-animal-furia="${o.id}" style="text-align:left;padding:8px 12px">
          <strong>${o.label}</strong><br>
          <span style="font-size:0.8rem;color:var(--text-muted)">${o.desc}</span>
        </button>
      `).join('')}
    </div>
  `;

  abrirModal('Fúria dos Selvagens', html, '');

  document.querySelectorAll('[data-animal-furia]').forEach(btn => {
    btn.addEventListener('click', () => {
      const animal = btn.dataset.animalFuria;
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_animal = animal;
      salvar();
      window.fecharModal();
      toast(`Espírito de ${animal} ativado!`, 'success');
      renderFichaCompleta();
    });
  });
}

/** Setup de eventos para subclasses do Bárbaro (Fanático, Coração Selvagem, etc.) */
export function setupEventosSubclasseBarbaro() {
  // Campeão dos Deuses (Fanático nv3): usar d12 para cura
  document.querySelectorAll('[data-campeao-deuses]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (char.classe !== 'Bárbaro' || char.subclasse !== 'Trilha do Fanático') return;
      if (!char.recursos) char.recursos = {};
      const nivel = char.nivel || 1;
      const dadosMax = nivel >= 17 ? 7 : nivel >= 12 ? 6 : nivel >= 6 ? 5 : 4;
      const gastos = char.recursos.campeao_deuses_gastos || 0;
      if (gastos >= dadosMax) {
        toast('Sem dados de cura disponíveis. Descanse para recuperar.', 'error');
        return;
      }
      // Modal para escolher quantos dados gastar
      const disponiveis = dadosMax - gastos;
      const pvMax = char.pv_max_override || char.pv_max;
      abrirModal('Campeão dos Deuses - Cura',
        `<div style="text-align:center;font-size:0.9rem">
          <p>Dados disponíveis: <strong>${disponiveis}d12</strong></p>
          <p>Como Ação Bônus, gaste dados e recupere PV igual ao total.</p>
          <div style="margin-top:8px">
            <label class="form-label">Quantos d12 gastar?</label>
            <input type="number" id="input-campeao-dados" min="1" max="${disponiveis}" value="1" style="width:60px;text-align:center;padding:4px;border-radius:4px;border:1px solid var(--border)">
          </div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">O resultado será simulado automaticamente (role fisicamente se preferir)</p>
        </div>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-success" id="btn-campeao-curar">Curar</button>'
      );
      document.getElementById('btn-campeao-curar')?.addEventListener('click', () => {
        const qtd = Math.min(disponiveis, Math.max(1, parseInt(document.getElementById('input-campeao-dados')?.value) || 1));
        // Simular rolagem
        let total = 0;
        for (let i = 0; i < qtd; i++) total += Math.floor(Math.random() * 12) + 1;
        char.recursos.campeao_deuses_gastos = gastos + qtd;
        char.pv_atual = Math.min(pvMax, char.pv_atual + total);
        salvar();
        window.fecharModal();
        toast(`Campeão dos Deuses: ${qtd}d12 = ${total} PV recuperados!`, 'success');
        renderFichaCompleta();
      });
    });
  });

  // Concentração Fanática (Fanático nv6): marcar como usada
  document.querySelectorAll('[data-concentracao-fanatica]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      if (char.recursos.concentracao_fanatica_usada) {
        toast('Concentração Fanática já usada nesta Fúria.', 'error');
        return;
      }
      char.recursos.concentracao_fanatica_usada = true;
      const danoFuria = getEstadoFuria()?.dano || 0;
      salvar();
      toast(`Concentração Fanática usada! Re-role a salvaguarda com +${danoFuria}.`, 'success');
      renderFichaCompleta();
    });
  });

  // Presença Zelosa (Fanático nv10): usar ou restaurar gastando Fúria
  document.querySelectorAll('[data-presenca-zelosa]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      const acao = btn.dataset.presencaZelosa;
      if (acao === 'usar') {
        if (char.recursos.presenca_zelosa_usada) {
          toast('Presença Zelosa já usada.', 'error');
          return;
        }
        char.recursos.presenca_zelosa_usada = true;
        salvar();
        toast('Presença Zelosa ativada! Até 10 aliados: Vantagem em ataques e salvaguardas até o início do próximo turno.', 'success');
        renderFichaCompleta();
      } else if (acao === 'restaurar') {
        // Gastar 1 uso de Fúria para restaurar
        const estado = getEstadoFuria();
        if (!estado || estado.usosDisponiveis <= 0) {
          toast('Sem usos de Fúria para restaurar Presença Zelosa.', 'error');
          return;
        }
        char.recursos.furia_usos_gastos = (char.recursos.furia_usos_gastos || 0) + 1;
        char.recursos.presenca_zelosa_usada = false;
        salvar();
        toast('Presença Zelosa restaurada (1 uso de Fúria gasto).', 'success');
        renderFichaCompleta();
      }
    });
  });

  // Fúria dos Deuses (Fanático nv14): toggle forma divina
  document.querySelectorAll('[data-furia-deuses]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      const acao = btn.dataset.furiaDeuses;
      if (acao === 'ativar') {
        if (char.recursos.furia_deuses_usada) {
          toast('Fúria dos Deuses já usada. Recarrega no Descanso Longo.', 'error');
          return;
        }
        char.recursos.furia_deuses_ativa = true;
        char.recursos.furia_deuses_usada = true;
        salvar();
        toast('Fúria dos Deuses ativada! Resistência: Necrótico/Psíquico/Radiante + Voo + Revivificação', 'success');
        renderFichaCompleta();
      } else {
        char.recursos.furia_deuses_ativa = false;
        salvar();
        toast('Forma divina encerrada.', 'info');
        renderFichaCompleta();
      }
    });
  });

  // Aspecto dos Selvagens (Coração Selvagem nv6): escolha persistente
  document.querySelectorAll('[data-aspecto-selvagem]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      if (!char.recursos) char.recursos = {};
      char.recursos.aspecto_selvagem = e.target.value || null;
      salvar();
      toast(`Aspecto dos Selvagens: ${e.target.value || 'nenhum'}`, 'success');
      renderFichaCompleta();
    });
  });

  // Berserker: Presença Intimidante (nv10) — usar ou restaurar gastando Fúria
  document.querySelectorAll('[data-berserker-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      const acao = btn.dataset.berserkerAcao;
      if (acao === 'presenca-intimidante') {
        if (char.recursos.presenca_intimidante_usada) {
          toast('Presença Intimidante já usada.', 'error');
          return;
        }
        char.recursos.presenca_intimidante_usada = true;
        const modFor = calcMod(char.atributos.forca);
        const cd = 8 + bonusProficiencia(char.nivel || 1) + modFor;
        salvar();
        toast(`Presença Intimidante ativada! CD ${cd}. Criaturas escolhidas ficam Amedrontadas.`, 'success');
        renderFichaCompleta();
      } else if (acao === 'presenca-restaurar') {
        const estado = getEstadoFuria();
        if (!estado || estado.usosDisponiveis <= 0) {
          toast('Sem usos de Fúria para restaurar Presença Intimidante.', 'error');
          return;
        }
        char.recursos.furia_usos_gastos = (char.recursos.furia_usos_gastos || 0) + 1;
        char.recursos.presenca_intimidante_usada = false;
        salvar();
        toast('Presença Intimidante restaurada (1 uso de Fúria gasto).', 'success');
        renderFichaCompleta();
      }
    });
  });
}