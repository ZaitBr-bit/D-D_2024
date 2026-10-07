// ============================================================
// Ficha: familiar (Convocar Familiar).
//
// Ao conjurar a magia (espaço, Ritual, uso grátis ou Pacto da Corrente) abre
// a tela de escolha da forma, com as estatísticas de cada uma. Escolhida a
// forma e concluída a conjuração, a ficha ganha o card "Familiar", acima das
// magias, para controlar PV, descartar, fazer reaparecer e dispensar.
// A regra vive em regras-familiar.js.
// ============================================================
import { char, salvar } from './estado.js';
import { abrirModal, escHtml, mdParaHtml, semAcento, toast } from '../utils.js';
import { getCriaturas } from '../db.js';
import { ligarSelosFonte, seloFonte } from '../fontes.js';
import { ehNecromante } from '../regras-necromante.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirModalPVCriatura } from './pv-criatura.js';
import {
  ajustarPVFamiliar, descartarFamiliar, dispensarFamiliar, estadoFamiliar, formasComuns,
  formasEspeciaisDoPersonagem, reaparecerFamiliar, registrarFamiliar, tamanhoDaForma, tiposDoPersonagem, tipoExibido,
} from '../regras-familiar.js';

let _criaturas = [];

// Escolha feita na tela de seleção, à espera da conclusão da conjuração.
let _pendente = null;
const VALIDADE_PENDENTE_MS = 30_000;

/** Carrega o apêndice de criaturas uma vez (chamado antes do primeiro render da ficha). */
export async function carregarCriaturasFamiliar() {
  if (!_criaturas.length) _criaturas = (await getCriaturas())?.criaturas || [];
}

/** Criaturas do apêndice já carregadas (compartilhadas com a Forma Selvagem). */
export function criaturasApendice() {
  return _criaturas;
}

/** Há uma escolha de forma recente, à espera de a conjuração terminar. */
function temEscolhaPendente() {
  return !!_pendente && (Date.now() - _pendente.em) < VALIDADE_PENDENTE_MS;
}

/**
 * Chamado quando a conjuração de uma magia termina: se for Convocar Familiar
 * e houver uma forma escolhida, registra o familiar. Não grava nada para
 * outras magias.
 * @param {string} nome Nome da magia conjurada.
 */
export function registrarFamiliarPendente(nome) {
  if (nome !== 'Convocar Familiar' || !temEscolhaPendente()) return;
  const criatura = _criaturas.find((c) => c.nome === _pendente.forma);
  const escolha = _pendente;
  _pendente = null;
  if (!criatura) return;
  registrarFamiliar(char, criatura, { tipo: escolha.tipo, especial: escolha.especial, origem: escolha.origem || '', tipos: tiposDoPersonagem(char) });
}

/**
 * Se a magia for Convocar Familiar e ainda não houver forma escolhida, abre a
 * tela de escolha e, confirmada, chama `reabrir` para repetir o clique (agora
 * com a forma pendente). Devolve true quando assumiu o clique.
 * @param {string} nome Nome da magia.
 * @param {'espaco'|'ritual'|'gratis'|'pacto'} rota Como a magia está sendo conjurada.
 * @param {Function} reabrir Repete o clique original.
 * @returns {boolean} true se o clique foi interceptado.
 */
export function interceptarConvocarFamiliar(nome, rota, reabrir) {
  if (nome !== 'Convocar Familiar' || temEscolhaPendente()) return false;
  abrirSelecaoFamiliar(rota, reabrir);
  return true;
}

/** Linha de resumo de uma forma: tamanho, CA, PV e deslocamento. */
export function resumoForma(c) {
  return [tamanhoDaForma(c), `CA ${c.ca}`, `PV ${String(c.pv).split(' ')[0]}`, c.deslocamento].filter(Boolean).map(escHtml).join(' · ');
}

