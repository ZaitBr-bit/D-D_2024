// ============================================================
// Ficha: Necromante (Mago, Arcana Unleashed). Card "Mortos-Vivos" (registro,
// PV, dispensar, colher, fortalecer, extinguir) e os modais das
// características. A regra vive em regras-necromante.js.
// ============================================================
import { char, indiceMagiasCache, salvar } from './estado.js';
import { abrirModal, escHtml, toast } from '../utils.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirModalPVCriatura } from './pv-criatura.js';
import { abrirPopupSobreposto, cardForma, criaturasApendice, fichaTecnica } from './familiar.js';
import { gastarEspaco, reservasDeEspacos } from './reservas-espacos.js';
import {
  MAGIAS_QUE_CRIAM_MORTOS_VIVOS, ajustarPVMortoVivo, colherMortoVivo, dadosDeExtinguir, dispensarMortoVivo, ehMagiaDeNecromancia,
  avisoLivroNaoEmpunhado, ehNecromante, estadoNecromante, fortalecerMortosVivos, fortitudeMortaViva, golpeDebilitante, livroEmpunhado, nivelDoMago, pvDaColheita, registrarMortoVivo,
  vitalidadeMortaViva,
} from '../regras-necromante.js';

/** Formas de Morto-Vivo oferecidas no registro (apêndice de criaturas). */
const FORMAS_MORTO_VIVO = ['Esqueleto', 'Zumbi'];

/** Se a seção existe para este personagem (Necromante, nível 3+ de Mago). */
function ativo() {
  return ehNecromante(char) && nivelDoMago(char) >= 3;
}

/**
 * Card "Mortos-Vivos", acima do card do Familiar. Vazio fora do Necromante.
 * @returns {string} HTML do card.
 */
