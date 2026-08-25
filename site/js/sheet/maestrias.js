// ============================================================
// Modais de maestria em arma
//
// Compartilhados por Barbaro, Guerreiro e Guardiao.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { abrirModal, escHtml, semAcento, toast } from '../utils.js';
import { armasElegiveisMaestria } from '../regras-equipamento.js';
import { deArmas } from '../opcoes-dominio.js';
import { montarTroca } from '../ui-opcoes.js';
import { temClasse } from '../regras-multiclasse.js';
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

// As cinco classes que concedem Maestria em Arma. Exportada porque o gate do
// Descanso Longo (hp-descanso.js) precisa da MESMA lista: ele mantinha uma
// cópia própria e a comparava com `char.classe`, o espelho da classe INICIAL
// -- num Mago 5/Guerreiro 5 a opção de troca sumia da tela.
export const CLASSES_MAESTRIA = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];

// Das cinco, as três que deixam refazer TODAS as escolhas num Descanso Longo.
// Bárbaro e Guerreiro trocam apenas UMA.
const CLASSES_TROCA_TOTAL = ['Guardião', 'Paladino', 'Ladino'];

/**
 * As classes DESTE personagem que concedem Maestria em Arma, na ordem da
 * lista canônica. Substitui `classesMaestria.includes(char.classe)`, que só
 * enxergava a classe INICIAL.
 * @param {object} [p] Personagem; por padrão o da ficha aberta.
 * @returns {string[]} nomes das classes que concedem (vazio se nenhuma).
 */
export function classesComMaestria(p = char) {
  return CLASSES_MAESTRIA.filter((nome) => temClasse(p, nome));
}

/**
 * True se o personagem pode refazer TODAS as escolhas de maestria no Descanso
 * Longo. Num multiclasse basta UMA classe conceder essa liberdade: o
 * personagem tem a característica dela de verdade, e o app guarda todas as
 * maestrias num único array compartilhado (`char.maestrias_arma`).
 * @param {object} [p] Personagem; por padrão o da ficha aberta.
 * @returns {boolean}
 */
export function trocaTodasNoDescanso(p = char) {
  return classesComMaestria(p).some((nome) => CLASSES_TROCA_TOTAL.includes(nome));
}

/**
 * Quantas maestrias UMA classe concede no nível que o personagem tem NELA.
 * Bárbaro e Guerreiro leem a tabela da própria classe (getProgressao*, que já
 * usa `nivelNa()` desde o sub-projeto 3b); as outras três são fixas em 2.
 * @param {string} nome Nome da classe.
 * @returns {number} 0 se o personagem não tem a classe.
 */
function maestriasDaClasse(nome) {
  if (!temClasse(char, nome)) return 0;
  if (nome === 'Bárbaro') return getProgressaoBarbaro()?.maestriasMax || 2;
  if (nome === 'Guerreiro') return getProgressaoGuerreiro()?.maestriasMax || 3;
  return 2;
}

/**
 * O teto ÚNICO de maestrias em arma do personagem.
 *
 * DECISÃO DE PRODUTO de 2026-08-22 (docs/PERGUNTAS-PENDENTES.txt, PERGUNTA 2):
 * o MAIOR limite entre as classes que concedem, NÃO a soma -- um Bárbaro 4
 * (3 maestrias) / Guerreiro 3 (3) fica com 3, não 6. É o tratamento que o
 * livro dá a Ataque Extra (livro:2059-2063, "as características não se
 * acumulam"), a única característica análoga que o capítulo 2 de fato
 * arbitra; Maestria em Arma ele não arbitra.
 *
 * Antes disto não havia UM teto: havia CINCO, um por card de classe, e o
 * imposto de verdade era o do ÚLTIMO botão clicado.
 *
 * O bônus do talento Mestre das Armas entra UMA vez, no fim: ele concede uma
 * vaga adicional ao PERSONAGEM, não uma por classe. Personagem sem nenhuma
 * classe de maestria fica com 0 -- nenhum dos cinco cards existe na ficha
 * dele e o modal nem abre, então o bônus não teria onde ser gasto.
 *
 * Lê o `char` da ficha aberta, como as getProgressao* de que depende.
 * @returns {number} teto de maestrias do personagem inteiro.
 */
