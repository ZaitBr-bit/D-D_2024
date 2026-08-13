// ============================================================
// Modais de maestria em arma
//
// Compartilhados por Barbaro, Guerreiro e Guardiao.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { abrirModal, escHtml, semAcento, toast } from '../utils.js';
import { deArmas } from '../opcoes-dominio.js';
import { montarTroca } from '../ui-opcoes.js';
import { getProgressaoBarbaro } from './classes/barbaro.js';
import { getProgressaoGuerreiro } from './classes/guerreiro.js';
import { char, passivosTalentosCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { carregarDadosEquipSheet } from './inventario.js';

// Talentos.md §Mestre das Armas: "Propriedade de Maestria" concede uma vaga
// de maestria em arma ADICIONAL às que a classe já dá — não uma lista
// paralela. resolverPassivosTalentos() (talentos-effects.js) já calcula a
// flag mestre_armas_maestria_extra sempre que o personagem tem o talento;
// aqui é o único lugar que a consome, somando +1 ao limite normal da
// classe para quem já usa este sistema de maestrias.
function bonusMaestriaTalento() {
  return passivosTalentosCache?.flags?.mestre_armas_maestria_extra ? 1 : 0;
}

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
  maestriasMax += bonusMaestriaTalento();

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
  maestriasMax += bonusMaestriaTalento();

  const atuais = char.maestrias_arma || [];
  if (atuais.length === 0) {
    // Sem maestrias definidas, abrir modal completo
    await abrirModalMaestrias();
    return;
  }

  const dados = await carregarDadosEquipSheet();
  const todasArmas = dados?.armas || [];
  // Filtrar armas disponiveis conforme classe -- mantém os objetos completos
  // (nao só o nome): deArmas precisa de dano/propriedades/maestria de cada uma.
  const armasDisponiveis = todasArmas
    .filter(a => {
      const cat = (a.categoria || '').toLowerCase();
      const ehSimples = cat.includes('simples');
      const ehMarcial = cat.includes('marciais');
      if (!ehSimples && !ehMarcial) return false;
      if (char.classe === 'Bárbaro') return cat.includes('corpo a corpo');
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  let armaTrocar = '';
  let armaSubstituta = '';

  // Troca de maestria: as duas pontas são armas, e o que decide a escolha
  // (dano, propriedades, qual maestria a arma concede) só existia no JSON.
  const renderConteudo = () => `
    <p style="font-size:0.85rem;margin-bottom:12px">
      Como ${escHtml(char.classe)}, você pode trocar <strong>uma</strong> escolha de maestria por Descanso Longo.
    </p>
    <div id="maestria-troca"></div>
  `;

  abrirModal(`Trocar Maestria (${escHtml(char.classe)})`, renderConteudo(),
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>'
    + '<button class="btn btn-primary" id="btn-confirmar-troca-maestria">Trocar</button>');

  const descricoesMaestria = new Map(
    (dados.propriedadesArmas || []).map(p => [p.nome, p.descricao]));
  montarTroca(document.getElementById('maestria-troca'), {
    sai: {
      rotulo: 'Qual arma deseja remover?',
      opcoes: deArmas(todasArmas.filter(a => atuais.includes(a.nome)), { descricoesMaestria }),
    },
    entra: {
      rotulo: 'Qual arma adicionar no lugar?',
      busca: true,
      opcoes: deArmas(armasDisponiveis, { jaTem: new Set(atuais), descricoesMaestria }),
    },
    aoMudar: ({ sai, entra }) => { armaTrocar = sai; armaSubstituta = entra; },
  });

  document.getElementById('btn-confirmar-troca-maestria')?.addEventListener('click', () => {
    if (!armaTrocar || !armaSubstituta) {
      toast('Selecione a arma a remover e a arma substituta.', 'error');
      return;
    }

    const novaLista = atuais.filter(n => n !== armaTrocar);
    novaLista.push(armaSubstituta);
    char.maestrias_arma = novaLista.sort((a, b) => a.localeCompare(b));
    salvar();
    window.fecharModal();
    toast(`Maestria trocada: ${armaTrocar} → ${armaSubstituta}`, 'success');
    renderFichaCompleta();
    // Encadear próxima ação (ex.: troca de magias após maestria)
    if (callbackPosTroca) callbackPosTroca();
  });
}