export function renderSecaoMortosVivos() {
  if (!ativo()) return '';
  const e = estadoNecromante(char);
  const nivel = nivelDoMago(char);
  const golpe = golpeDebilitante(char);
  const linhas = e.mortos_vivos.map((m) => {
    const c = criaturasApendice().find((x) => x.nome === m.nome);
    const tipo = c ? String(c.tipo_tamanho || '').split(',')[0] : '';
    const detalhes = c ? [c.deslocamento, c.nd ? `ND ${String(c.nd).split(' ')[0]}` : '', c.sentidos].filter(Boolean).map(escHtml).join(' · ') : '';
    return `
    <div class="opcao-card" data-morto-vivo="${escHtml(m.id)}" data-morto-vivo-ficha="${escHtml(m.id)}" style="padding:8px 10px;margin-bottom:6px;cursor:${c ? 'pointer' : 'default'}" ${c ? 'title="Clique para ver a ficha técnica"' : ''}>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <strong>${escHtml(m.nome)}</strong>
        ${tipo ? `<span class="badge badge-secondary">${escHtml(tipo)}</span>` : ''}
        ${c ? `<span class="badge badge-secondary">CA ${escHtml(c.ca)}</span>` : ''}
        <span class="badge badge-secondary">PV ${m.pv_atual}/${m.pv_max}</span>
        ${m.pv_temporarios ? `<span class="badge badge-secondary">PV temp. ${m.pv_temporarios}</span>` : ''}
        <span style="font-size:0.72rem;color:var(--text-muted)">${m.dados_de_vida} Dado(s) de Vida</span>
      </div>
      ${detalhes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${detalhes}</div>` : ''}
      ${golpe ? `<div style="font-size:0.75rem;color:var(--text-muted)">Golpe Debilitante: +${golpe} de dano Necrótico por acerto.</div>` : ''}
      <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-sm btn-danger" data-necromante-acao="dano" data-id="${escHtml(m.id)}">Dano</button>
        <button class="btn btn-sm btn-success" data-necromante-acao="cura" data-id="${escHtml(m.id)}">Cura</button>
        <button class="btn btn-sm btn-secondary" data-necromante-acao="dispensar" data-id="${escHtml(m.id)}">Dispensar</button>
      </div>
    </div>`;
  }).join('');
  return `
    <div class="card" id="card-mortos-vivos">
      <div class="card-header"><h2>Mortos-Vivos</h2>
        <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-accent" data-necromante-acao="registrar">Registrar morto-vivo</button>
          ${nivel >= 10 ? '<button class="btn btn-sm btn-secondary" data-necromante-acao="colher" title="Reação: reduz um Morto-Vivo seu a 0 PV e você recupera PV iguais ao nível">Colher</button>' : ''}
          ${nivel >= 14 ? `<button class="btn btn-sm btn-secondary" data-necromante-acao="fortalecer" ${e.fortalecer_usado || !e.mortos_vivos.length ? 'disabled' : ''} title="Ação Bônus, 1x por Descanso Longo">Fortalecer</button>
          <button class="btn btn-sm btn-secondary" data-necromante-acao="extinguir" title="Quando um Morto-Vivo vai a 0 PV">Extinguir</button>` : ''}
        </div></div>
      ${nivel >= 6 ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px">
        Golpe Debilitante: um Morto-Vivo seu a até 18 m que atinja uma criatura causa <strong>+${golpe} de dano Necrótico</strong>.
        Necrose Esmagadora: suas magias e características de Mago ignoram Resistência a dano Necrótico.</div>` : ''}
      ${avisoLivroNaoEmpunhado(char) ? `<div class="aviso" style="font-size:0.78rem;color:#842029;margin-bottom:6px">${avisoLivroNaoEmpunhado(char)}</div>` : ''}
      ${linhas || '<div style="font-size:0.8rem;color:var(--text-muted)">Nenhum Morto-Vivo sob seu controle. Registre os que você criar ou invocar.</div>'}
    </div>`;
}

/**
 * Tela de registro: cards de forma (o nome abre a ficha técnica), quantidade e
 * confirmação. Aplica a Fortitude Morta-Viva (nível 6+) no PV de cada um.
 * @param {() => void} [aoFim] Chamado quando a tela fecha (registrando ou não).
 */
export function abrirRegistroMortosVivos(aoFim) {
  const formas = FORMAS_MORTO_VIVO.map((n) => criaturasApendice().find((c) => c.nome === n)).filter(Boolean);
  let forma = '';
  const desenhar = () => {
    const corpo = document.getElementById('registro-mortos-vivos');
    if (!corpo) return;
    corpo.innerHTML = `
      <div class="opcao-grid densa">${formas.map((c) => cardForma(c, c.nome === forma)).join('')}</div>
      <div class="form-group" style="margin-top:10px"><label class="form-label" for="registro-quantidade">Quantidade</label>
        <input type="number" class="form-input" id="registro-quantidade" min="1" max="20" value="1" style="width:90px"></div>`;
    const botao = document.getElementById('btn-confirmar-registro-mortos-vivos');
    if (botao) { botao.disabled = !forma; botao.style.opacity = forma ? '' : '0.5'; }
    corpo.querySelectorAll('[data-familiar-toggle]').forEach((el) => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      forma = el.dataset.familiarToggle === forma ? '' : el.dataset.familiarToggle;
      desenhar();
    }));
    corpo.querySelectorAll('[data-familiar-info]').forEach((el) => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const c = formas.find((x) => x.nome === el.dataset.familiarInfo);
      if (c) abrirPopupSobreposto(c.nome, fichaTecnica(c), { rotulo: 'Escolher esta forma', aoClicar: () => { forma = c.nome; desenhar(); } });
    }));
  };
  abrirModal('Registrar Mortos-Vivos', '<div id="registro-mortos-vivos"></div>',
    '<button class="btn btn-secondary" id="btn-cancelar-registro-mortos-vivos">Agora não</button>'
    + '<button class="btn btn-primary" id="btn-confirmar-registro-mortos-vivos" disabled>Registrar</button>',
    () => aoFim?.());
  desenhar();
  document.getElementById('btn-cancelar-registro-mortos-vivos')?.addEventListener('click', () => window.fecharModal());
  document.getElementById('btn-confirmar-registro-mortos-vivos')?.addEventListener('click', () => {
    const criatura = formas.find((c) => c.nome === forma);
    const quantidade = Math.max(1, parseInt(document.getElementById('registro-quantidade')?.value, 10) || 1);
    if (!criatura) return;
    registrarMortoVivo(char, criatura, { quantidade });
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${quantidade} ${criatura.nome} registrado(s).`, 'success');
  });
}

/** Liga os botões do card Mortos-Vivos. */
export function setupEventosMortosVivos() {
  // Clique no card abre a ficha técnica da criatura (como o card do Familiar).
  document.querySelectorAll('[data-morto-vivo-ficha]').forEach((el) => el.addEventListener('click', (ev) => {
    if (ev.target.closest('button, input')) return;
    const m = estadoNecromante(char).mortos_vivos.find((x) => x.id === el.dataset.mortoVivoFicha);
    const c = m && criaturasApendice().find((x) => x.nome === m.nome);
    if (c) abrirPopupSobreposto(`Morto-Vivo: ${m.nome}`, `<p style="font-size:0.8rem;color:var(--text-muted)">${escHtml(c.tipo_tamanho || '')}</p>${fichaTecnica(c)}`);
  }));
  document.querySelectorAll('[data-necromante-acao]').forEach((btn) => btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const acao = btn.dataset.necromanteAcao;
    const id = btn.dataset.id;
    const m = estadoNecromante(char).mortos_vivos.find((x) => x.id === id);
    if (acao === 'registrar') abrirRegistroMortosVivos();
    else if (acao === 'colher') abrirModalColher();
    else if (acao === 'fortalecer') {
      const pv = fortalecerMortosVivos(char);
      if (!pv) { toast('Nada a fortalecer: registre um Morto-Vivo ou o uso já foi gasto.', 'error'); return; }
      salvar();
      renderFichaCompleta();
      toast(`Mortos-Vivos fortalecidos: +${pv} PV temporários cada. ${avisoLivroNaoEmpunhado(char)}`.trim(), 'success');
    } else if (acao === 'extinguir') abrirModalExtinguir();
    else if ((acao === 'dano' || acao === 'cura') && m) {
      abrirModalPVCriatura({
        nome: m.nome, tipo: acao, pvMax: m.pv_max,
        aoAplicar: (valor) => { ajustarPVMortoVivo(char, id, acao === 'dano' ? -valor : valor); salvar(); renderFichaCompleta(); },
      });
    } else if (acao === 'dispensar' && m) {
      dispensarMortoVivo(char, id);
      salvar();
      renderFichaCompleta();
    }
  }));
}

/**
 * Colher Mortos-Vivos (nível 10): escolha do Morto-Vivo (cards) e confirmação.
 * O escolhido vai a 0 PV e o mago recupera PV iguais ao nível de Mago.
 */
function abrirModalColher() {
  const lista = estadoNecromante(char).mortos_vivos;
  if (!lista.length) { toast('Nenhum Morto-Vivo registrado para colher.', 'error'); return; }
  let escolhido = lista[0].id;
  const desenhar = () => {
    const corpo = document.getElementById('colher-corpo');
    if (!corpo) return;
    corpo.innerHTML = `<p style="font-size:0.85rem">Reação, ao ficar Sangrando sem cair a 0 PV: o Morto-Vivo escolhido vai a 0 PV e você recupera <strong>${pvDaColheita(char)} PV</strong>.</p>
      <div class="opcao-grid densa">${lista.map((m) => `
        <div class="opcao-card ${m.id === escolhido ? 'selecionada' : ''}" data-colher-card="${escHtml(m.id)}" style="cursor:pointer">
          <div class="opcao-nome">${escHtml(m.nome)}</div><div class="opcao-resumo">PV ${m.pv_atual}/${m.pv_max}</div></div>`).join('')}</div>`;
    corpo.querySelectorAll('[data-colher-card]').forEach((el) => el.addEventListener('click', () => { escolhido = el.dataset.colherCard; desenhar(); }));
  };
  abrirModal('Colher Mortos-Vivos', '<div id="colher-corpo"></div>',
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-colher">Colher</button>');
  desenhar();
  document.getElementById('btn-confirmar-colher')?.addEventListener('click', () => {
    const cura = colherMortoVivo(char, escolhido);
    if (!cura) return;
    const pvMax = char.pv_max_override || char.pv_max;
    char.pv_atual = Math.min(pvMax, (char.pv_atual || 0) + cura);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`Morto-Vivo colhido: você recuperou ${cura} PV.`, 'success');
  });
}

/**
 * Extinguir Mortos-Vivos (nível 14): escolha de um Morto-Vivo registrado (que
 * preenche os Dados de Vida e marca "sob meu controle") ou de outro Morto-Vivo.
 * Rola metade dos Dados de Vida (para cima, mínimo 1) em d6. Num Morto-Vivo que
 * não é do mago, gasta Reação e o menor espaço de 5º círculo ou superior
 * disponível. O registrado explodido sai da lista.
 */
function abrirModalExtinguir() {
  const lista = estadoNecromante(char).mortos_vivos;
  let escolhido = lista[0]?.id || '';
  const aviso = avisoLivroNaoEmpunhado(char);
  abrirModal('Extinguir Mortos-Vivos', `
    ${aviso ? `<div class="aviso" style="font-size:0.78rem;color:#842029;margin-bottom:8px">${aviso}</div>` : ''}
    <div class="opcao-grid densa" id="extinguir-cards">${lista.map((m) => `
      <div class="opcao-card" data-extinguir-card="${escHtml(m.id)}" style="cursor:pointer">
        <div class="opcao-nome">${escHtml(m.nome)}</div><div class="opcao-resumo">PV ${m.pv_atual}/${m.pv_max} · ${m.dados_de_vida} DV</div></div>`).join('')}
      <div class="opcao-card" data-extinguir-card="" style="cursor:pointer">
        <div class="opcao-nome">Outro Morto-Vivo</div><div class="opcao-resumo">Não registrado</div></div></div>
    <div class="form-group" style="margin-top:10px"><label class="form-label" for="extinguir-dv">Dados de Vida não gastos</label>
      <input type="number" class="form-input" id="extinguir-dv" min="1" max="40" value="2" style="width:90px"></div>
    <label class="form-check"><input type="checkbox" id="extinguir-controlado" checked> É um Morto-Vivo sob meu controle</label>
    <p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">Se não for seu, gasta uma Reação e um espaço de magia de 5º círculo ou superior.</p>`,
  '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-extinguir">Explodir</button>');
  // Marca o card escolhido e, para um registrado, preenche Dados de Vida e controle.
  const marcar = () => {
    document.querySelectorAll('[data-extinguir-card]').forEach((el) => el.classList.toggle('selecionada', el.dataset.extinguirCard === escolhido));
    const m = lista.find((x) => x.id === escolhido);
    if (m) document.getElementById('extinguir-dv').value = m.dados_de_vida;
    document.getElementById('extinguir-controlado').checked = !!m;
    document.getElementById('extinguir-controlado').disabled = !!m;
    document.getElementById('extinguir-dv').disabled = !!m;
  };
  document.querySelectorAll('[data-extinguir-card]').forEach((el) => el.addEventListener('click', () => { escolhido = el.dataset.extinguirCard; marcar(); }));
  marcar();
  document.getElementById('btn-confirmar-extinguir')?.addEventListener('click', () => {
    const dv = Math.max(1, parseInt(document.getElementById('extinguir-dv')?.value, 10) || 1);
    const controlado = !!document.getElementById('extinguir-controlado')?.checked;
    let custo = '';
    if (!controlado) {
      const reserva = reservasDeEspacos()
        .filter((r) => r.fonte === 'conjuracao' && r.circulo >= 5 && r.disponiveis > 0)
        .sort((a, b) => a.circulo - b.circulo)[0];
      if (!reserva || !gastarEspaco(char, 'conjuracao', reserva.circulo)) {
        toast('Sem espaço de magia de 5º círculo ou superior para extinguir um Morto-Vivo que não é seu.', 'error');
        return;
      }
      custo = ` Reação e espaço de ${reserva.circulo}º círculo gastos.`;
    }
    if (escolhido) dispensarMortoVivo(char, escolhido);
    const dados = dadosDeExtinguir(dv);
    const rolagens = Array.from({ length: dados }, () => 1 + Math.floor(Math.random() * 6));
    const total = rolagens.reduce((s, n) => s + n, 0);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    abrirModal('Extinguir Mortos-Vivos', `<p><strong>${total} de dano Necrótico</strong> (${dados}d6: ${rolagens.join(' + ')}).</p>
      <p>Cada criatura em uma Emanação de 3 metros faz salvaguarda de Destreza: em uma falha sofre o dano e não pode executar Reações até o início do próximo turno dela; em um sucesso, metade do dano.${custo}</p>`,
    '<button class="btn btn-primary" id="btn-fechar-extinguir">Fechar</button>');
    document.getElementById('btn-fechar-extinguir')?.addEventListener('click', () => window.fecharModal());
  });
}

