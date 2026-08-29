// ============================================================
// Renderização de Cards do Level Up - Steps dinâmicos
// Fase 3: Render de cards
// ============================================================
import { CLASSES_INFO, ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY } from './dados-classes.js';
import { getMagiasClasse, getMagiasPorCirculo } from './db.js';
import { calcMod, bonusProficiencia, escHtml, mdParaHtml, semAcento, toast, abrirModal } from './utils.js';
import { rotuloPericia } from './opcoes-dominio.js';
import { obterTalentosElegiveis } from './levelup.js';
import { calcularConjuracao, calcularSubclasseArcana, escolhasSubclasseDoNivel } from './levelup-flow.js';
import { opcoesDaLinha } from './regras-subclasse-escolhas.js';
import { truqueEhTrocavel } from './regras-origens-magia.js';
// preparadasPorClasse (Item 1 da revisão final do sub-projeto "magia sabe a
// classe"): ver uso perto de `magiasAtuais`, em renderCardMagias.
import { preparadasPorClasse } from './regras-magia-classe.js';
import { classesDe } from './regras-multiclasse.js';
import { podeEntrarEm } from './regras-multiclasse-progressao.js';
// INSTRUMENTOS_MUSICAIS vem de regras-cobertura.js, NUNCA de
// creator/comum.js -- a constante existe duplicada nos dois arquivos, e
// levelup.js valida a escolha do jogador contra a copia de
// regras-cobertura.js (a mesma que levelup-ui.js:29 ja importa, aliada
// _INSTRUMENTOS). Importar da outra copia ofereceria uma lista que o
// motor nao reconhece.
import { INSTRUMENTOS_MUSICAIS } from './regras-cobertura.js';

// ============================================================
// CARD: Classe do Nível (step 'escolha_classe')
// ============================================================

/**
 * Motivo legivel de bloqueio, a partir do `faltando` de podeEntrarEm.
 * So as faltas COM atributo viram texto: a entrada sem atributo e a que
 * `podeEntrarEm` usa para "classe fora do catalogo", que este card nunca
 * produz (as opcoes saem das chaves de CLASSES_INFO).
 * @param {Array<{classe:string, atributo:string|null, valor:number|null}>} faltando
 * @returns {string}
 */
export function motivoBloqueio(faltando) {
  return (faltando || [])
    .filter((f) => f.atributo)
    .map((f) => `${f.atributo} ${f.valor}, precisa 13`)
    .join(' · ');
}

/**
 * Card do step 'escolha_classe': em qual classe o nivel entra.
 *
 * As classes que o personagem JA TEM vem primeiro e nunca sao barradas --
 * podeEntrarEm devolve sempre `permitido` para elas, porque o 13+ do
 * livro:2033 e para se qualificar a uma classe NOVA (um Monge 5 com
 * Sabedoria 12 e personagem legal e nao pode travar na propria classe).
 *
 * O botao "usar mesmo assim" abre uma confirmacao (bindEventosEscolhaClasse,
 * levelup-ui.js) que nomeia o que falta e avisa que a ficha fica marcada
 * PERMANENTEMENTE -- e so ao confirmar que `state.dispensarPrerequisito`
 * vira true e a classe travada passa a ser aceita por `subirDeNivel`.
 *

 * @param {Object} ctx - Contexto do buildLevelUpContext
 * @param {Object} state - Estado das escolhas
 * @returns {string} HTML do card
 */
export function renderCardEscolhaClasse(ctx, state) {
  const atuais = classesDe(ctx.char);
  const nomesAtuais = new Set(atuais.map((c) => c.classe));
  const novas = Object.keys(CLASSES_INFO).filter((n) => !nomesAtuais.has(n));

  /** Uma linha de opcao (radio) para uma classe. */
  const opcao = (nome, rotulo) => {
    const { permitido, faltando } = podeEntrarEm(ctx.char, nome);
    const marcado = state.classeQueSobe === nome ? ' checked' : '';
    const travada = !permitido;
    // Depois de confirmar "usar mesmo assim", esta classe travada VIROU a
    // escolhida: o cadeado e o botao dariam a entender que nada aconteceu
    // (o unico retorno visual era o "Proximo" destravando). Troca o motivo
    // pelo mesmo texto do selo que a ficha vai exibir depois.
    const dispensada = travada && state.dispensarPrerequisito && state.classeQueSobe === nome;
    return `
      <label class="levelup-check-label levelup-opcao${travada ? ' levelup-opcao-travada' : ''}">
        <input type="radio" name="classe-que-sobe" data-classe="${escHtml(nome)}"${marcado}${travada ? ' disabled' : ''}>
        <span>${escHtml(rotulo)}</span>
        ${dispensada ? `<span class="levelup-motivo" data-prerequisito-dispensado="${escHtml(nome)}">⚠️ pré-requisito dispensado (${escHtml(motivoBloqueio(faltando))})</span>` : ''}
        ${travada && !dispensada ? `<span class="levelup-motivo">🔒 ${escHtml(motivoBloqueio(faltando))}</span>
                     <button class="btn btn-sm btn-secondary" data-dispensar="${escHtml(nome)}">usar mesmo assim</button>` : ''}
      </label>`;
  };

  // `data-classe-ctx` diz sobre QUAL classe o contexto desta renderização
  // foi montado -- que não é a mesma coisa que a opção marcada enquanto a
  // reconstrução (trocarClasseQueSobe, levelup-ui.js) não termina. É o
  // único sinal observável de que ela terminou, tanto para depurar quanto
  // para os testes esperarem o re-render em vez de adivinhar um tempo.
  return `
    <div class="levelup-card" id="levelup-escolha-classe" data-classe-ctx="${escHtml(ctx.classeQueSobe)}">
      <div class="levelup-card-header">Em qual classe você sobe?</div>
      <div class="levelup-card-body">
        <div class="levelup-grupo">
          <h4>SUAS CLASSES</h4>
          ${atuais.map((c) => opcao(c.classe, `${c.classe} ${c.nivel} → ${c.classe} ${c.nivel + 1}`)).join('')}
        </div>
        ${/* Sem classe nova sobrando, o grupo inteiro sai: um personagem
              com as 12 classes (alcancavel sob o teto de 20) veria um
              cabecalho "NOVA CLASSE" com nada embaixo. */''}
        ${novas.length ? `
        <div class="levelup-grupo">
          <h4>NOVA CLASSE</h4>
          ${novas.map((n) => opcao(n, n)).join('')}
        </div>` : ''}
      </div>
    </div>`;
}

