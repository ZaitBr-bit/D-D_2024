// ============================================================
// Habilidades ativas e itens de caracteristica
//
// As duas funcoes daqui somam ~4.600 linhas e NAO foram quebradas por
// classe de proposito: as flags por classe sao calculadas no topo e
// costuradas dentro de um unico template literal, entao separa-las
// exigiria reescrever a montagem do HTML. Ver spec secao 5.3.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { abrirModal, bonusProficiencia, calcMod, detectarRecarga, ehHabilidadeAtiva, escHtml, fmtMod, getDeslocamento, getEspacosMagia, mdParaHtml, semAcento, toast } from '../utils.js';
import { _abrirEscolhaAnimalFuria, getEstadoFuria, getProgressaoBarbaro } from './classes/barbaro.js';
import { getEstadoInspiracaoBardo } from './classes/bardo.js';
import { abrirModalPactoDoTomo, abrirModalRecursosBruxo, getEstadoRecursosBruxo, recuperarEspacosMagiaBruxo } from './classes/bruxo.js';
import { getEstadoRecursosClerigo, getEstadoSubclassesClerigo, getProgressaoClerigo } from './classes/clerigo.js';
import { consumirUsoFormaSelvagem, getEstadoRecursosDruida } from './classes/druida.js';
import { gastarPontosFeiticaria, getEstadoRecursosFeiticeiro, recuperarPontosFeiticaria } from './classes/feiticeiro.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { getEstadoRecursosGuerreiro } from './classes/guerreiro.js';
import { getEstadoRecursosLadino } from './classes/ladino.js';
import { getEstadoRecursosMago } from './classes/mago.js';
import { getEstadoRecursosMonge } from './classes/monge.js';
import { getEstadoRecursosPaladino } from './classes/paladino.js';
import { ataqueImprudenteAtivo, formatarMetros, getDeslocamentoFinal, parseMetros, temArmaduraPesadaEquipada } from './combate.js';
import { char, especiesCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { numberPickerHtml, setupNumberPicker } from './hp-descanso.js';
import { abrirModalMaestrias } from './maestrias.js';
import { OPCOES_METAMAGIA, consumirEspacoMagiaDisponivel, recuperarEspacoMagia } from './magias.js';

// --- Habilidades (Ativas) ---
export function setupEventosHabilidades() {
  // Toggle simples (1 uso)
  document.querySelectorAll('[data-toggle-uso]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const key = btn.dataset.toggleUso;
      if (!char.usos_habilidades) char.usos_habilidades = {};
      char.usos_habilidades[key] = !char.usos_habilidades[key];
      salvar();
      renderFichaCompleta();
    });
  });

  // Usar habilidade com múltiplos usos
  document.querySelectorAll('[data-usar-habilidade]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const key = btn.dataset.usarHabilidade;
      const usosMax = parseInt(btn.dataset.usosMax) || 1;
      if (!char.usos_habilidades) char.usos_habilidades = {};
      const atual = typeof char.usos_habilidades[key] === 'number' ? char.usos_habilidades[key] : 0;
      if (atual >= usosMax) {
        toast('Usos esgotados! Descanse para recuperar.', 'error');
        return;
      }
      char.usos_habilidades[key] = atual + 1;
      salvar();
      renderFichaCompleta();
    });
  });

  // Aasimar: Mãos Curativas - botão de cura com rolagem de PB d4s
  document.querySelectorAll('[data-maos-curativas]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.especie !== 'Aasimar') return;
      const key = 'especie_Mãos Curativas';
      if (!char.usos_habilidades) char.usos_habilidades = {};
      if (char.usos_habilidades[key]) {
        toast('Mãos Curativas já usado. Descanse para recuperar.', 'error');
        return;
      }
      const pb = bonusProficiencia(char.nivel || 1);
      // Simular rolagem de PB d4s
      let total = 0;
      const resultados = [];
      for (let i = 0; i < pb; i++) {
        const roll = Math.floor(Math.random() * 4) + 1;
        resultados.push(roll);
        total += roll;
      }
      char.usos_habilidades[key] = true;
      // Mostrar resultado para o jogador aplicar
      abrirModal('Mãos Curativas', `
        <div style="text-align:center;padding:16px">
          <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Cura: ${total} PV</div>
          <div style="font-size:0.85rem;color:var(--text-muted)">${pb}d4 = [${resultados.join(', ')}]</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Toque em uma criatura para curar.</div>
        </div>
      `, '<button class="btn btn-primary" onclick="fecharModal()">OK</button>');
      salvar();
      renderFichaCompleta();
    });
  });

  // Recursos específicos do Clérigo
  document.querySelectorAll('[data-clerigo-cd-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;

      const estado = getEstadoRecursosClerigo();
      if (!estado || estado.canalizarDivindadeUsosDisponiveis <= 0) {
        toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
        return;
      }

      const acao = btn.dataset.clerigoCdAcao;
      const modSab = calcMod(char.atributos.sabedoria);
      const dadosCentelha = (char.nivel >= 18) ? '4d8' : (char.nivel >= 13) ? '3d8' : (char.nivel >= 7) ? '2d8' : '1d8';

      // Consome 1 uso
      char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;

      if (acao === 'centelha') {
        toast(`Centelha Divina usada (${dadosCentelha} + ${fmtMod(modSab)}).`, 'success');
      } else if (acao === 'expulsar') {
        toast('Expulsar Mortos-Vivos usado.', 'success');
      } else if (acao === 'fulminar') {
        toast(`Fulminar Mortos-Vivos usado (${Math.max(1, modSab)}d8).`, 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-clerigo-golpes-opcao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.clerigo) char.recursos.clerigo = {};

      char.recursos.clerigo.golpes_abencoados_opcao = btn.dataset.clerigoGolpesOpcao;
      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-clerigo-intervencao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.clerigo) char.recursos.clerigo = {};

      const acao = btn.dataset.clerigoIntervencao;
      const bloqueada = !!char.recursos.clerigo.intervencao_divina_bloqueada;
      const restantes = char.recursos.clerigo.intervencao_divina_descansos_restantes || 0;

      if (bloqueada) {
        if (restantes > 0) {
          toast(`Intervenção Divina bloqueada por ${restantes} descanso(s) longo(s).`, 'error');
        } else {
          toast('Intervenção Divina já foi usada e recarrega em descanso longo.', 'error');
        }
        return;
      }

      if (acao === 'desejo') {
        const cooldown = Math.floor(Math.random() * 3) + Math.floor(Math.random() * 3) + 2; // 2d4
        char.recursos.clerigo.intervencao_divina_descansos_restantes = cooldown;
        char.recursos.clerigo.intervencao_divina_bloqueada = true;
        toast(`Intervenção Divina Maior usada com Desejo. Recarrega em ${cooldown} descanso(s) longo(s).`, 'success');
      } else {
        char.recursos.clerigo.intervencao_divina_descansos_restantes = 0;
        char.recursos.clerigo.intervencao_divina_bloqueada = true;
        toast('Intervenção Divina usada. Recarrega no próximo descanso longo.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-clerigo-subclasse-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;

      const acao = btn.dataset.clerigoSubclasseAcao;
      const estadoClerigo = getEstadoRecursosClerigo();
      const estadoSub = getEstadoSubclassesClerigo();
      if (!estadoClerigo || !estadoSub) return;

      // Ações que consomem Canalizar Divindade
      const usaCanalizar = [
        'guerra_ataque_direcionado',
        'guerra_bencao_deus',
        'luz_brilho_amanhecer',
        'trapaca_invocar_duplicidade',
        'vida_preservar_vida'
      ].includes(acao);

      if (usaCanalizar && estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0) {
        toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
        return;
      }

      switch (acao) {
        case 'guerra_ataque_direcionado':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast('Ataque Direcionado usado.', 'success');
          break;

        case 'guerra_bencao_deus':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast('Bênção do Deus da Guerra usada.', 'success');
          break;

        case 'guerra_sacerdote_guerra':
          if (estadoSub.guerra.sacerdoteUsosDisponiveis <= 0) {
            toast('Sem usos de Sacerdote da Guerra disponíveis.', 'error');
            return;
          }
          char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos += 1;
          toast('Sacerdote da Guerra usado.', 'success');
          break;

        case 'luz_brilho_amanhecer':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast('Brilho do Amanhecer usado.', 'success');
          break;

        case 'luz_labareda_protetora':
          if (estadoSub.luz.labaredaUsosDisponiveis <= 0) {
            toast('Sem usos de Labareda Protetora disponíveis.', 'error');
            return;
          }
          char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos += 1;
          toast('Labareda Protetora usada.', 'success');
          break;

        case 'luz_coroa_luz':
          if (estadoSub.luz.coroaUsosDisponiveis <= 0) {
            toast('Sem usos de Coroa de Luz disponíveis.', 'error');
            return;
          }
          char.recursos.clerigo.subclasses.luz.coroa_luz_usos_gastos += 1;
          toast('Coroa de Luz usada.', 'success');
          break;

        case 'trapaca_bencao_toggle':
          char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa = !char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa;
          toast(
            char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa
              ? 'Bênção do Trapaceiro ativada.'
              : 'Bênção do Trapaceiro encerrada.',
            'success'
          );
          break;

        case 'trapaca_invocar_duplicidade':
          if (!char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa) {
            char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
            char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = true;
            toast('Invocar Duplicidade ativada.', 'success');
          } else {
            char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = false;
            toast('Invocar Duplicidade encerrada.', 'success');
          }
          break;

        case 'vida_preservar_vida':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast(`Preservar a Vida usado (pool de ${5 * (char.nivel || 1)} PV).`, 'success');
          break;

        default:
          return;
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Bruxo: subclasses interativas
  document.querySelectorAll('[data-bruxo-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bruxo') return;
      const estado = getEstadoRecursosBruxo();
      if (!estado) return;
      const acao = el.dataset.bruxoSubclasseAcao;
      const sub = char.recursos.bruxo.subclasses;

      // Passos Feéricos
      if (acao === 'passos_feericos') {
        if (estado.passosFeericosDisponiveis <= 0) { toast('Sem usos de Passos Feéricos.', 'error'); return; }
        sub.arquifada.passos_feericos_usos_gastos += 1;
        toast(`Passos Feéricos! Teletransporte 9m. Restantes: ${estado.passosFeericosDisponiveis - 1}/${estado.passosFeericosMax}`, 'success');
      }
      // Fuga em Névoa
      if (acao === 'fuga_nevoa') {
        if (sub.arquifada.fuga_nevoa_usada) { toast('Fuga em Névoa já usada.', 'error'); return; }
        sub.arquifada.fuga_nevoa_usada = true;
        toast('Fuga em Névoa! Reação: Passo Nebuloso + efeito Desvanecedor ou Terrível.', 'success');
      }
      if (acao === 'fuga_nevoa_restaurar') {
        sub.arquifada.fuga_nevoa_usada = false;
        toast('Fuga em Névoa restaurada (Espaço de Pacto gasto).', 'success');
      }
      // Defesas Sedutoras
      if (acao === 'defesas_sedutoras') {
        if (sub.arquifada.defesas_sedutoras_usada) { toast('Defesas Sedutoras já usada.', 'error'); return; }
        sub.arquifada.defesas_sedutoras_usada = true;
        toast('Defesas Sedutoras! Atacante deve fazer salvaguarda Sabedoria ou ficar Enfeitiçado.', 'success');
      }
      if (acao === 'defesas_sedutoras_restaurar') {
        sub.arquifada.defesas_sedutoras_usada = false;
        toast('Defesas Sedutoras restaurada (Espaço de Pacto gasto).', 'success');
      }
      // Luz Medicinal
      if (acao === 'luz_medicinal') {
        if (estado.luzMedicinalDadosDisponiveis <= 0) { toast('Sem dados de Luz Medicinal.', 'error'); return; }
        sub.celestial.luz_medicinal_dados_gastos += 1;
        toast(`Luz Medicinal! d6 de cura usado. Restantes: ${estado.luzMedicinalDadosDisponiveis - 1}/${estado.luzMedicinalDadosMax}`, 'success');
      }
      // Vingança Calcinante
      if (acao === 'vinganca_calcinante') {
        if (sub.celestial.vinganca_calcinante_usada) { toast('Vingança Calcinante já usada.', 'error'); return; }
        sub.celestial.vinganca_calcinante_usada = true;
        const modCar = Math.max(1, calcMod(char.atributos.carisma));
        toast(`Vingança Calcinante! 2d8+${modCar} dano Radiante em criaturas a 9m.`, 'success');
      }
      // Combatente Clarividente
      if (acao === 'combatente_clarividente') {
        if (sub.grande_antigo.combatente_clarividente_usado) { toast('Combatente Clarividente já usado.', 'error'); return; }
        sub.grande_antigo.combatente_clarividente_usado = true;
        toast('Combatente Clarividente! Vantagem em todos os ataques neste turno.', 'success');
      }
      if (acao === 'combatente_clarividente_restaurar') {
        sub.grande_antigo.combatente_clarividente_usado = false;
        toast('Combatente Clarividente restaurado (Espaço de Pacto gasto).', 'success');
      }
      // Sorte do Tenebroso
      if (acao === 'sorte_tenebroso') {
        if (estado.sorteTenebrosoDisponiveis <= 0) { toast('Sem usos de Sorte do Tenebroso.', 'error'); return; }
        sub.infero.sorte_tenebroso_usos_gastos += 1;
        toast(`Sorte do Tenebroso! +1d10 ao resultado. Restantes: ${estado.sorteTenebrosoDisponiveis - 1}/${estado.sorteTenebrosoMax}`, 'success');
      }
      // Lançar no Inferno
      if (acao === 'lancar_inferno') {
        if (sub.infero.lancar_inferno_usado) { toast('Lançar no Inferno já usado.', 'error'); return; }
        sub.infero.lancar_inferno_usado = true;
        toast('Lançar no Inferno! Alvo faz salvaguarda Carisma: 8d10 Psíquico + 8d10 Ígneo.', 'success');
      }
      if (acao === 'lancar_inferno_restaurar') {
        sub.infero.lancar_inferno_usado = false;
        toast('Lançar no Inferno restaurado (Espaço de Pacto gasto).', 'success');
      }

      salvar();
      renderFichaCompleta();
    };
    // Selector para Resistência Ínfera
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Bruxo') return;
        const estado = getEstadoRecursosBruxo();
        if (!estado) return;
        char.recursos.bruxo.subclasses.infero.resistencia_infera_escolha = el.value;
        toast(`Resistência Ínfera: ${el.value || 'Nenhuma'}`, 'success');
        salvar();
        renderFichaCompleta();
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  // Guardião: subclasses interativas
  document.querySelectorAll('[data-guardiao-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Guardião') return;
      const estado = getEstadoRecursosGuardiao();
      if (!estado) return;
      const acao = el.dataset.guardiaoSubclasseAcao;
      const sub = char.recursos.guardiao.subclasses;

      // Reforços Feéricos
      if (acao === 'reforcos_feericos') {
        if (sub.andarilho.reforcos_feericos_usado) { toast('Reforços Feéricos já usado.', 'error'); return; }
        sub.andarilho.reforcos_feericos_usado = true;
        toast('Reforços Feéricos! Convocar Feérico sem slot, sem Material, sem Concentração (1 min).', 'success');
      }
      // Andarilho Nebuloso
      if (acao === 'andarilho_nebuloso') {
        if (estado.andarilhoNebulosoDisponiveis <= 0) { toast('Sem usos de Andarilho Nebuloso.', 'error'); return; }
        sub.andarilho.andarilho_nebuloso_usos_gastos += 1;
        toast(`Passo Nebuloso sem slot! Teleporte 9m + 1 criatura. Restantes: ${estado.andarilhoNebulosoDisponiveis - 1}/${estado.andarilhoNebulosoMax}`, 'success');
      }
      // Golpe Terrível
      if (acao === 'golpe_terrivel') {
        if (estado.golpeTerrivelDisponiveis <= 0) { toast('Sem usos de Golpe Terrível.', 'error'); return; }
        sub.vigilante.golpe_terrivel_usos_gastos += 1;
        const dano = (char.nivel || 1) >= 11 ? '2d8' : '2d6';
        toast(`Golpe Terrível! ${dano} Psíquico adicional. Restantes: ${estado.golpeTerrivelDisponiveis - 1}/${estado.golpeTerrivelMax}`, 'success');
      }

      salvar();
      renderFichaCompleta();
    };
    // SELECTs: presa, táticas, companheiro
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Guardião') return;
        const estado = getEstadoRecursosGuardiao();
        if (!estado) return;
        const acao = el.dataset.guardiaoSubclasseAcao;
        if (acao === 'presa_escolha') {
          char.recursos.guardiao.subclasses.cacador.presa_escolha = el.value;
          toast(`Presa do Caçador: ${el.value || 'Nenhuma'}`, 'success');
        }
        if (acao === 'taticas_escolha') {
          char.recursos.guardiao.subclasses.cacador.taticas_escolha = el.value;
          toast(`Táticas Defensivas: ${el.value || 'Nenhuma'}`, 'success');
        }
        if (acao === 'companheiro_tipo') {
          char.recursos.guardiao.subclasses.feras.companheiro_tipo = el.value;
          toast(`Companheiro Primal: ${el.value || 'Nenhum'}`, 'success');
        }
        salvar();
        renderFichaCompleta();
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  // Druida: subclasses interativas
  document.querySelectorAll('[data-druida-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida') return;
      const estado = getEstadoRecursosDruida();
      if (!estado) return;
      const acao = el.dataset.druidaSubclasseAcao;
      const sub = char.recursos.druida.subclasses;

      // Passo Lunar
      if (acao === 'passo_lunar') {
        if (estado.passoLunarDisponiveis <= 0) { toast('Sem usos de Passo Lunar.', 'error'); return; }
        sub.lua.passo_lunar_usos_gastos += 1;
        toast(`Passo Lunar! Teleporte 9m + Vantagem no próximo ataque. Restantes: ${estado.passoLunarDisponiveis - 1}/${estado.passoLunarMax}`, 'success');
      }
      if (acao === 'passo_lunar_restaurar') {
        if (estado.passoLunarDisponiveis >= estado.passoLunarMax) { toast('Passo Lunar já está completo.', 'error'); return; }
        sub.lua.passo_lunar_usos_gastos = Math.max(0, sub.lua.passo_lunar_usos_gastos - 1);
        toast('Passo Lunar restaurado (slot de 2º círculo+ gasto).', 'success');
      }
      // Recuperação Natural — magia grátis
      if (acao === 'recuperacao_magia') {
        if (sub.terra.recuperacao_natural_magia_usada) { toast('Magia de círculo grátis já usada.', 'error'); return; }
        sub.terra.recuperacao_natural_magia_usada = true;
        toast('Recuperação Natural — magia de círculo druídico conjurada sem slot!', 'success');
      }
      // Recuperação Natural — slots (desc curto)
      if (acao === 'recuperacao_slots') {
        if (sub.terra.recuperacao_natural_slots_usada) { toast('Recuperação de slots já usada neste descanso longo.', 'error'); return; }
        sub.terra.recuperacao_natural_slots_usada = true;
        const metadeNivel = Math.ceil((char.nivel || 1) / 2);
        toast(`Recuperação Natural — recupere até ${metadeNivel} círculos de slots (nenhum 6+). Marque manualmente nos slots.`, 'success');
      }
      // Mapa Estelar — Raio Guia grátis
      if (acao === 'mapa_estelar') {
        if (estado.mapaEstelarDisponiveis <= 0) { toast('Sem usos grátis de Raio Guia.', 'error'); return; }
        sub.estrelas.mapa_estelar_usos_gastos += 1;
        toast(`Raio Guia conjurado sem slot! Restantes: ${estado.mapaEstelarDisponiveis - 1}/${estado.mapaEstelarMax}`, 'success');
      }
      // Presságio Cósmico — usar reação
      if (acao === 'pressagio_usar') {
        if (estado.pressagioDisponiveis <= 0) { toast('Sem usos de Presságio Cósmico.', 'error'); return; }
        sub.estrelas.pressagio_cosmico_usos_gastos += 1;
        const tipo = estado.pressagioTipo === 'prosperidade' ? '+1d6' : estado.pressagioTipo === 'infortunio' ? '-1d6' : '1d6';
        toast(`Presságio Cósmico! Reação: ${tipo} ao teste. Restantes: ${estado.pressagioDisponiveis - 1}/${estado.pressagioMax}`, 'success');
      }

      salvar();
      renderFichaCompleta();
    };
    // SELECTs: constelação e tipo de presságio
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Druida') return;
        const estado = getEstadoRecursosDruida();
        if (!estado) return;
        const acao = el.dataset.druidaSubclasseAcao;
        if (acao === 'constelacao_escolha') {
          const novaConstelacao = el.value;
          const constelacaoAnterior = char.recursos.druida.subclasses.estrelas.constelacao_ativa || '';
          // Ativar constelação consome 1 uso de Forma Selvagem
          if (novaConstelacao && !constelacaoAnterior) {
            if (!consumirUsoFormaSelvagem(1)) {
              toast('Sem usos de Forma Selvagem disponíveis.', 'error');
              el.value = constelacaoAnterior;
              return;
            }
          }
          char.recursos.druida.subclasses.estrelas.constelacao_ativa = novaConstelacao;
          toast(`Constelação ativa: ${novaConstelacao || 'Nenhuma'}`, 'success');
        }
        if (acao === 'pressagio_tipo') {
          char.recursos.druida.subclasses.estrelas.pressagio_tipo = el.value;
          const label = el.value === 'prosperidade' ? 'Prosperidade (+1d6)' : el.value === 'infortunio' ? 'Infortúnio (-1d6)' : 'Nenhum';
          toast(`Presságio Cósmico: ${label}`, 'success');
        }
        salvar();
        renderFichaCompleta();
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  // Bardo: subclasses interativas (Glamour + Dança + Conhecimento)
  document.querySelectorAll('[data-bardo-subclasse-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bardo') return;
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.bardo) char.recursos.bardo = {};
      if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = {};
      if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};

      const acao = btn.dataset.bardoSubclasseAcao;
      const glamour = char.recursos.bardo.subclasses.glamour;

      // Ações que consomem 1 Inspiração de Bardo
      const usaInspiracao = [
        'danca_gingado_coordenado', 'danca_movimento_inspirador',
        'conhecimento_palavras_interrupcao', 'conhecimento_pericia_inigualavel',
        'glamour_manto_inspiracao'
      ].includes(acao);

      if (usaInspiracao) {
        const estadoInsp = getEstadoInspiracaoBardo();
        if (!estadoInsp || estadoInsp.usosDisponiveis <= 0) {
          toast('Sem usos de Inspiração Bárdica disponíveis.', 'error');
          return;
        }
        char.recursos.inspiracao_bardo_usos_gastos += 1;
      }

      switch (acao) {
        case 'danca_gingado_coordenado':
          toast('Gingado Coordenado! +dado de Inspiração na Iniciativa para você e aliados em 9m.', 'success');
          break;

        case 'danca_movimento_inspirador':
          toast('Movimento Inspirador! Reação: mova sem provocar + aliado em 9m também move.', 'success');
          break;

        case 'conhecimento_palavras_interrupcao':
          toast('Palavras de Interrupção! Reação: subtraia dado de Inspiração do resultado do alvo.', 'success');
          break;

        case 'conhecimento_pericia_inigualavel':
          toast('Perícia Inigualável! +dado de Inspiração ao teste/ataque falho.', 'success');
          break;

        case 'glamour_manto_inspiracao':
          toast('Manto de Inspiração ativado! PV temporários + Reação para mover sem provocar.', 'success');
          break;

        case 'glamour_magia_fascinante':
          if (glamour.magia_fascinante_usada) {
            toast('Magia Fascinante já usada.', 'error');
            return;
          }
          glamour.magia_fascinante_usada = true;
          toast('Magia Fascinante ativada! Criaturas Enfeitiçadas por 1 minuto.', 'success');
          break;

        case 'glamour_magia_fascinante_restaurar': {
          // Gastar 1 uso de Inspiração Bárdica para restaurar
          const estadoInsp = getEstadoInspiracaoBardo();
          if (!estadoInsp || estadoInsp.usosDisponiveis <= 0) {
            toast('Sem usos de Inspiração Bárdica para restaurar.', 'error');
            return;
          }
          char.recursos.inspiracao_bardo_usos_gastos += 1;
          glamour.magia_fascinante_usada = false;
          toast('Magia Fascinante restaurada (1 uso de Inspiração gasto).', 'success');
          break;
        }

        case 'glamour_manto_majestade':
          if (glamour.manto_majestade_usado) {
            toast('Manto de Majestade já usado.', 'error');
            return;
          }
          glamour.manto_majestade_usado = true;
          toast('Manto de Majestade ativado por 1 minuto! Comando como Ação Bônus.', 'success');
          break;

        case 'glamour_majestade_inquebravel':
          if (glamour.majestade_inquebravel_usada) {
            toast('Majestade Inquebrável já usada.', 'error');
            return;
          }
          glamour.majestade_inquebravel_usada = true;
          toast('Majestade Inquebrável usada! Aparência restaurada + Santuário.', 'success');
          break;

        default:
          return;
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-feiticeiro-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Feiticeiro') return;

      const estado = getEstadoRecursosFeiticeiro();
      if (!estado) return;
      const acao = btn.dataset.feiticeiroAcao;

      if (acao === 'ativar-feiticaria-inata') {
        if (estado.feiticariaInataUsosDisponiveis > 0) {
          char.recursos.feiticeiro.feiticaria_inata_usos_gastos += 1;
          char.recursos.feiticeiro.feiticaria_inata_ativa = true;
          toast('Feitiçaria Inata ativada por 1 minuto.', 'success');
        } else if ((char.nivel || 1) >= 7 && gastarPontosFeiticaria(2)) {
          char.recursos.feiticeiro.feiticaria_inata_ativa = true;
          toast('Feitiçaria Inata ativada com Feitiçaria Encarnada (-2 PF).', 'success');
        } else {
          toast('Sem usos de Feitiçaria Inata disponíveis.', 'error');
          return;
        }
      }

      if (acao === 'encerrar-feiticaria-inata') {
        char.recursos.feiticeiro.feiticaria_inata_ativa = false;
        toast('Feitiçaria Inata encerrada.', 'info');
      }

      if (acao === 'restauracao-feiticeira') {
        if ((char.nivel || 1) < 5) {
          toast('Restauração Feiticeira exige nível 5.', 'error');
          return;
        }
        if (char.recursos.feiticeiro.restauracao_feiticeira_usada) {
          toast('Restauração Feiticeira já foi usada neste descanso longo.', 'error');
          return;
        }
        const rec = Math.floor((char.nivel || 1) / 2);
        const recuperavel = Math.min(rec, estado.pontosMax - estado.pontosAtuais);
        if (recuperavel <= 0) {
          toast('Seus Pontos de Feitiçaria já estão no máximo.', 'info');
          return;
        }
        recuperarPontosFeiticaria(recuperavel);
        char.recursos.feiticeiro.restauracao_feiticeira_usada = true;
        toast(`Restauração Feiticeira recuperou ${recuperavel} PF.`, 'success');
      }

      if (acao === 'converter-slot-ponto') {
        abrirModal('Converter Slot em Pontos de Feitiçaria', `
          <div class="form-group">
            <label class="form-label" for="slot-para-pf">Círculo do espaço de magia</label>
            <select class="form-input" id="slot-para-pf">
              ${Object.keys(char.espacos_magia || {}).map(c => `<option value="${c}">${c}º círculo</option>`).join('')}
            </select>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-slot-para-pf">Converter</button>');

        document.getElementById('btn-slot-para-pf')?.addEventListener('click', () => {
          const c = parseInt(document.getElementById('slot-para-pf')?.value) || 1;
          const slot = char.espacos_magia?.[c];
          const estAtual = getEstadoRecursosFeiticeiro();
          if (!slot || (slot.usados || 0) >= (slot.total || 0)) {
            toast(`Sem espaço de ${c}º círculo disponível.`, 'error');
            return;
          }
          if (!estAtual || estAtual.pontosAtuais + c > estAtual.pontosMax) {
            toast('Conversão excede o máximo de Pontos de Feitiçaria.', 'error');
            return;
          }
          slot.usados += 1;
          recuperarPontosFeiticaria(c);
          salvar();
          window.fecharModal();
          toast(`Espaço de ${c}º círculo convertido em ${c} PF.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'converter-ponto-slot') {
        const custos = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
        abrirModal('Criar Espaço de Magia', `
          <div class="form-group">
            <label class="form-label" for="pf-para-slot">Círculo do espaço (máx. 5º)</label>
            <select class="form-input" id="pf-para-slot">
              ${[1, 2, 3, 4, 5].filter(c => (char.nivel || 1) >= (c === 1 ? 2 : c === 2 ? 3 : c === 3 ? 5 : c === 4 ? 7 : 9)).map(c => `<option value="${c}">${c}º círculo (custo ${custos[c]} PF)</option>`).join('')}
            </select>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-pf-para-slot">Criar</button>');

        document.getElementById('btn-pf-para-slot')?.addEventListener('click', () => {
          const c = parseInt(document.getElementById('pf-para-slot')?.value) || 1;
          const custo = custos[c] || 2;
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          // Rastrear slots extras separadamente para não serem sobrescritos pelo sync
          if (!char.espacos_magia_extras) char.espacos_magia_extras = {};
          char.espacos_magia_extras[c] = (char.espacos_magia_extras[c] || 0) + 1;
          // Atualizar total imediatamente (o sync em renderSheet so roda no carregamento)
          if (!char.espacos_magia[c]) char.espacos_magia[c] = { total: 0, usados: 0 };
          char.espacos_magia[c].total += 1;
          salvar();
          window.fecharModal();
          toast(`Espaço de ${c}º círculo criado por ${custo} PF.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'metamagia-config') {
        // Usa constante global OPCOES_METAMAGIA
        const nivel = char.nivel || 1;
        const maxMeta = (nivel >= 17 ? 6 : nivel >= 10 ? 4 : 2);
        const metasSelecionadas = new Set(estado.metamagias || []);

        function renderMetaGrid(selSet) {
          let html = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Selecionadas: <strong>${selSet.size}</strong> / ${maxMeta}
            ${selSet.size > maxMeta ? '<span style="color:var(--danger)"> (excedido!)</span>' : ''}
          </div>`;
          html += `<div class="magias-grid">${OPCOES_METAMAGIA.map(o => {
            const sel = selSet.has(o.nome);
            const cheio = selSet.size >= maxMeta && !sel;
            return `
              <div class="magia-card ${sel ? 'selecionada' : ''}"
                   data-meta-info="${o.nome}" title="Ver descricao" style="${cheio ? 'opacity:0.35;' : ''}cursor:pointer;">
                <span class="magia-card-check" data-meta-toggle="${o.nome}" title="${sel ? 'Remover selecao' : 'Selecionar'}"></span>
                <div class="magia-card-nome">${o.nome}</div>
                <div class="magia-card-meta">
                  <span style="font-size:0.65rem">${o.custo} PF</span>
                </div>
              </div>`;
          }).join('')}</div>`;
          return html;
        }

        abrirModal('Opcoes de Metamagia', `
          <div id="metamagia-grid">${renderMetaGrid(metasSelecionadas)}</div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-metamagia">Salvar</button>');

        function attachMetaListeners() {
          document.querySelectorAll('[data-meta-toggle]').forEach(el => {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              const nome = el.dataset.metaToggle;
              if (metasSelecionadas.has(nome)) {
                metasSelecionadas.delete(nome);
              } else {
                if (metasSelecionadas.size >= maxMeta) {
                  toast(`Limite de ${maxMeta} opções de Metamagia atingido.`, 'error');
                  return;
                }
                metasSelecionadas.add(nome);
              }
              document.getElementById('metamagia-grid').innerHTML = renderMetaGrid(metasSelecionadas);
              attachMetaListeners();
            });
          });
          // Clicar no corpo do card abre os detalhes em um sub-modal.
          document.querySelectorAll('[data-meta-info]').forEach(card => {
            card.addEventListener('click', () => {
              const nome = card.dataset.metaInfo;
              const opcao = OPCOES_METAMAGIA.find(o => o.nome === nome);
              if (!opcao) return;
              abrirModal(opcao.nome, `
                <div style="margin-bottom:10px">
                  <span class="badge badge-primary">${opcao.custo} PF</span>
                </div>
                <div style="font-size:0.9rem;line-height:1.6">${opcao.desc}</div>
              `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
            });
          });
        }
        attachMetaListeners();

        document.getElementById('btn-salvar-metamagia')?.addEventListener('click', () => {
          char.recursos.feiticeiro.metamagias = [...metasSelecionadas];
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'metamagia-gastar') {
        abrirModal('Gastar Pontos de Feitiçaria',
          numberPickerHtml('metamagia-custo', 1, 1, 20, 'Custo em PF'),
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-gastar-metamagia">Gastar</button>'
        );
        setupNumberPicker('metamagia-custo');

        document.getElementById('btn-gastar-metamagia')?.addEventListener('click', () => {
          const custo = Math.max(1, parseInt(document.getElementById('metamagia-custo-val')?.value) || 1);
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          salvar();
          window.fecharModal();
          toast(`Metamagia usada (${custo} PF).`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'fala-telepatica') {
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_ativa = true;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_duracao_min = char.nivel || 1;
        toast(`Fala Telepática ativada por ${char.nivel || 1} minuto(s).`, 'success');
      }

      if (acao === 'revelacao-carne') {
        abrirModal('Revelação em Carne',
          numberPickerHtml('revelacao-custo', 1, 1, 10, 'Pontos de Feitiçaria gastos'),
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-revelacao-carne">Ativar</button>'
        );
        setupNumberPicker('revelacao-custo');
        document.getElementById('btn-revelacao-carne')?.addEventListener('click', () => {
          const custo = Math.max(1, parseInt(document.getElementById('revelacao-custo-val')?.value) || 1);
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          char.recursos.feiticeiro.subclasses.aberrante.revelacao_carne_ativa = true;
          salvar();
          window.fecharModal();
          toast(`Revelação em Carne ativada (${custo} benefício(s)).`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'afinidade-elemental') {
        abrirModal('Afinidade Elemental', `
          <div class="form-group">
            <label class="form-label" for="draconica-afinidade">Tipo de dano</label>
            <select class="form-input" id="draconica-afinidade">
              ${['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Venenoso'].map(t => `<option value="${t}" ${(estado.subclasses.draconica.afinidade_elemental || '') === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-afinidade">Salvar</button>');
        document.getElementById('btn-salvar-afinidade')?.addEventListener('click', () => {
          char.recursos.feiticeiro.subclasses.draconica.afinidade_elemental = document.getElementById('draconica-afinidade')?.value || '';
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'ativar-asas-dragao') {
        const dr = char.recursos.feiticeiro.subclasses.draconica;
        if (!dr.asas_usada_desde_descanso) {
          dr.asas_usada_desde_descanso = true;
          dr.asas_ativas = true;
          toast('Asas de Dragão ativadas.', 'success');
        } else if (gastarPontosFeiticaria(3)) {
          dr.asas_ativas = true;
          toast('Asas de Dragão restauradas com 3 PF.', 'success');
        } else {
          toast('Sem uso disponível e PF insuficientes (3 PF).', 'error');
          return;
        }
      }

      if (acao === 'desativar-asas-dragao') {
        char.recursos.feiticeiro.subclasses.draconica.asas_ativas = false;
        toast('Asas de Dragão recolhidas.', 'info');
      }

      if (acao === 'companheiro-draconico') {
        const dr = char.recursos.feiticeiro.subclasses.draconica;
        if (dr.companheiro_draconico_usado) {
          toast('Companheiro Dracônico já foi usado neste descanso longo.', 'error');
          return;
        }
        dr.companheiro_draconico_usado = true;
        toast('Companheiro Dracônico usado: Invocar Dragão sem gasto de espaço.', 'success');
      }

      if (acao === 'restaurar-equilibrio') {
        const mec = char.recursos.feiticeiro.subclasses.mecanica;
        const max = Math.max(1, calcMod(char.atributos.carisma));
        if ((mec.restaurar_equilibrio_usos_gastos || 0) >= max) {
          toast('Sem usos de Restaurar Equilíbrio.', 'error');
          return;
        }
        mec.restaurar_equilibrio_usos_gastos += 1;
        toast('Restaurar Equilíbrio usado.', 'success');
      }

      if (acao === 'bastiao-lei') {
        abrirModal('Bastião da Lei',
          numberPickerHtml('bastiao-custo', 1, 1, 5, 'PF gastos (1 a 5)'),
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-bastiao-lei">Criar</button>'
        );
        setupNumberPicker('bastiao-custo');
        document.getElementById('btn-bastiao-lei')?.addEventListener('click', () => {
          const custo = Math.max(1, Math.min(5, parseInt(document.getElementById('bastiao-custo-val')?.value) || 1));
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          char.recursos.feiticeiro.subclasses.mecanica.bastiao_dados = custo;
          salvar();
          window.fecharModal();
          toast(`Bastião da Lei criado com ${custo}d8.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'ativar-transe-ordem') {
        const mec = char.recursos.feiticeiro.subclasses.mecanica;
        if (!mec.transe_ordem_usado_desde_descanso) {
          mec.transe_ordem_usado_desde_descanso = true;
          mec.transe_ordem_ativo = true;
          toast('Transe da Ordem ativado.', 'success');
        } else if (gastarPontosFeiticaria(5)) {
          mec.transe_ordem_ativo = true;
          toast('Transe da Ordem reativado com 5 PF.', 'success');
        } else {
          toast('Sem uso disponível e PF insuficientes (5 PF).', 'error');
          return;
        }
      }

      if (acao === 'desativar-transe-ordem') {
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_ativo = false;
        toast('Transe da Ordem encerrado.', 'info');
      }

      if (acao === 'mares-caos') {
        const sel = char.recursos.feiticeiro.subclasses.selvagem;
        if (!sel.mares_caos_disponivel) {
          toast('Marés do Caos indisponível até conjurar magia com espaço ou descanso longo.', 'error');
          return;
        }
        sel.mares_caos_disponivel = false;
        toast('Marés do Caos usado. A próxima magia com espaço ativa surto automático e recarrega Marés do Caos.', 'success');
      }

      if (acao === 'distorcer-sorte') {
        if (!gastarPontosFeiticaria(1)) {
          toast('Pontos de Feitiçaria insuficientes.', 'error');
          return;
        }
        toast('Distorcer a Sorte usado (-1 PF).', 'success');
      }

      if (acao === 'surto-controlado') {
        const sel = char.recursos.feiticeiro.subclasses.selvagem;
        if (sel.surto_controlado_usado) {
          toast('Surto Controlado já usado neste descanso longo.', 'error');
          return;
        }
        sel.surto_controlado_usado = true;
        toast('Surto Controlado marcado como usado.', 'success');
      }

      if (acao === 'surto-resolvido') {
        char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = false;
        toast('Surto de Magia Selvagem marcado como resolvido.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Inspiração de Bardo (recurso de classe)
  document.querySelectorAll('[data-inspiracao-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bardo') return;
      if (!char.recursos) char.recursos = {};
      if (typeof char.recursos.inspiracao_bardo_usos_gastos !== 'number') {
        char.recursos.inspiracao_bardo_usos_gastos = 0;
      }

      const acao = btn.dataset.inspiracaoAcao;
      const modCar = calcMod(char.atributos.carisma);
      const usosMax = Math.max(1, modCar);

      if (acao === 'usar') {
        if (char.recursos.inspiracao_bardo_usos_gastos >= usosMax) {
          toast('Sem usos de Inspiração de Bardo disponíveis.', 'error');
          return;
        }
        char.recursos.inspiracao_bardo_usos_gastos += 1;
        toast('Inspiração de Bardo consumida.', 'success');
      }

      if (acao === 'iniciativa' && (char.nivel || 1) >= 18) {
        const usosAtuais = Math.max(0, usosMax - char.recursos.inspiracao_bardo_usos_gastos);
        const alvo = Math.min(2, usosMax);
        if (usosAtuais < alvo) {
          char.recursos.inspiracao_bardo_usos_gastos = usosMax - alvo;
          toast('Inspiração Superior aplicada ao rolar iniciativa.', 'success');
        } else {
          toast('Você já possui 2 ou mais usos disponíveis.', 'info');
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-bruxo-astucia-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (char.classe !== 'Bruxo') return;
      const estado = getEstadoRecursosBruxo();
      if (!estado) return;
      if (estado.astuciaUsada) {
        toast('Astúcia Mágica já foi usada até o próximo descanso longo.', 'error');
        return;
      }

      const recuperados = recuperarEspacosMagiaBruxo(true);
      if (recuperados <= 0) {
        toast('Nenhum espaço de Magia de Pacto gasto para recuperar.', 'error');
        return;
      }

      char.recursos.bruxo.astucia_usada = true;
      salvar();
      toast(`Astúcia Mágica recuperou ${recuperados} espaço(s) de Magia de Pacto.`, 'success');
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-bruxo-arcanum-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bruxo') return;
      const circ = parseInt(btn.dataset.bruxoArcanumToggle);
      if (!circ || ![6, 7, 8, 9].includes(circ)) return;
      const estado = getEstadoRecursosBruxo();
      if (!estado?.circulosArcanum.includes(circ)) return;
      if (!char.recursos.bruxo.arcanum[circ]) char.recursos.bruxo.arcanum[circ] = { magia: '', usado: false };
      char.recursos.bruxo.arcanum[circ].usado = !char.recursos.bruxo.arcanum[circ].usado;
      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-bruxo-recursos]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      abrirModalRecursosBruxo();
    });
  });

  // Gerenciar selecoes do Pacto do Tomo
  document.querySelectorAll('[data-pacto-tomo-gerenciar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      abrirModalPactoDoTomo();
    });
  });

  // Conjurar magias de Pacto (sem gastar espaco)
  document.querySelectorAll('[data-conjurar-pacto]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const nomeMagia = btn.dataset.conjurarPacto;
      toast(`${nomeMagia} conjurada (via Pacto, sem gastar espaco).`, 'success');
    });
  });

  document.querySelectorAll('[data-druida-forma-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida') return;

      const acao = btn.dataset.druidaFormaAcao;
      const estado = getEstadoRecursosDruida();
      if (!estado) return;

      if (acao === 'ativar') {
        if (!consumirUsoFormaSelvagem(1)) {
          toast('Sem usos de Forma Selvagem disponíveis.', 'error');
          return;
        }
        char.recursos.druida.forma_selvagem_ativa = true;
        toast('Forma Selvagem ativada.', 'success');
      } else {
        char.recursos.druida.forma_selvagem_ativa = false;
        toast('Forma Selvagem encerrada.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-druida-companheiro-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida') return;

      const estado = getEstadoRecursosDruida();
      if (!estado) return;

      if (estado.companheiroSelvagemAtivo) {
        char.recursos.druida.companheiro_selvagem_ativo = false;
        toast('Companheiro Selvagem dispensado.', 'success');
        salvar();
        renderFichaCompleta();
        return;
      }

      if (consumirUsoFormaSelvagem(1)) {
        char.recursos.druida.companheiro_selvagem_ativo = true;
        toast('Companheiro Selvagem invocado (consumiu 1 uso de Forma Selvagem).', 'success');
      } else {
        const circulo = consumirEspacoMagiaDisponivel(1);
        if (!circulo) {
          toast('Sem uso de Forma Selvagem ou espaço de magia disponível para invocar o companheiro.', 'error');
          return;
        }
        char.recursos.druida.companheiro_selvagem_ativo = true;
        toast(`Companheiro Selvagem invocado (consumiu 1 espaço de ${circulo}º círculo).`, 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-druida-ressurgimento-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida' || (char.nivel || 1) < 5) return;

      const estado = getEstadoRecursosDruida();
      if (!estado) return;
      const acao = btn.dataset.druidaRessurgimentoAcao;

      if (acao === 'recuperar-forma') {
        if (estado.usosDisponiveis > 0) {
          toast('Você ainda tem usos de Forma Selvagem disponíveis.', 'error');
          return;
        }
        const circuloConsumido = consumirEspacoMagiaDisponivel(1);
        if (!circuloConsumido) {
          toast('Nenhum espaço de magia disponível para recuperar Forma Selvagem.', 'error');
          return;
        }
        char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
        toast(`Ressurgimento Selvagem: recuperou 1 uso de Forma Selvagem (gasto de espaço ${circuloConsumido}º).`, 'success');
      }

      if (acao === 'recuperar-slot') {
        if (estado.ressurgimentoSlotRecuperadoHoje) {
          toast('Você já recuperou um espaço de 1º círculo com Ressurgimento neste descanso longo.', 'error');
          return;
        }
        if (!consumirUsoFormaSelvagem(1)) {
          toast('Sem usos de Forma Selvagem disponíveis para converter.', 'error');
          return;
        }
        if (!recuperarEspacoMagia(1)) {
          char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
          toast('Nenhum espaço de 1º círculo gasto para recuperar.', 'error');
          return;
        }
        char.recursos.druida.ressurgimento_slot_recuperado_hoje = true;
        toast('Ressurgimento Selvagem: espaço de 1º círculo recuperado.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-druida-iniciativa]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (char.classe !== 'Druida' || (char.nivel || 1) < 20) return;
      const estado = getEstadoRecursosDruida();
      if (!estado) return;
      if (estado.usosDisponiveis > 0) {
        toast('Arquidruida só recupera uso ao rolar iniciativa se você não tiver usos restantes.', 'info');
        return;
      }
      char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
      salvar();
      toast('Arquidruida: 1 uso de Forma Selvagem recuperado ao rolar iniciativa.', 'success');
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-guardiao-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Guardião') return;

      const estado = getEstadoRecursosGuardiao();
      if (!estado) return;
      const acao = btn.dataset.guardiaoAcao;

      if (acao === 'usar-marca') {
        if (estado.inimigoFavoritoDisponiveis <= 0) {
          toast('Sem usos de Inimigo Favorito disponíveis.', 'error');
          return;
        }
        char.recursos.guardiao.inimigo_favorito_usos_gastos += 1;
        char.recursos.guardiao.marca_predador_ativa = true;
        toast('Marca do Caçador ativada sem gastar espaço de magia.', 'success');
      }

      if (acao === 'encerrar-marca') {
        char.recursos.guardiao.marca_predador_ativa = false;
        toast('Marca do Caçador encerrada.', 'info');
      }

      if (acao === 'incansavel') {
        if (!estado.incansavelAtivo) return;
        if (estado.incansavelDisponiveis <= 0) {
          toast('Sem usos de Incansável disponíveis.', 'error');
          return;
        }
        abrirModal('Incansável',
          numberPickerHtml('input-guardiao-incansavel', 1, 1, 8, 'Resultado do d8') +
          `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;text-align:center">PV temporário = d8 + Sabedoria (${fmtMod(calcMod(char.atributos.sabedoria))})</div>`,
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-incansavel">Aplicar</button>'
        );
        setupNumberPicker('input-guardiao-incansavel');
        document.getElementById('btn-aplicar-incansavel')?.addEventListener('click', () => {
          const d8 = parseInt(document.getElementById('input-guardiao-incansavel-val')?.value) || 1;
          const temp = Math.max(1, d8 + calcMod(char.atributos.sabedoria));
          char.pv_temporario = Math.max(char.pv_temporario || 0, temp);
          char.recursos.guardiao.incansavel_usos_gastos += 1;
          salvar();
          window.fecharModal();
          toast(`Incansável aplicado: ${temp} PV temporários.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'veu') {
        if (!estado.veuNaturezaAtivo) return;
        if (estado.veuNaturezaDisponiveis <= 0) {
          toast('Sem usos de Véu da Natureza disponíveis.', 'error');
          return;
        }
        char.recursos.guardiao.veu_natureza_usos_gastos += 1;
        toast('Véu da Natureza usado (Invisível até o final do próximo turno).', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Recursos do Guerreiro: Recuperar Fôlego, Surto de Ação, Indomável
  // Handler: Paladino
  document.querySelectorAll('[data-paladino-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Paladino') return;
      const estado = getEstadoRecursosPaladino();
      if (!estado) return;
      const acao = btn.dataset.paladinoAcao;

      if (acao === 'maos-consagradas') {
        if (estado.maosAtuais <= 0) {
          toast('Reserva de Mãos Consagradas esgotada.', 'error');
          return;
        }
        // Abrir modal para definir quantidade de PV a usar
        abrirModal('Mãos Consagradas', `
          <div class="info-box info" style="margin-bottom:12px">
            Reserva disponível: <strong>${estado.maosAtuais} PV</strong> de ${estado.maosMax}
          </div>
          ` + numberPickerHtml('maos-consagradas-qtd', 1, 1, estado.maosAtuais, 'Quantidade de PV a restaurar') + `
          <div style="font-size:0.8rem;color:var(--text-muted)">
            Remover Envenenado: gasta 5 PV da reserva sem restaurar PV.
            ${estado.toqueRestauradorAtivo ? '<br>Toque Restaurador: remover condição por 5 PV adicionais.' : ''}
          </div>
        `, `
          <button class="btn btn-secondary" onclick="window.fecharModal()">Cancelar</button>
          <button class="btn btn-accent" id="btn-maos-confirmar">Curar</button>
          <button class="btn btn-primary" id="btn-maos-envenenado" ${estado.maosAtuais < 5 ? 'disabled style="opacity:0.5"' : ''}>Remover Envenenado (5 PV)</button>
        `);
        setupNumberPicker('maos-consagradas-qtd');
        document.getElementById('btn-maos-confirmar')?.addEventListener('click', () => {
          const qtd = Math.min(parseInt(document.getElementById('maos-consagradas-qtd-val')?.value) || 1, estado.maosAtuais);
          char.recursos.paladino.maos_consagradas_gastos += qtd;
          toast(`Mãos Consagradas: ${qtd} PV de cura aplicados.`, 'success');
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        document.getElementById('btn-maos-envenenado')?.addEventListener('click', () => {
          if (estado.maosAtuais < 5) return;
          char.recursos.paladino.maos_consagradas_gastos += 5;
          toast('Condição Envenenado removida (5 PV gastos da reserva).', 'success');
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'canalizar') {
        if (estado.canalizarDisponiveis <= 0) {
          toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
          return;
        }
        char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
        toast('Canalizar Divindade usado! Sentido Divino ou opção de subclasse ativado.', 'success');
      }

      if (acao === 'destruicao-gratuita') {
        if (estado.destruicaoGratuitaUsada) {
          toast('Destruição gratuita já usada neste descanso.', 'error');
          return;
        }
        char.recursos.paladino.destruicao_gratuita_usada = true;
        toast('Destruição Divina conjurada sem gastar espaço de magia!', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Paladino subclasses (Glória, Vingança, Anciões)
  document.querySelectorAll('[data-paladino-subclasse-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Paladino') return;
      const estado = getEstadoRecursosPaladino();
      if (!estado) return;
      if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};

      const acao = btn.dataset.paladinoSubclasseAcao;

      // Ações que consomem Canalizar Divindade
      const usaCanalizar = [
        'gloria_atleta', 'gloria_destruicao_inspiradora',
        'vinganca_voto_inimizade', 'ancioes_ira_natureza',
        'devocao_arma_sagrada'
      ].includes(acao);

      if (usaCanalizar && estado.canalizarDisponiveis <= 0) {
        toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
        return;
      }

      switch (acao) {
        // === Glória ===
        case 'gloria_atleta':
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          toast('Atleta Inigualável ativado! 10min: Vantagem em Acrobacia/Atletismo + salto longo sem corrida.', 'success');
          break;

        case 'gloria_destruicao_inspiradora': {
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          const nivel = char.nivel || 1;
          const dReforco = nivel >= 11 ? '2d6' : '1d6';
          toast(`Destruição Inspiradora usada! Aliados atacantes causam +${dReforco} Radiante no turno extra.`, 'success');
          break;
        }

        case 'gloria_defesa_gloriosa': {
          if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
          const modCar = calcMod(char.atributos.carisma);
          const maxUsos = Math.max(1, modCar);
          const gastos = char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos || 0;
          if (gastos >= maxUsos) {
            toast('Sem usos de Defesa Gloriosa disponíveis.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos = gastos + 1;
          toast('Defesa Gloriosa usada! Reação: +mod CAR à CA ou aliado ganha PV temp.', 'success');
          break;
        }

        case 'gloria_lenda_viva': {
          if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
          if (char.recursos.paladino.subclasses.gloria.lenda_viva_usada) {
            toast('Lenda Viva já usada.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.gloria.lenda_viva_usada = true;
          toast('Lenda Viva ativada! 1min: Emanação 3m, Vantagem ataques/salvaguardas de aliados + Desvantagem contra eles.', 'success');
          break;
        }

        // === Vingança ===
        case 'vinganca_voto_inimizade':
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          toast('Voto de Inimizade ativado! 1min: Vantagem em ataques contra alvo inimigo.', 'success');
          break;

        case 'vinganca_anjo_vingador': {
          if (!char.recursos.paladino.subclasses.vinganca) char.recursos.paladino.subclasses.vinganca = {};
          if (char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado) {
            toast('Anjo Vingador já usado.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado = true;
          toast('Anjo Vingador ativado! 10min: Voo 18m + Emanação 9m de Amedrontar.', 'success');
          break;
        }

        // === Anciões ===
        case 'ancioes_ira_natureza':
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          toast('Ira da Natureza usada! Vinhas prendem criaturas em área de 4,5m (Vines of Constraint).', 'success');
          break;

        case 'ancioes_sentinela_imortal': {
          if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
          if (char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada) {
            toast('Sentinela Imortal já usada.', 'error');
            return;
          }
          const nivel = char.nivel || 1;
          const cura = 3 * nivel;
          char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada = true;
          char.pv_atual = Math.min(1, char.pv_atual) || 1;
          toast(`Sentinela Imortal! Ao cair a 0 PV: fica com 1 PV + conjure Cura de Ferimentos (${cura} PV) sem gastar slot.`, 'success');
          break;
        }

        case 'ancioes_campeao_ancestral': {
          if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
          if (char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado) {
            toast('Campeão Ancestral já usado.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado = true;
          toast('Campeão Ancestral ativado! 1min: Desv. salvaguardas de inimigos, magias como Bônus, +10 PV por turno.', 'success');
          break;
        }

        // === Devoção ===
        case 'devocao_arma_sagrada': {
          if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa = true;
          toast('Arma Sagrada ativada! 10min: +mod CAR no ataque, luz brilhante 6m + penumbra 6m.', 'success');
          break;
        }

        case 'devocao_arma_sagrada_desativar': {
          if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
          char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa = false;
          toast('Arma Sagrada encerrada.', 'info');
          break;
        }

        case 'devocao_resplendor_ativar': {
          if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
          if (char.recursos.paladino.subclasses.devocao.resplendor_sagrado_usado) {
            toast('Resplendor Sagrado já usado neste descanso longo.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_usado = true;
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo = true;
          toast('Resplendor Sagrado ativado! 10min: emanação 9m de luz Radiante, +mod CAR à salvaguarda.', 'success');
          break;
        }

        case 'devocao_resplendor_desativar': {
          if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo = false;
          toast('Resplendor Sagrado encerrado.', 'info');
          break;
        }

        case 'devocao_resplendor_restaurar': {
          if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
          // Gastar espaço de magia de 5º círculo para restaurar
          const slots = char.espacos_magia || {};
          const usados5 = slots['5_usado'] || 0;
          const max5 = (getEspacosMagia(char.classe, char.nivel || 1) || {})[5] || 0;
          if (usados5 >= max5) {
            toast('Sem espaço de magia de 5º círculo disponível.', 'error');
            return;
          }
          if (!char.espacos_magia) char.espacos_magia = {};
          char.espacos_magia['5_usado'] = usados5 + 1;
          char.recursos.paladino.subclasses.devocao.resplendor_sagrado_usado = false;
          toast('Resplendor Sagrado restaurado (1 espaço de 5º círculo gasto).', 'success');
          break;
        }

        default:
          return;
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Monge
  document.querySelectorAll('[data-monge-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Monge') return;
      const estado = getEstadoRecursosMonge();
      if (!estado) return;
      const acao = btn.dataset.mongeAcao;

      if (acao === 'gastar-ponto') {
        if (estado.pontosAtuais <= 0) {
          toast('Sem Pontos de Foco disponíveis.', 'error');
          return;
        }
        char.recursos.monge.pontos_foco_gastos += 1;
        toast(`Ponto de Foco gasto. Restantes: ${estado.pontosAtuais - 1}/${estado.pontosMax}`, 'success');
      }

      if (acao === 'golpe-atordoante') {
        if (estado.pontosAtuais <= 0) {
          toast('Sem Pontos de Foco para Golpe Atordoante.', 'error');
          return;
        }
        char.recursos.monge.pontos_foco_gastos += 1;
        toast(`Golpe Atordoante! Alvo faz salvaguarda de Constituição CD ${estado.cdFoco}. Restantes: ${estado.pontosAtuais - 1}/${estado.pontosMax}`, 'success');
      }

      if (acao === 'metabolismo') {
        if (estado.metabolismoUsado) {
          toast('Metabolismo Incomum já usado neste descanso.', 'error');
          return;
        }
        // Restaurar todos os pontos de foco
        char.recursos.monge.pontos_foco_gastos = 0;
        char.recursos.monge.metabolismo_usado = true;
        const cura = `${char.nivel || 1} + 1d${estado.dadoArtesMarciais}`;
        toast(`Metabolismo Incomum ativado! Pontos de Foco restaurados. Cura: ${cura} PV.`, 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Monge: subclasses
  document.querySelectorAll('[data-monge-subclasse-acao]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Monge') return;
      const estado = getEstadoRecursosMonge();
      if (!estado) return;
      const acao = el.dataset.mongeSubclasseAcao;
      const sub = char.subclasse || '';

      // Mão Espalmada
      if (sub === 'Combatente da Mão Espalmada' && char.recursos.monge.subclasses?.mao_espalmada) {
        const s = char.recursos.monge.subclasses.mao_espalmada;
        if (acao === 'integridade_usar') {
          if (estado.integridadeDisponiveis <= 0) {
            toast('Sem usos de Integridade Corporal disponíveis.', 'error');
            return;
          }
          s.integridade_usos_gastos += 1;
          toast(`Integridade Corporal: cure 1d${estado.dadoArtesMarciais} + mod SAB PV! Restantes: ${estado.integridadeDisponiveis - 1}/${estado.integridadeMax}`, 'success');
        }
        if (acao === 'palma_ativar') {
          if (estado.pontosAtuais < 4) {
            toast('Pontos de Foco insuficientes (necessário 4).', 'error');
            return;
          }
          char.recursos.monge.pontos_foco_gastos += 4;
          s.palma_vibrante_ativa = true;
          toast('Palma Vibrante ativada! Vibrações imperceptíveis iniciadas no alvo.', 'success');
        }
        if (acao === 'palma_encerrar') {
          s.palma_vibrante_ativa = false;
          toast(`Palma Vibrante encerrada! Alvo faz salvaguarda de Constituição CD ${estado.cdFoco} — 10d12 Energético em falha.`, 'warning');
        }
        if (acao === 'palma_cancelar') {
          s.palma_vibrante_ativa = false;
          toast('Vibrações encerradas inofensivamente.', 'info');
        }
      }

      // Misericórdia
      if (sub === 'Combatente da Misericórdia' && char.recursos.monge.subclasses?.misericordia) {
        const s = char.recursos.monge.subclasses.misericordia;
        if (acao === 'torrente_usar') {
          if (estado.torrenteDisponiveis <= 0) {
            toast('Sem usos de Torrente de Cura e Dolo disponíveis.', 'error');
            return;
          }
          s.torrente_usos_gastos += 1;
          toast(`Torrente de Cura e Dolo: Cura/Dolo grátis na Torrente de Golpes! Restantes: ${estado.torrenteDisponiveis - 1}/${estado.torrenteMax}`, 'success');
        }
        if (acao === 'misericordia_final') {
          if (s.misericordia_final_usada) {
            toast('Mão da Misericórdia Final já usada neste descanso.', 'error');
            return;
          }
          if (estado.pontosAtuais < 5) {
            toast('Pontos de Foco insuficientes (necessário 5).', 'error');
            return;
          }
          char.recursos.monge.pontos_foco_gastos += 5;
          s.misericordia_final_usada = true;
          toast('Mão da Misericórdia Final! Criatura revivida com 4d10 + mod SAB PV.', 'success');
        }
      }

      // Elementos
      if (sub === 'Combatente dos Elementos' && char.recursos.monge.subclasses?.elementos) {
        const s = char.recursos.monge.subclasses.elementos;
        if (acao === 'sintonia_toggle') {
          if (s.sintonia_ativa) {
            s.sintonia_ativa = false;
            toast('Sintonia Elemental desativada.', 'info');
          } else {
            if (estado.pontosAtuais < 1) {
              toast('Sem Pontos de Foco disponíveis.', 'error');
              return;
            }
            char.recursos.monge.pontos_foco_gastos += 1;
            s.sintonia_ativa = true;
            toast(`Sintonia Elemental ativada! Ataques Elementais + Extensão 3m por 10 min. PF restantes: ${estado.pontosAtuais - 1}`, 'success');
          }
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Ladino
  document.querySelectorAll('[data-ladino-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Ladino') return;
      const estado = getEstadoRecursosLadino();
      if (!estado) return;
      const acao = btn.dataset.ladinoAcao;

      if (acao === 'golpe-sorte') {
        if (estado.golpeSorteUsado) {
          toast('Golpe de Sorte já usado neste descanso.', 'error');
          return;
        }
        char.recursos.ladino.golpe_sorte_usado = true;
        toast('Golpe de Sorte usado! O resultado do Teste de D20 se torna 20.', 'success');
      }

      // --- Adaga Espiritual ---
      if (acao === 'gastar-dado-psionico') {
        if (estado.dadosPsionicosDisponiveisL <= 0) {
          toast('Sem Dados de Energia Psiônica disponíveis.', 'error');
          return;
        }
        char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
        toast(`Dado de Energia Psiônica gasto! (${estado.tipoDadoPsionicoL})`, 'success');
      }

      if (acao === 'sussurros') {
        if (estado.sussurrosGratisUsado) {
          if (estado.dadosPsionicosDisponiveisL <= 0) {
            toast('Sem Dados de Energia Psiônica para Sussurros Psíquicos.', 'error');
            return;
          }
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
          toast(`Sussurros Psíquicos ativados! Role 1${estado.tipoDadoPsionicoL} = horas de telepatia (dado gasto).`, 'success');
        } else {
          char.recursos.ladino.subclasses.adaga_espiritual.sussurros_gratis_usado = true;
          toast(`Sussurros Psíquicos ativados gratuitamente! Role 1${estado.tipoDadoPsionicoL} = horas de telepatia.`, 'success');
        }
      }

      if (acao === 'teleporte-psiquico') {
        if (estado.dadosPsionicosDisponiveisL <= 0) {
          toast('Sem Dados de Energia Psiônica para Teleporte Psíquico.', 'error');
          return;
        }
        char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
        toast(`Teleporte Psíquico! Role 1${estado.tipoDadoPsionicoL} x 3 = metros de teleporte.`, 'success');
      }

      if (acao === 'veu-psiquico') {
        if (estado.veuPsiquicoUsado) {
          if (estado.dadosPsionicosDisponiveisL <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Véu Psíquico.', 'error');
            return;
          }
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = false;
          toast('Véu Psíquico recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = true;
          toast('Véu Psíquico ativado! Invisível por 1 hora (encerra ao causar dano ou forçar salvaguarda).', 'success');
        }
      }

      if (acao === 'rasgar-mente') {
        if (estado.rasgarMenteUsado) {
          if (estado.dadosPsionicosDisponiveisL < 3) {
            toast('Precisa de 3 Dados de Energia Psiônica para recuperar Rasgar Mente.', 'error');
            return;
          }
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 3;
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = false;
          toast('Rasgar Mente recuperado gastando 3 dados!', 'success');
        } else {
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = true;
          toast(`Rasgar Mente usado! Alvo faz salvaguarda Sab CD ${estado.cdPsionicaAdaga} ou fica Atordoado por 1 min.`, 'success');
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Mago
  document.querySelectorAll('[data-mago-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Mago') return;
      const estado = getEstadoRecursosMago();
      if (!estado) return;
      const acao = btn.dataset.magoAcao;

      if (acao === 'recuperacao-arcana') {
        if (estado.recuperacaoArcanaUsada) {
          toast('Recuperação Arcana já usada hoje.', 'error');
          return;
        }
        // Abrir modal para escolher quais espaços recuperar
        const maxCirculo = Math.min(5, estado.recuperacaoArcanaMax);
        let opcoesHtml = '';
        for (let c = 1; c <= maxCirculo; c++) {
          const slot = char.espacos_magia?.[c];
          if (!slot) continue;
          const usados = slot.usados || 0;
          if (usados <= 0) continue;
          opcoesHtml += `
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.85rem">
              <input type="number" class="recuperar-slot" data-circulo="${c}" min="0" max="${usados}" value="0" style="width:60px;padding:4px;border-radius:var(--radius);border:1px solid var(--border)">
              ${c}º Círculo (${usados} gastos)
            </label>`;
        }
        if (!opcoesHtml) {
          toast('Nenhum espaço de magia gasto para recuperar.', 'info');
          return;
        }
        abrirModal('Recuperação Arcana', `
          <div class="info-box info" style="margin-bottom:12px">
            Recupere espaços gastos. Círculos combinados devem ser ≤ <strong>${estado.recuperacaoArcanaMax}</strong>. Máximo 5º círculo.
          </div>
          ${opcoesHtml}
          <div id="recuperar-total" style="font-size:0.8rem;margin-top:8px;color:var(--text-muted)">Total: 0 / ${estado.recuperacaoArcanaMax}</div>
        `, `
          <button class="btn btn-secondary" onclick="window.fecharModal()">Cancelar</button>
          <button class="btn btn-accent" id="btn-recuperar-confirmar">Recuperar</button>
        `);
        // Atualizar total em tempo real
        const atualizarTotal = () => {
          let total = 0;
          document.querySelectorAll('.recuperar-slot').forEach(inp => {
            total += (parseInt(inp.value) || 0) * parseInt(inp.dataset.circulo);
          });
          const el = document.getElementById('recuperar-total');
          if (el) el.textContent = `Total: ${total} / ${estado.recuperacaoArcanaMax}`;
        };
        document.querySelectorAll('.recuperar-slot').forEach(inp => inp.addEventListener('input', atualizarTotal));
        document.getElementById('btn-recuperar-confirmar')?.addEventListener('click', () => {
          let total = 0;
          const slots = [];
          document.querySelectorAll('.recuperar-slot').forEach(inp => {
            const qtd = parseInt(inp.value) || 0;
            const circ = parseInt(inp.dataset.circulo);
            if (qtd > 0) {
              total += qtd * circ;
              slots.push({ circulo: circ, qtd });
            }
          });
          if (total <= 0) {
            toast('Selecione ao menos 1 espaço para recuperar.', 'error');
            return;
          }
          if (total > estado.recuperacaoArcanaMax) {
            toast(`Total (${total}) excede o máximo (${estado.recuperacaoArcanaMax}).`, 'error');
            return;
          }
          // Aplicar recuperação
          slots.forEach(s => {
            const slot = char.espacos_magia?.[s.circulo];
            if (slot) slot.usados = Math.max(0, (slot.usados || 0) - s.qtd);
          });
          char.recursos.mago.recuperacao_arcana_usada = true;
          const detalhes = slots.map(s => `${s.qtd}x ${s.circulo}º`).join(', ');
          toast(`Recuperação Arcana: ${detalhes} restaurados!`, 'success');
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'assinatura-1') {
        if (estado.assinatura1Usada) {
          toast('Assinatura Mágica 1 já usada neste descanso.', 'error');
          return;
        }
        char.recursos.mago.assinatura_magia_1_usada = true;
        toast('Assinatura Mágica 1 conjurada no 3º círculo sem gastar espaço!', 'success');
      }

      if (acao === 'assinatura-2') {
        if (estado.assinatura2Usada) {
          toast('Assinatura Mágica 2 já usada neste descanso.', 'error');
          return;
        }
        char.recursos.mago.assinatura_magia_2_usada = true;
        toast('Assinatura Mágica 2 conjurada no 3º círculo sem gastar espaço!', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Mago: subclasses
  document.querySelectorAll('[data-mago-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Mago') return;
      const estado = getEstadoRecursosMago();
      if (!estado) return;
      const acao = el.dataset.magoSubclasseAcao;
      const sub = char.subclasse || '';

      // Abjurador: Proteção Arcana
      if (sub === 'Abjurador' && char.recursos.mago.subclasses?.abjurador) {
        const s = char.recursos.mago.subclasses.abjurador;
        if (acao === 'protecao_criar') {
          if (s.protecao_criada) {
            toast('Proteção Arcana já criada neste descanso.', 'error');
            return;
          }
          s.protecao_criada = true;
          s.protecao_pv_atual = estado.protecaoPvMax;
          toast(`Proteção Arcana criada com ${estado.protecaoPvMax} PV!`, 'success');
        }
        if (acao === 'protecao_dano') {
          abrirModal('Dano na Proteção Arcana',
            numberPickerHtml('input-protecao-dano', 1, 1, 999, 'Valor do dano') +
            `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">PV atuais da proteção: <strong>${s.protecao_pv_atual}</strong></div>`,
            '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-protecao-dano-ok">Aplicar Dano</button>'
          );
          setupNumberPicker('input-protecao-dano');
          document.getElementById('btn-protecao-dano-ok')?.addEventListener('click', () => {
            const dano = parseInt(document.getElementById('input-protecao-dano-val')?.value) || 0;
            if (dano <= 0) return;
            const pvAntes = s.protecao_pv_atual;
            s.protecao_pv_atual = Math.max(0, s.protecao_pv_atual - dano);
            const excedente = dano > pvAntes ? dano - pvAntes : 0;
            toast(`Proteção absorveu ${Math.min(dano, pvAntes)} de dano. PV: ${s.protecao_pv_atual}${excedente > 0 ? ` | ${excedente} de dano excedente passa para você!` : ''}`, s.protecao_pv_atual > 0 ? 'info' : 'warning');
            salvar();
            window.fecharModal();
            renderFichaCompleta();
          });
          return;
        }
        if (acao === 'protecao_restaurar') {
          abrirModal('Restaurar Proteção Arcana',
            numberPickerHtml('input-protecao-slot', 1, 1, 9, 'Círculo do espaço de magia') +
            `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Restaura <strong>2x o círculo</strong> em PV da proteção.</div>`,
            '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-accent" id="btn-protecao-rest-ok">Restaurar</button>'
          );
          setupNumberPicker('input-protecao-slot');
          document.getElementById('btn-protecao-rest-ok')?.addEventListener('click', () => {
            const circulo = parseInt(document.getElementById('input-protecao-slot-val')?.value) || 0;
            if (circulo < 1) return;
            const restaurar = circulo * 2;
            s.protecao_pv_atual = Math.min(estado.protecaoPvMax, s.protecao_pv_atual + restaurar);
            toast(`Proteção restaurou ${restaurar} PV! Atual: ${s.protecao_pv_atual}/${estado.protecaoPvMax}`, 'success');
            salvar();
            window.fecharModal();
            renderFichaCompleta();
          });
          return;
        }
      }

      // Adivinhador: Prodígio e O Terceiro Olho
      if (sub === 'Adivinhador' && char.recursos.mago.subclasses?.adivinhador) {
        const s = char.recursos.mago.subclasses.adivinhador;
        if (acao === 'prodigio_rolar') {
          const n = estado.numDadosProdigio;
          s.prodigio_dado_1 = Math.floor(Math.random() * 20) + 1;
          s.prodigio_dado_1_usado = false;
          s.prodigio_dado_2 = Math.floor(Math.random() * 20) + 1;
          s.prodigio_dado_2_usado = false;
          if (n >= 3) {
            s.prodigio_dado_3 = Math.floor(Math.random() * 20) + 1;
            s.prodigio_dado_3_usado = false;
          }
          const valores = [s.prodigio_dado_1, s.prodigio_dado_2];
          if (n >= 3) valores.push(s.prodigio_dado_3);
          toast(`Prodígio: dados rolados — ${valores.join(', ')}!`, 'success');
        }
        if (acao === 'prodigio_usar_1') {
          if (s.prodigio_dado_1_usado) { toast('Dado já usado.', 'error'); return; }
          s.prodigio_dado_1_usado = true;
          toast(`Prodígio: usou dado ${s.prodigio_dado_1}!`, 'success');
        }
        if (acao === 'prodigio_usar_2') {
          if (s.prodigio_dado_2_usado) { toast('Dado já usado.', 'error'); return; }
          s.prodigio_dado_2_usado = true;
          toast(`Prodígio: usou dado ${s.prodigio_dado_2}!`, 'success');
        }
        if (acao === 'prodigio_usar_3') {
          if (s.prodigio_dado_3_usado) { toast('Dado já usado.', 'error'); return; }
          s.prodigio_dado_3_usado = true;
          toast(`Prodígio: usou dado ${s.prodigio_dado_3}!`, 'success');
        }
        if (acao === 'terceiro_olho_usar') {
          if (s.terceiro_olho_usado) { toast('O Terceiro Olho já está ativo.', 'error'); return; }
          if (!s.terceiro_olho_escolha) { toast('Escolha um benefício primeiro.', 'error'); return; }
          s.terceiro_olho_usado = true;
          toast(`O Terceiro Olho: ${s.terceiro_olho_escolha} ativado!`, 'success');
        }
      }

      // Evocador: Sobrecarga
      if (sub === 'Evocador' && char.recursos.mago.subclasses?.evocador) {
        const s = char.recursos.mago.subclasses.evocador;
        if (acao === 'sobrecarga_usar') {
          s.sobrecarga_usos += 1;
          if (s.sobrecarga_usos === 1) {
            toast('Sobrecarga! Dano máximo na magia — sem efeito adverso.', 'success');
          } else {
            const dado = s.sobrecarga_usos;
            toast(`Sobrecarga! Dano máximo — você sofre ${dado}d12 x círculo de dano Necrótico!`, 'warning');
          }
        }
      }

      // Ilusionista: Criaturas Espectrais e Autoimagem Ilusória
      if (sub === 'Ilusionista' && char.recursos.mago.subclasses?.ilusionista) {
        const s = char.recursos.mago.subclasses.ilusionista;
        if (acao === 'espectrais_feerica') {
          if (s.feerica_usada) { toast('Convocar Feérico grátis já usado.', 'error'); return; }
          s.feerica_usada = true;
          toast('Convocar Feérico conjurado gratuitamente! PV pela metade.', 'success');
        }
        if (acao === 'espectrais_fera') {
          if (s.fera_usada) { toast('Invocar Fera grátis já usado.', 'error'); return; }
          s.fera_usada = true;
          toast('Invocar Fera conjurado gratuitamente! PV pela metade.', 'success');
        }
        if (acao === 'autoimagem_usar') {
          if (s.autoimagem_usada) { toast('Autoimagem Ilusória já usada.', 'error'); return; }
          s.autoimagem_usada = true;
          toast('Autoimagem Ilusória usada! O ataque erra automaticamente.', 'success');
        }
        if (acao === 'autoimagem_restaurar') {
          if (!s.autoimagem_usada) { toast('Autoimagem Ilusória já está disponível.', 'info'); return; }
          s.autoimagem_usada = false;
          toast('Autoimagem Ilusória restaurada (gasto slot de 2º+ círculo).', 'success');
        }
      }

      salvar();
      renderFichaCompleta();
    };
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Mago') return;
        const acao = el.dataset.magoSubclasseAcao;
        if (acao === 'terceiro_olho_escolha') {
          if (!char.recursos?.mago?.subclasses?.adivinhador) return;
          char.recursos.mago.subclasses.adivinhador.terceiro_olho_escolha = el.value;
          salvar();
          renderFichaCompleta();
        }
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  document.querySelectorAll('[data-guerreiro-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Guerreiro') return;

      const estado = getEstadoRecursosGuerreiro();
      if (!estado) return;
      const acao = btn.dataset.guerreiroAcao;

      if (acao === 'usar-folego') {
        if (estado.recuperarFolegoDisponiveis <= 0) {
          toast('Sem usos de Recuperar Folego disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.recuperar_folego_usos_gastos += 1;
        const cura = `1d10 + ${char.nivel || 1}`;
        toast(`Recuperar Folego usado! Role ${cura} e aplique a cura.`, 'success');
      }

      if (acao === 'usar-surto') {
        if (estado.surtoDisponiveis <= 0) {
          toast('Sem usos de Surto de Ação disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.surto_acao_usos_gastos += 1;
        toast('Surto de Ação usado! Você tem 1 ação adicional (exceto Usar Magia).', 'success');
      }

      if (acao === 'usar-indomavel') {
        if (estado.indomavelDisponiveis <= 0) {
          toast('Sem usos de Indomável disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.indomavel_usos_gastos += 1;
        toast(`Indomável usado! Rejogue a salvaguarda com bônus de +${char.nivel || 1}.`, 'success');
      }

      // --- Mestre da Batalha ---
      if (acao === 'usar-superioridade') {
        if (estado.dadosSuperioridadeDisponiveis <= 0) {
          toast('Sem Dados de Superioridade disponíveis.', 'error');
          return;
        }
        const nomeManobra = btn.dataset.manobraNome || 'manobra';
        char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos += 1;
        toast(`${nomeManobra}: Dado de Superioridade gasto! Role 1${estado.tipoDadoSuperioridade}. CD: ${estado.cdSuperioridade}.`, 'success');
      }

      if (acao === 'conheca-inimigo') {
        if (estado.conhecaInimigoUsado) {
          toast('Conheça Seu Inimigo já usado neste descanso.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = true;
        toast('Conheça Seu Inimigo usado! Examine imunidades, resistências e vulnerabilidades do alvo.', 'success');
      }

      if (acao === 'conheca-inimigo-dado') {
        if (estado.dadosSuperioridadeDisponiveis <= 0) {
          toast('Sem Dados de Superioridade para recuperar Conheça Seu Inimigo.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos += 1;
        char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = false;
        toast('Conheça Seu Inimigo recuperado gastando 1 Dado de Superioridade!', 'success');
      }

      // --- Combatente Psíquico ---
      if (acao === 'golpe-psionico') {
        if (estado.dadosPsionicosDisponiveisG <= 0) {
          toast('Sem Dados de Energia Psiônica disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
        const modInt = calcMod(char.atributos?.inteligencia || 10);
        toast(`Golpe Psiônico! Role 1${estado.tipoDadoPsionicoG}+${modInt} dano Energético extra.`, 'success');
      }

      if (acao === 'vinculo-protetivo') {
        if (estado.dadosPsionicosDisponiveisG <= 0) {
          toast('Sem Dados de Energia Psiônica disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
        const modInt = calcMod(char.atributos?.inteligencia || 10);
        toast(`Vínculo Protetivo! Role 1${estado.tipoDadoPsionicoG}+${modInt} para reduzir o dano (Reação).`, 'success');
      }

      if (acao === 'movimento-telecinetico') {
        if (estado.movimentoTelecineticoUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Movimento Telecinético.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          toast('Movimento Telecinético recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = true;
          toast('Movimento Telecinético usado! Transporte um objeto ou criatura até 9m.', 'success');
        }
      }

      if (acao === 'salto-impulsao') {
        if (estado.saltoImpulsaoUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Salto com Impulsão.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
          toast('Salto com Impulsão Psíquica recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = true;
          toast('Salto com Impulsão usado! Voo = 2x Deslocamento até o final do turno.', 'success');
        }
      }

      if (acao === 'baluarte') {
        if (estado.baluarteUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Baluarte de Energia.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = false;
          toast('Baluarte de Energia recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = true;
          const modInt = calcMod(char.atributos?.inteligencia || 10);
          toast(`Baluarte de Energia ativado! Até ${Math.max(1, modInt)} criaturas ganham Cobertura Parcial por 1 min.`, 'success');
        }
      }

      if (acao === 'mestre-telecinetico') {
        if (estado.mestreTelecineticoUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Mestre Telecinético.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = false;
          toast('Mestre Telecinético recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = true;
          toast('Telecinese conjurada sem espaço! INT como atributo de conjuração. Ataque com arma como Ação Bônus.', 'success');
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-furia-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const acao = btn.dataset.furiaToggle;
      const estado = getEstadoFuria();
      if (!estado) return;

      if (!char.recursos) char.recursos = {};

      if (acao === 'ativar') {
        if (temArmaduraPesadaEquipada()) {
          toast('Não é possível entrar em Fúria com armadura pesada equipada.', 'error');
          return;
        }
        if (estado.usosDisponiveis <= 0) {
          toast('Sem usos de Fúria disponíveis.', 'error');
          return;
        }
        if (char.recursos.furia_ativa) {
          toast('A Fúria já está ativa.', 'error');
          return;
        }
        char.recursos.furia_ativa = true;
        char.recursos.furia_usos_gastos = (char.recursos.furia_usos_gastos || 0) + 1;
        // Reseta flag de Concentração Fanática para nova sessão de Fúria
        char.recursos.concentracao_fanatica_usada = false;

        // Fúria Irracional (Berserker 6+): remove Amedrontado e Enfeitiçado ao ativar
        if (estado.furiaIrracional) {
          const condicoesImunes = ['Amedrontado', 'Enfeitiçado'];
          const removidas = (char.condicoes || []).filter(c => condicoesImunes.includes(c));
          if (removidas.length > 0) {
            char.condicoes = (char.condicoes || []).filter(c => !condicoesImunes.includes(c));
            toast(`Fúria Irracional: ${removidas.join(' e ')} removida(s)!`, 'success');
          }
        }

        // Bote Instintivo (nível 7+): lembrete ao ativar Fúria
        if (estado.temBoteInstintivo) {
          toast('Bote Instintivo: você pode se mover até metade do seu Deslocamento como parte desta Ação Bônus.', 'info');
        }

        // Coração Selvagem (nível 3+): solicitar escolha de animal
        if (char.subclasse === 'Trilha do Coração Selvagem' && (char.nivel || 1) >= 3) {
          _abrirEscolhaAnimalFuria();
        }

        // Árvore do Mundo (nível 3+): Surto de Vitalidade — PVT = nível ao ativar
        if (char.subclasse === 'Trilha da Árvore do Mundo' && (char.nivel || 1) >= 3) {
          const pvtSurto = char.nivel || 1;
          char.pv_temporario = Math.max(char.pv_temporario || 0, pvtSurto);
          toast(`Surto de Vitalidade: +${pvtSurto} PV Temporários!`, 'success');
        }
      } else {
        char.recursos.furia_ativa = false;
        // Limpar escolha de animal da Fúria ao encerrar
        if (char.subclasse === 'Trilha do Coração Selvagem') {
          char.recursos.furia_animal = null;
        }
        // Desativar Fúria dos Deuses ao encerrar
        if (char.recursos.furia_deuses_ativa) {
          char.recursos.furia_deuses_ativa = false;
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-config-maestrias]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await abrirModalMaestrias();
    });
  });

  document.querySelectorAll('[data-imprudente-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!char.recursos) char.recursos = {};
      char.recursos.ataque_imprudente_ativo = btn.dataset.imprudenteToggle === 'ativar';
      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-furia-iniciativa]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (char.classe !== 'Bárbaro' || char.nivel < 15) return;
      if (!char.recursos) char.recursos = {};
      if (char.recursos.furia_persistente_usada) {
        toast('Fúria Persistente já foi usada desde o último descanso longo.', 'error');
        return;
      }
      char.recursos.furia_usos_gastos = 0;
      char.recursos.furia_persistente_usada = true;
      salvar();
      toast('Fúrias recuperadas pela Fúria Persistente.', 'success');
      renderFichaCompleta();
    });
  });

  // Fúria Implacável (nível 11+): botão para usar quando cair a 0 PV
  document.querySelectorAll('[data-furia-implacavel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const estado = getEstadoFuria();
      if (!estado?.ativa || !estado.furiaImplacavel) return;
      if (!char.recursos) char.recursos = {};
      const cd = char.recursos.furia_implacavel_cd || 10;
      const nivel = char.nivel || 1;
      const pvRecuperados = nivel * 2;

      abrirModal('Fúria Implacável',
        `<div style="text-align:center;font-size:0.9rem;line-height:1.6">
          <p>Você foi reduzido a <strong>0 PV</strong> com a Fúria ativa.</p>
          <p>Realize uma <strong>Salvaguarda de Constituição CD ${cd}</strong>.</p>
          <p>Em caso de sucesso, seus PV mudam para <strong>${pvRecuperados}</strong>.</p>
          <p style="color:var(--text-muted);font-size:0.8rem">A cada uso adicional, a CD aumenta em 5. Reseta no Descanso Curto/Longo.</p>
        </div>`,
        `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
         <button class="btn btn-danger" id="btn-furia-implacavel-falha">Falha</button>
         <button class="btn btn-success" id="btn-furia-implacavel-sucesso">Sucesso</button>`
      );

      document.getElementById('btn-furia-implacavel-sucesso')?.addEventListener('click', () => {
        char.pv_atual = pvRecuperados;
        char.recursos.furia_implacavel_cd = cd + 5;
        salvar();
        window.fecharModal();
        toast(`Fúria Implacável! PV restaurados para ${pvRecuperados}. Próxima CD: ${cd + 5}`, 'success');
        renderFichaCompleta();
      });

      document.getElementById('btn-furia-implacavel-falha')?.addEventListener('click', () => {
        char.recursos.furia_implacavel_cd = cd + 5;
        salvar();
        window.fecharModal();
        toast(`Fúria Implacável falhou. Próxima CD: ${cd + 5}`, 'error');
        renderFichaCompleta();
      });
    });
  });
}

// --- Características de Classe ---

/**
 * Detecta usos máximos de uma habilidade pela descrição.
 * Ex: "duas vezes" => 2, "três vezes" => 3
 */
export function detectarUsosMaximos(descricao) {
  if (!descricao) return null;
  const d = descricao.toLowerCase();
  const numerosTexto = { 'uma': 1, 'duas': 2, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5, 'seis': 6 };
  for (const [texto, num] of Object.entries(numerosTexto)) {
    if (d.includes(`${texto} vezes`) || d.includes(`${texto} vez`)) return num;
  }
  const match = d.match(/(\d+)\s*vezes/);
  if (match) return parseInt(match[1]);
  return null;
}

/**
 * Detecta sub-habilidades (ex: **Centelha Divina.**, **Expulsar Mortos-Vivos.**)
 */
function detectarSubHabilidades(descricao) {
  if (!descricao) return [];
  const matches = descricao.matchAll(/\*\*([^*]+)\.\*\*/g);
  const subs = [];
  for (const match of matches) {
    const nome = match[1].trim();
    // Filtrar nomes genéricos ou de tabela
    if (nome.length > 2 && nome.length < 60 && !nome.includes('|') && !nome.includes('Nível')) {
      subs.push(nome);
    }
  }
  return subs;
}

export function renderFeatureItem(f, source) {
  let recarga = detectarRecarga(f.descricao);
  // Features that are purely descriptive should always be passive
  const nomeNorm = semAcento(f.nome);
  const ativa = ehHabilidadeAtiva(f.descricao, f.nome);
  const key = `${source}_${f.nome}`;
  if (!char.usos_habilidades) char.usos_habilidades = {};

  // Detectar usos máximos e sub-habilidades
  let usosMax = detectarUsosMaximos(f.descricao);
  const subHabilidades = detectarSubHabilidades(f.descricao);
  const ehCanalizarDivindadeClerigo = char.classe === 'Clérigo' && f.nome === 'Canalizar Divindade';
  const ehGolpesAbencoadosClerigo = char.classe === 'Clérigo' && f.nome === 'Golpes Abençoados';
  const ehIntervencaoDivinaClerigo = char.classe === 'Clérigo' && f.nome === 'Intervenção Divina';
  const ehIntervencaoDivinaMaiorClerigo = char.classe === 'Clérigo' && f.nome === 'Intervenção Divina Maior';

  const ehSubclasseClerigo = char.classe === 'Clérigo' && source === 'subclasse';
  const ehGuerraAtaqueDirecionado = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Ataque Direcionado';
  const ehGuerraSacerdote = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Sacerdote da Guerra';
  const ehGuerraBencaoDeus = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Bênção do Deus da Guerra';
  const ehLuzBrilho = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Brilho do Amanhecer';
  const ehLuzLabareda = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Labareda Protetora';
  const ehLuzCoroa = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Coroa de Luz';
  const ehTrapacaBencao = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Bênção do Trapaceiro';
  const ehTrapacaInvocar = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Invocar Duplicidade';
  const ehVidaPreservar = ehSubclasseClerigo && char.subclasse === 'Domínio da Vida' && f.nome === 'Preservar a Vida';

  const ehInimigoFavoritoGuardiao = char.classe === 'Guardião' && f.nome === 'Inimigo Favorito';
  const ehIncansavelGuardiao = char.classe === 'Guardião' && f.nome === 'Incansável';
  const ehVeuNaturezaGuardiao = char.classe === 'Guardião' && f.nome === 'Véu da Natureza';
  const ehMaestriaGuardiao = char.classe === 'Guardião' && f.nome === 'Maestria em Arma';
  const estadoGuardiao = (ehInimigoFavoritoGuardiao || ehIncansavelGuardiao || ehVeuNaturezaGuardiao || ehMaestriaGuardiao) ? getEstadoRecursosGuardiao() : null;

  // Guardião: subclasses — detecção de features
  const ehGuardiao = char.classe === 'Guardião';
  const ehSubclasseGuardiao = ehGuardiao && source === 'subclasse';
  // Andarilho Feérico
  const ehAndarilhoReforcos = ehSubclasseGuardiao && char.subclasse === 'Andarilho Feérico' && f.nome === 'Reforços Feéricos';
  const ehAndarilhoNebuloso = ehSubclasseGuardiao && char.subclasse === 'Andarilho Feérico' && f.nome === 'Andarilho Nebuloso';
  // Caçador
  const ehCacadorPresa = ehSubclasseGuardiao && char.subclasse === 'Caçador' && f.nome === 'Presa do Caçador';
  const ehCacadorTaticas = ehSubclasseGuardiao && char.subclasse === 'Caçador' && f.nome === 'Táticas Defensivas';
  // Senhor das Feras
  const ehFerasCompanheiro = ehSubclasseGuardiao && char.subclasse === 'Senhor das Feras' && f.nome === 'Companheiro Primal';
  // Vigilante das Sombras
  const ehVigilanteEmboscador = ehSubclasseGuardiao && char.subclasse === 'Vigilante das Sombras' && f.nome === 'Emboscador das Sombras';
  const estadoGuardiaoSub = (ehAndarilhoReforcos || ehAndarilhoNebuloso || ehCacadorPresa || ehCacadorTaticas || ehFerasCompanheiro || ehVigilanteEmboscador) ? getEstadoRecursosGuardiao() : null;

  // Druida: deteccao de Forma Selvagem para handler dedicado
  const ehFormaSelvagem = char.classe === 'Druida' && f.nome === 'Forma Selvagem';
  const estadoDruida = ehFormaSelvagem ? getEstadoRecursosDruida() : null;

  // Druida: subclasses — detecção de features
  const ehDruida = char.classe === 'Druida';
  const ehSubclasseDruida = ehDruida && source === 'subclasse';
  // Círculo da Lua
  const ehLuaPassoLunar = ehSubclasseDruida && char.subclasse === 'Círculo da Lua' && f.nome === 'Passo Lunar';
  // Círculo da Terra
  const ehTerraRecuperacao = ehSubclasseDruida && char.subclasse === 'Círculo da Terra' && f.nome === 'Recuperação Natural';
  // Círculo das Estrelas
  const ehEstrelasForma = ehSubclasseDruida && char.subclasse === 'Círculo das Estrelas' && f.nome === 'Forma Estrelada';
  const ehEstrelasMapa = ehSubclasseDruida && char.subclasse === 'Círculo das Estrelas' && f.nome === 'Mapa Estelar';
  const ehEstrelasPresagio = ehSubclasseDruida && char.subclasse === 'Círculo das Estrelas' && f.nome === 'Presságio Cósmico';
  const estadoDruidaSub = (ehLuaPassoLunar || ehTerraRecuperacao || ehEstrelasMapa || ehEstrelasPresagio || ehEstrelasForma) ? getEstadoRecursosDruida() : null;

  // Bardo: deteccao de Inspiracao de Bardo para handler dedicado
  const ehInspiracaoBardo = char.classe === 'Bardo' && f.nome === 'Inspiração de Bardo';
  const estadoInspiracaoBardo = ehInspiracaoBardo ? getEstadoInspiracaoBardo() : null;

  // Bruxo: deteccao de Astucia Magica para handler dedicado
  const ehAstuciaBruxo = char.classe === 'Bruxo' && f.nome === 'Astúcia Mágica';
  const estadoBruxoFeature = ehAstuciaBruxo ? getEstadoRecursosBruxo() : null;

  // Bruxo: subclasses — detecção de features
  const ehBruxo = char.classe === 'Bruxo';
  const ehSubclasseBruxo = ehBruxo && source === 'subclasse';
  // Patrono Arquifada
  const ehArquifadaPassos = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Passos Feéricos';
  const ehArquifadaFuga = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Fuga em Névoa';
  const ehArquifadaDefesas = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Defesas Sedutoras';
  const ehArquifadaMagiaSedutora = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Magia Sedutora';
  // Patrono Celestial
  const ehCelestialLuz = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Luz Medicinal';
  const ehCelestialAlma = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Alma Radiante';
  const ehCelestialResiliencia = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Resiliência Celestial';
  const ehCelestialVinganca = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Vingança Calcinante';
  // Patrono O Grande Antigo
  const ehAntigoCombatente = ehSubclasseBruxo && char.subclasse === 'Patrono O Grande Antigo' && f.nome === 'Combatente Clarividente';
  const ehAntigoDanacao = ehSubclasseBruxo && char.subclasse === 'Patrono O Grande Antigo' && f.nome === 'Danação Mística';
  const ehAntigoEscudo = ehSubclasseBruxo && char.subclasse === 'Patrono O Grande Antigo' && f.nome === 'Escudo Mental';
  // Patrono Ínfero
  const ehInferoBencao = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'Bênção do Tenebroso';
  const ehInferoSorte = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'A Sorte do Próprio Tenebroso';
  const ehInferoResistencia = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'Resistência Ínfera';
  const ehInferoLancar = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'Lançar no Inferno';
  const estadoBruxoSub = (ehArquifadaPassos || ehArquifadaFuga || ehArquifadaDefesas || ehCelestialLuz || ehCelestialVinganca || ehAntigoCombatente || ehInferoSorte || ehInferoResistencia || ehInferoLancar) ? getEstadoRecursosBruxo() : null;

  const ehFeiticeiro = char.classe === 'Feiticeiro';
  const subclasseFeiticeiro = semAcento(char.subclasse || '');
  const ehFeiticariaInata = ehFeiticeiro && f.nome === 'Feitiçaria Inata';
  const ehFonteMagia = ehFeiticeiro && f.nome === 'Fonte de Magia';
  const ehMetamagia = ehFeiticeiro && f.nome === 'Metamagia';
  const ehRestauracaoFeiticeira = ehFeiticeiro && f.nome === 'Restauração Feiticeira';
  const ehFalaTelepatica = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Aberrante') && f.nome === 'Fala Telepática';
  const ehRevelacaoCarne = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Aberrante') && f.nome === 'Revelação em Carne';
  const ehAfinidadeElemental = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Dracônica') && f.nome === 'Afinidade Elemental';
  const ehAsasDragao = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Dracônica') && f.nome === 'Asas de Dragão';
  const ehCompanheiroDraconico = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Dracônica') && f.nome === 'Companheiro Dracônico';
  const ehRestaurarEquilibrio = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Mecânica') && f.nome === 'Restaurar Equilíbrio';
  const ehBastiaoLei = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Mecânica') && f.nome === 'Bastião da Lei';
  const ehTranseOrdem = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Mecânica') && f.nome === 'Transe da Ordem';
  const ehMaresCaos = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Selvagem') && f.nome === 'Marés do Caos';
  const ehDistorcerSorte = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Selvagem') && f.nome === 'Distorcer a Sorte';
  const ehSurtoControlado = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Selvagem') && f.nome === 'Surto Controlado';

  const estadoFeiticeiro = ehFeiticeiro ? getEstadoRecursosFeiticeiro() : null;

  // Guerreiro: detecção de habilidades dedicadas
  const ehGuerreiro = char.classe === 'Guerreiro';
  const ehRecuperarFolegoGuerreiro = ehGuerreiro && f.nome === 'Recuperar Fôlego';
  const ehSurtoAcaoGuerreiro = ehGuerreiro && f.nome === 'Surto de Ação';
  const ehIndomavelGuerreiro = ehGuerreiro && f.nome === 'Indomável';
  const ehMaestriaGuerreiro = ehGuerreiro && f.nome === 'Maestria em Arma';
  // Mestre da Batalha
  const ehSuperioridadeCombate = ehGuerreiro && char.subclasse === 'Mestre da Batalha' && f.nome === 'Superioridade em Combate';
  const ehConhecaInimigo = ehGuerreiro && char.subclasse === 'Mestre da Batalha' && f.nome === 'Conheça Seu Inimigo';
  // Combatente Psíquico
  const ehPoderPsionicoGuerreiro = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Poder Psiônico';
  const ehAdeptoTelecinetico = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Adepto Telecinético';
  const ehBaluarteEnergia = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Baluarte de Energia';
  const ehMestreTelecinetico = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Mestre Telecinético';
  const estadoGuerreiro = ehGuerreiro ? getEstadoRecursosGuerreiro() : null;

  // Paladino: detecção de habilidades dedicadas
  const ehPaladino = char.classe === 'Paladino';
  const ehMaosConsagradasPaladino = ehPaladino && f.nome === 'Mãos Consagradas';
  const ehCanalizarPaladino = ehPaladino && f.nome === 'Canalizar Divindade';
  const ehDestruicaoPaladino = ehPaladino && f.nome === 'Destruição do Paladino';
  const ehAuraProtecaoPaladino = ehPaladino && f.nome === 'Aura de Proteção';
  const ehGolpesRadiantesPaladino = ehPaladino && f.nome === 'Golpes Radiantes';
  const ehMaestriaPaladino = ehPaladino && f.nome === 'Maestria em Arma';
  const estadoPaladino = ehPaladino ? getEstadoRecursosPaladino() : null;

  // Monge: detecção de habilidades dedicadas
  const ehMonge = char.classe === 'Monge';
  const ehArtesMarciais = ehMonge && f.nome === 'Artes Marciais';
  const ehPontosFoco = ehMonge && f.nome === 'Foco do Monge';
  const ehDesviarAtaques = ehMonge && (f.nome === 'Defletir Ataques' || f.nome === 'Defletir Energia');
  const ehGolpeAtordoante = ehMonge && f.nome === 'Golpe Atordoante';
  const estadoMonge = ehMonge ? getEstadoRecursosMonge() : null;
  // Subclasses de Monge
  const ehSubclasseMonge = ehMonge && source === 'subclasse';
  // Mão Espalmada
  const ehEspalmadaIntegridade = ehSubclasseMonge && char.subclasse === 'Combatente da Mão Espalmada' && f.nome === 'Integridade Corporal';
  const ehEspalmadaPalma = ehSubclasseMonge && char.subclasse === 'Combatente da Mão Espalmada' && f.nome === 'Palma Vibrante';
  // Misericórdia
  const ehMisericordiaTorrente = ehSubclasseMonge && char.subclasse === 'Combatente da Misericórdia' && f.nome === 'Torrente de Cura e Dolo';
  const ehMisericordiaFinal = ehSubclasseMonge && char.subclasse === 'Combatente da Misericórdia' && f.nome === 'Mão da Misericórdia Final';
  // Elementos
  const ehElementosSintonia = ehSubclasseMonge && char.subclasse === 'Combatente dos Elementos' && f.nome === 'Sintonia Elemental';
  const estadoMongeSub = (ehEspalmadaIntegridade || ehEspalmadaPalma || ehMisericordiaTorrente || ehMisericordiaFinal || ehElementosSintonia) ? getEstadoRecursosMonge() : null;

  // Ladino: detecção de habilidades dedicadas
  const ehLadino = char.classe === 'Ladino';
  const ehAtaqueFurtivo = ehLadino && f.nome === 'Ataque Furtivo';
  const ehGolpeSorte = ehLadino && f.nome === 'Golpe de Sorte';
  const ehMaestriaLadino = ehLadino && f.nome === 'Maestria em Arma';
  // Adaga Espiritual
  const ehPoderPsionicoLadino = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Poder Psiônico';
  const ehLaminasAlma = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Lâminas da Alma';
  const ehVeuPsiquico = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Véu Psíquico';
  const ehRasgarMente = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Rasgar Mente';
  const estadoLadino = ehLadino ? getEstadoRecursosLadino() : null;

  // Mago: detecção de habilidades dedicadas
  const ehMago = char.classe === 'Mago';
  const ehRecuperacaoArcana = ehMago && f.nome === 'Recuperação Arcana';
  const ehAssinaturaMagica = ehMago && f.nome === 'Assinatura Mágica';
  const estadoMago = ehMago ? getEstadoRecursosMago() : null;
  // Subclasses de Mago
  const ehSubclasseMago = ehMago && source === 'subclasse';
  // Abjurador
  const ehAbjuradorProtecao = ehSubclasseMago && char.subclasse === 'Abjurador' && f.nome === 'Proteção Arcana';
  // Adivinhador
  const ehAdivinhadorProdigio = ehSubclasseMago && char.subclasse === 'Adivinhador' && f.nome === 'Prodígio';
  const ehAdivinhadorTerceiroOlho = ehSubclasseMago && char.subclasse === 'Adivinhador' && f.nome === 'O Terceiro Olho';
  // Evocador
  const ehEvocadorSobrecarga = ehSubclasseMago && char.subclasse === 'Evocador' && f.nome === 'Sobrecarga';
  // Ilusionista
  const ehIlusionistaEspectrais = ehSubclasseMago && char.subclasse === 'Ilusionista' && f.nome === 'Criaturas Espectrais';
  const ehIlusionistaAutoimagem = ehSubclasseMago && char.subclasse === 'Ilusionista' && f.nome === 'Autoimagem Ilusória';
  const estadoMagoSub = (ehAbjuradorProtecao || ehAdivinhadorProdigio || ehAdivinhadorTerceiroOlho || ehEvocadorSobrecarga || ehIlusionistaEspectrais || ehIlusionistaAutoimagem) ? getEstadoRecursosMago() : null;

  if (ehLuzLabareda && (char.nivel || 1) >= 6) recarga = 'curto_ou_longo';

  if (ehCanalizarDivindadeClerigo) {
    const prog = getProgressaoClerigo();
    if (prog?.canalizarDivindadeMax) usosMax = prog.canalizarDivindadeMax;
  }

  const temMultiplosUsos = usosMax && usosMax > 1 && recarga;
  const ehFuriaBarbaro = char.classe === 'Bárbaro' && f.nome === 'Fúria';
  const ehMaestriaBarbaro = char.classe === 'Bárbaro' && f.nome === 'Maestria em Arma';
  const ehAtaqueImprudente = char.classe === 'Bárbaro' && f.nome === 'Ataque Imprudente';
  const estadoFuria = ehFuriaBarbaro ? getEstadoFuria() : null;

  // Subclasses do Bárbaro
  const ehBarbaro = char.classe === 'Bárbaro';
  const ehCampeaoDeuses = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Campeão dos Deuses';
  const ehFuriaDivina = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Fúria Divina';
  const ehConcentracaoFanatica = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Concentração Fanática';
  const ehFuriaDeuses = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Fúria dos Deuses';
  const ehPresencaZelosa = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Presença Zelosa';
  const ehFuriaSelvagens = ehBarbaro && char.subclasse === 'Trilha do Coração Selvagem' && f.nome === 'Fúria dos Selvagens';
  const ehAspectoSelvagens = ehBarbaro && char.subclasse === 'Trilha do Coração Selvagem' && f.nome === 'Aspecto dos Selvagens';
  const ehPoderSelvagens = ehBarbaro && char.subclasse === 'Trilha do Coração Selvagem' && f.nome === 'Poder dos Selvagens';
  const ehVitalidadeArvore = ehBarbaro && char.subclasse === 'Trilha da Árvore do Mundo' && f.nome === 'Vitalidade da Árvore';
  const ehPercorrerArvore = ehBarbaro && char.subclasse === 'Trilha da Árvore do Mundo' && f.nome === 'Percorrer a Árvore';

  // Bárbaro: Golpe Brutal (nível 9+) e Golpe Brutal Aprimorado (13/17)
  const ehGolpeBrutal = ehBarbaro && (f.nome === 'Golpe Brutal' || f.nome === 'Golpe Brutal Aprimorado');

  // Bárbaro: Berserker — detecção de features de nível alto
  const ehBerserker = ehBarbaro && char.subclasse === 'Trilha do Berserker';
  const ehFrenesi = ehBerserker && f.nome === 'Frenesi';
  const ehFuriaIrracional = ehBerserker && f.nome === 'Fúria Irracional';
  const ehRetaliacao = ehBerserker && f.nome === 'Retaliação';
  const ehPresencaIntimidante = ehBerserker && f.nome === 'Presença Intimidante';

  // Bardo: detecção de habilidades de classe
  const ehBardo = char.classe === 'Bardo';
  const ehContraEncantamento = ehBardo && f.nome === 'Contra-Encantamento';
  const ehPalavrasCriacao = ehBardo && f.nome === 'Palavras de Criação';

  // Bardo: subclasses — detecção de features
  const ehSubclasseBardo = ehBardo && source === 'subclasse';
  // Colégio da Bravura
  const ehBravuraInspiracaoCombate = ehSubclasseBardo && char.subclasse === 'Colégio da Bravura' && f.nome === 'Inspiração em Combate';
  const ehBravuraMagiaBatalha = ehSubclasseBardo && char.subclasse === 'Colégio da Bravura' && f.nome === 'Magia de Batalha';
  // Colégio da Dança
  const ehDancaGingaFascinante = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Ginga Fascinante';
  const ehDancaGingadoCoordenado = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Gingado Coordenado';
  const ehDancaMovimentoInspirador = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Movimento Inspirador';
  const ehDancaEvasaoLiderada = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Evasão Liderada';
  // Colégio do Conhecimento
  const ehConhecimentoPalavrasInterrupcao = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Palavras de Interrupção';
  const ehConhecimentoProficienciasBonus = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Proficiências Bônus';
  const ehConhecimentoDescobertasMagicas = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Descobertas Mágicas';
  const ehConhecimentoPericiaInigualavel = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Perícia Inigualável';
  // Colégio do Glamour
  const ehGlamourMagiaFascinante = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Magia Fascinante';
  const ehGlamourMantoInspiracao = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Manto de Inspiração';
  const ehGlamourMantoMajestade = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Manto de Majestade';
  const ehGlamourMajestadeInquebravel = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Majestade Inquebrável';

  // Clérigo: features de nível alto faltantes
  const ehGuerraAvatarGuerra = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Avatar da Guerra';
  const ehTrapacaDuplicidadeAprimorada = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Duplicidade Aprimorada';
  const ehVidaCurandeiroAbencoado = ehSubclasseClerigo && char.subclasse === 'Domínio da Vida' && f.nome === 'Curandeiro Abençoado';
  const ehVidaCuraSuprema = ehSubclasseClerigo && char.subclasse === 'Domínio da Vida' && f.nome === 'Cura Suprema';
  const ehLuzLabaredaAprimorada = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Labareda Protetora Aprimorada';
  const ehTrapacaTransposicao = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Transposição do Trapaceiro';

  // Guerreiro: Campeão — detecção de features
  const ehCampeao = ehGuerreiro && char.subclasse === 'Campeão';
  const ehCriticoAprimorado = ehCampeao && f.nome === 'Crítico Aprimorado';
  const ehAtletaExtraordinario = ehCampeao && f.nome === 'Atleta Extraordinário';
  const ehEstiloLutaAdicional = ehCampeao && f.nome === 'Estilo de Luta Adicional';
  const ehCombatenteHeroico = ehCampeao && f.nome === 'Combatente Heroico';
  const ehCriticoSuperior = ehCampeao && f.nome === 'Crítico Superior';
  const ehSobrevivente = ehCampeao && f.nome === 'Sobrevivente';

  // Ladino: subclasses — detecção de features
  const ehSubclasseLadino = ehLadino && source === 'subclasse';
  // Ladrão
  const ehLadrao = ehLadino && char.subclasse === 'Ladrão';
  const ehAndarilhoTelhados = ehSubclasseLadino && ehLadrao && f.nome === 'Andarilho de Telhados';
  const ehMaoLeve = ehSubclasseLadino && ehLadrao && f.nome === 'Mão Leve';
  const ehFurtividadeSuprema = ehSubclasseLadino && ehLadrao && f.nome === 'Furtividade Suprema';
  const ehUsarDispositivoMagico = ehSubclasseLadino && ehLadrao && f.nome === 'Usar Dispositivo Mágico';
  const ehReflexosLadrao = ehSubclasseLadino && ehLadrao && f.nome === 'Reflexos de Ladrão';
  // Assassino
  const ehAssassino = ehLadino && char.subclasse === 'Assassino';
  const ehAssassinar = ehSubclasseLadino && ehAssassino && f.nome === 'Assassinar';
  const ehFerramentasAssassino = ehSubclasseLadino && ehAssassino && f.nome === 'Ferramentas de Assassino';
  const ehEspecialistaInfiltracao = ehSubclasseLadino && ehAssassino && f.nome === 'Especialista em Infiltração';
  const ehArmasVenenosas = ehSubclasseLadino && ehAssassino && f.nome === 'Armas Venenosas';
  const ehGolpeMortal = ehSubclasseLadino && ehAssassino && f.nome === 'Golpe Mortal';

  // Paladino: subclasses — detecção de features
  const ehSubclassePaladino = ehPaladino && source === 'subclasse';
  // Juramento da Glória
  const ehGloria = ehPaladino && char.subclasse === 'Juramento da Glória';
  const ehGloriaAtletaInigualavel = ehSubclassePaladino && ehGloria && f.nome === 'Atleta Inigualável';
  const ehGloriaDestruicaoInspiradora = ehSubclassePaladino && ehGloria && f.nome === 'Destruição Inspiradora';
  const ehGloriaAuraVivacidade = ehSubclassePaladino && ehGloria && f.nome === 'Aura de Vivacidade';
  const ehGloriaDefesaGloriosa = ehSubclassePaladino && ehGloria && f.nome === 'Defesa Gloriosa';
  const ehGloriaLendaViva = ehSubclassePaladino && ehGloria && f.nome === 'Lenda Viva';
  // Juramento da Vingança
  const ehVinganca = ehPaladino && char.subclasse === 'Juramento da Vingança';
  const ehVingancaVotoInimizade = ehSubclassePaladino && ehVinganca && f.nome === 'Voto de Inimizade';
  const ehVingancaVingadorImplacavel = ehSubclassePaladino && ehVinganca && f.nome === 'Vingador Implacável';
  const ehVingancaAlmaVingativa = ehSubclassePaladino && ehVinganca && f.nome === 'Alma Vingativa';
  const ehVingancaAnjoVingador = ehSubclassePaladino && ehVinganca && f.nome === 'Anjo Vingador';
  // Juramento dos Anciões
  const ehAncioes = ehPaladino && char.subclasse === 'Juramento dos Anciões';
  const ehAncioesIraNatureza = ehSubclassePaladino && ehAncioes && f.nome === 'A Ira da Natureza';
  const ehAncioesAuraResistencia = ehSubclassePaladino && ehAncioes && f.nome === 'Aura de Resistência';
  const ehAncioesSentinelaImortal = ehSubclassePaladino && ehAncioes && f.nome === 'Sentinela Imortal';
  const ehAncioesCampeaoAncestral = ehSubclassePaladino && ehAncioes && f.nome === 'Campeão Ancestral';
  // Juramento da Devoção
  const ehDevocao = ehPaladino && char.subclasse === 'Juramento da Devoção';
  const ehDevocaoArmaSagrada = ehSubclassePaladino && ehDevocao && f.nome === 'Arma Sagrada';
  const ehDevocaoResplendorSagrado = ehSubclassePaladino && ehDevocao && f.nome === 'Resplendor Sagrado';

  // Para habilidades com múltiplos usos, usar contador
  let usosAtual = 0;
  if (temMultiplosUsos) {
    if (typeof char.usos_habilidades[key] === 'number') {
      usosAtual = char.usos_habilidades[key];
    } else if (char.usos_habilidades[key] === true) {
      usosAtual = usosMax; // Migrar de boolean para número
      char.usos_habilidades[key] = usosMax;
    }
  }
  const usado = temMultiplosUsos ? usosAtual >= usosMax : (char.usos_habilidades[key] || false);
  const estadoClerigo = (ehCanalizarDivindadeClerigo || ehIntervencaoDivinaClerigo || ehIntervencaoDivinaMaiorClerigo || ehGolpesAbencoadosClerigo
    || ehGuerraBencaoDeus || ehLuzBrilho || ehVidaPreservar
    || ehGuerraAtaqueDirecionado || ehTrapacaInvocar)
    ? getEstadoRecursosClerigo()
    : null;
  const estadoSubclassesClerigo = (
    ehGuerraAtaqueDirecionado || ehGuerraSacerdote || ehGuerraBencaoDeus ||
    ehLuzBrilho || ehLuzLabareda || ehLuzCoroa ||
    ehTrapacaBencao || ehTrapacaInvocar || ehVidaPreservar ||
    ehGuerraAvatarGuerra || ehTrapacaDuplicidadeAprimorada || ehVidaCurandeiroAbencoado ||
    ehVidaCuraSuprema || ehLuzLabaredaAprimorada || ehTrapacaTransposicao
  ) ? getEstadoSubclassesClerigo() : null;

  const recargaBadge = recarga
    ? `<span class="badge" style="font-size:0.65rem;margin-left:4px;background:${recarga === 'longo' ? 'var(--info)' : recarga === 'curto' ? 'var(--success)' : 'var(--warning)'};color:#fff">${recarga === 'longo' ? '🌙 Desc. Longo' : recarga === 'curto' ? '☀ Desc. Curto' : '☀🌙 Curto/Longo'}</span>`
    : '';
  const tipoBadge = ativa
    ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--accent);color:#fff">Ativa</span>'
    : '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--text-muted);color:#fff">Passiva</span>';

  // Renderizar controle de usos (fora do summary para acessibilidade)
  let usosHtmlSummary = '';
  let usosHtmlBody = '';

  if (ehFuriaBarbaro && estadoFuria) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFuria.usosDisponiveis}/${estadoFuria.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoFuria.ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-toggle="${estadoFuria.ativa ? 'desativar' : 'ativar'}">
          ${estadoFuria.ativa ? 'Encerrar Fúria' : 'Entrar em Fúria'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Dano da Fúria: +${estadoFuria.dano}</span>
      </div>
    `;
  } else if (ehMaestriaBarbaro) {
    const prog = getProgressaoBarbaro() || { maestriasMax: 0 };
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/${prog.maestriasMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehAtaqueImprudente) {
    const ativo = ataqueImprudenteAtivo();
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativo ? 'btn-warning' : 'btn-secondary'}" data-imprudente-toggle="${ativo ? 'desativar' : 'ativar'}">
          ${ativo ? 'Desativar Ataque Imprudente' : 'Ativar Ataque Imprudente'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ajuste manual por turno</span>
      </div>
    `;
  } else if (ehCampeaoDeuses) {
    // Campeão dos Deuses (Fanático nv3): pool de d12 cura
    const nivel = char.nivel || 1;
    const dadosMax = nivel >= 17 ? 7 : nivel >= 12 ? 6 : nivel >= 6 ? 5 : 4;
    if (!char.recursos) char.recursos = {};
    if (typeof char.recursos.campeao_deuses_gastos !== 'number') char.recursos.campeao_deuses_gastos = 0;
    const dadosDisp = Math.max(0, dadosMax - char.recursos.campeao_deuses_gastos);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${dadosDisp}/${dadosMax} d12</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-campeao-deuses="usar" ${dadosDisp <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar d12 (Curar)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: gaste dados, role e recupere PV</span>
      </div>
    `;
  } else if (ehFuriaDivina) {
    // Fúria Divina: dano extra por turno durante Fúria
    const nivel = char.nivel || 1;
    const danoExtra = `1d6+${Math.floor(nivel / 2)}`;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? `<strong>Ativo:</strong> +${danoExtra} dano Necrótico ou Radiante (1o alvo por turno)` : 'Requer Fúria ativa'}
      </div>
    `;
  } else if (ehConcentracaoFanatica) {
    // Concentração Fanática: 1x por Fúria, re-roll salvaguarda
    if (!char.recursos) char.recursos = {};
    const usada = !!char.recursos.concentracao_fanatica_usada;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    const danoFuria = getEstadoFuria()?.dano || 0;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        ${furiaAtiva ? `
          <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-concentracao-fanatica="usar" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar (Re-roll +${danoFuria})</button>
          <span style="font-size:0.75rem;color:var(--text-muted)">${usada ? 'Já usada nesta Fúria' : '1x por Fúria: re-roll salvaguarda falha com bônus'}</span>
        ` : '<span style="font-size:0.75rem;color:var(--text-muted)">Requer Fúria ativa</span>'}
      </div>
    `;
  } else if (ehFuriaDeuses) {
    // Fúria dos Deuses (Fanático nv14): forma divina
    if (!char.recursos) char.recursos = {};
    const ativa = !!char.recursos.furia_deuses_ativa;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    const usada = !!char.recursos.furia_deuses_usada;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        ${furiaAtiva ? `
          <button class="btn btn-sm ${ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-deuses="${ativa ? 'desativar' : 'ativar'}" ${(!ativa && usada) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            ${ativa ? 'Encerrar Forma Divina' : 'Ativar Forma Divina'}
          </button>
          ${ativa ? '<span style="font-size:0.75rem;color:var(--success)">Resist: Necrótico, Psíquico, Radiante | Voo | Revivificação</span>' : ''}
          ${usada && !ativa ? '<span style="font-size:0.75rem;color:var(--text-muted)">Já usada (desc. longo)</span>' : ''}
        ` : '<span style="font-size:0.75rem;color:var(--text-muted)">Requer Fúria ativa</span>'}
      </div>
    `;
  } else if (ehPresencaZelosa) {
    // Presença Zelosa (Fanático nv10): buff aliados
    if (!char.recursos) char.recursos = {};
    const usada = !!char.recursos.presenca_zelosa_usada;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-presenca-zelosa="usar" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Presença Zelosa</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${usada ? 'Usada (desc. longo ou gastar Fúria)' : 'Até 10 aliados: Vant. em ataques e salvaguardas'}</span>
        ${usada ? '<button class="btn btn-sm btn-warning" data-presenca-zelosa="restaurar">Restaurar (gastar Fúria)</button>' : ''}
      </div>
    `;
  } else if (ehFuriaSelvagens) {
    // Fúria dos Selvagens: mostrar animal ativo
    const animal = char.recursos?.furia_animal;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva && animal ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva && animal ? `<strong>Espírito ativo:</strong> ${animal}` : 'Escolha ao ativar Fúria: Águia, Lobo ou Urso'}
        ${(char.nivel || 1) >= 14 ? ' (+ Carneiro, Falcão, Leão)' : ''}
      </div>
    `;
  } else if (ehAspectoSelvagens) {
    // Aspecto dos Selvagens: escolha persistente
    if (!char.recursos) char.recursos = {};
    const aspecto = char.recursos.aspecto_selvagem || null;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <select data-aspecto-selvagem="escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!aspecto ? 'selected' : ''}>Escolher...</option>
          <option value="Coruja" ${aspecto === 'Coruja' ? 'selected' : ''}>Coruja (Visão no Escuro 18m)</option>
          <option value="Pantera" ${aspecto === 'Pantera' ? 'selected' : ''}>Pantera (Escalada = Deslocamento)</option>
          <option value="Salmão" ${aspecto === 'Salmão' ? 'selected' : ''}>Salmão (Natação = Deslocamento)</option>
        </select>
        <span style="font-size:0.75rem;color:var(--text-muted)">Alterar no Descanso Longo</span>
      </div>
    `;
  } else if (ehVitalidadeArvore) {
    // Vitalidade da Árvore: info sobre PVT ao ativar + cura por turno
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    const danoFuria = getEstadoFuria()?.dano || 0;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? `<strong>Ativo:</strong> Surto: PVT = nível (${char.nivel})  |  Força Revigorante: ${danoFuria}d6 PVT a aliado por turno` : 'PVT ao ativar Fúria + d6 x dano da Fúria PVT a aliado/turno'}
      </div>
    `;
  } else if (ehGolpeBrutal) {
    // Golpe Brutal (9) / Golpe Brutal Aprimorado (13/17)
    const nivel = char.nivel || 1;
    const dadosDano = nivel >= 17 ? '2d10' : '1d10';
    const efeitosDisponiveis = ['Golpe Debilitador (-4,5m Desloc.)', 'Golpe Poderoso (empurrar 4,5m)'];
    if (nivel >= 13) {
      efeitosDisponiveis.push('Golpe Atordoante (Desv. prox. salv.)');
      efeitosDisponiveis.push('Golpe Destruidor (+5 prox. ataque aliado)');
    }
    const numEfeitos = nivel >= 17 ? 2 : 1;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600;margin-bottom:4px">+${dadosDano} dano (renunciar Vantagem do Ataque Imprudente)</div>
        <div style="color:var(--text-muted);font-size:0.75rem">Efeitos disponíveis (escolha ${numEfeitos}):</div>
        <ul style="margin:2px 0 0 16px;padding:0;font-size:0.75rem;color:var(--text-muted)">
          ${efeitosDisponiveis.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    `;
  } else if (ehFrenesi) {
    // Berserker: Frenesi (nv3) — dano extra com Ataque Imprudente durante Fúria
    const nivel = char.nivel || 1;
    const bonusDanoFuria = nivel >= 16 ? 4 : nivel >= 9 ? 3 : 2;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? `<strong>Ativo:</strong> +${bonusDanoFuria}d6 dano extra (1o alvo por turno com Ataque Imprudente)` : 'Requer Fúria ativa + Ataque Imprudente'}
      </div>
    `;
  } else if (ehRetaliacao) {
    // Berserker: Retaliação (nv10) — reação passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Reação — Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao sofrer dano de criatura a até 1,5m: ataque corpo a corpo contra ela como Reação.
        </div>
      </div>
    `;
  } else if (ehPresencaIntimidante) {
    // Berserker: Presença Intimidante (nv14) — 1x/longo ou gasta Fúria
    if (!char.recursos) char.recursos = {};
    const usada = !!char.recursos.presenca_intimidante_usada;
    const nivel = char.nivel || 1;
    const modFor = calcMod(char.atributos.forca);
    const cdPresenca = 8 + modFor + bonusProficiencia(nivel);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-danger'}" data-berserker-acao="presenca-intimidante" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Presença Intimidante</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD ${cdPresenca} (SAB) | Amedrontado 1 min</span>
        ${usada ? '<button class="btn btn-sm btn-warning" data-berserker-acao="presenca-restaurar">Restaurar (gastar Fúria)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehFuriaIrracional) {
    // Berserker nv6: Fúria Irracional — passiva durante Fúria
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? '<strong>Ativo:</strong> Imune a Amedrontado e Enfeitiçado enquanto em Fúria.' : 'Requer Fúria ativa — concede Imunidade a Amedrontado e Enfeitiçado.'}
      </div>
    `;
  } else if (ehPoderSelvagens) {
    // Coração Selvagem nv14: Poder dos Selvagens — aprimora Fúria dos Selvagens
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Fúria dos Selvagens</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao entrar em Fúria: escolha <strong>2 espíritos animais</strong> em vez de apenas 1.
        </div>
      </div>
    `;
  } else if (ehPercorrerArvore) {
    // Árvore do Mundo nv6: Percorrer a Árvore — Ação Bônus durante Fúria
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? '<strong>Disponível:</strong> Ação Bônus — teleporte até 18m para espaço desocupado visível.' : 'Requer Fúria ativa — Ação Bônus para teleportar até 18m.'}
      </div>
    `;
  } else if (ehContraEncantamento) {
    // Contra-Encantamento (Bardo nível 7): reação ilimitada
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Reação — Uso Ilimitado</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Quando você ou criatura a até 9m falhar em salvaguarda contra Amedrontado/Enfeitiçado:
          re-role a salvaguarda com Vantagem.
        </div>
      </div>
    `;
  } else if (ehPalavrasCriacao) {
    // Palavras de Criação (Bardo nível 20): magias sempre preparadas
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Magias Sempre Preparadas</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Palavra de Poder: Matar</strong> e <strong>Palavra de Poder: Salvar</strong><br>
          Pode escolher uma segunda criatura a até 3m do alvo original.
        </div>
      </div>
    `;
  } else if (ehBravuraInspiracaoCombate) {
    // Bravura: Inspiração em Combate (nv3) — informativo
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Uso de Inspiração de Bardo em Combate</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Defesa:</strong> Reação — +d${dadoInsp} na CA contra 1 ataque<br>
          <strong>Ofensa:</strong> +d${dadoInsp} no dano ao acertar um ataque com arma
        </div>
      </div>
    `;
  } else if (ehBravuraMagiaBatalha) {
    // Bravura: Magia de Batalha (nv14) — informativo
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Após conjurar magia (ação), pode fazer 1 ataque com arma como Ação Bônus.
        </div>
      </div>
    `;
  } else if (ehDancaGingaFascinante) {
    // Dança: Ginga Fascinante (nv3) — exibir CA alternativa
    const modDes = calcMod(char.atributos.destreza);
    const modCar = calcMod(char.atributos.carisma);
    const caGinga = 10 + modDes + modCar;
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">CA Desarmada: ${caGinga} (10 + DES ${modDes >= 0 ? '+' : ''}${modDes} + CAR ${modCar >= 0 ? '+' : ''}${modCar})</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Sem armadura/escudo: Vantagem em Atuação (dança)<br>
          Dano desarmado: d${dadoInsp} + DES | Ao gastar Inspiração: golpe desarmado incluso
        </div>
      </div>
    `;
  } else if (ehDancaGingadoCoordenado) {
    // Dança: Gingado Coordenado (nv6) — gasta Inspiração
    const estadoInsp = getEstadoInspiracaoBardo();
    const dadoInsp = estadoInsp?.dado || 6;
    const semInsp = !estadoInsp || estadoInsp.usosDisponiveis <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Insp. ${estadoInsp?.usosDisponiveis || 0}/${estadoInsp?.usosMax || 0}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bardo-subclasse-acao="danca_gingado_coordenado" ${semInsp ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Inspiração</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Iniciativa: +d${dadoInsp} para você e aliados em 9m</span>
      </div>
    `;
  } else if (ehDancaMovimentoInspirador) {
    // Dança: Movimento Inspirador (nv6) — reação + gasta Inspiração
    const estadoInsp = getEstadoInspiracaoBardo();
    const semInsp = !estadoInsp || estadoInsp.usosDisponiveis <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Insp. ${estadoInsp?.usosDisponiveis || 0}/${estadoInsp?.usosMax || 0}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bardo-subclasse-acao="danca_movimento_inspirador" ${semInsp ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Inspiração (Reação)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Move sem provocar + aliado em 9m também move</span>
      </div>
    `;
  } else if (ehDancaEvasaoLiderada) {
    // Dança: Evasão Liderada (nv14) — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva (não funciona Incapacitado)</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Evasão: sucesso DEX = 0 dano, falha = metade.<br>
          Compartilha com criaturas a 1,5m que fizerem a salvaguarda.
        </div>
      </div>
    `;
  } else if (ehConhecimentoPalavrasInterrupcao) {
    // Conhecimento: Palavras de Interrupção (nv3) — usa Inspiração + Reação
    const estadoInsp = getEstadoInspiracaoBardo();
    const dadoInsp = estadoInsp?.dado || 6;
    const semInsp = !estadoInsp || estadoInsp.usosDisponiveis <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Insp. ${estadoInsp?.usosDisponiveis || 0}/${estadoInsp?.usosMax || 0}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bardo-subclasse-acao="conhecimento_palavras_interrupcao" ${semInsp ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Inspiração (Reação)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Criatura a 18m: -d${dadoInsp} no dano, teste ou ataque</span>
      </div>
    `;
  } else if (ehConhecimentoProficienciasBonus) {
    // Conhecimento: Proficiências Bônus (nv3) — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — +3 Perícias</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Escolha 3 perícias adicionais para se tornar proficiente.
        </div>
      </div>
    `;
  } else if (ehConhecimentoDescobertasMagicas) {
    // Conhecimento: Descobertas Mágicas (nv6) — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — 2 Magias de Qualquer Lista</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Aprenda 2 magias de qualquer lista (Clérigo, Druida, Mago).<br>
          Sempre preparadas. Trocáveis ao subir de nível.
        </div>
      </div>
    `;
  } else if (ehConhecimentoPericiaInigualavel) {
    // Conhecimento: Perícia Inigualável (nv14) — usa Inspiração
    const estadoInsp = getEstadoInspiracaoBardo();
    const dadoInsp = estadoInsp?.dado || 6;
    const semInsp = !estadoInsp || estadoInsp.usosDisponiveis <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Insp. ${estadoInsp?.usosDisponiveis || 0}/${estadoInsp?.usosMax || 0}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bardo-subclasse-acao="conhecimento_pericia_inigualavel" ${semInsp ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Inspiração</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Falha em teste/ataque: +d${dadoInsp} (não gasta se ainda falhar)</span>
      </div>
    `;
  } else if (ehGlamourMagiaFascinante) {
    // Glamour: Magia Fascinante (nv3) — 1x/longo ou gasta Inspiração
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.bardo) char.recursos.bardo = { subclasses: { glamour: {} } };
    if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = { glamour: {} };
    if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};
    const usada = !!char.recursos.bardo.subclasses.glamour.magia_fascinante_usada;
    const nivel = char.nivel || 1;
    const cdFeitico = 8 + calcMod(char.atributos.carisma) + bonusProficiencia(nivel);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-bardo-subclasse-acao="glamour_magia_fascinante" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Magia Fascinante</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD ${cdFeitico} (SAB) | Amedrontado/Enfeitiçado 1 min</span>
        ${usada ? '<button class="btn btn-sm btn-warning" data-bardo-subclasse-acao="glamour_magia_fascinante_restaurar">Restaurar (gastar Inspiração)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehGlamourMantoInspiracao) {
    // Glamour: Manto de Inspiração (nv3) — gasta Inspiração de Bardo
    const estadoInsp = getEstadoInspiracaoBardo();
    const dadoInsp = estadoInsp?.dado || 6;
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    const semInsp = !estadoInsp || estadoInsp.usosDisponiveis <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Insp. ${estadoInsp?.usosDisponiveis || 0}/${estadoInsp?.usosMax || 0}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bardo-subclasse-acao="glamour_manto_inspiracao" ${semInsp ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Inspiração (Ação Bônus)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${modCar} criaturas: ${2 * dadoInsp} PVT + mover sem provocar</span>
      </div>
    `;
  } else if (ehGlamourMantoMajestade) {
    // Glamour: Manto de Majestade (nv6) — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.bardo) char.recursos.bardo = { subclasses: { glamour: {} } };
    if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = { glamour: {} };
    if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};
    const usado = !!char.recursos.bardo.subclasses.glamour.manto_majestade_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-bardo-subclasse-acao="glamour_manto_majestade" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Manto de Majestade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: Comando sem espaço + aura 1 min</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehGlamourMajestadeInquebravel) {
    // Glamour: Majestade Inquebrável (nv14) — 1x/curto ou longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.bardo) char.recursos.bardo = { subclasses: { glamour: {} } };
    if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = { glamour: {} };
    if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};
    const usada = !!char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-bardo-subclasse-acao="glamour_majestade_inquebravel" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Majestade Inquebrável</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: 1 min, atacantes fazem salv. CAR ou falham</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehInimigoFavoritoGuardiao && estadoGuardiao) {
    // Inimigo Favorito: usa o mesmo data-guardiao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiao.inimigoFavoritoDisponiveis}/${estadoGuardiao.inimigoFavoritoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoGuardiao.marcaPredadorAtiva ? 'btn-secondary' : 'btn-accent'}" data-guardiao-acao="${estadoGuardiao.marcaPredadorAtiva ? 'encerrar-marca' : 'usar-marca'}" ${(!estadoGuardiao.marcaPredadorAtiva && estadoGuardiao.inimigoFavoritoDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          ${estadoGuardiao.marcaPredadorAtiva ? 'Encerrar Marca' : 'Ativar Marca (sem espaço)'}
        </button>
        ${estadoGuardiao.marcaPredadorAtiva ? `<span style="font-size:0.75rem;color:var(--success)">Marca ativa (${estadoGuardiao.marcaPredadorDado})</span>` : ''}
      </div>
    `;
  } else if (ehIncansavelGuardiao && estadoGuardiao && estadoGuardiao.incansavelAtivo) {
    // Incansavel: usa o mesmo data-guardiao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiao.incansavelDisponiveis}/${estadoGuardiao.incansavelMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-guardiao-acao="incansavel" ${estadoGuardiao.incansavelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Incansavel</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">d8 + mod Sabedoria PV temporarios</span>
      </div>
    `;
  } else if (ehVeuNaturezaGuardiao && estadoGuardiao && estadoGuardiao.veuNaturezaAtivo) {
    // Veu da Natureza: usa o mesmo data-guardiao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiao.veuNaturezaDisponiveis}/${estadoGuardiao.veuNaturezaMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-guardiao-acao="veu" ${estadoGuardiao.veuNaturezaDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Veu da Natureza</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Invisivel ate o final do proximo turno</span>
      </div>
    `;
  } else if (ehFormaSelvagem && estadoDruida) {
    // Forma Selvagem: usa o mesmo data-druida-forma-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruida.usosDisponiveis}/${estadoDruida.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoDruida.formaSelvagemAtiva ? 'btn-secondary' : 'btn-accent'}" data-druida-forma-acao="${estadoDruida.formaSelvagemAtiva ? 'desativar' : 'ativar'}" ${(!estadoDruida.formaSelvagemAtiva && estadoDruida.usosDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          ${estadoDruida.formaSelvagemAtiva ? 'Encerrar Forma Selvagem' : 'Ativar Forma Selvagem'}
        </button>
      </div>
    `;
  } else if (ehInspiracaoBardo && estadoInspiracaoBardo) {
    // Inspiracao de Bardo: usa o mesmo data-inspiracao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoInspiracaoBardo.usosDisponiveis}/${estadoInspiracaoBardo.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-inspiracao-acao="usar" ${estadoInspiracaoBardo.usosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Inspiracao (d${estadoInspiracaoBardo.dado})</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Recupera ${estadoInspiracaoBardo.recuperaCurto ? 'Descanso Curto' : 'Descanso Longo'}</span>
      </div>
    `;
  } else if (ehAstuciaBruxo && estadoBruxoFeature) {
    // Astucia Magica: usa o mesmo data-bruxo-astucia-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoFeature.astuciaUsada ? 'Usada' : 'Disponivel'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-astucia-acao="usar" ${estadoBruxoFeature.astuciaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Astucia Magica</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Recupera no Descanso Longo</span>
      </div>
    `;
  } else if (ehArquifadaPassos && estadoBruxoSub) {
    // Patrono Arquifada nv3: Passos Feéricos — CHA mod usos/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.passosFeericosDisponiveis}/${estadoBruxoSub.passosFeericosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-subclasse-acao="passos_feericos" ${estadoBruxoSub.passosFeericosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Passos Feéricos</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Teletransportar 9m + Passo Provocante ou Revigorante</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehArquifadaFuga && estadoBruxoSub) {
    // Patrono Arquifada nv6: Fuga em Névoa — 1/longo ou gastar espaço de Pacto
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.fugaNeVoaUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.fugaNeVoaUsada ? 'btn-secondary' : 'btn-accent'}" data-bruxo-subclasse-acao="fuga_nevoa" ${estadoBruxoSub.fugaNeVoaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Fuga em Névoa</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: Passo Nebuloso + Desvanecedor ou Terrível</span>
        ${estadoBruxoSub.fugaNeVoaUsada ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="fuga_nevoa_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehArquifadaDefesas && estadoBruxoSub) {
    // Patrono Arquifada nv10: Defesas Sedutoras — imune Enfeitiçado + reação 1/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.defesasSedutorasUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.defesasSedutorasUsada ? 'btn-secondary' : 'btn-accent'}" data-bruxo-subclasse-acao="defesas_sedutoras" ${estadoBruxoSub.defesasSedutorasUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Defesas Sedutoras</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: Enfeitiçar atacante | Imune a Enfeitiçado</span>
        ${estadoBruxoSub.defesasSedutorasUsada ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="defesas_sedutoras_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehArquifadaMagiaSedutora) {
    // Patrono Arquifada nv14: Magia Sedutora — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Após conjurar Encantamento ou Ilusão: Passo Nebuloso grátis (sem espaço, sem ação).
        </div>
      </div>
    `;
  } else if (ehCelestialLuz && estadoBruxoSub) {
    // Patrono Celestial nv3: Luz Medicinal — pool de d6s = 1 + nível
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.luzMedicinalDadosDisponiveis}/${estadoBruxoSub.luzMedicinalDadosMax} d6</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-subclasse-acao="luz_medicinal" ${estadoBruxoSub.luzMedicinalDadosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Luz Medicinal</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: gaste d6s para curar a até 18m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCelestialAlma) {
    // Patrono Celestial nv6: Alma Radiante — passiva
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Resistência + Dano Extra</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Resistência a dano Radiante.<br>
          Ao causar dano Ígneo ou Radiante: +${modCar} (mod CAR) ao dano.
        </div>
      </div>
    `;
  } else if (ehCelestialResiliencia) {
    // Patrono Celestial nv10: Resiliência Celestial — passiva
    const nivel = char.nivel || 1;
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — PV Temporários</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao terminar Descanso Curto/Longo ou usar Recuperação Arcana: receba ${modCar}+${nivel} PVT (mod CAR + nível).
        </div>
      </div>
    `;
  } else if (ehCelestialVinganca && estadoBruxoSub) {
    // Patrono Celestial nv14: Vingança Calcinante — 1/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.vingancaCalcinanteUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.vingancaCalcinanteUsada ? 'btn-secondary' : 'btn-danger'}" data-bruxo-subclasse-acao="vinganca_calcinante" ${estadoBruxoSub.vingancaCalcinanteUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Vingança Calcinante</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Quando aliado faz salvaguarda contra morte: 2d8+CAR Radiante em 9m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAntigoCombatente && estadoBruxoSub) {
    // Patrono O Grande Antigo nv6: Combatente Clarividente — 1/curto ou gastar Pacto
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.combatenteClarividenteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.combatenteClarividenteUsado ? 'btn-secondary' : 'btn-accent'}" data-bruxo-subclasse-acao="combatente_clarividente" ${estadoBruxoSub.combatenteClarividenteUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Combatente Clarividente</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: Vantagem em ataques 1 turno</span>
        ${estadoBruxoSub.combatenteClarividenteUsado ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="combatente_clarividente_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAntigoDanacao) {
    // Patrono O Grande Antigo nv10: Danação Mística — passiva (aprimora Maldição)
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Maldição</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Maldição não requer Concentração. Dano adicional Psíquico = bônus de proficiência.<br>
          Transferência: ao abater alvo, mova para criatura a até 9m.
        </div>
      </div>
    `;
  } else if (ehAntigoEscudo) {
    // Patrono O Grande Antigo nv10: Escudo Mental — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Resistência Psíquica</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Resistência a dano Psíquico. Ao sofrer dano Psíquico: reflexão do dano de volta ao atacante.
        </div>
      </div>
    `;
  } else if (ehInferoBencao) {
    // Patrono Ínfero nv3: Bênção do Tenebroso — passiva
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — PV Temporários ao Abater</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao reduzir criatura hostil a 0 PV: receba ${modCar}+${char.nivel || 1} PVT (mod CAR + nível).
        </div>
      </div>
    `;
  } else if (ehInferoSorte && estadoBruxoSub) {
    // Patrono Ínfero nv6: A Sorte do Próprio Tenebroso — CHA mod usos/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.sorteTenebrosoDisponiveis}/${estadoBruxoSub.sorteTenebrosoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-subclasse-acao="sorte_tenebroso" ${estadoBruxoSub.sorteTenebrosoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Sorte (+1d10)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ao falhar teste de atributo ou salvaguarda: +1d10</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehInferoResistencia && estadoBruxoSub) {
    // Patrono Ínfero nv10: Resistência Ínfera — escolher tipo no descanso
    const escolha = estadoBruxoSub.resistenciaInferaEscolha;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${escolha || 'Nenhuma'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <select data-bruxo-subclasse-acao="resistencia_infera_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!escolha ? 'selected' : ''}>Escolher...</option>
          <option value="Contundente" ${escolha === 'Contundente' ? 'selected' : ''}>Contundente</option>
          <option value="Cortante" ${escolha === 'Cortante' ? 'selected' : ''}>Cortante</option>
          <option value="Perfurante" ${escolha === 'Perfurante' ? 'selected' : ''}>Perfurante</option>
          <option value="Ácido" ${escolha === 'Ácido' ? 'selected' : ''}>Ácido</option>
          <option value="Elétrico" ${escolha === 'Elétrico' ? 'selected' : ''}>Elétrico</option>
          <option value="Gélido" ${escolha === 'Gélido' ? 'selected' : ''}>Gélido</option>
          <option value="Ígneo" ${escolha === 'Ígneo' ? 'selected' : ''}>Ígneo</option>
          <option value="Necrótico" ${escolha === 'Necrótico' ? 'selected' : ''}>Necrótico</option>
          <option value="Radiante" ${escolha === 'Radiante' ? 'selected' : ''}>Radiante</option>
          <option value="Trovejante" ${escolha === 'Trovejante' ? 'selected' : ''}>Trovejante</option>
          <option value="Venenoso" ${escolha === 'Venenoso' ? 'selected' : ''}>Venenoso</option>
        </select>
        <span style="font-size:0.75rem;color:var(--text-muted)">Alterar ao terminar Descanso Curto ou Longo</span>
      </div>
    `;
  } else if (ehInferoLancar && estadoBruxoSub) {
    // Patrono Ínfero nv14: Lançar no Inferno — 1/longo ou gastar Pacto
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.lancarInfernoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.lancarInfernoUsado ? 'btn-secondary' : 'btn-danger'}" data-bruxo-subclasse-acao="lancar_inferno" ${estadoBruxoSub.lancarInfernoUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Lançar no Inferno</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">8d10 Psíquico + 8d10 Ígneo (aparência do Inferno)</span>
        ${estadoBruxoSub.lancarInfernoUsado ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="lancar_inferno_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehLuaPassoLunar && estadoDruidaSub) {
    // Círculo da Lua nv10: Passo Lunar — SAB mod/longo, recuperável com slot 2+
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruidaSub.passoLunarDisponiveis}/${estadoDruidaSub.passoLunarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-druida-subclasse-acao="passo_lunar" ${estadoDruidaSub.passoLunarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Passo Lunar</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Teleporte 9m + Vantagem no próximo ataque</span>
        ${estadoDruidaSub.passoLunarDisponiveis < estadoDruidaSub.passoLunarMax ? '<button class="btn btn-sm btn-warning" data-druida-subclasse-acao="passo_lunar_restaurar">Restaurar (gastar slot 2+)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehTerraRecuperacao && estadoDruidaSub) {
    // Círculo da Terra nv6: Recuperação Natural — 1 magia grátis/longo + slots/curto(1/longo)
    const magiaStatus = estadoDruidaSub.recuperacaoNaturalMagiaUsada ? 'Usada' : 'Disponível';
    const slotsStatus = estadoDruidaSub.recuperacaoNaturalSlotsUsada ? 'Usada' : 'Disponível';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Magia: ${magiaStatus} | Slots: ${slotsStatus}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoDruidaSub.recuperacaoNaturalMagiaUsada ? 'btn-secondary' : 'btn-accent'}" data-druida-subclasse-acao="recuperacao_magia" ${estadoDruidaSub.recuperacaoNaturalMagiaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar Magia Grátis</button>
        <button class="btn btn-sm ${estadoDruidaSub.recuperacaoNaturalSlotsUsada ? 'btn-secondary' : 'btn-warning'}" data-druida-subclasse-acao="recuperacao_slots" ${estadoDruidaSub.recuperacaoNaturalSlotsUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperar Slots (Desc. Curto)</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehEstrelasForma && estadoDruidaSub) {
    // Círculo das Estrelas nv3: Forma Estrelada — escolha de constelação
    const constelacao = estadoDruidaSub.constelacaoAtiva;
    const semForma = estadoDruidaSub.usosDisponiveis <= 0;
    const selectDesabilitado = semForma && !constelacao;
    usosHtmlSummary = constelacao
      ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Ativa: ${constelacao}</span>`
      : `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">FS ${estadoDruidaSub.usosDisponiveis}/${estadoDruidaSub.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Constelação:</span>
        <select data-druida-subclasse-acao="constelacao_escolha" ${selectDesabilitado ? 'disabled' : ''} style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)${selectDesabilitado ? ';opacity:0.5;cursor:not-allowed' : ''}">
          <option value="" ${!constelacao ? 'selected' : ''}>Nenhuma</option>
          <option value="Arqueiro" ${constelacao === 'Arqueiro' ? 'selected' : ''}>Arqueiro (1d8 Radiante + SAB)</option>
          <option value="Dragão" ${constelacao === 'Dragão' ? 'selected' : ''}>Dragão (mín 10 em INT/SAB/CON conc.)</option>
          <option value="Taça" ${constelacao === 'Taça' ? 'selected' : ''}>Taça (1d8 + SAB cura extra)</option>
        </select>
        <span style="font-size:0.75rem;color:var(--text-muted)">Gasta 1 uso de Forma Selvagem</span>
      </div>
    `;
  } else if (ehEstrelasMapa && estadoDruidaSub) {
    // Círculo das Estrelas nv3: Mapa Estelar — SAB mod Raio Guia grátis/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruidaSub.mapaEstelarDisponiveis}/${estadoDruidaSub.mapaEstelarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-druida-subclasse-acao="mapa_estelar" ${estadoDruidaSub.mapaEstelarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar Raio Guia (grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Raio Guia sem gastar espaço de magia</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehEstrelasPresagio && estadoDruidaSub) {
    // Círculo das Estrelas nv6: Presságio Cósmico — SAB mod reações/longo + tipo par/ímpar
    const tipo = estadoDruidaSub.pressagioTipo;
    const tipoLabel = tipo === 'prosperidade' ? 'Prosperidade (+1d6)' : tipo === 'infortunio' ? 'Infortúnio (-1d6)' : 'Não definido';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruidaSub.pressagioDisponiveis}/${estadoDruidaSub.pressagioMax} | ${tipoLabel}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-druida-subclasse-acao="pressagio_usar" ${estadoDruidaSub.pressagioDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Presságio</button>
        <select data-druida-subclasse-acao="pressagio_tipo" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!tipo ? 'selected' : ''}>Escolher tipo</option>
          <option value="prosperidade" ${tipo === 'prosperidade' ? 'selected' : ''}>Prosperidade (par, +1d6)</option>
          <option value="infortunio" ${tipo === 'infortunio' ? 'selected' : ''}>Infortúnio (ímpar, -1d6)</option>
        </select>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAndarilhoReforcos && estadoGuardiaoSub) {
    // Andarilho Feérico nv11: Reforços Feéricos — 1 conjuração grátis/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiaoSub.reforcosFeericosUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoGuardiaoSub.reforcosFeericosUsado ? 'btn-secondary' : 'btn-accent'}" data-guardiao-subclasse-acao="reforcos_feericos" ${estadoGuardiaoSub.reforcosFeericosUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Convocar Feérico (grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Sem Material, sem slot, sem Concentração (1 min)</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAndarilhoNebuloso && estadoGuardiaoSub) {
    // Andarilho Feérico nv15: Andarilho Nebuloso — SAB mod Passo Nebuloso grátis/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiaoSub.andarilhoNebulosoDisponiveis}/${estadoGuardiaoSub.andarilhoNebulosoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guardiao-subclasse-acao="andarilho_nebuloso" ${estadoGuardiaoSub.andarilhoNebulosoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Passo Nebuloso (grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Teleporte 9m + pode levar 1 criatura a 1,5m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCacadorPresa && estadoGuardiaoSub) {
    // Caçador nv3: Presa do Caçador — escolha
    const escolha = estadoGuardiaoSub.presaCacadorEscolha;
    usosHtmlSummary = escolha ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${escolha}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Opção ativa:</span>
        <select data-guardiao-subclasse-acao="presa_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!escolha ? 'selected' : ''}>Escolher</option>
          <option value="Assassino de Colossos" ${escolha === 'Assassino de Colossos' ? 'selected' : ''}>Assassino de Colossos (+1d8 se PV < máx)</option>
          <option value="Destruidor de Hordas" ${escolha === 'Destruidor de Hordas' ? 'selected' : ''}>Destruidor de Hordas (ataque extra 1,5m)</option>
        </select>
      </div>
    `;
  } else if (ehCacadorTaticas && estadoGuardiaoSub) {
    // Caçador nv7: Táticas Defensivas — escolha
    const escolha = estadoGuardiaoSub.taticasDefensivasEscolha;
    usosHtmlSummary = escolha ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${escolha}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Tática ativa:</span>
        <select data-guardiao-subclasse-acao="taticas_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!escolha ? 'selected' : ''}>Escolher</option>
          <option value="Defesa Contra Ataques Múltiplos" ${escolha === 'Defesa Contra Ataques Múltiplos' ? 'selected' : ''}>Defesa Contra Ataques Múltiplos</option>
          <option value="Escapar de Hordas" ${escolha === 'Escapar de Hordas' ? 'selected' : ''}>Escapar de Hordas (Desv. em OA)</option>
        </select>
      </div>
    `;
  } else if (ehFerasCompanheiro && estadoGuardiaoSub) {
    // Senhor das Feras nv3: Companheiro Primal — tipo de fera
    const tipo = estadoGuardiaoSub.companheiroTipo;
    usosHtmlSummary = tipo ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Fera: ${tipo}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Tipo de Fera:</span>
        <select data-guardiao-subclasse-acao="companheiro_tipo" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!tipo ? 'selected' : ''}>Escolher</option>
          <option value="Fera da Terra" ${tipo === 'Fera da Terra' ? 'selected' : ''}>Fera da Terra (12m, Escalada 12m)</option>
          <option value="Fera do Céu" ${tipo === 'Fera do Céu' ? 'selected' : ''}>Fera do Céu (Voo 18m)</option>
          <option value="Fera do Mar" ${tipo === 'Fera do Mar' ? 'selected' : ''}>Fera do Mar (Natação 18m)</option>
        </select>
      </div>
    `;
  } else if (ehVigilanteEmboscador && estadoGuardiaoSub) {
    // Vigilante das Sombras nv3: Emboscador — Golpe Terrível SAB mod/longo
    const dano = (char.nivel || 1) >= 11 ? '2d8' : '2d6';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiaoSub.golpeTerrivelDisponiveis}/${estadoGuardiaoSub.golpeTerrivelMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guardiao-subclasse-acao="golpe_terrivel" ${estadoGuardiaoSub.golpeTerrivelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Terrível</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${dano} Psíquico (1/turno) + SAB em Iniciativa</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCanalizarDivindadeClerigo && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-cd-acao="centelha" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Centelha Divina</button>
        <button class="btn btn-sm btn-secondary" data-clerigo-cd-acao="expulsar" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Expulsar Mortos-Vivos</button>
        ${char.nivel >= 5 ? `<button class="btn btn-sm btn-accent" data-clerigo-cd-acao="fulminar" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Fulminar Mortos-Vivos</button>` : ''}
      </div>
    `;
  } else if (ehGolpesAbencoadosClerigo && estadoClerigo) {
    const opcaoAtual = char.recursos?.clerigo?.golpes_abencoados_opcao || '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${opcaoAtual === 'Conjuração Poderosa' ? 'btn-accent' : 'btn-secondary'}" data-clerigo-golpes-opcao="Conjuração Poderosa">Conjuração Poderosa</button>
        <button class="btn btn-sm ${opcaoAtual === 'Golpe Divino' ? 'btn-accent' : 'btn-secondary'}" data-clerigo-golpes-opcao="Golpe Divino">Golpe Divino</button>
      </div>
    `;
  } else if (ehIntervencaoDivinaClerigo && estadoClerigo) {
    const bloqueada = estadoClerigo.intervencaoDivinaBloqueada;
    const restantes = estadoClerigo.intervencaoDivinaDescansosRestantes;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${bloqueada ? 'Em recarga' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${bloqueada ? 'btn-secondary' : 'btn-primary'}" data-clerigo-intervencao="normal" ${bloqueada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Intervenção Divina</button>
        ${bloqueada && restantes > 0 ? `<span style="font-size:0.75rem;color:var(--warning)">Recarrega em ${restantes} descanso(s) longo(s)</span>` : ''}
      </div>
    `;
  } else if (ehIntervencaoDivinaMaiorClerigo && estadoClerigo) {
    const bloqueada = estadoClerigo.intervencaoDivinaBloqueada;
    const restantes = estadoClerigo.intervencaoDivinaDescansosRestantes;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${bloqueada ? 'Em recarga' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${bloqueada ? 'btn-secondary' : 'btn-primary'}" data-clerigo-intervencao="normal" ${bloqueada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Intervenção (normal)</button>
        <button class="btn btn-sm ${bloqueada ? 'btn-secondary' : 'btn-danger'}" data-clerigo-intervencao="desejo" ${bloqueada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Intervenção Maior (Desejo)</button>
        ${bloqueada && restantes > 0 ? `<span style="font-size:0.75rem;color:var(--warning)">Recarrega em ${restantes} descanso(s) longo(s)</span>` : ''}
      </div>
    `;
  } else if (ehGuerraAtaqueDirecionado && estadoClerigo && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="guerra_ataque_direcionado" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Ataque Direcionado</button>
      </div>
    `;
  } else if (ehGuerraSacerdote && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoSubclassesClerigo.guerra.sacerdoteUsosDisponiveis}/${estadoSubclassesClerigo.guerra.sacerdoteUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="guerra_sacerdote_guerra" ${estadoSubclassesClerigo.guerra.sacerdoteUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Sacerdote da Guerra</button>
      </div>
    `;
  } else if (ehGuerraBencaoDeus && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="guerra_bencao_deus" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Bênção do Deus da Guerra</button>
      </div>
    `;
  } else if (ehLuzBrilho && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="luz_brilho_amanhecer" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Brilho do Amanhecer</button>
      </div>
    `;
  } else if (ehLuzLabareda && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoSubclassesClerigo.luz.labaredaUsosDisponiveis}/${estadoSubclassesClerigo.luz.labaredaUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="luz_labareda_protetora" ${estadoSubclassesClerigo.luz.labaredaUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Labareda Protetora</button>
      </div>
    `;
  } else if (ehLuzCoroa && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoSubclassesClerigo.luz.coroaUsosDisponiveis}/${estadoSubclassesClerigo.luz.coroaUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="luz_coroa_luz" ${estadoSubclassesClerigo.luz.coroaUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Coroa de Luz</button>
      </div>
    `;
  } else if (ehTrapacaBencao && estadoSubclassesClerigo) {
    const ativaBencao = estadoSubclassesClerigo.trapaca.bencaoTrapaceiroAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativaBencao ? 'Ativa' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativaBencao ? 'btn-secondary' : 'btn-primary'}" data-clerigo-subclasse-acao="trapaca_bencao_toggle">${ativaBencao ? 'Encerrar Bênção' : 'Ativar Bênção'}</button>
      </div>
    `;
  } else if (ehTrapacaInvocar && estadoClerigo && estadoSubclassesClerigo) {
    const ativaDup = estadoSubclassesClerigo.trapaca.invocarDuplicidadeAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativaDup ? 'Ativa' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativaDup ? 'btn-secondary' : 'btn-primary'}" data-clerigo-subclasse-acao="trapaca_invocar_duplicidade" ${(estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 && !ativaDup) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${ativaDup ? 'Encerrar Duplicidade' : 'Invocar Duplicidade'}</button>
        ${!ativaDup ? `<span style="font-size:0.75rem;color:var(--text-muted)">Consome 1 Canalizar Divindade</span>` : ''}
      </div>
    `;
  } else if (ehVidaPreservar && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="vida_preservar_vida" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Preservar a Vida</button>
      </div>
    `;
  } else if (ehGuerraAvatarGuerra) {
    // Guerra nv17: Avatar da Guerra — resistências passivas
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Resistências Permanentes</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Resistência a dano <strong>Contundente</strong>, <strong>Cortante</strong> e <strong>Perfurante</strong>.
        </div>
      </div>
    `;
  } else if (ehVidaCurandeiroAbencoado) {
    // Vida nv6: Curandeiro Abençoado — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Autocura</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao curar outros com espaço de magia: você recupera 2 + círculo do espaço PV.
        </div>
      </div>
    `;
  } else if (ehVidaCuraSuprema) {
    // Vida nv17: Cura Suprema — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Dados Maximizados</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao restaurar PV com magia ou Canalizar Divindade: use o <strong>valor máximo</strong> dos dados
          (ex: 2d6 = 12, 4d8 = 32).
        </div>
      </div>
    `;
  } else if (ehTrapacaDuplicidadeAprimorada) {
    // Trapaça nv17: Duplicidade Aprimorada — aprimora Invocar Duplicidade
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Invocar Duplicidade</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Aliados também ganham Vantagem em ataques vs criatura perto da ilusão.<br>
          Ao encerrar a duplicidade: cure PV = nível de Clérigo (${char.nivel || 1}).
        </div>
      </div>
    `;
  } else if (ehTrapacaTransposicao) {
    // Trapaça nv6: Transposição do Trapaceiro — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Parte de Invocar Duplicidade</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao criar ou mover a ilusão: teleporte trocando de lugar com ela.
        </div>
      </div>
    `;
  } else if (ehLuzLabaredaAprimorada) {
    // Luz nv6: Labareda Protetora Aprimorada — aprimora Labareda
    const modSab = Math.max(1, calcMod(char.atributos.sabedoria));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Labareda Protetora</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Restaura usos em Descanso Curto ou Longo.<br>
          Ao usar: concede 2d6+${modSab} PV temporários ao alvo protegido.
        </div>
      </div>
    `;
  } else if (ehFeiticariaInata && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.feiticariaInataUsosDisponiveis}/${estadoFeiticeiro.feiticariaInataUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoFeiticeiro.feiticariaInataAtiva ? 'btn-secondary' : 'btn-primary'}" data-feiticeiro-acao="${estadoFeiticeiro.feiticariaInataAtiva ? 'encerrar-feiticaria-inata' : 'ativar-feiticaria-inata'}" ${(estadoFeiticeiro.feiticariaInataUsosDisponiveis <= 0 && !estadoFeiticeiro.feiticariaInataAtiva && (char.nivel || 1) < 7) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoFeiticeiro.feiticariaInataAtiva ? 'Encerrar' : 'Ativar'}</button>
      </div>
    `;
  } else if (ehFonteMagia && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">PF ${estadoFeiticeiro.pontosAtuais}/${estadoFeiticeiro.pontosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="converter-slot-ponto">Slot → PF</button>
        <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="converter-ponto-slot">PF → Slot</button>
      </div>
    `;
  } else if (ehMetamagia && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.metamagias.length} opção(ões)</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="metamagia-config">Gerenciar Metamagia</button>
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="metamagia-gastar">Gastar PF</button>
      </div>
    `;
  } else if (ehRestauracaoFeiticeira && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.restauracaoFeiticeiraUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="restauracao-feiticeira" ${estadoFeiticeiro.restauracaoFeiticeiraUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperar PF</button>
      </div>
    `;
  } else if (ehFalaTelepatica) {
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="fala-telepatica">Iniciar Telepatia</button>
      </div>
    `;
  } else if (ehRevelacaoCarne && estadoFeiticeiro) {
    const semPF = estadoFeiticeiro.pontosAtuais <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">PF ${estadoFeiticeiro.pontosAtuais}/${estadoFeiticeiro.pontosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="revelacao-carne" ${semPF ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Revelação em Carne</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Custo: 1-10 PF (1 benefício por PF)</span>
      </div>
    `;
  } else if (ehAfinidadeElemental && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.subclasses.draconica.afinidade_elemental || 'Não definida'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="afinidade-elemental">Definir Afinidade</button>
      </div>
    `;
  } else if (ehAsasDragao && estadoFeiticeiro) {
    const ativa = !!estadoFeiticeiro.subclasses.draconica.asas_ativas;
    const usada = !!estadoFeiticeiro.subclasses.draconica.asas_usada_desde_descanso;
    const semPFReativar = usada && !ativa && estadoFeiticeiro.pontosAtuais < 3;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Ativas' : (usada ? 'Gasta' : 'Disponível')}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativa ? 'btn-secondary' : 'btn-primary'}" data-feiticeiro-acao="${ativa ? 'desativar-asas-dragao' : 'ativar-asas-dragao'}" ${semPFReativar ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${ativa ? 'Recolher Asas' : (usada ? 'Reabrir Asas (3 PF)' : 'Abrir Asas')}</button>
      </div>
    `;
  } else if (ehCompanheiroDraconico && estadoFeiticeiro) {
    const usada = !!estadoFeiticeiro.subclasses.draconica.companheiro_draconico_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Gasto' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="companheiro-draconico" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar Invocar Dragão (grátis)</button>
      </div>
    `;
  } else if (ehRestaurarEquilibrio && estadoFeiticeiro) {
    const max = estadoFeiticeiro.modCar;
    const gastos = estadoFeiticeiro.subclasses.mecanica.restaurar_equilibrio_usos_gastos || 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${Math.max(0, max - gastos)}/${max}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="restaurar-equilibrio" ${gastos >= max ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Restaurar Equilíbrio</button>
      </div>
    `;
  } else if (ehBastiaoLei && estadoFeiticeiro) {
    const semPF = estadoFeiticeiro.pontosAtuais <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Escudo: ${estadoFeiticeiro.subclasses.mecanica.bastiao_dados || 0}d8</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="bastiao-lei" ${semPF ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Criar Bastião da Lei</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Custo: 1-5 PF</span>
      </div>
    `;
  } else if (ehTranseOrdem && estadoFeiticeiro) {
    const ativo = !!estadoFeiticeiro.subclasses.mecanica.transe_ordem_ativo;
    const usado = !!estadoFeiticeiro.subclasses.mecanica.transe_ordem_usado_desde_descanso;
    const semPFReativar = usado && !ativo && estadoFeiticeiro.pontosAtuais < 5;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativo ? 'Ativo' : 'Inativo'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativo ? 'btn-secondary' : 'btn-primary'}" data-feiticeiro-acao="${ativo ? 'desativar-transe-ordem' : 'ativar-transe-ordem'}" ${semPFReativar ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${ativo ? 'Encerrar Transe' : (usado ? 'Reativar Transe (5 PF)' : 'Ativar Transe')}</button>
      </div>
    `;
  } else if (ehMaresCaos && estadoFeiticeiro) {
    const disponivel = !!estadoFeiticeiro.subclasses.selvagem.mares_caos_disponivel;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disponivel ? 'Disponível' : 'Indisponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="mares-caos" ${!disponivel ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Marés do Caos</button>
      </div>
    `;
  } else if (ehDistorcerSorte && estadoFeiticeiro) {
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="distorcer-sorte" ${estadoFeiticeiro.pontosAtuais < 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Distorcer a Sorte (-1 PF)</button>
      </div>
    `;
  } else if (ehSurtoControlado && estadoFeiticeiro) {
    const usado = !!estadoFeiticeiro.subclasses.selvagem.surto_controlado_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Gasto' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="surto-controlado" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Surto Controlado</button>
      </div>
    `;
  } else if (ehRecuperarFolegoGuerreiro && estadoGuerreiro) {
    // Recuperar Fôlego: botão dedicado com contador de usos
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.recuperarFolegoDisponiveis}/${estadoGuerreiro.recuperarFolegoMax}</span>`;
    const curaFormula = `1d10 + ${char.nivel || 1}`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="usar-folego" ${estadoGuerreiro.recuperarFolegoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Recuperar Folego</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Cura: ${curaFormula} PV (Acao Bonus)</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehSurtoAcaoGuerreiro && estadoGuerreiro) {
    // Surto de Ação: botão de usar com controle
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.surtoDisponiveis}/${estadoGuerreiro.surtoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="usar-surto" ${estadoGuerreiro.surtoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Surto de Acao</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">1 acao adicional (exceto Usar Magia)</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehIndomavelGuerreiro && estadoGuerreiro && estadoGuerreiro.indomavelMax > 0) {
    // Indomável: botão de usar com contador
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.indomavelDisponiveis}/${estadoGuerreiro.indomavelMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-danger" data-guerreiro-acao="usar-indomavel" ${estadoGuerreiro.indomavelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Indomavel</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Bonus: +${char.nivel || 1} na salvaguarda</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehSuperioridadeCombate && estadoGuerreiro && estadoGuerreiro.dadosSuperioridadeMax > 0) {
    // Mestre da Batalha: Dados de Superioridade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.dadosSuperioridadeDisponiveis}/${estadoGuerreiro.dadosSuperioridadeMax} ${estadoGuerreiro.tipoDadoSuperioridade}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">CD: ${estadoGuerreiro.cdSuperioridade} | Manobras conhecidas: ${estadoGuerreiro.manobrasConhecidas}/${estadoGuerreiro.manobrasEsperadas}</div>
        ${estadoGuerreiro.manobrasComDescricao.length === 0
          ? '<div style="font-size:0.75rem;color:var(--warning,orange)">Nenhuma manobra escolhida ainda. Use o assistente de subida de nível para escolher.</div>'
          : estadoGuerreiro.manobrasComDescricao.map(m => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <button class="btn btn-sm btn-primary" data-guerreiro-acao="usar-superioridade" data-manobra-nome="${escHtml(m.nome)}" ${estadoGuerreiro.dadosSuperioridadeDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar</button>
            <span style="font-size:0.78rem"><strong>${escHtml(m.nome)}</strong></span>
          </div>
        `).join('')}
      </div>
      ${estadoGuerreiro.implacavelAtivo ? '<div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">Implacável: 1x/turno role 1d8 grátis em vez de gastar dado.</div>' : ''}
    `;
    recarga = 'curto_ou_longo';
  } else if (ehConhecaInimigo && estadoGuerreiro) {
    // Mestre da Batalha: Conheça Seu Inimigo (nível 7+)
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.conhecaInimigoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="conheca-inimigo" ${estadoGuerreiro.conhecaInimigoUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Conheça Seu Inimigo</button>
        <button class="btn btn-sm btn-secondary" data-guerreiro-acao="conheca-inimigo-dado" ${estadoGuerreiro.dadosSuperioridadeDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperar (gasta 1 Dado)</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehPoderPsionicoGuerreiro && estadoGuerreiro && estadoGuerreiro.dadosPsionicosMaxG > 0) {
    // Combatente Psíquico: Dados de Energia Psiônica
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.dadosPsionicosDisponiveisG}/${estadoGuerreiro.dadosPsionicosMaxG} ${estadoGuerreiro.tipoDadoPsionicoG}</span>`;
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="golpe-psionico" ${semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Psiônico</button>
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="vinculo-protetivo" ${semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Vínculo Protetivo</button>
        <button class="btn btn-sm btn-secondary" data-guerreiro-acao="movimento-telecinetico" ${estadoGuerreiro.movimentoTelecineticoUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.movimentoTelecineticoUsado ? 'Mov. Telecinético (gasta dado)' : 'Mov. Telecinético (grátis)'}</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Golpe: +${estadoGuerreiro.tipoDadoPsionicoG}+mod INT dano Energético | Vínculo: Reação, reduz dano em ${estadoGuerreiro.tipoDadoPsionicoG}+mod INT
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAdeptoTelecinetico && estadoGuerreiro) {
    // Combatente Psíquico: Adepto Telecinético (nível 7)
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.saltoImpulsaoUsado ? 'Salto Usado' : 'Salto Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="salto-impulsao" ${estadoGuerreiro.saltoImpulsaoUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.saltoImpulsaoUsado ? 'Salto Psíquico (gasta dado)' : 'Salto Psíquico (grátis)'}</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Estocada: alvo faz salv. FOR ou cai Caído/empurrado 3m. Salto: Ação Bônus, Voo = 2x Deslocamento no turno.
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehBaluarteEnergia && estadoGuerreiro) {
    // Combatente Psíquico: Baluarte de Energia (nível 15)
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.baluarteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="baluarte" ${estadoGuerreiro.baluarteUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.baluarteUsado ? 'Usar Baluarte (gasta dado)' : 'Usar Baluarte (grátis)'}</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehMestreTelecinetico && estadoGuerreiro) {
    // Combatente Psíquico: Mestre Telecinético (nível 18)
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.mestreTelecineticoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="mestre-telecinetico" ${estadoGuerreiro.mestreTelecineticoUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.mestreTelecineticoUsado ? 'Telecinese (gasta dado)' : 'Conjurar Telecinese (grátis)'}</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehMaestriaGuerreiro && estadoGuerreiro) {
    // Maestria em Arma: mostra contador de maestrias
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/${estadoGuerreiro.maestriasMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehCriticoAprimorado) {
    // Campeão nv3: Crítico em 19-20
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Acerto Crítico em 19-20</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Com armas e Ataques Desarmados, resultados 19 ou 20 no d20 são Acertos Críticos.
        </div>
      </div>
    `;
  } else if (ehAtletaExtraordinario) {
    // Campeão nv3: Atleta Extraordinário — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Vantagem em Iniciativa e testes de Atletismo.<br>
          Após Acerto Crítico: move metade do Deslocamento sem provocar.
        </div>
      </div>
    `;
  } else if (ehCombatenteHeroico) {
    // Campeão nv10: Combatente Heroico — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — A Cada Turno</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          No início de cada turno em combate, se não tiver <strong>Inspiração Heroica</strong>: concede a si mesmo.
        </div>
      </div>
    `;
  } else if (ehCriticoSuperior) {
    // Campeão nv15: Crítico em 18-20
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Acerto Crítico em 18-20</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Substitui Crítico Aprimorado. Resultados 18, 19 ou 20 no d20 são Acertos Críticos.
        </div>
      </div>
    `;
  } else if (ehSobrevivente) {
    // Campeão nv18: Sobrevivente — duas passivas
    const modCon = calcMod(char.atributos.constituicao);
    const curaInicio = 5 + modCon;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — Desafie a Morte + Regeneração Heroica</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Desafie a Morte:</strong> Vantagem em Salvaguardas Contra Morte. 18-20 = resultado 20.<br>
          <strong>Regeneração Heroica:</strong> Início do turno, se Sangrando e com 1+ PV: recupera ${curaInicio} PV (5 + mod CON).
        </div>
      </div>
    `;
  } else if (ehEstiloLutaAdicional) {
    // Campeão nv7: Estilo de Luta Adicional — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Talento Adicional</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ganhe outro talento de Estilo de Luta à sua escolha.
        </div>
      </div>
    `;
  } else if (ehMaestriaGuardiao) {
    // Guardião: Maestria em Arma fixa em 2
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/2</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehMaestriaPaladino) {
    // Paladino: Maestria em Arma fixa em 2
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/2</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehMaestriaLadino) {
    // Ladino: Maestria em Arma fixa em 2
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/2</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehPoderPsionicoLadino && estadoLadino && estadoLadino.dadosPsionicosMaxL > 0) {
    // Adaga Espiritual: Dados de Energia Psiônica
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.dadosPsionicosDisponiveisL}/${estadoLadino.dadosPsionicosMaxL} ${estadoLadino.tipoDadoPsionicoL}</span>`;
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL <= 0;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-ladino-acao="gastar-dado-psionico">Gastar Dado Psiônico</button>
        <button class="btn btn-sm btn-secondary" data-ladino-acao="sussurros" ${estadoLadino.sussurrosGratisUsado && semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.sussurrosGratisUsado ? 'Sussurros (gasta dado)' : 'Sussurros Psíquicos (grátis)'}</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Aptidão Reforçada: ao falhar perícia, role dado (gasto só se acertar). Sussurros: telepatia por ${estadoLadino.tipoDadoPsionicoL} horas.
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehLaminasAlma && estadoLadino) {
    // Adaga Espiritual: Lâminas da Alma (nível 9)
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Dados: ${estadoLadino.dadosPsionicosDisponiveisL}/${estadoLadino.dadosPsionicosMaxL}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-ladino-acao="teleporte-psiquico" ${semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Teleporte Psíquico</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Golpes Teleguiados: ao errar ataque com Lâmina, role dado (gasto só se acertar). Teleporte: gasta dado, teleporta 3x resultado metros.
      </div>
    `;
  } else if (ehVeuPsiquico && estadoLadino) {
    // Adaga Espiritual: Véu Psíquico (nível 13)
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.veuPsiquicoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-ladino-acao="veu-psiquico" ${estadoLadino.veuPsiquicoUsado && semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.veuPsiquicoUsado ? 'Véu Psíquico (gasta dado)' : 'Véu Psíquico (grátis)'}</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehRasgarMente && estadoLadino) {
    // Adaga Espiritual: Rasgar Mente (nível 17)
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL < 3;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.rasgarMenteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-danger" data-ladino-acao="rasgar-mente" ${estadoLadino.rasgarMenteUsado && semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.rasgarMenteUsado ? 'Rasgar Mente (gasta 3 dados)' : 'Rasgar Mente (grátis)'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD: ${estadoLadino.cdPsionicaAdaga} (Sab) | Atordoado 1 min</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAndarilhoTelhados) {
    // Ladrão nv3: Andarilho de Telhados — passiva
    const espAndarilho = especiesCache?.especies?.find(e => e.nome === char.especie);
    const baseAndarilho = espAndarilho ? getDeslocamento(espAndarilho.texto_completo) : '9 metros';
    const deslocAndarilhoNum = parseMetros(getDeslocamentoFinal(baseAndarilho), 9);
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Deslocamento de Escalada = Deslocamento normal (${formatarMetros(deslocAndarilhoNum)}m).<br>
          Saltos usam Destreza em vez de Força.
        </div>
      </div>
    `;
  } else if (ehMaoLeve) {
    // Ladrão nv3: Mão Leve — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Ação Bônus</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Prestidigitação (abrir fechadura, desarmar, roubar) ou Usar Objeto/item mágico como Ação Bônus.
        </div>
      </div>
    `;
  } else if (ehFurtividadeSuprema) {
    // Ladrão nv9: Furtividade Suprema — custo em dados de Ataque Furtivo
    const dadosFurtivo = estadoLadino?.furtivoDados || Math.ceil((char.nivel || 1) / 2);
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Golpe Astuto: Ataque Escondido (1d6)</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Custo: 1d6 do Ataque Furtivo (${dadosFurtivo}d6 → ${dadosFurtivo - 1}d6).<br>
          O ataque não encerra Invisibilidade se terminar turno com Cobertura 3/4 ou Total.
        </div>
      </div>
    `;
  } else if (ehUsarDispositivoMagico) {
    // Ladrão nv13: Usar Dispositivo Mágico — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Sintonize até <strong>4 itens mágicos</strong> (em vez de 3).<br>
          6 no d6: não gasta cargas de itens. Pode usar Pergaminhos Mágicos (INT para conjuração).
        </div>
      </div>
    `;
  } else if (ehReflexosLadrao) {
    // Ladrão nv17: Reflexos de Ladrão — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — 2 Turnos na 1a Rodada</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          1a rodada de combate: age na Iniciativa normal <strong>e</strong> na Iniciativa -10.
        </div>
      </div>
    `;
  } else if (ehAssassinar) {
    // Assassino nv3: Assassinar — passiva
    const nivel = char.nivel || 1;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — 1a Rodada</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Vantagem em Iniciativa. 1a rodada: Vantagem em ataques vs criaturas que não agiram.<br>
          Ataque Furtivo acerta: <strong>+${nivel} dano</strong> do tipo da arma (= nível de Ladino).
        </div>
      </div>
    `;
  } else if (ehFerramentasAssassino) {
    // Assassino nv3: Ferramentas de Assassino — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Proficiências</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Proficiência com <strong>Kit de Disfarce</strong> e <strong>Kit de Veneno</strong>.
        </div>
      </div>
    `;
  } else if (ehEspecialistaInfiltracao) {
    // Assassino nv9: Especialista em Infiltração — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Mimetismo Magistral:</strong> Imita fala/caligrafia após 1h estudando.<br>
          <strong>Mira Móvel:</strong> Mira Firme não zera seu Deslocamento.
        </div>
      </div>
    `;
  } else if (ehArmasVenenosas) {
    // Assassino nv13: Armas Venenosas — aprimora Golpe Astuto
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Aprimora Golpe Astuto — Opção Envenenar</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          +2d6 dano Venenoso a cada falha na salvaguarda (ignora Resistência a Venenoso).
        </div>
      </div>
    `;
  } else if (ehGolpeMortal) {
    // Assassino nv17: Golpe Mortal — passiva 1a rodada
    const nivel = char.nivel || 1;
    const modDes = calcMod(char.atributos.destreza);
    const cdGolpeMortal = 8 + modDes + bonusProficiencia(nivel);
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — 1a Rodada</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ataque Furtivo acerta na 1a rodada: salvaguarda CON <strong>CD ${cdGolpeMortal}</strong> ou dano dobrado.
        </div>
      </div>
    `;
  } else if (ehMaosConsagradasPaladino && estadoPaladino) {
    // Mãos Consagradas: mostra reserva de PV
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoPaladino.maosAtuais}/${estadoPaladino.maosMax} PV</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-paladino-acao="maos-consagradas" ${estadoPaladino.maosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Mãos Consagradas</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus | Reserva: ${estadoPaladino.maosAtuais} PV</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCanalizarPaladino && estadoPaladino && estadoPaladino.canalizarMax > 0) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-paladino-acao="canalizar" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Canalizar Divindade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Recupera 1 uso por Descanso Curto</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehDestruicaoPaladino && estadoPaladino) {
    usosHtmlSummary = estadoPaladino.destruicaoGratuitaAtiva ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoPaladino.destruicaoGratuitaUsada ? 'Usada' : 'Disponível'}</span>` : '';
    usosHtmlBody = estadoPaladino.destruicaoGratuitaAtiva ? `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-acao="destruicao-gratuita" ${estadoPaladino.destruicaoGratuitaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Destruição Gratuita (sem espaço)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">1x por Descanso Longo</span>
      </div>
    ` : '';
    recarga = 'longo';
  } else if (ehAuraProtecaoPaladino && estadoPaladino && estadoPaladino.auraProtecaoAtiva) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">+${estadoPaladino.bonusAura} (${estadoPaladino.auraRaio}m)</span>`;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
        Bônus nas salvaguardas = mod Carisma (+${estadoPaladino.bonusAura}) para você e aliados em ${estadoPaladino.auraRaio}m.
        ${estadoPaladino.auraCoragemAtiva ? ' Inclui imunidade a Amedrontado.' : ''}
      </div>
    `;
  } else if (ehGolpesRadiantesPaladino && estadoPaladino && estadoPaladino.golpesRadiantesAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">+1d8 Radiante</span>`;
  } else if (ehGloriaAtletaInigualavel && estadoPaladino) {
    // Glória nv3: Atleta Inigualável — usa Canalizar Divindade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="gloria_atleta" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Atleta Inigualável</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: 1h Vant. Atletismo/Acrobacia, +3m saltos</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehGloriaDestruicaoInspiradora && estadoPaladino) {
    // Glória nv3: Destruição Inspiradora — usa Canalizar Divindade após Destruição Divina
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    const nivel = char.nivel || 1;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="gloria_destruicao_inspiradora" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Destruição Inspiradora</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Após Destruição Divina: 2d8+${nivel} PVT entre aliados em 9m</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehGloriaAuraVivacidade) {
    // Glória nv7: Aura de Vivacidade — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aura</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          +3m no seu Deslocamento. Aliados na Aura de Proteção: +3m Deslocamento até fim do próximo turno.
        </div>
      </div>
    `;
  } else if (ehGloriaDefesaGloriosa && estadoPaladino) {
    // Glória nv15: Defesa Gloriosa — mod CAR/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
    const rg = char.recursos.paladino.subclasses.gloria;
    if (typeof rg.defesa_gloriosa_usos_gastos !== 'number') rg.defesa_gloriosa_usos_gastos = 0;
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    const dispDefesa = Math.max(0, modCar - rg.defesa_gloriosa_usos_gastos);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${dispDefesa}/${modCar}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-paladino-subclasse-acao="gloria_defesa_gloriosa" ${dispDefesa <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Defesa Gloriosa</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: +CAR na CA de alvo em 3m; se falhar, contra-ataque</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehGloriaLendaViva && estadoPaladino) {
    // Glória nv20: Lenda Viva — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
    const usada = !!char.recursos.paladino.subclasses.gloria.lenda_viva_usada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="gloria_lenda_viva" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Lenda Viva</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 10min: Vant. CAR, ataque errado vira acerto, re-roll salv.</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehVingancaVotoInimizade && estadoPaladino) {
    // Vingança nv3: Voto de Inimizade — usa Canalizar Divindade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="vinganca_voto_inimizade" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Voto de Inimizade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Vantagem em ataques contra 1 criatura em 9m por 1 min</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehVingancaVingadorImplacavel) {
    // Vingança nv7: Vingador Implacável — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Reação</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao acertar Ataque de Oportunidade: reduz Deslocamento do alvo a 0.<br>
          Move metade do seu Deslocamento sem provocar.
        </div>
      </div>
    `;
  } else if (ehVingancaAlmaVingativa) {
    // Vingança nv15: Alma Vingativa — passiva reação
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Reação</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Quando criatura sob Voto de Inimizade acerta ou erra ataque:<br>
          contra-ataque corpo a corpo como Reação.
        </div>
      </div>
    `;
  } else if (ehVingancaAnjoVingador && estadoPaladino) {
    // Vingança nv20: Anjo Vingador — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.vinganca) char.recursos.paladino.subclasses.vinganca = {};
    const usado = !!char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="vinganca_anjo_vingador" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Anjo Vingador</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 10min: Amedrontado na aura, Voo 18m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAncioesIraNatureza && estadoPaladino) {
    // Anciões nv3: A Ira da Natureza — usa Canalizar Divindade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="ancioes_ira_natureza" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Ira da Natureza</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Emanação 4,5m: salv. FOR ou Contido 1 min</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAncioesAuraResistencia) {
    // Anciões nv7: Aura de Resistência — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aura</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Você + aliados na Aura de Proteção: <strong>Resistência</strong> a dano Necrótico, Psíquico e Radiante.
        </div>
      </div>
    `;
  } else if (ehAncioesSentinelaImortal && estadoPaladino) {
    // Anciões nv15: Sentinela Imortal — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
    const usada = !!char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada;
    const nivel = char.nivel || 1;
    const cura = 3 * nivel;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-paladino-subclasse-acao="ancioes_sentinela_imortal" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Sentinela Imortal</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ao cair a 0 PV: fica com 1 PV + ${cura} cura</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAncioesCampeaoAncestral && estadoPaladino) {
    // Anciões nv20: Campeão Ancestral — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
    const usado = !!char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="ancioes_campeao_ancestral" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Campeão Ancestral</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 1min: Desv. salv. inimigos, magias como Bônus, +10 PV/turno</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehDevocaoArmaSagrada && estadoPaladino) {
    // Devoção nv3: Arma Sagrada — usa Canalizar Divindade
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
    const ativa = !!char.recursos.paladino.subclasses.devocao.arma_sagrada_ativa;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}${ativa ? ' | Ativa' : ''}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativa ? 'btn-secondary' : 'btn-primary'}" data-paladino-subclasse-acao="${ativa ? 'devocao_arma_sagrada_desativar' : 'devocao_arma_sagrada'}" ${(!ativa && estadoPaladino.canalizarDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${ativa ? 'Encerrar Arma Sagrada' : 'Ativar Arma Sagrada'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">10min: +mod CAR no ataque, luz brilhante 6m</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehDevocaoResplendorSagrado && estadoPaladino) {
    // Devoção nv20: Resplendor Sagrado — 1x/longo ou gastar slot 5º
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.devocao) char.recursos.paladino.subclasses.devocao = {};
    const ativo = !!char.recursos.paladino.subclasses.devocao.resplendor_sagrado_ativo;
    const usado = !!char.recursos.paladino.subclasses.devocao.resplendor_sagrado_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativo ? 'Ativo' : (usado ? 'Usado' : 'Disponível')}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativo ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="${ativo ? 'devocao_resplendor_desativar' : 'devocao_resplendor_ativar'}" ${(!ativo && usado) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${ativo ? 'Encerrar Resplendor' : 'Ativar Resplendor Sagrado'}</button>
        ${usado && !ativo ? '<button class="btn btn-sm btn-warning" data-paladino-subclasse-acao="devocao_resplendor_restaurar">Restaurar (gastar slot 5º)</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 10min: Radiante 9m, +mod CAR à salvaguarda</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehArtesMarciais && estadoMonge) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">d${estadoMonge.dadoArtesMarciais}</span>`;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
        Dado de dano: d${estadoMonge.dadoArtesMarciais} | Ataque Desarmado como Ação Bônus | Usar Destreza para ataque/dano
      </div>
    `;
  } else if (ehPontosFoco && estadoMonge && estadoMonge.pontosMax > 0) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoMonge.pontosAtuais}/${estadoMonge.pontosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-monge-acao="gastar-ponto" ${estadoMonge.pontosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Ponto</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD ${estadoMonge.cdFoco} | Recupera todos no Descanso Curto</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehDesviarAtaques && estadoMonge && estadoMonge.desviarAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Reduz ${estadoMonge.desviarReducao}</span>`;
  } else if (ehGolpeAtordoante && estadoMonge && estadoMonge.golpeAtordoanteAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoMonge.cdFoco}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-monge-acao="golpe-atordoante" ${estadoMonge.pontosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Atordoante (1 PF)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Salvaguarda Constituição CD ${estadoMonge.cdFoco}</span>
      </div>
    `;
  } else if (ehEspalmadaIntegridade && estadoMongeSub && estadoMongeSub.integridadeAtiva) {
    const disp = estadoMongeSub.integridadeDisponiveis;
    const max = estadoMongeSub.integridadeMax;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp} / ${max}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${disp <= 0 ? 'btn-secondary' : 'btn-accent'}" data-monge-subclasse-acao="integridade_usar" ${disp <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Integridade Corporal</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Cura: 1d${estadoMongeSub.dadoArtesMarciais} + SAB | Ação Bônus | ${disp}/${max} usos | Descanso Longo</span>
      </div>
    `;
  } else if (ehEspalmadaPalma && estadoMongeSub && estadoMongeSub.palmaVibranteNivel) {
    const ativa = estadoMongeSub.palmaVibranteAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Vibrações Ativas' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        ${!ativa ? `<button class="btn btn-sm btn-accent" data-monge-subclasse-acao="palma_ativar" ${estadoMongeSub.pontosAtuais < 4 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Palma Vibrante (4 PF)</button>` : ''}
        ${ativa ? '<button class="btn btn-sm btn-danger" data-monge-subclasse-acao="palma_encerrar">Encerrar Vibrações (10d12 Energético)</button>' : ''}
        ${ativa ? '<button class="btn btn-sm btn-secondary" data-monge-subclasse-acao="palma_cancelar">Cancelar Inofensivamente</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">Salvaguarda Constituição CD ${estadoMongeSub.cdFoco} | 1 alvo por vez</span>
      </div>
    `;
  } else if (ehMisericordiaTorrente && estadoMongeSub && estadoMongeSub.torrenteAtiva) {
    const disp = estadoMongeSub.torrenteDisponiveis;
    const max = estadoMongeSub.torrenteMax;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp} / ${max}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${disp <= 0 ? 'btn-secondary' : 'btn-accent'}" data-monge-subclasse-acao="torrente_usar" ${disp <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Torrente de Cura e Dolo</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Cura/Dolo grátis na Torrente | ${disp}/${max} usos | Descanso Longo</span>
      </div>
    `;
  } else if (ehMisericordiaFinal && estadoMongeSub && estadoMongeSub.misericordiaFinalAtiva) {
    const usado = estadoMongeSub.misericordiaFinalUsada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-monge-subclasse-acao="misericordia_final" ${usado || estadoMongeSub.pontosAtuais < 5 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Mão da Misericórdia Final (5 PF)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reviver criatura | 4d10+SAB PV | 1x/Descanso Longo</span>
      </div>
    `;
  } else if (ehElementosSintonia && estadoMongeSub) {
    const ativa = estadoMongeSub.sintoniaAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Ativa' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativa ? 'btn-warning' : 'btn-accent'}" data-monge-subclasse-acao="sintonia_toggle">${ativa ? 'Desativar Sintonia' : 'Ativar Sintonia (1 PF)'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">10 min | Ataques Elementais + Extensão 3m${(char.nivel || 1) >= 11 ? ' | Natação + Voo' : ''}</span>
      </div>
    `;
  } else if (ehAtaqueFurtivo && estadoLadino) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.furtivoTexto}</span>`;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
        Dano extra: ${estadoLadino.furtivoTexto} | 1x/turno com Vantagem ou aliado adjacente ao alvo
        ${estadoLadino.golpeAstutoAtivo ? `<br>Golpe Astuto (CD ${estadoLadino.cdGolpeAstuto}): Envenenar/Retirada/Tropeço (removem dados do Furtivo)` : ''}
        ${estadoLadino.golpeAprimoradoAtivo ? '<br>Golpe Astuto Aprimorado: 2 efeitos simultâneos' : ''}
        ${estadoLadino.golpesSujosAtivo ? '<br>Golpes Sujos: Aturdir (2d6) / Nocaute (6d6) / Obscurecer (3d6)' : ''}
      </div>
    `;
  } else if (ehGolpeSorte && estadoLadino && estadoLadino.golpeSorteAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.golpeSorteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-ladino-acao="golpe-sorte" ${estadoLadino.golpeSorteUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Golpe de Sorte</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Falha vira 20 | 1x por Descanso Curto/Longo</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehRecuperacaoArcana && estadoMago) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoMago.recuperacaoArcanaUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-mago-acao="recuperacao-arcana" ${estadoMago.recuperacaoArcanaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Recuperação Arcana</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Até ${estadoMago.recuperacaoArcanaMax}º combinado | Máx 5º círculo | Descanso Curto</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAssinaturaMagica && estadoMago && estadoMago.assinaturaMagicaAtiva) {
    const disp1 = estadoMago.assinatura1Usada ? 'Usada' : 'Pronta';
    const disp2 = estadoMago.assinatura2Usada ? 'Usada' : 'Pronta';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp1} / ${disp2}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-mago-acao="assinatura-1" ${estadoMago.assinatura1Usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Assinatura 1</button>
        <button class="btn btn-sm btn-primary" data-mago-acao="assinatura-2" ${estadoMago.assinatura2Usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Assinatura 2</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">3º círculo sem espaço | Curto/Longo</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAbjuradorProtecao && estadoMagoSub) {
    const pv = estadoMagoSub.protecaoPvAtual;
    const pvMax = estadoMagoSub.protecaoPvMax;
    const criada = estadoMagoSub.protecaoCriada;
    const pctPv = pvMax > 0 ? Math.round((pv / pvMax) * 100) : 0;
    usosHtmlSummary = criada ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${pv} / ${pvMax} PV</span>` : `<span style="font-size:0.7rem;font-weight:600;margin-left:auto;color:var(--text-muted)">Não Criada</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;flex-direction:column;gap:6px;padding:4px 0 4px 16px">
        ${criada ? `
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--bg-tertiary);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${pctPv}%;height:100%;background:${pv > pvMax/2 ? 'var(--accent)' : pv > 0 ? '#e67e22' : '#e74c3c'};transition:width 0.3s"></div>
            </div>
            <span style="font-size:0.75rem;font-weight:600;min-width:60px">${pv} / ${pvMax}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-danger" data-mago-subclasse-acao="protecao_dano">Sofrer Dano</button>
            <button class="btn btn-sm btn-accent" data-mago-subclasse-acao="protecao_restaurar">Restaurar PV (Abjuração/Slot)</button>
          </div>
        ` : `
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-accent" data-mago-subclasse-acao="protecao_criar">Criar Proteção (${pvMax} PV)</button>
            <span style="font-size:0.75rem;color:var(--text-muted)">Conjure Abjuração com slot | 1x/Descanso Longo</span>
          </div>
        `}
      </div>
    `;
  } else if (ehAdivinhadorProdigio && estadoMagoSub) {
    const n = estadoMagoSub.numDadosProdigio;
    const dados = [
      { valor: estadoMagoSub.prodigioDado1, usado: estadoMagoSub.prodigioDado1Usado },
      { valor: estadoMagoSub.prodigioDado2, usado: estadoMagoSub.prodigioDado2Usado }
    ];
    if (n >= 3) dados.push({ valor: estadoMagoSub.prodigioDado3, usado: estadoMagoSub.prodigioDado3Usado });
    const todosRolados = dados.every(d => d.valor > 0);
    const disponiveis = dados.filter(d => d.valor > 0 && !d.usado).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disponiveis} / ${n} disponíveis</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;flex-direction:column;gap:6px;padding:4px 0 4px 16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${dados.map((d, i) => `
            <div style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid ${d.usado ? 'var(--border)' : 'var(--accent)'}">
              <span style="font-size:1.1rem;font-weight:700;color:${d.usado ? 'var(--text-muted)' : 'var(--accent)'}${d.valor === 0 ? ';opacity:0.4' : ''}">${d.valor || '?'}</span>
              ${d.valor > 0 && !d.usado ? '<button class="btn btn-sm btn-accent" data-mago-subclasse-acao="prodigio_usar_' + (i+1) + '" style="padding:2px 6px;font-size:0.7rem">Usar</button>' : ''}
              ${d.usado ? '<span style="font-size:0.65rem;color:var(--text-muted)">usado</span>' : ''}
            </div>
          `).join('')}
        </div>
        ${!todosRolados ? '<button class="btn btn-sm btn-primary" data-mago-subclasse-acao="prodigio_rolar">Rolar Dados de Prodígio</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">${n}d20 | Substitui Teste de D20 | Descanso Longo</span>
      </div>
    `;
  } else if (ehAdivinhadorTerceiroOlho && estadoMagoSub && estadoMagoSub.terceiroOlhoAtivo) {
    const usado = estadoMagoSub.terceiroOlhoUsado;
    const escolha = estadoMagoSub.terceiroOlhoEscolha;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? (escolha || 'Usado') : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <select data-mago-subclasse-acao="terceiro_olho_escolha" style="padding:4px 8px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.8rem">
          <option value="">Escolher...</option>
          <option value="Compreensão Superior" ${escolha === 'Compreensão Superior' ? 'selected' : ''}>Compreensão Superior</option>
          <option value="Ver o Invisível" ${escolha === 'Ver o Invisível' ? 'selected' : ''}>Ver o Invisível</option>
          <option value="Visão no Escuro" ${escolha === 'Visão no Escuro' ? 'selected' : ''}>Visão no Escuro</option>
        </select>
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="terceiro_olho_usar" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus | Descanso Curto/Longo</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehEvocadorSobrecarga && estadoMagoSub && estadoMagoSub.sobrecargaAtiva) {
    const usos = estadoMagoSub.sobrecargaUsos;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usos}x usada</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-mago-subclasse-acao="sobrecarga_usar">Usar Sobrecarga</button>
        <span style="font-size:0.75rem;color:${usos > 0 ? '#e74c3c' : 'var(--text-muted)'};font-weight:${usos > 0 ? '600' : '400'}">
          ${usos === 0 ? '1ª vez: sem dano' : 'Próximo uso: ' + (usos + 1) + 'd12 x círculo (Necrótico)'}
        </span>
      </div>
    `;
  } else if (ehIlusionistaEspectrais && estadoMagoSub && estadoMagoSub.criaturasEspectraisAtiva) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${!estadoMagoSub.feericaUsada || !estadoMagoSub.feraUsada ? 'Disponível' : 'Usadas'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoMagoSub.feericaUsada ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="espectrais_feerica" ${estadoMagoSub.feericaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Convocar Feérico (Grátis)</button>
        <button class="btn btn-sm ${estadoMagoSub.feraUsada ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="espectrais_fera" ${estadoMagoSub.feraUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Invocar Fera (Grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">PV pela metade | Descanso Longo</span>
      </div>
    `;
  } else if (ehIlusionistaAutoimagem && estadoMagoSub && estadoMagoSub.autoimagemAtiva) {
    const usado = estadoMagoSub.autoimagemUsada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="autoimagem_usar" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Autoimagem</button>
        ${usado ? '<button class="btn btn-sm btn-warning" data-mago-subclasse-acao="autoimagem_restaurar">Restaurar (gastar slot 2+)</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação | Descanso Curto/Longo | Slot 2+</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (f.nome === 'Estilo de Luta') {
    // Exibir o estilo de luta escolhido com seu efeito
    const estiloEscolhido = char.escolhas_classe?.estilo_luta?.[0] || '';
    if (estiloEscolhido) {
      const efeitosEstilo = {
        'Arquearia': '+2 nas jogadas de ataque com armas à distância',
        'Defesa Cega': 'Sentido cego de 3m (exige proficiência)',
        'Defensivo': '+1 de CA ao usar armadura',
        'Duelismo': '+2 de dano com arma de uma mão (sem outra arma)',
        'Armas Grandes': 're-rolar 1 ou 2 no dano de armas de duas mãos',
        'Intercessão': '-1d10+prof do dano em aliado adjacente (reação)',
        'Arremesso': 'saca e arremessa com +2 de dano',
        'Combate sem Arma': '1d6+FOR de dano desarmado',
        'Combate com Duas Armas': '+mod de atributo no dano da arma secundária',
        'Combatente Druídico': '2 truques de Druida (Sabedoria)',
        'Combatente Abençoado': '2 truques de Clérigo (Carisma)'
      };
      const efeito = efeitosEstilo[estiloEscolhido] || '';
      usosHtmlBody = `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 16px;flex-wrap:wrap">
          <span class="badge badge-accent" style="font-size:0.8rem">${estiloEscolhido}</span>
          ${efeito ? `<span style="font-size:0.75rem;color:var(--text-muted)">${efeito}</span>` : ''}
        </div>
      `;
    }
  } else if (f.nome === 'Ordem Divina' || f.nome === 'Ordem Primal') {
    // Exibir somente a opcao escolhida (Protetor/Taumaturgo/Xama)
    const _chaveOrdem = f.nome === 'Ordem Divina' ? 'ordem_divina' : 'ordem_primal';
    const _ordemEscolhida = char[_chaveOrdem] || char.escolhas_classe?.[_chaveOrdem]?.[0] || '';
    if (_ordemEscolhida) {
      const _regexOpcao = new RegExp(`\\*\\*${_ordemEscolhida}\\.\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, 's');
      const _matchOpcao = f.descricao.match(_regexOpcao);
      const _descOpcao = _matchOpcao ? _matchOpcao[1].trim() : '';
      usosHtmlBody = `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 16px;flex-wrap:wrap">
          <span class="badge badge-accent" style="font-size:0.8rem">${_ordemEscolhida}</span>
          <span style="font-size:0.8rem">${_descOpcao}</span>
        </div>
      `;
    }
  }

  if (!usosHtmlBody && temMultiplosUsos) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:4px;padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
          ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar'}
        </button>
      </div>
    `;
  } else if (!usosHtmlBody && ativa && recarga) {
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-toggle-uso="${key}">
          ${usado ? '✗ Usado' : '✓ Disponível'}
        </button>
      </div>
    `;
  }

  return `
    <details style="margin-bottom:6px">
      <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
        <span class="badge badge-secondary" style="margin-right:4px">Nv.${f.nivel}</span>
        ${f.nome}
        ${tipoBadge}
        ${recargaBadge}
        ${usosHtmlSummary}
      </summary>
      ${usosHtmlBody}
      ${(f.nome === 'Ordem Divina' || f.nome === 'Ordem Primal') && (char.ordem_divina || char.ordem_primal || char.escolhas_classe?.ordem_divina?.length || char.escolhas_classe?.ordem_primal?.length)
        ? '' : `<div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(f.descricao)}</div>`}
      ${subHabilidades.length > 0 ? `
        <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
          <strong>Sub-habilidades:</strong> ${subHabilidades.join(', ')}
        </div>
      ` : ''}
    </details>
  `;
}