/** Bloco de ficha técnica de uma criatura (o texto do apêndice, sem o título). */
export function fichaTecnica(c) {
  return mdParaHtml(String(c.texto_completo || '').replace(/^##[^\n]*\n+/, ''));
}

/** Card de uma forma na tela de escolha. */
export function cardForma(c, selecionada) {
  const nome = escHtml(c.nome);
  return `
    <div class="opcao-card ${selecionada ? 'selecionada' : ''}" data-familiar-card="${nome}" data-familiar-info="${nome}" style="position:relative;cursor:pointer" title="Toque no card para ver a ficha; o círculo seleciona">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="opcao-check" data-familiar-toggle="${nome}" style="cursor:pointer;flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div class="opcao-nome">${nome}</div>
          <div class="opcao-resumo"><span style="font-size:0.65rem">${resumoForma(c)}</span> ${seloFonte(c.fonte)}</div>
        </div>
      </div>
    </div>`;
}

/**
 * Popup de informações por cima do modal aberto (não usa `abrirModal`, que
 * substituiria a tela de escolha e perderia a seleção).
 * @param {string} titulo Título do popup.
 * @param {string} corpoHtml Conteúdo.
 * @param {{rotulo: string, aoClicar: Function}|null} [acao] Botão de escolha.
 */
export function abrirPopupSobreposto(titulo, corpoHtml, acao = null) {
  document.getElementById('familiar-popup-sobreposicao')?.remove();
  const sobreposicao = document.createElement('div');
  sobreposicao.id = 'familiar-popup-sobreposicao';
  sobreposicao.className = 'inv-popup-sobreposicao';
  sobreposicao.innerHTML = `
    <div class="inv-popup" role="dialog" aria-modal="true" aria-label="${escHtml(titulo)}">
      <h3 style="margin:0 0 6px;font-size:1rem">${escHtml(titulo)}</h3>
      <div class="md-content" style="font-size:0.85rem">${corpoHtml}</div>
      <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:12px">
        <button class="btn btn-secondary" id="btn-fechar-familiar-popup">Fechar</button>
        ${acao ? `<button class="btn btn-primary" id="btn-escolher-familiar-popup">${escHtml(acao.rotulo)}</button>` : ''}
      </div>
    </div>`;
  const fechar = () => sobreposicao.remove();
  sobreposicao.addEventListener('click', (e) => { if (e.target === sobreposicao) fechar(); });
  sobreposicao.querySelector('#btn-fechar-familiar-popup').addEventListener('click', fechar);
  sobreposicao.querySelector('#btn-escolher-familiar-popup')?.addEventListener('click', () => { fechar(); acao.aoClicar(); });
  document.body.appendChild(sobreposicao);
  ligarSelosFonte(sobreposicao);
}

/**
 * Tela de escolha da forma do familiar. Clicar no nome do card abre a ficha
 * técnica; o círculo seleciona. Confirmar grava a escolha pendente e chama
 * `aoConfirmar`; cancelar não muda nada.
 * @param {'espaco'|'ritual'|'gratis'|'pacto'|'companheiro'} rota Como a magia está sendo conjurada.
 * @param {Function} aoConfirmar Chamado depois de a forma ser confirmada (recebe o custo escolhido, se houver).
 * @param {{origem?: string, tipoFixo?: string, custos?: Array<{id: string, rotulo: string, disponivel: boolean}>}} [opcoes]
 *   `origem` e `tipoFixo`: familiar que não vem da magia (Companheiro Selvagem: sempre Feérico);
 *   `custos`: o jogador escolhe o que gastar antes de confirmar.
 */
export function abrirSelecaoFamiliar(rota, aoConfirmar, opcoes = {}) {
  const comuns = formasComuns(_criaturas);
  const especiais = formasEspeciaisDoPersonagem(char, rota, _criaturas);
  const tiposPermitidos = tiposDoPersonagem(char);
  const atual = estadoFamiliar(char);
  let forma = '';
  let tipo = opcoes.tipoFixo || (atual?.tipo && tiposPermitidos.includes(atual.tipo) ? atual.tipo : 'Feérico');
  let busca = '';
  const custos = opcoes.custos || [];
  let custo = custos.find((c) => c.disponivel)?.id || '';

  const criaturaDe = (nome) => _criaturas.find((c) => c.nome === nome);
  const ehEspecial = (nome) => especiais.some((c) => c.nome === nome);
  const rotuloRota = { espaco: 'Gasta um espaço de 1º círculo ou superior.', ritual: 'Conjuração como Ritual: leva 1 hora e não gasta espaço.',
    gratis: 'Uso grátis: não gasta espaço.', pacto: 'Pacto da Corrente: não gasta espaço e libera as formas especiais.',
    companheiro: 'Companheiro Selvagem: Convocar Familiar sem componentes Materiais. O familiar é Feérico e desaparece ao completar um Descanso Longo.' }[rota] || '';

  const desenhar = () => {
    const corpo = document.getElementById('familiar-selecao');
    if (!corpo) return;
    const filtra = (lista) => lista.filter((c) => !busca || semAcento(c.nome).includes(semAcento(busca)));
    const secao = (titulo, lista) => (lista.length
      ? `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:10px 0 4px">${titulo}</div>
         <div class="opcao-grid densa">${lista.map((c) => cardForma(c, c.nome === forma)).join('')}</div>`
      : '');
    corpo.innerHTML = `
      ${atual ? `<div class="info-box info" style="font-size:0.8rem;margin-bottom:8px">Você já tem um familiar (${escHtml(atual.forma)}). Conjurar de novo troca a forma dele.</div>` : ''}
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${escHtml(rotuloRota)}</div>
      <div class="search-box" style="margin-bottom:6px"><input type="text" id="familiar-busca" placeholder="Buscar forma..." class="form-input" value="${escHtml(busca)}"></div>
      ${custos.length ? `<div style="margin-bottom:8px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Gastar</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${custos.map((c) => `<button class="btn btn-sm ${c.id === custo ? 'btn-primary' : 'btn-secondary'}" data-familiar-custo="${escHtml(c.id)}"${c.disponivel ? '' : ' disabled'}>${escHtml(c.rotulo)}${c.disponivel ? '' : ' (indisponível)'}</button>`).join('')}
          </div></div>` : ''}
      ${secao('Formas comuns (Fera de ND 0)', filtra(comuns))}
      ${secao('Formas especiais', filtra(especiais))}
      ${forma && !ehEspecial(forma) && !opcoes.tipoFixo ? `
        <div style="margin-top:12px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Tipo do familiar (no lugar de Fera)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${tiposPermitidos.map((t) => `<button class="btn btn-sm ${t === tipo ? 'btn-primary' : 'btn-secondary'}" data-familiar-tipo="${t}">${t}</button>`).join('')}
          </div>
        </div>` : ''}`;
    ligarSelosFonte(corpo);
    const botao = document.getElementById('btn-confirmar-familiar');
    const pode = !!forma && (!custos.length || !!custo);
    if (botao) { botao.disabled = !pode; botao.style.opacity = pode ? '' : '0.5'; }

    corpo.querySelectorAll('[data-familiar-toggle]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      forma = el.dataset.familiarToggle === forma ? '' : el.dataset.familiarToggle;
      desenhar();
    }));
    corpo.querySelectorAll('[data-familiar-info]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = criaturaDe(el.dataset.familiarInfo);
      if (!c) return;
      abrirPopupSobreposto(c.nome, `
        <p style="font-size:0.8rem;color:var(--text-muted)">${escHtml(tipoExibido(c, tipo, ehEspecial(c.nome)))}</p>${fichaTecnica(c)}`,
      { rotulo: 'Escolher esta forma', aoClicar: () => { forma = c.nome; desenhar(); } });
    }));
    corpo.querySelectorAll('[data-familiar-custo]').forEach((el) => el.addEventListener('click', () => {
      custo = el.dataset.familiarCusto;
      desenhar();
    }));
    corpo.querySelectorAll('[data-familiar-tipo]').forEach((el) => el.addEventListener('click', () => {
      tipo = el.dataset.familiarTipo;
      desenhar();
    }));
    document.getElementById('familiar-busca')?.addEventListener('input', (e) => {
      busca = e.target.value;
      desenhar();
      const campo = document.getElementById('familiar-busca');
      campo?.focus();
      campo?.setSelectionRange(busca.length, busca.length);
    });
  };

  abrirModal('Convocar Familiar', '<div id="familiar-selecao"></div>',
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>'
    + `<button class="btn btn-primary" id="btn-confirmar-familiar" disabled>${rota === 'companheiro' ? 'Invocar' : 'Conjurar'}</button>`);
  desenhar();
  document.getElementById('btn-confirmar-familiar')?.addEventListener('click', () => {
    if (!forma || (custos.length && !custo)) return;
    _pendente = { forma, tipo, especial: ehEspecial(forma), origem: opcoes.origem || '', em: Date.now() };
    window.fecharModal();
    aoConfirmar(custo);
  });
}