/**
 * Depois de uma conjuração concluída: para o Necromante, informa a Vitalidade
 * Morta-Viva (magia de Necromancia gasta com espaço) e oferece o registro dos
 * Mortos-Vivos criados (Animar Mortos, Criar Mortos-Vivos, Invocar Morto-Vivo).
 * Os modais abrem em sequência e depois da ficha redesenhada.
 * @param {string} nome Nome da magia conjurada.
 * @param {{circulo: number, comEspaco: boolean}} ctx Círculo e se gastou espaço.
 */
export function aposConjurarMagia(nome, { circulo, comEspaco }) {
  if (!ativo()) return;
  const escola = (indiceMagiasCache || []).find((m) => m.nome === nome)?.escola;
  const vitalidade = comEspaco && ehMagiaDeNecromancia(escola) ? vitalidadeMortaViva(char, circulo) : 0;
  const cria = MAGIAS_QUE_CRIAM_MORTOS_VIVOS.includes(nome);
  if (!vitalidade && !cria) return;
  setTimeout(() => {
    const registrar = () => { if (cria) abrirRegistroMortosVivos(); };
    if (!vitalidade) { registrar(); return; }
    abrirModal('Vitalidade Morta-Viva', `
      <p>Uma criatura Morta-Viva que você veja a até 18 metros recupera <strong>${vitalidade} Pontos de Vida</strong>
      (círculo ${circulo} + nível de Mago ${nivelDoMago(char)}).</p>
      <p style="font-size:0.8rem;color:var(--text-muted)">Aplique pelo botão Cura do Morto-Vivo no card Mortos-Vivos.</p>`,
    '<button class="btn btn-primary" id="btn-fechar-vitalidade">Fechar</button>', registrar);
    document.getElementById('btn-fechar-vitalidade')?.addEventListener('click', () => window.fecharModal());
  }, 0);
}