export function tetoMaestrias() {
  let teto = 0;
  for (const nome of CLASSES_MAESTRIA) {
    const desta = maestriasDaClasse(nome);
    if (desta > teto) teto = desta;
  }
  return teto > 0 ? teto + bonusMaestriaTalento() : 0;
}

/**
 * Abre o modal de escolha de maestrias em arma.
 *
 * O parâmetro `classe` existe por causa do multiclasse: um Bárbaro/Guerreiro
 * renderiza DOIS botões "Definir Maestrias", e cada um tem de anunciar a SUA
 * classe no título. O TETO, porém, deixou de sair daqui: desde a decisão de
 * 2026-08-22 ele é do PERSONAGEM INTEIRO (`tetoMaestrias`), o maior limite
 * entre as classes que concedem. Antes, cada botão impunha o teto da sua
 * classe e o que valia era o do ÚLTIMO clicado.
 *
 * O default preserva o comportamento de quem chama sem argumento (ficha de
 * classe única); o Descanso Longo passou a informar a classe explicitamente,
 * porque o espelho `char.classe` de um Mago 5/Guerreiro 5 não concede
 * maestria nenhuma e o modal voltava sem abrir.
 *
 * @param {string} [classe] Classe dona do botão clicado -- só rotula o modal.
 */
export async function abrirModalMaestrias(classe = char.classe) {
  // Só as cinco classes que concedem Maestria em Arma abrem este modal.
  if (!CLASSES_MAESTRIA.includes(classe)) return;

  // O teto é do PERSONAGEM, não do botão clicado.
  const maestriasMax = tetoMaestrias();

  const dados = await carregarDadosEquipSheet();
  // A regra de quais armas podem receber maestria mora em
  // regras-equipamento.js, junto da proficiência de que ela depende (o
  // livro amarra as duas). A cópia que existia aqui lia
  // `arma.propriedades` como lista -- o dado é string, e o modal do Ladino
  // quebrava com TypeError antes de abrir.
  const armas = armasElegiveisMaestria(char, dados?.armas || [])
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

  abrirModal(`Maestrias em Arma (${escHtml(classe)})`, `
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
  // As classes DESTE personagem que concedem maestria -- não o espelho
  // `char.classe`, que num Mago 5/Guerreiro 5 vale 'Mago' e fazia esta função
  // voltar sem abrir nada.
  const comMaestria = classesComMaestria(char);
  if (!comMaestria.length) return;
  const rotuloClasses = comMaestria.join('/');

  // Guardião, Paladino e Ladino podem trocar todas as escolhas -- num
  // multiclasse basta UMA delas para o personagem ter essa liberdade.
  // `comMaestria[0]` em vez de nenhum argumento: sem ele o modal completo
  // cairia de novo no espelho `char.classe` e não abriria.
  if (trocaTodasNoDescanso(char)) {
    await abrirModalMaestrias(comMaestria[0]);
    if (callbackPosTroca) callbackPosTroca();
    return;
  }

  // Bárbaro e Guerreiro: trocar apenas UMA arma. O teto não entra aqui -- a
  // troca é 1-por-1 e não altera a quantidade total.
  const atuais = char.maestrias_arma || [];
  if (atuais.length === 0) {
    // Sem maestrias definidas, abrir modal completo
    await abrirModalMaestrias(comMaestria[0]);
    return;
  }

  const dados = await carregarDadosEquipSheet();
  const todasArmas = dados?.armas || [];
  // Filtrar armas disponiveis conforme classe -- mantém os objetos completos
  // (nao só o nome): deArmas precisa de dano/propriedades/maestria de cada uma.
  const armasDisponiveis = armasElegiveisMaestria(char, todasArmas)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  let armaTrocar = '';
  let armaSubstituta = '';

  // Troca de maestria: as duas pontas são armas, e o que decide a escolha
  // (dano, propriedades, qual maestria a arma concede) só existia no JSON.
  const renderConteudo = () => `
    <p style="font-size:0.85rem;margin-bottom:12px">
      Como ${escHtml(rotuloClasses)}, você pode trocar <strong>uma</strong> escolha de maestria por Descanso Longo.
    </p>
    <div id="maestria-troca"></div>
  `;

  abrirModal(`Trocar Maestria (${escHtml(rotuloClasses)})`, renderConteudo(),
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