// ============================================================
// CARD: Ganhos do Nível
// ============================================================
export function renderCardGanhosNivel(ctx, state) {
  const { info, modCon, hpGanhoFixo, caracteristicas, caracteristicasEspecie,
          caracteristicasSubclasse, magiasDominioNivel, bonusNovo, bonusMudou, sub } = ctx;

  let html = '';

  // Card de PV
  html += `
    <div class="levelup-card">
      <div class="levelup-card-header">Pontos de Vida</div>
      <div class="levelup-card-body">
        <div style="display:flex;flex-direction:column;gap:8px;font-size:0.9rem">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" name="levelup-hp-modo" value="fixo" ${state.hpModo === 'fixo' ? 'checked' : ''}>
            <span>Valor fixo: <strong>+${hpGanhoFixo} PV</strong> (média do d${info.dado_vida} + CON)</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-wrap:wrap">
            <input type="radio" name="levelup-hp-modo" value="rolado" ${state.hpModo === 'rolado' ? 'checked' : ''}>
            <span>Rolagem: d${info.dado_vida} + CON</span>
            <input type="number" class="form-input" id="levelup-hp-rolado" min="1" max="${info.dado_vida}" step="1"
                   value="${state.hpRolado}" style="width:88px" ${state.hpModo !== 'rolado' ? 'disabled' : ''}>
            <span id="levelup-hp-previa-rolado" style="font-size:0.85rem;color:var(--text-muted)">
              = +${Math.max(1, state.hpRolado + modCon)} PV
            </span>
          </label>
        </div>
      </div>
    </div>
  `;

  // Card de ganhos automáticos
  html += `
    <div class="levelup-card">
      <div class="levelup-card-header">Ganhos Automáticos</div>
      <div class="levelup-card-body">
        <ul class="levelup-list">
          ${bonusMudou ? `<li><strong>Bônus de Proficiência:</strong> +${bonusNovo}</li>` : ''}
          ${caracteristicas.length > 0 ? caracteristicas.map(c => `<li>${c}</li>`).join('') : '<li style="color:var(--text-muted)">Nenhuma característica nova neste nível</li>'}
          ${caracteristicasEspecie.map(c => `<li><span class="badge badge-sm">Espécie</span> ${c.nome}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  // Card de características de subclasse
  if (caracteristicasSubclasse.length > 0) {
    html += `
      <div class="levelup-card">
        ${/* `sub.subclasse` (a subclasse DA CLASSE QUE SOBE), nunca o
              espelho `char.subclasse`, que num multiclasse aponta para a
              classe INICIAL: a lista logo abaixo ja vem de `sub.subclasse`
              (buildLevelUpContext monta `caracteristicasSubclasse` a partir
              dela), entao o cabecalho nomeava uma subclasse enquanto a
              lista mostrava as caracteristicas de outra. */''}
        <div class="levelup-card-header">Subclasse — ${escHtml(sub.subclasse)}</div>
        <div class="levelup-card-body">
          ${caracteristicasSubclasse.map(f => `
            <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-light)">
              <div style="font-weight:600;font-size:0.9rem">${f.nome}</div>
              <div class="md-content" style="font-size:0.85rem;margin-top:2px">${mdParaHtml(f.descricao)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Card de magias de domínio
  if (magiasDominioNivel.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Magias de Domínio — Automáticas</div>
        <div class="levelup-card-body">
          <ul class="levelup-list">
            ${magiasDominioNivel.map(m => `<li><strong>${m.nome}</strong> (${m.circulo}º círculo)</li>`).join('')}
          </ul>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">
            Sempre preparadas, não contam no limite.
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Escolha de Subclasse
// ============================================================
export function renderCardSubclasse(ctx, state) {
  const { subclassesDisponiveis } = ctx;
  if (!subclassesDisponiveis.length) return '';

  return `
    <div class="levelup-card">
      <div class="levelup-card-header" style="color:var(--warning)">Escolha de Subclasse (Obrigatória)</div>
      <div class="levelup-card-body">
        <input type="hidden" id="levelup-subclasse" value="${state.subclasse || ''}">
        <div id="levelup-subclasses-lista" style="display:flex;flex-direction:column;gap:8px">
          ${subclassesDisponiveis.map((sc, idx) => {
            const featsNivel3 = (sc.caracteristicas || []).filter(c => c.nivel === 3);
            const selecionada = state.subclasse === sc.nome;
            // Padding inline: a classe antiga (.levelup-subclasse-card) usava
            // "10px 12px", diferente do "12px" (igual nos 4 lados) que a base
            // do .opcao-card adota agora para os outros cards fora de grade
            // (Task 8, rodada 2 -- ver app.css). Como o valor original deste
            // card era mesmo outro, o override inline continua correto e
            // necessario para bater com a aparencia de antes da migracao.
            return `
              <div class="opcao-card ${selecionada ? 'selecionada' : ''}" data-subclasse="${sc.nome}" data-idx="${idx}" style="padding:10px 12px">
                <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${sc.nome}</div>
                <div style="font-size:0.82rem;color:var(--text-muted)">
                  ${featsNivel3.map(f => {
                    const descPlain = f.descricao.replace(/\|[^|]*\|/g, '').replace(/\*\*/g, '').trim();
                    const preview = descPlain.length > 120 ? descPlain.substring(0, 120) + '...' : descPlain;
                    return `<div style="margin-top:4px"><strong>${f.nome}:</strong> ${preview}</div>`;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div id="levelup-subclasse-detalhe" style="margin-top:12px;display:${state.subclasse ? 'block' : 'none'};background:var(--surface-variant);border-radius:8px;padding:12px;font-size:0.85rem"></div>
      </div>
    </div>
  `;
}

// ============================================================
// CARD: Aumento de Atributo / Talento
// ============================================================
export function renderCardASI(ctx, state, talentosCache) {
  const { char } = ctx;

  // A mesma regra de elegibilidade é usada pela validação central e pela recuperação legada.
  const nivelNovo = (char.nivel || 1) + 1;
  const talentosDisponiveis = obterTalentosElegiveis(char, talentosCache, nivelNovo)
    .filter(talento => ctx.exigeDadivaEpica || talento.nome !== 'Aumento no Valor de Atributo');

  return `
    <div class="levelup-card">
        <div class="levelup-card-header">${ctx.exigeDadivaEpica ? 'Dádiva Épica ou Outro Talento' : 'Aumento de Atributo ou Talento'}</div>
        <div class="levelup-card-body">
        ${ctx.exigeDadivaEpica ? '' : `<div style="display:flex;gap:12px;margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem">
            <input type="radio" name="levelup-asi-modo" value="atributo" ${state.asiModo === 'atributo' ? 'checked' : ''}> Aumentar Atributos
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem">
            <input type="radio" name="levelup-asi-modo" value="talento" ${state.asiModo === 'talento' ? 'checked' : ''}> Escolher Talento
          </label>
        </div>`}

        ${ctx.exigeDadivaEpica ? '' : `<div id="levelup-asi-atributos" style="display:${state.asiModo === 'atributo' ? 'block' : 'none'}">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Aumente um atributo em +2, ou dois em +1 cada (máximo 20).
          </div>
          <div class="atributos-grid">
            ${ATRIBUTOS_KEYS.map(key => `
              <div class="form-group" style="text-align:center">
                <label class="form-label" for="levelup-attr-${key}">${ATRIBUTOS_NOMES[key]}</label>
                <div style="font-size:0.8rem;margin-bottom:2px">${char.atributos[key]}</div>
                <select class="form-input" style="text-align:center" id="levelup-attr-${key}">
                  <option value="0" ${(state.aumentos[key] || 0) === 0 ? 'selected' : ''}>+0</option>
                  <option value="1" ${(state.aumentos[key] || 0) === 1 ? 'selected' : ''}>+1</option>
                  <option value="2" ${(state.aumentos[key] || 0) === 2 ? 'selected' : ''}>+2</option>
                </select>
              </div>
            `).join('')}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
            Total de pontos: <span id="levelup-pontos-total" style="font-weight:700">${state.pontosDistribuidos}</span> / 2
          </div>
        </div>`}

        <div id="levelup-asi-talento" style="display:${ctx.exigeDadivaEpica || state.asiModo === 'talento' ? 'block' : 'none'}">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            ${ctx.exigeDadivaEpica
              ? 'Escolha uma Dádiva Épica ou outro talento para o qual atenda aos pré-requisitos.'
              : 'Escolha um talento em vez de aumentar atributos.'}
          </div>
          <div id="levelup-talento-lista"></div>
          <div id="levelup-talento-escolhas"></div>
        </div>
      </div>
    </div>
  `;
}

// Nomes canônicos de Estilo de Luta (dados/talentos/talentos.json,
// categoria "de Estilo de Luta"), unificados na Task 7 (2026-08-07) --
// compartilhado entre o card de escolha obrigatória (Guardião/Paladino
// nível 2) e o card de troca opcional (Guerreiro, qualquer nível >= 2)
// para não haver duas listas que possam divergir.
// Exportado: levelup-ui.js precisa da mesma lista para montar os cards de
// escolha/troca com montarSeletor/montarTroca (Task 10) depois que este HTML
// entra no DOM -- ver bindEventosEscolhasClasse/bindEventosTrocasOpcionais.
export const OPCOES_ESTILO_LUTA_BASE = [
  { nome: 'Arquearia', descricao: '+2 em ataques à distância com armas' },
  { nome: 'Combate com Armas de Arremesso', descricao: '+2 de dano com armas de Arremesso' },
  { nome: 'Combate com Armas Grandes', descricao: 'Trata 1-2 como 3 nos dados de dano (duas mãos)' },
  { nome: 'Combate com Duas Armas', descricao: 'Adiciona mod. ao dano do ataque adicional com arma Leve' },
  { nome: 'Combate Desarmado', descricao: 'Dano desarmado d6/d8+For' },
  { nome: 'Defensivo', descricao: '+1 CA usando armadura' },
  { nome: 'Duelismo', descricao: '+2 dano com uma arma em uma mão' },
  { nome: 'Interceptação', descricao: 'Reduz dano a aliado em 1d10+Prof' },
  { nome: 'Luta às Cegas', descricao: 'Visão às Cegas com alcance de 3 metros' },
  { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' }
];

// ============================================================
// CARDS: escolhas OPCIONAIS que nunca introduzem um step novo --
// Troca de Estilo de Luta do Guerreiro (Classes.md:3812) e Especialização
// adicional do Ladino nível 6 (Classes.md:4188). Renderizados dentro do
// step "Revisão e Confirmação" (sempre visível, sempre o último), NÃO no
// step "Escolhas de Classe" -- de propósito: talentos-levelup.spec.mjs
// (testes/e2e/regras/) semeia Guerreiro/Paladino e hardcoda que o step de
// ASI/talento é seguido DIRETO pela Revisão ("um Próximo, um Confirmar").
// Um step novo visível em todo nível >= 2 de Guerreiro quebraria essa
// suposição para dezenas de testes de talento sem relação com Estilo de
// Luta -- ver o comentário equivalente em levelup-flow.js.
// ============================================================
export function renderCardTrocasOpcionais(ctx, state) {
  const { char, podeTrocarEstiloLutaGuerreiro, precisaExpertiseLadino } = ctx;
  let html = '';

  // Troca de Estilo de Luta do Guerreiro (opcional -- o jogador pode
  // simplesmente não mexer). A grade em si (estilo atual + as opções de
  // troca, via montarTroca/deEstilosLuta) é montada depois que este HTML
  // entra no DOM -- ver bindEventosTrocasOpcionais em levelup-ui.js. O "sai"
  // tem um item só (o estilo atual do personagem), então montarTroca mostra
  // um card de apresentação e o botão "Trocar este" em vez de uma escolha
  // falsa entre uma opção e "Não trocar".
  if (podeTrocarEstiloLutaGuerreiro) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Trocar Estilo de Luta (opcional)</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Você pode substituir seu Estilo de Luta por outro, ou manter o que já tem.
          </div>
          <div id="lvlup-estilo-luta-troca"></div>
        </div>
      </div>
    `;
  }

  // Especialização adicional do Ladino, nível 6 (opcional -- se o
  // jogador não escolher, o app completa automaticamente, ver
  // levelup.js/exigeEspecializacaoLadino).
  if (precisaExpertiseLadino) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Especialização do Ladino (opcional)</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Escolha 2 perícias proficientes para Especialização. Se não escolher, o app completa
            automaticamente com as próximas perícias elegíveis.
          </div>
          <div id="levelup-ladino-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveis.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-ladino-expertise="${p}" ${(state.ladinoExpertise || []).includes(p) ? 'checked' : ''}> ${rotuloPericia(p)}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionadas: <span id="levelup-ladino-expertise-count" style="font-weight:700">${(state.ladinoExpertise || []).length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Escolhas de Classe (Expertise, Estilo de Luta, etc.)
// ============================================================
export function renderCardEscolhasClasse(ctx, state) {
  const {
    char, precisaExpertiseBardo, precisaExpertiseGuardiao, precisaEstiloLuta,
    precisaExploradorHabil, precisaAcademico
  } = ctx;
  let html = '';

  // Especialização do Bardo
  if (precisaExpertiseBardo) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Especialização do Bardo</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Selecione 2 perícias proficientes para Especialização.
          </div>
          <div id="levelup-bardo-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveis.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-bardo-expertise="${p}" ${state.bardoExpertise.includes(p) ? 'checked' : ''}> ${rotuloPericia(p)}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionadas: <span id="levelup-bardo-expertise-count" style="font-weight:700">${state.bardoExpertise.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  // Especialista do Guardião
  if (precisaExpertiseGuardiao) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Especialista do Guardião</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Selecione 2 perícias proficientes para Especialização.
          </div>
          <div id="levelup-guardiao-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveis.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-guardiao-expertise="${p}" ${state.guardiaoExpertise.includes(p) ? 'checked' : ''}> ${rotuloPericia(p)}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionadas: <span id="levelup-guardiao-expertise-count" style="font-weight:700">${state.guardiaoExpertise.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  // Estilo de Luta
  // Nomes canônicos (dados/talentos/talentos.json) -- mesmo vocabulário do
  // seletor da criação (creator/comum.js:CLASSES_ESCOLHAS), unificado na
  // Task 7 (2026-08-07). Antes desta correção esta lista de subida de nível
  // gravava um vocabulário abreviado próprio, incompatível com o mapa de
  // exibição da ficha (sheet/habilidades.js:efeitosEstilo).
  // A grade em si (via montarSeletor/deEstilosLuta) é montada depois que
  // este HTML entra no DOM -- ver bindEventosEscolhasClasse em levelup-ui.js;
  // é lá que a lista base ganha Combatente Druídico/Abençoado para
  // Guardião/Paladino.
  if (precisaEstiloLuta) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Estilo de Luta</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Escolha um Estilo de Luta. A escolha é permanente.
          </div>
          <div id="lvlup-estilo-luta-escolha"></div>
        </div>
      </div>
    `;
  }

  // Explorador Hábil
  if (precisaExploradorHabil) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveisExp = proficientes.filter(p => !expertiseAtual.has(p));
    const idiomasDisponiveis = [
      'Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico',
      'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'
    ];
    const idiomasJaPossuidos = new Set(char.idiomas || []);
    const idiomasElegiveis = idiomasDisponiveis.filter(i => !idiomasJaPossuidos.has(i));

    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Explorador Hábil</div>
        <div class="levelup-card-body">
          <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">Especialização (1 perícia):</div>
          <div id="levelup-explorador-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-bottom:12px">
            ${elegiveisExp.map(p => `
              <label class="form-check levelup-check-label" style="cursor:pointer">
                <input type="radio" name="explorador_expertise" value="${p}" ${state.exploradorExpertise === p ? 'checked' : ''}> ${rotuloPericia(p)}
              </label>
            `).join('')}
          </div>
          <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">Idiomas (2):</div>
          <div id="levelup-explorador-idiomas" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px">
            ${idiomasElegiveis.map(i => `
              <label class="form-check levelup-check-label" style="cursor:pointer">
                <input type="checkbox" data-explorador-idioma="${i}" ${state.exploradorIdiomas.includes(i) ? 'checked' : ''}> ${i}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Idiomas: <span id="levelup-explorador-idiomas-count" style="font-weight:700">${state.exploradorIdiomas.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  // Acadêmico
  if (precisaAcademico) {
    const periciasAcademicas = ['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião'];
    const proficientes = new Set(char.pericias_proficientes || []);
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveisAc = periciasAcademicas.filter(p => proficientes.has(p) && !expertiseAtual.has(p));

    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Acadêmico</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Selecione 1 perícia acadêmica em que você já é proficiente para Especialização.
          </div>
          <div id="levelup-academico" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveisAc.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-academico-expertise="${p}" ${state.academicoExpertise.includes(p) ? 'checked' : ''}> ${rotuloPericia(p)}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionada: <span id="levelup-academico-count" style="font-weight:700">${state.academicoExpertise.length}</span>/1
          </div>
        </div>
      </div>
    `;
  }


  html += montarCardsEscolhaSubclasse(ctx, state);
  return html;
}

/**
 * Um card por escolha que uma caracteristica de SUBCLASSE exige neste nivel.
 * Generico de proposito: a proxima caracteristica que o livro mandar escolher
 * entra como LINHA em regras-subclasse-escolhas.js, sem card novo aqui.
 *
 * Le a subclasse de `state.subclasse || sub.subclasse` -- no nivel 3 ela esta
 * sendo escolhida NESTA sessao e ainda nao existe no personagem salvo; ler so
 * o personagem deixaria a maioria das escolhas sem card, com a pendencia
 * travando a subida sem o jogador ter onde responder.
 *
 * A lista de linhas vem de `escolhasSubclasseDoNivel` (levelup-flow.js), a
 * MESMA funcao que decide se o step 'escolhas_classe' aparece e se ele esta
 * completo. Antes havia aqui um gemeo dela que lia `ctx.char?.subclasse` (o
 * espelho, que num multiclasse aponta para a classe INICIAL) e `ctx.nivelNovo`
 * (o nivel TOTAL): o step aparecia por uma regra e montava os cards por outra
 * -- omitindo ou renderizando errado cards OBRIGATORIOS, em silencio. Um so
 * chamado dos dois lados nao tem como divergir de novo.
 */
export function montarCardsEscolhaSubclasse(ctx, state) {
  const linhas = escolhasSubclasseDoNivel(ctx, state);
  if (!linhas.length) return '';
  return linhas.map((linha) => {
    const opcoes = opcoesDaLinha(linha);
    const escolhidas = state?.escolhasSubclasse?.[linha.campo] || [];
    const seletores = Array.from({ length: linha.quantidade }, (_, i) => `
      <select class="input" data-subclasse-escolha="${linha.campo}" data-indice="${i}"
              style="margin-bottom:6px">
        <option value="">— escolha —</option>
        ${opcoes.map((o) => `<option value="${escHtmlSeletor(o)}"${escolhidas[i] === o ? ' selected' : ''}>${escHtmlSeletor(o)}</option>`).join('')}
      </select>`).join('');
    return `
      <div class="levelup-card">
        <div class="levelup-card-header">${escHtmlSeletor(linha.rotulo)}</div>
        <div class="levelup-card-body">
          ${seletores}
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
            Exigido pelo livro nesta subclasse (${escHtmlSeletor(linha.livro)}).
          </div>
        </div>
      </div>`;
  }).join('');
}

/** Escapa texto que vai para dentro do HTML dos seletores acima. */
function escHtmlSeletor(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// CARD: Seleção de Magias
// ============================================================
export function renderCardMagias(ctx, state) {
  // `classeQueSobe`, nunca o espelho `char.classe`: a lista de magias, o
  // grimório e o limite de preparadas deste card são todos da classe em
  // que o nível ENTRA. Num Mago 5/Clérigo 1 o espelho diz "Mago" enquanto
  // o nível é de Clérigo.
  const { char, info, classeQueSobe } = ctx;
  // Reativo à subclasse escolhida nesta sessão (Cavaleiro Místico /
  // Trapaceiro Arcano começam a conjurar no mesmo nível em que são
  // escolhidos) -- ver calcularConjuracao em levelup-flow.js.
  const conjuracao = calcularConjuracao(ctx, state);
  if (!conjuracao) return '';

  const { truquesGanhos, tipoConj, magiasGanhas, magiasNovo, magiasAtual, ehMago, grimorioQtd } = conjuracao;
  let html = '';

  // Truques que a subclasse concede sem escolha (Mãos Mágicas do Trapaceiro
  // Arcano): aparecem aqui para o jogador não procurá-los na lista.
  const truquesFixos = conjuracao.truquesFixosNovos || [];
  if (truquesFixos.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Truque${truquesFixos.length > 1 ? 's' : ''} da Subclasse</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px">
            Concedido${truquesFixos.length > 1 ? 's' : ''} automaticamente, sem ocupar suas escolhas.
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${truquesFixos.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Truques
  if (truquesGanhos > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Novos Truques (+${truquesGanhos})</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-truques-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.truquesSelecionados.length === 0
                ? `<span style="color:var(--danger)">Nenhum selecionado. Selecione ${truquesGanhos}.</span>`
                : `<span style="color:${state.truquesSelecionados.length === truquesGanhos ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.truquesSelecionados.length}/${truquesGanhos}</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-truques">Selecionar</button>
          </div>
          <div id="lvlup-truques-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.truquesSelecionados.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Magias conhecidas (Bardo/Feiticeiro/Bruxo)
  if (tipoConj === 'conhecidas' && magiasGanhas > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Novas Magias Conhecidas (+${magiasGanhas})</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-magias-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.magiasSelecionadas.length === 0
                ? `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${magiasGanhas}.</span>`
                : `<span style="color:${state.magiasSelecionadas.length === magiasGanhas ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.magiasSelecionadas.length}/${magiasGanhas}</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-magias">Selecionar</button>
          </div>
          <div id="lvlup-magias-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.magiasSelecionadas.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Troca de magia -- QUALQUER classe conjuradora.
  //
  // Antes era `tipoConj === 'conhecidas'` (Bardo, Bruxo, Feiticeiro), o que
  // deixava de fora as classes preparadas (Clerigo, Druida, Guardiao, Mago,
  // Paladino) e as subclasses conjuradoras (Cavaleiro Mistico, Trapaceiro
  // Arcano -- que nem sequer tem `tipo_conjuracao` em dados-classes.js,
  // porque Guerreiro e Ladino sao `conjurador: false`). Decisao do dono do
  // produto (2026-08-13): a troca vale para toda classe conjuradora, tanto
  // ao subir de nivel quanto no Descanso Longo. O bloco que APLICA a troca
  // (levelup-ui.js, "Troca") ja era gated so por `ctx.ehConjurador`, entao
  // nao precisou mudar junto.
  // preparadasPorClasse (Item 1 da revisão final do sub-projeto "magia sabe
  // a classe"): este portão contava `magiaContaNoLimite` sobre o
  // personagem INTEIRO, enquanto a lista que o próprio card monta (bloco
  // "Trocar Magias (Opcional)" acima, aplicado por
  // levelup-ui.js/montarBlocoTrocaMagia) já filtra por `classeQueSobe`. Num
  // Feiticeiro 5/Mago 1 (95% de lista em comum) com as preparadas todas
  // carimbadas da OUTRA classe, este portão dizia "sim" e o seletor "Qual
  // magia sai?" abria com zero candidatas -- o mesmo beco sem saída já
  // consertado em sheet/hp-descanso.js (Achado 3 da rodada 1 da Tarefa 4).
  // `desta ∪ semClasse` é a MESMA expressão de montarBlocoTrocaMagia;
  // `classeQueSobe` (não o espelho `char.classe`) porque é a classe em que
  // o nível ENTRA -- mesmo raciocínio do comentário no topo desta função.
  const candidatasTrocaNivel = preparadasPorClasse(char, classeQueSobe);
  const magiasAtuais = [...candidatasTrocaNivel.desta, ...candidatasTrocaNivel.semClasse]
    .filter(m => m.circulo > 0);
  if (magiasAtuais.length > 0) {
    // O Mago troca DENTRO do grimorio: preparar uma magia que nao esta no
    // livro contradiz normalizarGrimorioMago (utils.js) e o proprio modal
    // de troca do Descanso Longo (sheet/grimorio.js/mostrarTrocaMagias,
    // que para o Mago le `char.grimorio`). O filtro da lista "entra" fica
    // em levelup-ui.js; aqui so muda o texto.
    const fonte = ehMago ? 'do seu grimório' : `da lista de ${classeQueSobe}`;
    const rotulo = tipoConj === 'conhecidas' ? 'magia conhecida' : 'magia preparada';
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Trocar Magias (Opcional)</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Troque quantas ${rotulo}s quiser por outras ${fonte}.
          </div>
          <div id="levelup-trocas-magia-feitas"></div>
          <div id="levelup-troca-magia"></div>
        </div>
      </div>
    `;
  }

  // Troca de truque (qualquer classe conjuradora com truques de classe conhecidos)
  const truquesAtuais = (char.magias_conhecidas || []).filter(m => {
    return m.circulo === 0 && truqueEhTrocavel(m);
  });
  if (truquesAtuais.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Trocar Truques (Opcional)</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Troque quantos truques quiser por outros da lista de ${classeQueSobe}.
          </div>
          <div id="levelup-trocas-truque-feitas"></div>
          <div id="levelup-troca-truque"></div>
        </div>
      </div>
    `;
  }

  // Grimório do Mago. `grimorioQtd` é 6 no 1º nível de Mago (multiclasse --
  // livro:Classes.md, "seis magias de mago 1º círculo") e 2 nos seguintes
  // (ver calcularConjuracao, levelup-flow.js).
  if (ehMago) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Grimório: +${grimorioQtd} Magia${grimorioQtd === 1 ? '' : 's'}</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-grimorio-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.grimorioSelecionados.length === 0
                ? `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${grimorioQtd}.</span>`
                : `<span style="color:${state.grimorioSelecionados.length === grimorioQtd ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.grimorioSelecionados.length}/${grimorioQtd}</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-grimorio">Selecionar</button>
          </div>
          <div id="lvlup-grimorio-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.grimorioSelecionados.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Versado em [Escola] (subclasse do Mago)
  const subclasseArcana = calcularSubclasseArcana(ctx, state);
  if (subclasseArcana) {
    const { escola, quantidade } = subclasseArcana;
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">${escola}: +${quantidade} Magia(s)</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-subclasse-arcana-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.subclasseMagiasSelecionados.length === 0
                ? `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${quantidade}.</span>`
                : `<span style="color:${state.subclasseMagiasSelecionados.length === quantidade ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.subclasseMagiasSelecionados.length}/${quantidade}</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-subclasse-arcana">Selecionar</button>
          </div>
          <div id="lvlup-subclasse-arcana-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.subclasseMagiasSelecionados.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Preparadas (informativo)
  if (tipoConj === 'preparadas' && classeQueSobe !== 'Mago') {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Magias Preparadas</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted)">
            <strong>${magiasAtual} &rarr; ${magiasNovo}</strong>.
            Redefina a lista inteira num Descanso Longo; aqui você pode trocar 1 magia.
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Manobras do Guerreiro (Mestre da Batalha)
// ============================================================
export function renderCardManobrasGuerreiro(ctx, state) {
  const { manobrasGuerreiro } = ctx;
  if (!manobrasGuerreiro) return '';

  const { qtdNova, manobrasConhecidasAtuais } = manobrasGuerreiro;

  let html = `
    <div class="levelup-card">
      <div class="levelup-card-header">Novas Manobras (+${qtdNova})</div>
      <div class="levelup-card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div id="lvlup-manobras-resumo" style="font-size:0.85rem;color:var(--text-muted)">
            ${state.manobrasNovasSelecionadas.length === 0
              ? `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${qtdNova}.</span>`
              : `<span style="color:${state.manobrasNovasSelecionadas.length === qtdNova ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.manobrasNovasSelecionadas.length}/${qtdNova}</span>`
            }
          </div>
          <button class="btn btn-sm btn-accent" id="btn-lvlup-manobras">Selecionar</button>
        </div>
        <div id="lvlup-manobras-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${state.manobrasNovasSelecionadas.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  if (manobrasConhecidasAtuais.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Trocar Manobra Conhecida (opcional)</div>
        <div class="levelup-card-body">
          <div id="levelup-troca-manobra"></div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Proficiências da Classe Nova (step 'proficiencias_classe_nova')
// ============================================================

/**
 * Card do step 'proficiencias_classe_nova': os seletores que a classe NOVA
 * pode exigir no primeiro nivel dela (pericia e/ou Instrumento Musical) --
 * ver concessoesAoEntrarEm (regras-multiclasse-proficiencias.js). So
 * aparece para Bardo, Guardiao e Ladino (as unicas 3 com pericias > 0 no
 * ramo de multiclasse do catalogo).
 *
 * Armadura, arma e ferramenta entram so como TEXTO informativo: armadura e
 * arma sao DERIVADAS de classes[] (nunca gravam nada -- ver
 * armadurasDoPersonagem/armasDoPersonagem) e a ferramenta que o Ladino
 * concede (Ferramentas de Ladrao) e fixa, sem escolha do jogador.
 *
 * As pericias e o instrumento que o personagem JA TEM sao omitidos das
 * opcoes -- conceder um repetido gastaria a concessao em silencio, e o
 * jogador nao teria como perceber. O motor (levelup.js) tem a mesma
 * checagem como rede para quem chamar subirDeNivel sem passar por esta
 * tela.
 */
export function renderCardProficienciasClasseNova(ctx, state) {
  const c = ctx.concessoesClasseNova;
  if (!c) return '';
  const { char, classeQueSobe } = ctx;

  let html = `
    <div class="levelup-card">
      <div class="levelup-card-header">Proficiências de ${escHtml(classeQueSobe)}</div>
      <div class="levelup-card-body">
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px">
          Entrar em ${escHtml(classeQueSobe)} como classe nova concede um subconjunto das
          proficiências dela (livro, Multiclasse).
        </div>
  `;

  if (c.armaduras.length || c.armas.length) {
    const partes = [];
    if (c.armaduras.length) partes.push(`Armaduras: ${c.armaduras.join(', ')}`);
    if (c.armas.length) partes.push(`Armas: ${c.armas.join(', ')}`);
    html += `<div style="font-size:0.85rem;margin-bottom:8px">Automático — ${escHtml(partes.join(' · '))}</div>`;
  }
  if (c.ferramentas.length) {
    html += `<div style="font-size:0.85rem;margin-bottom:8px">Automático — Ferramentas: ${escHtml(c.ferramentas.join(', '))}</div>`;
  }

  if (c.pericias > 0) {
    const jaTem = new Set(char.pericias_proficientes || []);
    const opcoes = c.opcoesPericia.filter((p) => !jaTem.has(p));
    if (opcoes.length === 0) {
      // Lista ESGOTADA: o personagem ja e proficiente em TODAS as pericias
      // que ${classeQueSobe} ofereceria aqui. proficienciaClasseNovaCompleta
      // (levelup-flow.js) nunca aceita uma repetida, entao sem este aviso
      // o step ficaria PERMANENTEMENTE incompleto e "Confirmar" recusaria
      // sem explicacao nenhuma na tela -- achado da revisao da Tarefa 4,
      // rodada 1. Isto NAO e um bug de tela: e uma lacuna do livro (o que
      // fazer quando a concessao de multiclasse nao tem nada de novo para
      // dar) que este projeto ainda nao resolveu -- a tela so relata a
      // situacao, sem inventar bypass nem mudar o que o motor aceita.
      html += `
        <div style="margin-bottom:10px;padding:10px;background:var(--danger);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
          Você já é proficiente em todas as perícias que ${escHtml(classeQueSobe)} concederia aqui — não há nenhuma nova para escolher.
        </div>
      `;
    } else {
      html += `
        <div style="margin-bottom:10px">
          <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:4px">Perícia (escolha 1)</label>
          <select class="input" id="select-pericia-classe-nova">
            <option value="">— escolha —</option>
            ${opcoes.map((p) => `<option value="${escHtml(p)}"${state.periciaClasseNova === p ? ' selected' : ''}>${escHtml(rotuloPericia(p))}</option>`).join('')}
          </select>
        </div>
      `;
    }
  }

  if (c.instrumentos > 0) {
    const jaTemInstrumento = new Set(char.proficiencias_instrumentos || []);
    const opcoesInstrumentos = INSTRUMENTOS_MUSICAIS.filter((i) => !jaTemInstrumento.has(i));
    if (opcoesInstrumentos.length === 0) {
      // Mesmo caso da lista de pericias logo acima, para instrumentos.
      html += `
        <div style="padding:10px;background:var(--danger);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
          Você já é proficiente em todos os Instrumentos Musicais que ${escHtml(classeQueSobe)} concederia aqui — não há nenhum novo para escolher.
        </div>
      `;
    } else {
      html += `
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:4px">Instrumento Musical (escolha 1)</label>
          <select class="input" id="select-instrumento-classe-nova">
            <option value="">— escolha —</option>
            ${opcoesInstrumentos.map((i) => `<option value="${escHtml(i)}"${state.instrumentoClasseNova === i ? ' selected' : ''}>${escHtml(i)}</option>`).join('')}
          </select>
        </div>
      `;
    }
  }

  html += `</div></div>`;
  return html;
}

// ============================================================
// CARD: Magias Rituais do Bônus de Proficiência (step 'ritual_bonus_proficiencia')
// ============================================================

/**
 * Card do step 'ritual_bonus_proficiencia': a(s) magia(s) ritual(is) que o
 * crescimento do Conjurador Ritualista concede quando o Bônus de
 * Proficiência sobe (Talentos.md:370).
 *
 * As opções vêm de `ctx.magiasRituaisDisponiveis` -- carregada por
 * `getMagiasRituais(1)` (db.js), a MESMA fonte que a tela de AQUISIÇÃO do
 * talento já usa (bindEscolhasTalento, levelup-ui.js) -- nunca varrer
 * `magias/circulo_N.json` procurando um campo `ritual`: aquele acervo não
 * carrega marcador nenhum, só `tempo_conjuracao` contendo "Ritual".
 *
 * As magias JÁ escolhidas (`ctx.ritualBonus.jaEscolhidas`) aparecem
 * listadas à parte e ficam FORA do seletor -- repetir uma delas seria
 * recusado pelo motor (`subirDeNivel`, levelup.js) em silêncio quanto à
 * causa: o jogador marcaria uma opção válida na tela e só saberia do erro
 * no "Confirmar", sem entender por quê.
 *
 * O seletor tira TODAS as magias já preparadas da ficha
 * (`info.nomesPreparados`, de qualquer origem), não só as do próprio
 * talento -- achado Important 1 da revisão final: uma ritual já preparada
 * por outra via (preparação normal, magia de domínio, Tocado Pelas
 * Sombras) continuava sendo oferecida e a gravação, que deduplica por
 * `nome` + `origem`, empurrava uma SEGUNDA entrada com o mesmo nome, num
 * caminho SEM DESFAZER. As escondidas por essa razão são NOMEADAS numa
 * linha própria: uma opção que some sem explicação é a mesma falha de
 * silêncio que a lista de "Já preparadas" existe para evitar.
 *
 * O texto de abertura RAMIFICA por `ctx.bonusMudou` -- achado Important 2:
 * o invariante também dispara em nível que NÃO cruza patamar (dívida
 * acumulada), e afirmar ali que "o Bônus de Proficiência subiu" é contar
 * ao jogador uma regra que não aconteceu.
 *
 * `disponiveis.length < info.faltam` é o caso da lista vir CURTA demais
 * para completar a escolha -- na prática só alcançável se
 * `getMagiasRituais(1)` falhar ao carregar (levelup-ui.js/irParaStep grava
 * o erro no console e segue com `ctx.magiasRituaisDisponiveis` indefinido;
 * com os dados reais são 11 rituais de 1º círculo contra um `deve` máximo
 * de 6, então a lista nunca fica curta por conta própria). Sem aviso, o
 * grid nasceria vazio e `ritualBonusProficienciaCompleto`
 * (levelup-flow.js) NUNCA aceitaria -- o "Confirmar" recusaria para
 * sempre, cobrando uma escolha que a tela não oferece: exatamente o modo
 * de falha que esta tarefa existe para fechar. Mesmo tratamento do caso
 * "lista ESGOTADA" de renderCardProficienciasClasseNova, logo acima: avisa
 * a situação honestamente, sem inventar bypass nem mudar o que o motor
 * aceita.
 */
export function renderCardRitualBonus(ctx, state) {
  const info = ctx.ritualBonus;
  if (!info || info.faltam <= 0) return '';
  const selecionadas = state.rituaisBonusSelecionados || [];
  const nomesPreparados = info.nomesPreparados || [];
  const disponiveis = (ctx.magiasRituaisDisponiveis || [])
    .filter((m) => !nomesPreparados.includes(m.nome));
  // As que sumiram do seletor por já estarem preparadas por OUTRA origem
  // (as do próprio talento já aparecem na linha "Já preparadas").
  const ocultasOutraOrigem = (ctx.magiasRituaisDisponiveis || [])
    .filter((m) => nomesPreparados.includes(m.nome) && !info.jaEscolhidas.includes(m.nome))
    .map((m) => m.nome);

  let html = `<div class="levelup-card" id="levelup-ritual-bonus" data-faltam="${info.faltam}">`;
  html += `<div class="levelup-card-header">Magias Rituais (Bônus de Proficiência)</div>`;
  html += `<div class="levelup-card-body">`;
  html += `<p class="levelup-ajuda" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">`;
  html += ctx.bonusMudou
    ? `Seu Bônus de Proficiência subiu para +${info.deve}. `
    : `Sua ficha tem menos magias rituais do que o Conjurador Ritualista concede (seu Bônus de Proficiência é +${info.deve}). `;
  html += `O Conjurador Ritualista mantém ${info.deve} magia(s) ritual(is) de 1º círculo sempre preparadas `;
  html += `e você tem ${info.tem} — escolha ${info.faltam === 1 ? 'mais 1' : `mais ${info.faltam}`}.</p>`;
  if (info.jaEscolhidas.length) {
    html += `<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Já preparadas: ${escHtml(info.jaEscolhidas.join(', '))}</p>`;
  }
  if (ocultasOutraOrigem.length) {
    html += `<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">`;
    html += `Fora da lista por já estarem preparadas por outra origem: ${escHtml(ocultasOutraOrigem.join(', '))}.</p>`;
  }
  if (disponiveis.length < info.faltam) {
    html += `
      <div style="padding:10px;background:var(--danger);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
        Não foi possível carregar magias rituais suficientes para completar esta escolha agora
        (${disponiveis.length} disponível${disponiveis.length === 1 ? '' : 'is'} de ${info.faltam} necessária${info.faltam === 1 ? '' : 's'}).
        Feche o assistente e tente novamente.
      </div>
    `;
  } else {
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px">`;
    html += disponiveis.map((m) => `
        <label class="form-check levelup-check-label">
          <input type="checkbox" name="ritual-bonus" value="${escHtml(m.nome)}"
            ${selecionadas.includes(m.nome) ? 'checked' : ''}> ${escHtml(m.nome)}
        </label>`).join('');
    html += `</div>`;
    html += `<div class="levelup-counter">Selecionadas: <span id="levelup-ritual-bonus-count" style="font-weight:700">${selecionadas.length}</span>/${info.faltam}</div>`;
  }
  html += `</div></div>`;
  return html;
}

// ============================================================
// CARD: Revisão e Confirmação
// ============================================================
export function renderCardRevisao(ctx, state, steps) {
  const { nivelNovo, hpGanhoFixo, modCon, info, char, sub } = ctx;
  const incompletos = steps.filter(s => s.obrigatorio && !s._completo && s.id !== 'revisao_confirmacao');

  // Calcular HP que será ganho
  const hpGanho = state.hpModo === 'rolado'
    ? Math.max(1, state.hpRolado + modCon)
    : hpGanhoFixo;

  let html = `
    <div class="levelup-card">
      <div class="levelup-card-header">Resumo da Subida para Nível ${nivelNovo}</div>
      <div class="levelup-card-body">
        <ul class="levelup-list">
          ${/* A CLASSE vem primeiro. O titulo do card e o botao
                ("Confirmar Nivel N") falam do nivel TOTAL, e esta e a
                ultima tela antes de uma escrita irreversivel -- nao existe
                descer de nivel --, mas ate aqui ela nao nomeava a unica
                escolha que nao da para desfazer. Classe NOVA nao vira
                "Barbaro 0 -> Barbaro 1": diz que e nova, como o proprio
                seletor faz (la a opcao de classe nova e so o nome). */''}
          <li><strong>Classe:</strong> ${sub.ehPrimeiroNivelNaClasse
            ? `${escHtml(ctx.classeQueSobe)} 1 (classe nova)`
            : `${escHtml(ctx.classeQueSobe)} ${sub.nivelNaClasseAnterior} &rarr; ${escHtml(ctx.classeQueSobe)} ${sub.nivelNaClasseNovo}`}</li>
          <li><strong>HP:</strong> +${hpGanho} PV (${state.hpModo === 'rolado' ? `rolagem ${state.hpRolado}` : 'fixo'})</li>
  `;

  if (state.subclasse) html += `<li><strong>Subclasse:</strong> ${state.subclasse}</li>`;

  // Proficiencias da classe NOVA (livro:2051), pelo mesmo motivo que trouxe
  // a Classe para este resumo: a pericia escolhida aqui e gravada em
  // `pericias_proficientes` por um caminho SEM DESFAZER -- nao existe descer
  // de nivel. A caixa de "Pendencias" logo abaixo so nomeia o step quando
  // ele esta INCOMPLETO, o que cobre "nao escolheu" mas nao cobre "escolheu
  // errado" -- que e justamente o que um resumo existe para pegar.
  if (state.periciaClasseNova) html += `<li><strong>Perícia de ${escHtml(ctx.classeQueSobe)}:</strong> ${escHtml(state.periciaClasseNova)}</li>`;
  if (state.instrumentoClasseNova) html += `<li><strong>Instrumento Musical de ${escHtml(ctx.classeQueSobe)}:</strong> ${escHtml(state.instrumentoClasseNova)}</li>`;

  if (ctx.ganhaASI) {
    if (state.asiModo === 'atributo' && state.pontosDistribuidos > 0) {
      const resumoAttr = Object.entries(state.aumentos)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${ATRIBUTOS_NOMES[k]} +${v}`)
        .join(', ');
      html += `<li><strong>Atributos:</strong> ${resumoAttr || 'Nenhum'}</li>`;
    } else if (state.asiModo === 'talento' && state.talento) {
      html += `<li><strong>Talento:</strong> ${state.talento}</li>`;
    }
  }

  if (state.bardoExpertise.length > 0) html += `<li><strong>Especialização Bardo:</strong> ${state.bardoExpertise.join(', ')}</li>`;
  if (state.guardiaoExpertise.length > 0) html += `<li><strong>Especialista Guardião:</strong> ${state.guardiaoExpertise.join(', ')}</li>`;
  if (state.estiloLuta) html += `<li><strong>Estilo de Luta:</strong> ${state.estiloLuta}</li>`;
  if (state.estiloLutaTrocarDe && state.estiloLutaTrocarPara) html += `<li><strong>Troca de Estilo de Luta:</strong> ${state.estiloLutaTrocarDe} &rarr; ${state.estiloLutaTrocarPara}</li>`;
  if ((state.ladinoExpertise || []).length > 0) html += `<li><strong>Especialização Ladino:</strong> ${state.ladinoExpertise.join(', ')}</li>`;
  if (state.exploradorExpertise) html += `<li><strong>Explorador Hábil:</strong> ${state.exploradorExpertise}, Idiomas: ${state.exploradorIdiomas.join(', ')}</li>`;
  if (state.academicoExpertise.length > 0) html += `<li><strong>Acadêmico:</strong> ${state.academicoExpertise.join(', ')}</li>`;
  if (state.truquesSelecionados.length > 0) html += `<li><strong>Truques:</strong> ${state.truquesSelecionados.join(', ')}</li>`;
  if (state.magiasSelecionadas.length > 0) html += `<li><strong>Magias:</strong> ${state.magiasSelecionadas.join(', ')}</li>`;
  if (state.grimorioSelecionados.length > 0) html += `<li><strong>Grimório:</strong> ${state.grimorioSelecionados.join(', ')}</li>`;
  if (state.subclasseMagiasSelecionados.length > 0) html += `<li><strong>${calcularSubclasseArcana(ctx, state)?.escola || 'Subclasse'}:</strong> ${state.subclasseMagiasSelecionados.join(', ')}</li>`;
  // Gravada por um caminho SEM DESFAZER, mesmo motivo da perícia/instrumento
  // da classe nova logo acima: o resumo tem de nomear o que foi escolhido.
  if ((state.rituaisBonusSelecionados || []).length > 0) html += `<li><strong>Magias Rituais (Bônus de Proficiência):</strong> ${escHtml(state.rituaisBonusSelecionados.join(', '))}</li>`;
  if (state.trocarDe && state.trocarPara) html += `<li><strong>Troca:</strong> ${state.trocarDe} &rarr; ${state.trocarPara}</li>`;
  if (state.manobrasNovasSelecionadas.length > 0) html += `<li><strong>Manobras:</strong> ${state.manobrasNovasSelecionadas.join(', ')}</li>`;
  if (state.manobraTrocarDe && state.manobraTrocarPara) html += `<li><strong>Troca de Manobra:</strong> ${state.manobraTrocarDe} &rarr; ${state.manobraTrocarPara}</li>`;

  html += `</ul>`;

  if (incompletos.length > 0) {
    html += `
      <div style="margin-top:12px;padding:10px;background:var(--danger);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
        <strong>Pendências:</strong>
        <ul style="margin:4px 0 0 16px">
          ${incompletos.map(s => `<li>${s.titulo}</li>`).join('')}
        </ul>
      </div>
    `;
  } else {
    html += `
      <div style="margin-top:12px;padding:10px;background:var(--success);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
        Todas as escolhas estão completas. Pronto para confirmar!
      </div>
    `;
  }

  html += `</div></div>`;

  // Cards de escolhas opcionais que nunca introduzem um step novo (ver
  // comentário de renderCardTrocasOpcionais) -- Troca de Estilo de Luta do
  // Guerreiro e Especialização adicional do Ladino nível 6.
  html += renderCardTrocasOpcionais(ctx, state);

  return html;
}