/**
 * Resiliência Sepulcral (Poder Sepulcral, nível 6): a Recuperação Arcana tira
 * 1 nível de Exaustão. Chamado depois de a Recuperação Arcana concluir.
 * @returns {string} Texto para o toast; vazio se nada mudou.
 */
export function aplicarResilienciaSepulcral() {
  if (!ehNecromante(char) || nivelDoMago(char) < 6 || !(char.exaustao > 0)) return '';
  char.exaustao -= 1;
  if (char.exaustao === 0) char.condicoes = (char.condicoes || []).filter((c) => c !== 'Exaustão');
  return ` Resiliência Sepulcral: Exaustão ${char.exaustao + 1} → ${char.exaustao}.${avisoLivroNaoEmpunhado(char) ? ' Livro de magias não empunhado.' : ''}`;
}

/**
 * Popup do livro de magias do Necromante: o que ele é, quanto custa em mãos e
 * quais características exigem que esteja empunhado, com o valor atual de cada
 * uma e a tela onde ela é usada.
 */
export function abrirDetalheLivro() {
  const nivel = nivelDoMago(char);
  const empunhado = livroEmpunhado(char);
  const linha = (minimo, nome, efeito, onde) => `
    <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-light)">
      <div><strong>${nome}</strong>
        <span class="badge ${nivel >= minimo ? 'badge-success' : 'badge-secondary'}" style="font-size:0.65rem">${nivel >= minimo ? 'Ativa' : `Nível ${minimo}`}</span></div>
      <div>${efeito}</div>
      <div style="font-size:0.78rem;color:var(--text-muted)">Onde é usada: ${onde}</div>
    </div>`;
  abrirPopupSobreposto('Livro de magias', `
    <p>O livro de magias do Necromante. Empunhado, ocupa <strong>1 mão</strong> (entra na contagem do botão Mãos) e
    ativa as características abaixo. Hoje está <strong>${empunhado ? 'empunhado' : 'guardado'}</strong>.</p>
    <p style="font-size:0.8rem;color:var(--text-muted)">O app não bloqueia nada sem o livro: as características continuam valendo e
    aparece o aviso "Livro de magias não empunhado". Empunhar exige uma mão livre.</p>
    ${linha(6, 'Poder Sepulcral — Resiliência Sepulcral',
      'Ao usar Recuperação Arcana, seu nível de Exaustão diminui em 1.',
      'botão Recuperação Arcana, no painel de recursos do Mago (a mensagem confirma a redução).')}
    ${linha(6, 'Poder Sepulcral — Necrose Esmagadora',
      'O dano das suas magias e características de Mago ignora Resistência a dano Necrótico.',
      'regra de mesa, sem cálculo automático; lembrete no card Mortos-Vivos.')}
    ${linha(6, 'Servos Fortalecidos — Fortitude Morta-Viva',
      `Todo Morto-Vivo que você cria com magia de Necromancia ganha +${fortitudeMortaViva(char)} no máximo e no atual de PV (Int + metade do nível).`,
      'card Mortos-Vivos, botão Registrar morto-vivo (o registro já soma o bônus).')}
    ${linha(6, 'Servos Fortalecidos — Golpe Debilitante',
      `Morto-Vivo seu a até 18 m que atinge uma criatura causa +${golpeDebilitante(char)} de dano Necrótico.`,
      'texto em cada Morto-Vivo e no topo do card Mortos-Vivos.')}
    ${linha(14, 'Mestre da Morte — Fortalecer Mortos-Vivos',
      `Ação Bônus: cada Morto-Vivo seu ganha ${nivel} PV temporários, 1 vez por Descanso Longo.`,
      'card Mortos-Vivos, botão Fortalecer (volta no Descanso Longo).')}
    ${linha(14, 'Mestre da Morte — Extinguir Mortos-Vivos',
      'Faz um Morto-Vivo reduzido a 0 PV explodir em dano Necrótico (d6 pela metade dos Dados de Vida, Emanação de 3 m).',
      'card Mortos-Vivos, botão Extinguir.')}`);
}
