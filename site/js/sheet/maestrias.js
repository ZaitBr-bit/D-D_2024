// ============================================================
// Modais de maestria em arma
//
// Compartilhados por Barbaro, Guerreiro e Guardiao.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { abrirModal, escHtml, semAcento, toast } from '../utils.js';
import { getProgressaoBarbaro } from './classes/barbaro.js';
import { getProgressaoGuerreiro } from './classes/guerreiro.js';
import { char, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { carregarDadosEquipSheet } from './inventario.js';

export async function abrirModalMaestrias() {
  // Classes que possuem Maestria em Arma
  const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
  if (!classesMaestria.includes(char.classe)) return;

  // Obter quantidade máxima de maestrias conforme a classe
  let maestriasMax = 2; // Valor fixo para Guardião, Paladino e Ladino
  if (char.classe === 'Bárbaro') {
    const prog = getProgressaoBarbaro();
    maestriasMax = prog?.maestriasMax || 2;
  } else if (char.classe === 'Guerreiro') {
    const prog = getProgressaoGuerreiro();
    maestriasMax = prog?.maestriasMax || 3;
  }

  const dados = await carregarDadosEquipSheet();
  // Filtrar armas conforme regras de proficiência por classe
  const todasArmas = dados?.armas || [];
  const armas = todasArmas
    .filter(a => {
      const cat = (a.categoria || '').toLowerCase();
      const ehSimples = cat.includes('simples');
      const ehMarcial = cat.includes('marciais');
      if (!ehSimples && !ehMarcial) return false;

      // Bárbaro: apenas Corpo a Corpo (Simples ou Marcial)
      if (char.classe === 'Bárbaro') {
        return cat.includes('corpo a corpo');
      }
      // Ladino: Simples + Marciais com propriedade Acuidade
      if (char.classe === 'Ladino') {
        if (ehSimples) return true;
        const props = (a.propriedades || []).map(p => p.toLowerCase());
        return props.some(p => p.includes('acuidade'));
      }
      // Guerreiro, Guardião, Paladino: todas Simples e Marciais
      return true;
    })
    .map(a => a.nome)
    .sort((a, b) => a.localeCompare(b));

  const selecionadas = new Set(char.maestrias_arma || []);

  const renderLista = (filtro = '') => {
    const termo = semAcento(filtro || '');
    const visiveis = termo.length >= 2
      ? armas.filter(n => semAcento(n).includes(termo))
      : armas;

    return `
      <div style="font-size:0.85rem;margin-bottom:8px">
        Selecionadas: <strong id="maestria-count">${selecionadas.size}</strong> / ${maestriasMax}
      </div>
      <div style="max-height:45vh;overflow:auto;border:1px solid var(--border-light);border-radius:8px;padding:8px" id="maestria-lista">
        ${visiveis.map(nome => {
          const marcada = selecionadas.has(nome);
          return `
            <label class="form-check" style="justify-content:flex-start;margin:0 0 6px 0;opacity:${!marcada && selecionadas.size >= maestriasMax ? 0.5 : 1}">
              <input type="checkbox" data-maestria-nome="${nome}" ${marcada ? 'checked' : ''}>
              ${nome}
            </label>
          `;
        }).join('')}
      </div>
    `;
  };

  abrirModal(`Maestrias em Arma (${escHtml(char.classe)})`, `
    <div class="search-box"><input type="text" id="maestria-busca" class="form-input" placeholder="Buscar arma..."></div>
    <div id="maestria-conteudo">${renderLista('')}</div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
      Regra: você conhece ${maestriasMax} maestria(s) neste nível.
    </div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-maestrias">Salvar</button>');

  const bindLista = () => {
    document.querySelectorAll('[data-maestria-nome]').forEach(cb => {
      cb.addEventListener('change', () => {
        const nome = cb.dataset.maestriaNome;
        if (cb.checked) {
          if (selecionadas.size >= maestriasMax) {
            cb.checked = false;
            toast(`Você só pode selecionar ${maestriasMax} maestria(s).`, 'error');
            return;
          }
          selecionadas.add(nome);
        } else {
          selecionadas.delete(nome);
        }
        const count = document.getElementById('maestria-count');
        if (count) count.textContent = String(selecionadas.size);
      });
    });
  };

  bindLista();

  document.getElementById('maestria-busca')?.addEventListener('input', (e) => {
    const termo = e.target.value || '';
    const conteudo = document.getElementById('maestria-conteudo');
    if (!conteudo) return;
    conteudo.innerHTML = renderLista(termo);
    bindLista();
  });

  document.getElementById('btn-salvar-maestrias')?.addEventListener('click', () => {
    char.maestrias_arma = [...selecionadas].sort((a, b) => a.localeCompare(b));
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

// Modal de troca de maestria no descanso longo
// Bárbaro/Guerreiro: troca apenas UMA arma por descanso longo
// Guardião/Paladino/Ladino: pode trocar TODAS as armas
export async function abrirModalTrocaMaestriaDescanso(callbackPosTroca = null) {
  const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
  if (!classesMaestria.includes(char.classe)) return;

  // Guardião, Paladino e Ladino podem trocar todas as escolhas
  if (['Guardião', 'Paladino', 'Ladino'].includes(char.classe)) {
    await abrirModalMaestrias();
    if (callbackPosTroca) callbackPosTroca();
    return;
  }

  // Bárbaro e Guerreiro: trocar apenas UMA arma
  let maestriasMax = 2;
  if (char.classe === 'Bárbaro') {
    const prog = getProgressaoBarbaro();
    maestriasMax = prog?.maestriasMax || 2;
  } else if (char.classe === 'Guerreiro') {
    const prog = getProgressaoGuerreiro();
    maestriasMax = prog?.maestriasMax || 3;
  }

  const atuais = char.maestrias_arma || [];
  if (atuais.length === 0) {
    // Sem maestrias definidas, abrir modal completo
    await abrirModalMaestrias();
    return;
  }

  const dados = await carregarDadosEquipSheet();
  const todasArmas = dados?.armas || [];
  // Filtrar armas disponiveis conforme classe
  const armasDisponiveis = todasArmas
    .filter(a => {
      const cat = (a.categoria || '').toLowerCase();
      const ehSimples = cat.includes('simples');
      const ehMarcial = cat.includes('marciais');
      if (!ehSimples && !ehMarcial) return false;
      if (char.classe === 'Bárbaro') return cat.includes('corpo a corpo');
      return true;
    })
    .map(a => a.nome)
    .filter(n => !atuais.includes(n))
    .sort((a, b) => a.localeCompare(b));

  let armaTrocar = '';
  let armaSubstituta = '';

  const renderConteudo = () => {
    return `
      <p style="font-size:0.85rem;margin-bottom:12px">
        Como ${escHtml(char.classe)}, você pode trocar <strong>uma</strong> escolha de maestria por Descanso Longo.
      </p>
      <div style="margin-bottom:12px">
        <label class="form-label" style="font-size:0.85rem">Qual arma deseja remover?</label>
        <select id="maestria-remover" class="form-input" style="font-size:0.85rem">
          <option value="">-- Selecionar --</option>
          ${atuais.map(n => `<option value="${n}" ${armaTrocar === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.85rem">Qual arma adicionar no lugar?</label>
        <input type="text" id="maestria-filtro-nova" class="form-input" placeholder="Buscar arma..." style="font-size:0.85rem;margin-bottom:6px">
        <div style="max-height:30vh;overflow:auto;border:1px solid var(--border-light);border-radius:8px;padding:8px" id="maestria-nova-lista">
          ${armasDisponiveis.map(n => `
            <label class="form-check" style="justify-content:flex-start;margin:0 0 4px 0">
              <input type="radio" name="maestria-nova" value="${n}" ${armaSubstituta === n ? 'checked' : ''}>
              ${n}
            </label>
          `).join('')}
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
        Maestrias atuais: ${atuais.join(', ')}
      </div>
    `;
  };

  abrirModal(`Trocar Maestria (${escHtml(char.classe)})`, renderConteudo(),
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-troca-maestria">Trocar</button>'
  );

  // Filtrar lista ao digitar
  document.getElementById('maestria-filtro-nova')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value || '');
    const lista = document.getElementById('maestria-nova-lista');
    if (!lista) return;
    const filtradas = termo.length >= 2
      ? armasDisponiveis.filter(n => semAcento(n).includes(termo))
      : armasDisponiveis;
    lista.innerHTML = filtradas.map(n => `
      <label class="form-check" style="justify-content:flex-start;margin:0 0 4px 0">
        <input type="radio" name="maestria-nova" value="${n}" ${armaSubstituta === n ? 'checked' : ''}>
        ${n}
      </label>
    `).join('');
  });

  document.getElementById('btn-confirmar-troca-maestria')?.addEventListener('click', () => {
    const remover = document.getElementById('maestria-remover')?.value;
    const nova = document.querySelector('input[name="maestria-nova"]:checked')?.value;

    if (!remover || !nova) {
      toast('Selecione a arma a remover e a arma substituta.', 'error');
      return;
    }

    const novaLista = atuais.filter(n => n !== remover);
    novaLista.push(nova);
    char.maestrias_arma = novaLista.sort((a, b) => a.localeCompare(b));
    salvar();
    window.fecharModal();
    toast(`Maestria trocada: ${remover} → ${nova}`, 'success');
    renderFichaCompleta();
    // Encadear próxima ação (ex.: troca de magias após maestria)
    if (callbackPosTroca) callbackPosTroca();
  });
}