/** Rótulo e cor da situação do familiar. */
const SITUACAO = {
  ativo: { texto: 'Em campo', cor: 'var(--success)' },
  descartado: { texto: 'Na mini dimensão', cor: 'var(--info)' },
  desaparecido: { texto: 'Desapareceu (0 PV)', cor: 'var(--danger)' },
};

/**
 * Card "Familiar", acima das magias. Vazio quando não há familiar.
 * @returns {string} HTML do card.
 */
export function renderSecaoFamiliar() {
  const f = estadoFamiliar(char);
  if (!f || !_criaturas.length) return '';
  const c = _criaturas.find((x) => x.nome === f.forma);
  if (!c) return '';
  const sit = SITUACAO[f.situacao] || SITUACAO.ativo;
  return `
    <div class="card" id="card-familiar">
      <div class="card-header"><h2>Familiar</h2>
        <span class="badge" style="background:${sit.cor};color:#fff">${sit.texto}</span></div>
      <div class="opcao-card" data-familiar-ficha="1" style="padding:10px 12px;cursor:pointer" title="Clique para ver a ficha técnica">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${escHtml(f.forma)}</strong>
          <span class="badge badge-secondary">${escHtml(tipoExibido(c, f.tipo, f.especial))}</span>
          <span class="badge badge-secondary">CA ${escHtml(c.ca)}</span>
          <span class="badge badge-secondary">PV ${f.pv_atual}/${f.pv_max}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">${escHtml(c.deslocamento || '')}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
          Conexão telepática a até 30 m; Ação Bônus para ver e ouvir pelo familiar. Não ataca.
          ${ehNecromante(char) ? ' Ao executar a ação Atacar, você pode abrir mão de um ataque para o familiar atacar com a Reação dele.' : ''}
          ${f.origem === 'companheiro_selvagem' ? ' Companheiro Selvagem: desaparece ao completar um Descanso Longo.' : ''}
          ${f.situacao === 'desaparecido' ? ' Reaparece quando você conjurar Convocar Familiar de novo.' : ''}
        </div>
        <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
          ${f.situacao === 'ativo' ? `
            <button class="btn btn-sm btn-danger" data-familiar-acao="dano">Dano</button>
            <button class="btn btn-sm btn-success" data-familiar-acao="cura">Cura</button>
            <button class="btn btn-sm btn-secondary" data-familiar-acao="descartar" title="Ação Usar Magia: guarda o familiar na mini dimensão">Descartar</button>` : ''}
          ${f.situacao === 'descartado' ? '<button class="btn btn-sm btn-accent" data-familiar-acao="reaparecer" title="Ação Usar Magia: reaparece a até 9 m">Reaparecer</button>' : ''}
          <button class="btn btn-sm btn-secondary" data-familiar-acao="dispensar" title="Descarta o familiar para sempre">Dispensar</button>
        </div>
      </div>
    </div>`;
}

