// ============================================================
// Renderização de Cards do Level Up - Steps dinâmicos
// Fase 3: Render de cards
// ============================================================
import { CLASSES_INFO, ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY } from './dados-classes.js';
import { getMagiasClasse, getMagiasPorCirculo } from './db.js';
import { calcMod, bonusProficiencia, mdParaHtml, semAcento, toast, abrirModal } from './utils.js';
import { rotuloPericia } from './opcoes-dominio.js';
import { obterTalentosElegiveis } from './levelup.js';
import { calcularConjuracao, calcularSubclasseArcana } from './levelup-flow.js';
import { linhasDaSubclasseNoNivel, opcoesDaLinha } from './regras-subclasse-escolhas.js';

// ============================================================
// CARD: Ganhos do Nível
// ============================================================
export function renderCardGanhosNivel(ctx, state) {
  const { info, nivelNovo, modCon, hpGanhoFixo, caracteristicas, caracteristicasEspecie,
          caracteristicasSubclasse, magiasDominioNivel, bonusNovo, bonusMudou, char } = ctx;

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
        <div class="levelup-card-header">Subclasse — ${char.subclasse}</div>
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
 * Le a subclasse de `state.subclasse || char.subclasse` -- no nivel 3 ela esta
 * sendo escolhida NESTA sessao e ainda nao existe no personagem salvo; ler so
 * o personagem deixaria a maioria das escolhas sem card, com a pendencia
 * travando a subida sem o jogador ter onde responder.
 */
export function montarCardsEscolhaSubclasse(ctx, state) {
  const subclasse = state?.subclasse || ctx.char?.subclasse;
  const linhas = linhasDaSubclasseNoNivel(subclasse, ctx.nivelNovo).filter((l) => l.tipo);
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
  const { char, info } = ctx;
  // Reativo à subclasse escolhida nesta sessão (Cavaleiro Místico /
  // Trapaceiro Arcano começam a conjurar no mesmo nível em que são
  // escolhidos) -- ver calcularConjuracao em levelup-flow.js.
  const conjuracao = calcularConjuracao(ctx, state);
  if (!conjuracao) return '';

  const { truquesGanhos, tipoConj, magiasGanhas, magiasNovo, magiasAtual, ehMago } = conjuracao;
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
  const magiasAtuais = (char.magias_preparadas || []).filter(m => {
    const origensEspeciais = ['dominio', 'sempre', 'especie_legado', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
    return m.circulo > 0 && !origensEspeciais.includes(m?.origem);
  });
  if (magiasAtuais.length > 0) {
    // O Mago troca DENTRO do grimorio: preparar uma magia que nao esta no
    // livro contradiz normalizarGrimorioMago (utils.js) e o proprio modal
    // de troca do Descanso Longo (sheet/grimorio.js/mostrarTrocaMagias,
    // que para o Mago le `char.grimorio`). O filtro da lista "entra" fica
    // em levelup-ui.js; aqui so muda o texto.
    const fonte = ehMago ? 'do seu grimório' : `da lista de ${char.classe}`;
    const rotulo = tipoConj === 'conhecidas' ? 'magia conhecida' : 'magia preparada';
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Trocar Magia (Opcional)</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Troque 1 ${rotulo} por outra ${fonte}.
          </div>
          <div id="levelup-troca-magia"></div>
        </div>
      </div>
    `;
  }

  // Troca de truque (qualquer classe conjuradora com truques de classe conhecidos)
  const truquesAtuais = (char.magias_conhecidas || []).filter(m => {
    const origensEspeciais = ['especie', 'sempre', 'especie_legado', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista', 'subclasse_fixa'];
    return m.circulo === 0 && !origensEspeciais.includes(m?.origem);
  });
  if (truquesAtuais.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Trocar Truque (Opcional)</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Troque 1 truque conhecido por outro da lista de ${char.classe}.
          </div>
          <div id="levelup-troca-truque"></div>
        </div>
      </div>
    `;
  }

  // Grimório do Mago
  if (ehMago) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Grimório: +2 Magias</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-grimorio-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.grimorioSelecionados.length === 0
                ? '<span style="color:var(--danger)">Nenhuma selecionada. Selecione 2.</span>'
                : `<span style="color:${state.grimorioSelecionados.length === 2 ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.grimorioSelecionados.length}/2</span>`
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
  if (tipoConj === 'preparadas' && char.classe !== 'Mago') {
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
// CARD: Revisão e Confirmação
// ============================================================
export function renderCardRevisao(ctx, state, steps) {
  const { nivelNovo, hpGanhoFixo, modCon, info, char } = ctx;
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
          <li><strong>HP:</strong> +${hpGanho} PV (${state.hpModo === 'rolado' ? `rolagem ${state.hpRolado}` : 'fixo'})</li>
  `;

  if (state.subclasse) html += `<li><strong>Subclasse:</strong> ${state.subclasse}</li>`;

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