/**
 * Popup do familiar com a ficha técnica da forma.
 */
function abrirFichaFamiliar() {
  const f = estadoFamiliar(char);
  const c = f && _criaturas.find((x) => x.nome === f.forma);
  if (!c) return;
  abrirPopupSobreposto(`Familiar: ${f.forma}`,
    `<p style="font-size:0.8rem;color:var(--text-muted)">${escHtml(tipoExibido(c, f.tipo, f.especial))}</p>${fichaTecnica(c)}`);
}

/** Liga os controles do card Familiar. */
export function setupEventosFamiliar() {
  document.querySelectorAll('[data-familiar-ficha]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button, input')) return;
    abrirFichaFamiliar();
  }));
  document.querySelectorAll('[data-familiar-acao]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const acao = btn.dataset.familiarAcao;
    if (acao === 'dano' || acao === 'cura') {
      const atual = estadoFamiliar(char);
      if (!atual) return;
      abrirModalPVCriatura({
        nome: atual.forma, tipo: acao, pvMax: atual.pv_max,
        aoAplicar: (valor) => {
          const f = ajustarPVFamiliar(char, acao === 'dano' ? -valor : valor);
          if (!f) return;
          salvar();
          renderFichaCompleta();
          if (f.situacao === 'desaparecido') toast('O familiar chegou a 0 PV e desapareceu. Conjure a magia de novo para ele voltar.', 'info');
        },
      });
    } else if (acao === 'descartar') {
      if (descartarFamiliar(char)) { salvar(); renderFichaCompleta(); toast('Familiar guardado na mini dimensão.', 'success'); }
    } else if (acao === 'reaparecer') {
      if (reaparecerFamiliar(char)) { salvar(); renderFichaCompleta(); toast('Familiar de volta, a até 9 m de você.', 'success'); }
    } else if (acao === 'dispensar') {
      abrirModal('Dispensar o familiar?', '<p>O familiar é descartado para sempre. Para ter outro, conjure Convocar Familiar de novo.</p>',
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>'
        + '<button class="btn btn-danger" id="btn-confirmar-dispensar-familiar">Dispensar</button>');
      document.getElementById('btn-confirmar-dispensar-familiar')?.addEventListener('click', () => {
        dispensarFamiliar(char);
        salvar();
        window.fecharModal();
        renderFichaCompleta();
      });
    }
  }));
}
