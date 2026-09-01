// ============================================================
// Magias: secao, espacos, concentracao, metamagia e efeitos
//
// Tambem cobre as magias personalizadas do jogador.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTO_NOME_PARA_KEY, CLASSES_INFO } from '../dados-classes.js';
import { getMagiasClasse, getMagiasPorCirculo } from '../db.js';
import { abrirModal, bonusProficiencia, calcMod, escHtml, getBonusTruquesOrdem, getLimitesMagias, getMagiaPreparadas, mdParaHtml, semAcento, toast } from '../utils.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { renderSecaoPactoBruxo } from './classes/bruxo.js';
import { gastarPontosFeiticaria, getEstadoRecursosFeiticeiro } from './classes/feiticeiro.js';
import { getCavaleiroMisticoConjuracao } from './classes/guerreiro.js';
import { getTrapaceiroArcanoConjuracao } from './classes/ladino.js';
import { _truquesColapsados } from './colapso.js';
import { ehBardoComSegredosMagicos, getTruquesExtraEstiloLuta } from './combate.js';
import { char, classesData, indiceMagiasCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirPreenchimentoSlotMagia, mostrarBuscaGrimorio, mostrarBuscaMagia, mostrarFormMagiaCustom } from './grimorio.js';
// superficiesDaFicha/dadosDe (Tarefa 3, sub-projeto "tela magias por
// classe"): substituem a leitura de char.classe/char.subclasse/char.nivel
// (a classe INICIAL, o espelho) e de `classeData` (os dados dela) por
// classes[] de verdade -- ver o comentário de superficieAtiva(), abaixo.
// definirSuperficieSelecionada/superficieAtivaDaFicha (Tarefa 4): o
// seletor de classe (`tabs-superficie-magia`, em renderSecaoMagias) e o
// estado compartilhado que ele escreve.
import { dadosDe, definirSuperficieSelecionada, superficiesDaFicha, superficieAtivaDaFicha } from './contexto-classe.js';
import { nivelNa, temClasse } from '../regras-multiclasse.js';
// reservasDeEspacos/gastarEspaco/recuperarUmEspaco (Tarefa 4, sub-projeto 4):
// os pontos deste arquivo que liam/escreviam `char.espacos_magia[circulo]`
// direto, na forma antiga, passam a ler/escrever pelo acessador derivado e
// pelos escritores autorizados de sheet/reservas-espacos.js -- ver o
// comentario de `espacos` (mais abaixo) para a limitacao conhecida da
// leitura combinada por CIRCULO (sem distinguir fonte).
import { gastarEspaco, recuperarUmEspaco, reservasDeEspacos } from './reservas-espacos.js';
import { abrirModalAdicionarTalento, abrirModalEditarIniciadoEmMagia } from './talentos.js';
// preparadasPorClasse (Tarefa 4 do sub-projeto "magia sabe a classe"):
// fonte única dos três baldes desta/deOutra/semClasse -- ver o comentário
// de renderSecaoMagias, abaixo, para o "contador honesto" que esta função
// substitui.
import { preparadasPorClasse, truquesPorClasse } from '../regras-magia-classe.js';

// `magiaContaNoLimite` e `magiaEhEspecial` moram em regras-origens-magia.js,
// a fonte única das origens que o jogador não escolheu. Reexportados aqui
// porque vários módulos da ficha os importam deste arquivo desde antes da
// consolidação -- reexportar é mais barato e menos arriscado que reescrever
// os importadores, e não recria a cópia que a consolidação foi eliminar.
import { magiaContaNoLimite, magiaEhEspecial, truqueContaNoLimite } from '../regras-origens-magia.js';
export { magiaContaNoLimite, magiaEhEspecial, truqueContaNoLimite };

/**
 * Superfície de conjuração ATIVA desta seção da ficha: mesma definição (e
 * mesmo motivo) do `superficieAtiva()` de sheet/grimorio.js -- a escolhida
 * no seletor de classe (`superficieAtivaDaFicha`, sheet/contexto-classe.js),
 * que por padrão é a PRIMEIRA de `superficiesDaFicha(char)`, a classe
 * inicial quando ela conjura, a única em personagem de classe única. `null`
 * quando o personagem não tem NENHUMA superfície de conjuração por classe
 * (ex.: Bárbaro puro com Iniciado em Magia -- a seção Magias ainda abre
 * para ele, por talento/espécie/personalizada, mas não há classe nenhuma
 * de onde pedir lista/limite).
 *
 * `renderSecaoMagias` e as demais funções deste arquivo que precisam saber
 * "de que classe" chamam isto UMA VEZ, no topo, e derivam tudo dali --
 * nunca de char.classe/char.subclasse/char.nivel direto. Mesma disciplina
 * de sheet/grimorio.js -- é o que tornou a Tarefa 4 (seletor de classe)
 * uma mudança de UMA variável em vez de reescrever cada função.
 */
function superficieAtiva() {
  return superficieAtivaDaFicha(char);
}

/**
 * Tabela de conjuração da subclasse (Cavaleiro Místico / Trapaceiro
 * Arcano) para a superfície informada, ou `null` quando ela não se aplica
 * (classe plena/meia conjuradora, ou sem superfície nenhuma). Mesma lógica
 * de sheet/grimorio.js -- duplicada aqui de propósito: função pura de 3
 * linhas, e importar do outro módulo criaria acoplamento sem ganho (ela
 * não é exportada de lá).
 */
function subConjDaSuperficie(sup) {
  if (!sup) return null;
  return getSubclasseConjuradoraConjuracao({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse });
}

/**
 * Nível e tabela de características do Mago do personagem -- SEMPRE da
 * classe Mago, nunca da superfície "ativa" (`superficieAtiva()`) que o
 * resto desta seção usa para os contadores do topo. O grimório é exclusivo
 * do Mago (livro:2079), independente de qual classe é a inicial ou a
 * "ativa" por ordem de aquisição: um Clérigo 5/Mago 1 tem de ver o limite
 * de preparo DO MAGO no painel do grimório, mesmo com os contadores do
 * topo desta mesma seção mostrando o do Clérigo (a superfície ativa).
 * @returns {{nivel: number, tabela: object|null}}
 */
function nivelETabelaDoMago() {
  return { nivel: nivelNa(char, 'Mago'), tabela: dadosDe('Mago')?.tabela_caracteristicas || null };
}

/**
 * Escolhe a reserva de UM circulo entre as fontes disponiveis (conjuracao e
 * pacto), com a MESMA prioridade em toda parte deste arquivo que consulta
 * "a reserva deste circulo" sem already saber a fonte: conjuracao vence a
 * colisao (mesma direcao do docblock de migrarEspacosDeMagia -- gasto de
 * pacto nunca "rouba" o lugar de conjuracao). Usada tanto para RENDERIZAR
 * (a variavel `espacos` de renderSecaoMagias) quanto para GASTAR (o botao
 * "Conjurar" de magia preparada e a magia personalizada) -- as duas nunca
 * podem divergir sobre qual fonte um numero de circulo resolve, ou o botao
 * debitaria uma reserva diferente da que a tela mostrou.
 *
 * Devolve null quando o circulo nao existe em NENHUMA fonte -- nao {} nem
 * um objeto com total 0 -- pelo mesmo motivo do contrato de
 * espacosPorCirculo (regras-multiclasse-conjuracao.js): "ausente" e
 * "esgotado" sao coisas diferentes, e confundi-las aqui faria o botao
 * "Conjurar" achar que uma reserva existe (com 0 disponiveis) quando na
 * verdade o circulo pedido nao e servido por fonte nenhuma.
 * @param {number|string} circulo
 * @returns {{fonte:'conjuracao'|'pacto', circulo:number, total:number, usados:number, disponiveis:number}|null}
 */
function reservaDoCirculo(circulo) {
  const candidatas = reservasDeEspacos().filter(r => r.circulo === Number(circulo));
  return candidatas.find(r => r.fonte === 'conjuracao') || candidatas.find(r => r.fonte === 'pacto') || null;
}

export function rotuloOrigemMagia(magia) {
  if (magia?.origem === 'dominio') return 'Domínio';
  if (magia?.origem === 'sempre') return 'Sempre Preparada';
  if (magia?.origem === 'especie_legado') return 'Sempre Preparada';
  if (magia?.origem === 'iniciado_em_magia') return 'Iniciado em Magia';
  if (magia?.origem === 'tocado_por_fadas') return 'Tocado Por Fadas';
  if (magia?.origem === 'tocado_pelas_sombras') return 'Tocado Pelas Sombras';
  if (magia?.origem === 'conjurador_ritualista') return 'Conjurador Ritualista';
  if (magia?.origem === 'subclasse_fixa') return 'Subclasse';
  // Descobertas Mágicas (Colégio do Conhecimento nv6): sem este rótulo o
  // cartão do truque/magia escolhido saía com a linha de origem em branco --
  // e essa origem só passou a existir na ficha quando a escolha passou a ser
  // possível (issue #44).
  if (magia?.origem === 'subclasse_escolha') return 'Subclasse';
  if (magia?.origem === 'maestria_magias') return 'Maestria de Magias';
  if (magia?.origem === 'assinatura_magica') return 'Assinatura Mágica';
  return '';
}

// Mantém registros antigos de magias personalizadas compatíveis com a mesma
// visão usada pela lista de magias, sem alterar os dados persistidos da ficha.
export function normalizarMagiaPersonalizada(m, indice) {
  const magia = m && typeof m === 'object' ? m : {};
  return {
    ...magia,
    nome: String(magia.nome || ''),
    circulo: Number(magia.circulo) || 0,
    escola: String(magia.escola || ''),
    tempo_conjuracao: String(magia.tempo_conjuracao || ''),
    alcance: String(magia.alcance || ''),
    componentes: String(magia.componentes || ''),
    duracao: String(magia.duracao || ''),
    descricao: String(magia.descricao || ''),
    dano: String(magia.dano || ''),
    ritual: Boolean(magia.ritual),
    personalizada: true,
    origem: 'Personalizada'
  };
}

function renderDetalhesMagiaPersonalizada(magia) {
  const meta = [magia.escola, magia.tempo_conjuracao, magia.alcance, magia.componentes, magia.duracao]
    .filter(Boolean)
    .map(escHtml)
    .join(' | ');
  const dano = magia.dano ? `<div style="margin-top:6px"><strong>Dano / efeito:</strong> ${mdParaHtml(magia.dano)}</div>` : '';
  return `
    ${meta ? `<div class="magia-meta" style="margin-bottom:4px">${meta}</div>` : ''}
    ${magia.descricao ? `<div class="md-content">${mdParaHtml(magia.descricao)}</div>` : ''}
    ${dano}
  `;
}

function renderLinhaMagiaPersonalizada(magia, indice, opts = {}) {
  const { naoPreparada = false } = opts;
  const tags = [];
  if (magia.escola) tags.push(`<span class="magia-tag tag-escola">${escHtml(magia.escola)}</span>`);
  if (magia.tempo_conjuracao) {
    const tempo = String(magia.tempo_conjuracao);
    const tempoNormalizado = tempo.toLowerCase();
    const classeTempo = tempoNormalizado === 'ação' || tempoNormalizado === 'acao'
      ? 'tag-acao'
      : tempoNormalizado.includes('ação bônus') || tempoNormalizado.includes('acao bonus')
        ? 'tag-acao-bonus'
        : tempoNormalizado.includes('reação') || tempoNormalizado.includes('reacao') ? 'tag-reacao' : 'tag-tempo';
    const rotuloTempo = classeTempo === 'tag-acao' ? 'Ação'
      : classeTempo === 'tag-acao-bonus' ? 'Ação Bônus'
        : classeTempo === 'tag-reacao' ? 'Reação' : tempo;
    tags.push(`<span class="magia-tag ${classeTempo}">${escHtml(rotuloTempo)}</span>`);
  }
  if (magia.duracao) {
    const duracao = String(magia.duracao);
    const duracaoNormalizada = duracao.toLowerCase();
    if (duracaoNormalizada.includes('concentra')) tags.push('<span class="magia-tag tag-conc">Conc.</span>');
    else if (duracaoNormalizada.includes('instant')) tags.push('<span class="magia-tag tag-inst">Inst.</span>');
    else tags.push(`<span class="magia-tag tag-dur">${escHtml(duracao.replace(/^até\s+/i, ''))}</span>`);
  }
  if (magia.alcance) {
    const alcance = String(magia.alcance);
    const alcanceNormalizado = alcance.toLowerCase();
    const rotuloAlcance = alcanceNormalizado === 'pessoal' ? 'Pessoal' : alcanceNormalizado === 'toque' ? 'Toque' : alcance;
    tags.push(`<span class="magia-tag tag-alcance">${escHtml(rotuloAlcance)}</span>`);
  }
  const ritual = magia.ritual
    ? ' <span class="badge" style="font-size:0.6rem;background:var(--secondary);color:#fff">Ritual</span>'
    : '';
  // Magia personalizada consulta TODAS as fontes -- achado da revisao do
  // controlador: fixar 'conjuracao' fazia a magia personalizada SUMIR para
  // um Bruxo de classe unica (cuja reserva inteira e Magia de Pacto), que e
  // funcionalidade PERDIDA para classe unica, nao limitacao declaravel.
  // reservaDoCirculo (acima) resolve, por circulo, a MESMA fonte que
  // conjurarMagiaPersonalizada vai gastar (conjuracao vence a colisao) --
  // a tela e o gasto nunca divergem sobre qual reserva um circulo resolve.
  const todasReservasCandidatas = reservasDeEspacos();
  const circulosCandidatos = [...new Set(todasReservasCandidatas
    .filter(r => r.circulo >= magia.circulo)
    .map(r => r.circulo))].sort((a, b) => a - b);
  const reservasDisponiveis = circulosCandidatos.map(c => reservaDoCirculo(c)).filter(Boolean);
  const circulosDisponiveis = reservasDisponiveis.map(r => r.circulo);
  const temUpcast = magia.circulo > 0 && circulosDisponiveis.length > 1;
  // "esgotado" olha TODAS as fontes de cada circulo candidato, nao so a
  // prioritaria (reservasDisponiveis, acima, resolve por precedencia e so
  // serve para montar a lista de upcast) -- achado da revisao de branch
  // (Important 3), mesmo raciocinio do docblock de `espacos` em
  // renderSecaoMagias: sem isto, o botao desabilitava assim que a fonte
  // prioritaria esgotava, mesmo com a outra fonte do MESMO circulo ainda
  // com espaco.
  const circulosComEspacoDisponivel = new Set(
    todasReservasCandidatas.filter(r => r.disponiveis > 0).map(r => r.circulo)
  );
  const todosEsgotados = magia.circulo > 0 && (
    circulosDisponiveis.length === 0
    || circulosDisponiveis.every(c => !circulosComEspacoDisponivel.has(c))
  );
  const controlesConjuracao = magia.circulo === 0
    ? `<button class="btn btn-sm btn-cantrip" data-lancar-magia-custom="${indice}">Lançar</button>`
    : naoPreparada
      ? `
        <span style="font-size:0.65rem;color:var(--text-muted);font-style:italic">Não preparada</span>
        ${magia.ritual ? `<button class="btn btn-sm btn-secondary" data-conjurar-ritual-custom="${indice}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>` : ''}
      `
      : `
      ${temUpcast ? `
        <select class="form-input" data-conj-select-custom="${indice}" style="width:auto;padding:2px 4px;font-size:0.75rem">
          ${circulosDisponiveis.map(circulo => `<option value="${circulo}"${circulo === magia.circulo ? ' selected' : ''}>${circulo}º</option>`).join('')}
        </select>
      ` : ''}
      <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}"
              data-conjurar-magia-custom="${indice}"
              data-conj-circ="${circulosDisponiveis[0] || magia.circulo}"
              ${todosEsgotados ? 'disabled' : ''}>Conjurar</button>
      ${magia.ritual ? `<button class="btn btn-sm btn-secondary" data-conjurar-ritual-custom="${indice}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>` : ''}
    `;
  return `
    <div class="magia-item magia-personalizada" data-magia-custom-index="${indice}" data-magia-circ="${magia.circulo}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="magia-nome">${escHtml(magia.nome)} <span class="badge badge-secondary" style="font-size:0.6rem">Personalizada</span>${ritual}</div>
          <div class="magia-meta"><span>${magia.circulo === 0 ? 'Truque' : `${magia.circulo}º Círculo`}</span></div>
          ${tags.length ? `<div class="magia-tags">${tags.join('')}</div>` : ''}
        </div>
        <div class="no-print" style="display:flex;align-items:center;gap:4px">
          ${controlesConjuracao}
          <button class="btn btn-sm btn-secondary btn-icon" data-editar-magia-custom="${indice}" title="Editar magia personalizada">&#9998;</button>
          <button class="btn btn-sm btn-danger btn-icon" data-remover-magia-custom="${indice}" title="Remover magia personalizada">&times;</button>
        </div>
      </div>
      <div class="magia-desc"></div>
    </div>`;
}

function magiaPersonalizadaEhConcentracao(magia) {
  return /concentra/i.test(String(magia?.duracao || ''));
}

function registrarConcentracaoMagiaPersonalizada(magia, circulo) {
  if (!magiaPersonalizadaEhConcentracao(magia)) return;
  if (!char.efeitos_magicos) char.efeitos_magicos = [];
  char.efeitos_magicos = char.efeitos_magicos.filter(efeito => !efeito.concentracao);
  char.efeitos_magicos.push({
    nome: magia.nome,
    tipo: 'concentracao_generica',
    concentracao: true,
    circulo: Number(circulo) || 0,
    rotulo: `Concentrando em ${magia.nome}`
  });
}

function conjurarMagiaPersonalizada(indice, circuloSelecionado, fonte) {
  const registro = (char?.magias_customizadas || [])[indice];
  if (!registro) return false;

  const magia = normalizarMagiaPersonalizada(registro, indice);
  const circuloBase = Number(magia.circulo);
  const circulo = Number(circuloSelecionado);
  if (circuloBase <= 0 || !Number.isInteger(circulo) || circulo < circuloBase) {
    toast('Círculo inválido para esta magia.', 'error');
    return false;
  }

  // A fonte vem por PARAMETRO desde o RULING do controlador que estendeu o
  // seletor "De qual reserva?" (Tarefa 7) para a magia personalizada: com
  // as DUAS fontes disponiveis neste circulo, quem chama ja perguntou ao
  // jogador (mostrarSeletorFonteMagia, abaixo) e passa a fonte ESCOLHIDA
  // aqui -- a mesma logica do botao "Conjurar" de magia preparada
  // (_executarConjuracao). O fallback (`reservaDoCirculo(circulo)?.fonte`,
  // a MESMA prioridade da leitura em renderLinhaMagiaPersonalizada) cobre
  // so o caso de UMA reserva so (nunca abre o seletor) e a folga de
  // concorrencia entre o clique e aqui -- se o circulo nao existir em fonte
  // nenhuma, o fallback tambem devolve undefined, `fonteAlvo` fica falsy e
  // o gasto falha com a mensagem de sempre, sem gastar da fonte errada.
  const fonteAlvo = fonte || reservaDoCirculo(circulo)?.fonte;
  if (!fonteAlvo || !gastarEspaco(char, fonteAlvo, circulo)) {
    toast(`Sem espaços de ${circulo}º círculo!`, 'error');
    return false;
  }

  registrarConcentracaoMagiaPersonalizada(magia, circulo);
  salvar();
  renderFichaCompleta();
  toast(`${magia.nome} conjurada${circulo > circuloBase ? ` no ${circulo}º círculo` : ''}!`, 'success');
  return true;
}

// Retorna a tabela de conjuração da subclasse ativa (Cavaleiro Místico ou
// Trapaceiro Arcano). `opcoes` ({ subclasse, nivel }) permite consultar uma
// combinação ainda não gravada em `char` -- a subida de nível precisa disso
// porque a subclasse é escolhida no MESMO nível em que a conjuração começa.
export function getSubclasseConjuradoraConjuracao(opcoes = {}) {
  return getCavaleiroMisticoConjuracao(opcoes) || getTrapaceiroArcanoConjuracao(opcoes);
}

// Verifica se a subclasse concede conjuração (ver `opcoes` acima)
export function ehSubclasseConjuradora(opcoes = {}) {
  return !!getSubclasseConjuradoraConjuracao(opcoes);
}

// Fonte 'conjuracao' fixa nas duas funcoes abaixo -- mesma limitacao
// conhecida de conjurarMagiaPersonalizada (acima): nenhum recurso que as
// chama hoje (Companheiro Selvagem / Ressurgimento Selvagem do Druida, em
// sheet/habilidades.js) e alcancavel por um Bruxo, entao a fonte fixa nao
// tira nada de ninguem na pratica.
export function consumirEspacoMagiaDisponivel(circuloMinimo = 1) {
  const alvo = reservasDeEspacos()
    .filter(r => r.fonte === 'conjuracao' && r.circulo >= circuloMinimo && r.disponiveis > 0)
    .sort((a, b) => a.circulo - b.circulo)[0];
  if (!alvo) return 0;
  return gastarEspaco(char, 'conjuracao', alvo.circulo) ? alvo.circulo : 0;
}

export function recuperarEspacoMagia(circulo = 1) {
  return recuperarUmEspaco(char, 'conjuracao', circulo);
}

// --- Magias ---

/**
 * Converte a estrutura aninhada do JSON de magias da classe
 * { lista_magias: { "Truques": [...], "1º Círculo": [...], ... } }
 * para uma lista plana [{ nome, circulo, escola, especial }, ...]
 */
export function achatarMagiasClasse(magiasClasseData) {
  const lista = magiasClasseData?.lista_magias || {};
  const resultado = [];
  for (const [chave, magias] of Object.entries(lista)) {
    let circulo = 0;
    if (chave === 'Truques') {
      circulo = 0;
    } else {
      const match = chave.match(/^(\d+)/);
      if (match) circulo = parseInt(match[1]);
    }
    (magias || []).forEach(m => {
      const obj = typeof m === 'string' ? { nome: m } : { ...m };
      // O círculo vem do ACERVO (dados/magias/), não do nome do grupo. O grupo
      // é dado derivado reguardado à mão, e divergiu: De Carne para Pedra é
      // magia de 6º círculo e estava listada no grupo "5º Círculo" do Druida,
      // o que a fazia aparecer como opção de 5º para um Druida de nível 9 --
      // dois níveis antes de o livro permitir. O grupo continua servindo de
      // fallback para magia que o acervo não tenha (dado em migração).
      const doAcervo = indiceMagiasCache?.find(x => x.nome === obj.nome);
      obj.circulo = typeof doAcervo?.circulo === 'number' ? doAcervo.circulo : circulo;
      resultado.push(obj);
    });
  }
  return resultado;
}

/**
 * Lista de magias que uma classe oferece ao personagem.
 *
 * @param {Object} opcoes
 * @param {string} [opcoes.classe] - Classe cuja lista se quer. Sem ela, a
 *   da SUPERFÍCIE de conjuração ATIVA (`superficieAtiva()`, acima -- a
 *   primeira de `superficiesDaFicha`, a classe inicial quando ela conjura).
 *   ATÉ A TAREFA 3 (sub-projeto "tela magias por classe") o fallback lia o
 *   espelho `char.classe` direto, e esta mesma seção da ficha
 *   (`renderSecaoMagias`) dependia desse fallback -- um Ladino 5/Mago 1
 *   pedia a lista de Ladino (`classes/magias_ladino.json`, que não existe:
 *   404) mesmo com a superfície de conjuração sendo a do Mago. Quem SOBE DE
 *   NÍVEL sempre passou a classe explicitamente
 *   (`carregarMagiasDisponiveis`, levelup-flow.js): num Mago 5 que entra em
 *   Clérigo 1, o nível já era lido na classe certa (`nivelNaClasseNovo`) mas a
 *   LISTA vinha do espelho -- o jogador escolhia magias de Mago numa tela
 *   rotulada "da lista de Clérigo", e elas eram gravadas no nível de Clérigo.
 * @param {string} [opcoes.subclasse] - Subclasse a considerar (Cavaleiro
 *   Místico / Trapaceiro Arcano usam a lista do Mago).
 * @param {number} [opcoes.nivel] - Nível NA CLASSE, para a checagem acima.
 */
export async function obterMagiasDisponiveisClasseAtual(opcoes = {}) {
  // Subclasses conjuradoras (Cavaleiro Místico e Trapaceiro Arcano) usam a lista de magias do Mago
  let classeParaMagias = opcoes.classe || superficieAtiva()?.classe;
  if (ehSubclasseConjuradora(opcoes)) {
    classeParaMagias = 'Mago';
  }
  const magiasClasseData = await getMagiasClasse(classeParaMagias);
  const base = achatarMagiasClasse(magiasClasseData);

  // Combatente Druídico: incluir truques de Druida
  const estiloLuta = char.escolhas_classe?.estilo_luta?.[0] || '';
  if (estiloLuta === 'Combatente Druídico') {
    const druidaData = await getMagiasClasse('Druida');
    const druidaTruques = achatarMagiasClasse(druidaData).filter(m => m.circulo === 0);
    const mapa = new Map();
    base.forEach(m => mapa.set(`${m.nome}|${m.circulo || 0}`, m));
    druidaTruques.forEach(m => { if (!mapa.has(`${m.nome}|0`)) mapa.set(`${m.nome}|0`, m); });
    // Retornar base + truques de druida, mantendo magias de circulo da base
    const resultado = [...mapa.values()];
    if (!ehBardoComSegredosMagicos()) return resultado;
  }

  // Combatente Abençoado: incluir truques de Clérigo
  if (estiloLuta === 'Combatente Abençoado') {
    const clerigoData = await getMagiasClasse('Clérigo');
    const clerigoTruques = achatarMagiasClasse(clerigoData).filter(m => m.circulo === 0);
    const mapa = new Map();
    base.forEach(m => mapa.set(`${m.nome}|${m.circulo || 0}`, m));
    clerigoTruques.forEach(m => { if (!mapa.has(`${m.nome}|0`)) mapa.set(`${m.nome}|0`, m); });
    const resultado = [...mapa.values()];
    if (!ehBardoComSegredosMagicos()) return resultado;
  }

  if (!ehBardoComSegredosMagicos()) return base;

  const extrasClasses = ['Clérigo', 'Druida', 'Mago'];
  const extras = [];
  for (const classe of extrasClasses) {
    const data = await getMagiasClasse(classe);
    extras.push(...achatarMagiasClasse(data));
  }

  const mapa = new Map();
  [...base, ...extras].forEach(m => {
    const chave = `${m.nome}|${m.circulo || 0}`;
    if (!mapa.has(chave)) mapa.set(chave, m);
  });

  return [...mapa.values()];
}

// Prioridade de ordenacao: Acao=0, Acao Bonus=1, Reacao=2, outros=3
function prioridadeConjuracao(nomeMagia) {
  const info = indiceMagiasCache?.find(m => m.nome === nomeMagia);
  if (!info?.tempo_conjuracao) return 3;
  const tc = info.tempo_conjuracao.toLowerCase();
  if (tc === 'ação' || tc === 'acao') return 0;
  if (tc.includes('ação bônus') || tc.includes('acao bonus')) return 1;
  if (tc.includes('reação') || tc.includes('reacao')) return 2;
  return 3;
}

// Retorna badges HTML compactos com metadados da magia (tipo, tempo, alcance, duração)
export function badgesMagiaRapidos(nomeMagia) {
  if (!indiceMagiasCache?.length) return '';
  const info = indiceMagiasCache.find(m => m.nome === nomeMagia);
  if (!info) return '';

  const badges = [];

  // Escola
  if (info.escola) {
    badges.push(`<span class="magia-tag tag-escola">${info.escola}</span>`);
  }

  // Tempo de conjuração - cores diferentes por tipo
  if (info.tempo_conjuracao) {
    const tc = info.tempo_conjuracao.toLowerCase();
    let label = info.tempo_conjuracao;
    let tagClass = 'tag-tempo';
    if (tc === 'ação' || tc === 'acao') { label = 'Ação'; tagClass = 'tag-acao'; }
    else if (tc.includes('ação bônus') || tc.includes('acao bonus')) { label = 'Ação Bônus'; tagClass = 'tag-acao-bonus'; }
    else if (tc.includes('reação') || tc.includes('reacao')) { label = 'Reação'; tagClass = 'tag-reacao'; }
    badges.push(`<span class="magia-tag ${tagClass}">${label}</span>`);
  }

  // Duração - concentração ou instantâneo
  if (info.duracao) {
    const dur = info.duracao.toLowerCase();
    if (dur.includes('concentra')) {
      badges.push(`<span class="magia-tag tag-conc">Conc.</span>`);
    } else if (dur.includes('instant')) {
      badges.push(`<span class="magia-tag tag-inst">Inst.</span>`);
    } else {
      badges.push(`<span class="magia-tag tag-dur">${info.duracao.replace('até ', '').replace('Até ', '')}</span>`);
    }
  }

  // Alcance
  if (info.alcance) {
    const alc = info.alcance.toLowerCase();
    let label = info.alcance;
    if (alc === 'pessoal') label = 'Pessoal';
    else if (alc === 'toque') label = 'Toque';
    badges.push(`<span class="magia-tag tag-alcance">${label}</span>`);
  }

  return `<div class="magia-tags">${badges.join('')}</div>`;
}

export function renderSecaoMagias() {
  // sup: a superfície de conjuração ATIVA desta seção -- ver
  // superficieAtiva() (topo do arquivo). Tarefa 3 (sub-projeto "tela
  // magias por classe"): substitui a leitura dos espelhos
  // char.classe/char.subclasse/char.nivel daqui para baixo. `null` quando
  // o personagem não tem NENHUMA superfície de conjuração (Bárbaro puro
  // com Iniciado em Magia, por exemplo) -- os `?.` abaixo degradam para o
  // mesmo "sem classe" de antes nesse caso.
  const sup = superficieAtiva();
  const superficies = superficiesDaFicha(char);
  const subConj = subConjDaSuperficie(sup);
  // Corrige o defeito registrado em docs/PERGUNTAS-PENDENTES.txt ("MAGIA
  // PREPARADA NAO SABE DE QUE CLASSE E" / "IRMAO DESTE ITEM"): antes, um
  // Bárbaro 5/Bardo 1 lia `CLASSES_INFO[char.classe].tipo_conjuracao` do
  // Bárbaro (nenhum) e caía em 'preparadas' por omissão -- errado para o
  // Bardo, que é 'conhecidas'. `sup.tipo` já vem calculado pela MESMA
  // fórmula, mas por `superficiesDeConjuracao`
  // (regras-multiclasse-conjuracao.js), com a classe da SUPERFÍCIE (aqui,
  // o Bardo, primeira que efetivamente conjura), não a INICIAL. `sup ? ... :
  // (subConj ? ...)` cobre só a subclasse conjuradora sem superfície de
  // classe (Cavaleiro Místico/Trapaceiro Arcano puro, hoje inalcançável
  // fora deste ramo -- mesma guarda que sheet/grimorio.js usa). Repartir
  // POR CLASSE a contagem de "quantas estão preparadas" -- que dependia de
  // `magias_preparadas[].classe`, inexistente quando este comentário foi
  // escrito -- é a Tarefa 4 do sub-projeto "magia sabe a classe"; ver o
  // comentário de `preparadasPorClasse` no contador de preparadas, abaixo,
  // para o que mudou e o que continua fora do alcance (o campo é opcional
  // e o estado misto é permanente, então a contagem por classe nunca fica
  // 100% certa em toda ficha).
  const tipoConj = sup ? sup.tipo : (subConj ? 'conhecidas' : 'preparadas');
  const magiasPersonalizadas = (char.magias_customizadas || []).map((magia, indice) => ({
    ...normalizarMagiaPersonalizada(magia, indice),
    indicePersonalizada: indice
  }));
  const truquesPersonalizados = magiasPersonalizadas.filter(m => m.circulo === 0);
  const todosTruques = [
    ...(char.magias_conhecidas || []).filter(m => m.circulo === 0),
    ...truquesPersonalizados
  ];
  const truquesEspecie = todosTruques.filter(m => m.origem === 'especie');
  // O que conta no limite de truques mora em regras-origens-magia.js, a
  // fonte única das origens que o jogador não escolheu. Aqui existia uma
  // lista literal de quatro origens que esquecia `telecinetico` e
  // `subclasse_automatica` -- o contador cobrava do orçamento da classe
  // truques que o livro concede de graça.
  const truquesConcedidos = todosTruques.filter(m => !truqueContaNoLimite(m) && m.origem !== 'especie' && m.origem !== 'sempre');
  const truquesTalento = truquesConcedidos;
  const truquesSempre = todosTruques.filter(m => m.origem === 'sempre');
  // DUAS PERGUNTAS DIFERENTES, DOIS CONJUNTOS -- não faça um servir aos dois.
  //
  //  - `truquesNoLimite` responde "quanto do orçamento DESTA classe já foi
  //    gasto?". A base vem da fonte única (regras-origens-magia.js), que lê
  //    `magias_conhecidas` E `magias_customizadas`: truque personalizado
  //    CONTA, como a magia de círculo personalizada sempre contou (decisão
  //    do dono do produto). `truquesPorClasse` separa esses truques em três
  //    baldes por classe -- é a MESMA função que o modal "+ Magia"
  //    (sheet/grimorio.js) chama, para as duas telas não poderem discordar
  //    sobre o número.
  //
  //    Passou a ser POR CLASSE porque a soma global era o que quebrava o
  //    limite em multiclasse: os truques do Clérigo gastavam o orçamento do
  //    Mago, e a saída da época foi desligar a trava (medido: 16 truques
  //    com limite 4). Com UMA superfície só nada muda -- RULING R-B: sem
  //    ambiguidade possível, o truque sem carimbo é dela.
  //
  //  - `truquesClasseDoAcervo` responde "o que eu desenho neste bloco?".
  //    Só truque do LIVRO: a linha sai com `data-magia-nome`, e o handler
  //    genérico busca a descrição em `getMagiasPorCirculo` -- o acervo de
  //    dados/, onde a magia que o jogador inventou não está. O truque
  //    personalizado já é desenhado logo abaixo, por
  //    `renderLinhaMagiaPersonalizada` (com `data-magia-custom-index`, o
  //    handler que lê `char.magias_customizadas`). Juntar os dois aqui o
  //    mostraria DUAS vezes, e a segunda cópia abriria a descrição vazia --
  //    a forma exata da issue #39.
  const classificacaoTruques = truquesPorClasse(char, sup?.classe, classesData);
  const truquesNoLimite = classificacaoTruques.desta;
  const truquesSemClasse = classificacaoTruques.semClasse;
  const truquesClasseDoAcervo = todosTruques.filter(m => !m.personalizada && m.origem !== 'especie' && m.origem !== 'sempre' && truqueContaNoLimite(m));
  const preparadas = char.magias_preparadas || [];
  // `espacos`: casca no formato ANTIGO (por CIRCULO, nao por fonte) que o
  // resto desta funcao ja consome (resumo de espacos, o NUMERO mostrado nas
  // secoes de Preparadas e Grimorio) -- construida a partir do acessador
  // derivado (reservasDeEspacos, Tarefa 1) para nao duplicar a regra de
  // total aqui, em vez de reintroduzir um reconciliador de render (essa e a
  // Tarefa 4 que este proprio sub-projeto fechou). Usa reservaDoCirculo
  // (acima) -- a MESMA prioridade que os botoes de "Conjurar" usam quando
  // so ha UMA fonte com espaco -- para a tela e o gasto nunca divergirem
  // sobre qual reserva um numero de circulo resolve nesse caso.
  //
  // LIMITACAO DE TELA QUE PERMANECE (nao confundir com o beco de gasto
  // logo abaixo, que FOI corrigido): um personagem com Conjuracao E Magia
  // de Pacto no MESMO circulo (Bruxo multiclasse) ve, aqui, so o NUMERO da
  // reserva de conjuracao -- o pacto colidido fica invisivel neste resumo.
  // Julgado defensavel pelo mesmo motivo do docblock de
  // migrarEspacosDeMagia (multiclasse ainda nao existe em ficha de
  // producao, ver regras-multiclasse-conjuracao.js:135-143).
  //
  // O que MUDOU (achado da revisao de branch, Important 3): uma nota
  // anterior deste comentario declarava "LIMITACAO CONHECIDA e PERMANENTE"
  // tambem para o GASTO -- que so seria possivel pela fonte que aparece
  // aqui. Nao e mais verdade. `todosEsgotados` (abaixo) e o portao de
  // `setupEventosEspacosMagia` ([data-conjurar]) passam a consultar
  // `circulosComEspacoDisponivel` (todas as fontes, nao so a que `espacos`
  // mostra), entao o botao "Conjurar" so desabilita quando NENHUMA fonte
  // daquele circulo tem espaco -- e `decidirFonteEContinuar` (mais abaixo)
  // resolve a fonte certa mesmo com a conjuracao colidida ja esgotada.
  // Prova por mutacao no oraculo "apos esgotar a Conjuracao, o Pacto
  // colidido continua gastavel" (multiclasse-magias.spec.mjs).
  const espacos = {};
  new Set(reservasDeEspacos().map(r => r.circulo)).forEach(circulo => {
    const r = reservaDoCirculo(circulo);
    if (r) espacos[circulo] = { total: r.total, usados: r.usados, fonte: r.fonte };
  });

  // Circulos em que PELO MENOS UMA fonte ainda tem espaco disponivel --
  // ao contrario de `espacos` (acima), olha TODAS as fontes daquele
  // circulo, nao so a prioritaria. Usado pelos gates "todosEsgotados"
  // desta funcao para o botao "Conjurar" so desabilitar quando NENHUMA
  // reserva do circulo tiver espaco (ver comentario de `espacos`, acima,
  // para o raciocinio completo).
  const circulosComEspacoDisponivel = new Set(
    reservasDeEspacos().filter(r => r.disponiveis > 0).map(r => r.circulo)
  );

  // Calcular limites de magias preparadas/conhecidas e truques
  // Para subclasses conjuradoras (Cavaleiro Místico / Trapaceiro Arcano), usar tabela da subclasse
  // getLimitesMagias já cai para a tabela da subclasse quando a tabela da
  // classe não tem colunas de magia (Guerreiro/Ladino) -- mesma função que
  // o modal de consulta usa, para os dois não divergirem (ver utils.js).
  // `sup?.tabela`/`sup?.nivelClasse` (Tarefa 3): antes, `classeData` e
  // `char.nivel` eram a tabela da classe INICIAL confrontada com o nível
  // TOTAL -- o caso reportado (Ladino 5/Mago 1): sem coluna de magia no
  // Ladino, `getLimitesMagias` caía para a tabela da subclasse (nenhuma
  // aqui) e devolvia 0/0, mesmo com a superfície de conjuração ativa
  // (Mago) tendo limite de verdade.
  const _limites = getLimitesMagias(sup?.tabela, sup?.nivelClasse ?? 0, subConj);
  let maxPreparadas = _limites.preparadas;
  let maxTruques = _limites.truques;
  // Truques extras de Combatente Druídico / Abençoado
  maxTruques += getTruquesExtraEstiloLuta();
  // Truques extras do Clérigo Taumaturgo / Druida Xamã (utils.js, mesma
  // função que o criador usa -- antes só o criador somava esse bônus, e a
  // ficha calculava o limite sem ele). `sup?.classe` (Tarefa 3): sem isso a
  // checagem caía no espelho `char.classe` e um Ladino 5/Clérigo 1
  // Taumaturgo nunca via o +1 truque.
  maxTruques += getBonusTruquesOrdem(char, sup?.classe);

  // Contar magias preparadas excluindo as especiais (não contam no limite).
  // preparadasPorClasse (Tarefa 4): `numPreparadas` deixa de ser a soma de
  // TODAS as classes e passa a ser só `desta` -- as preparadas CARIMBADAS
  // com a classe da superfície ativa. Ver "O CONTADOR HONESTO", no bloco de
  // render abaixo, para o antes/depois e para `numSemClasse`.
  const classificacaoPreparadas = preparadasPorClasse(char, sup?.classe);
  const preparadasEspeciais = preparadas.filter(m => magiaEhEspecial(m));
  const numPreparadas = classificacaoPreparadas.desta.length;
  const numSemClasse = classificacaoPreparadas.semClasse.length;

  // Label dinâmico baseado no tipo de conjuração
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias Conhecidas' : 'Magias Preparadas';

  // Agrupar magias preparadas por círculo
  const preparadasPorCirculo = {};
  preparadas.forEach(m => {
    const circ = m.circulo || 1;
    if (!preparadasPorCirculo[circ]) preparadasPorCirculo[circ] = [];
    const item = m.personalizada
      ? (magiasPersonalizadas.find(mp => mp.nome === m.nome && mp.circulo === circ) || m)
      : m;
    preparadasPorCirculo[circ].push(item);
  });

  // Verificar se é Mago (para grimório). `temClasse`, não o espelho
  // `char.classe === 'Mago'`: o grimório existe para o personagem que TEM
  // a classe Mago em qualquer ordem, não só quando ela é a inicial -- um
  // Clérigo 5/Mago 1 tem grimório de Mago igual a um Mago 5/Clérigo 1.
  const ehMago = temClasse(char, 'Mago');
  // Limite de preparo DO GRIMÓRIO -- sempre da classe Mago (nivelETabelaDoMago,
  // topo do arquivo), NUNCA de `maxPreparadas` (acima): `maxPreparadas` é o
  // limite da superfície ATIVA, que só por acaso é a do Mago quando ele é a
  // classe inicial/única. Num Clérigo 5/Mago 1, `maxPreparadas` mostra o
  // limite do Clérigo (9) nos contadores do topo, mas o painel do grimório,
  // abaixo, precisa do limite do MAGO (1) -- os dois painéis não podem
  // divergir sobre "quantas o Mago pode preparar".
  const { nivel: _nivelMago, tabela: _tabelaMago } = nivelETabelaDoMago();
  const maxPreparadasGrimorio = _tabelaMago ? getMagiaPreparadas(_tabelaMago, _nivelMago) : 99;
  const grimorio = char.grimorio || [];
  const grimorioPorCirculo = grimorio.reduce((grupos, magia) => {
    const circulo = Number(magia.circulo);
    if (!grupos[circulo]) grupos[circulo] = [];
    grupos[circulo].push(magia);
    return grupos;
  }, {});
  Object.values(grimorioPorCirculo).forEach(magias => magias.sort((a, b) => {
    const ritualA = ehMagiaRitual(a.nome);
    const ritualB = ehMagiaRitual(b.nome);
    return Number(ritualA) - Number(ritualB) || a.nome.localeCompare(b.nome, 'pt-BR');
  }));

  // Mapa de truques modificados por invocacoes do Bruxo (para indicacao visual)
  const truquesModificadosMapa = {};
  // temClasse, nao o espelho `char.classe` (que e a classe INICIAL): num
  // Mago 5/Bruxo 3 as marcas de invocacao nos truques sumiam da tela.
  if (temClasse(char, 'Bruxo') && char.recursos?.bruxo?.invocacoes) {
    const INV_TRUQUE_LABELS = {
      'Explosão Agonizante': '+Carisma ao dano',
      'Explosão Repulsiva': 'Empurra 3m',
      'Lança Mística': 'Alcance aumentado'
    };
    for (const inv of char.recursos.bruxo.invocacoes) {
      const nomeInv = typeof inv === 'string' ? inv : inv.nome;
      const truque = inv?.truque;
      if (truque && INV_TRUQUE_LABELS[nomeInv]) {
        if (!truquesModificadosMapa[truque]) truquesModificadosMapa[truque] = [];
        truquesModificadosMapa[truque].push({ invocacao: nomeInv, efeito: INV_TRUQUE_LABELS[nomeInv] });
      }
    }
  }

  return `
    <div class="card print-break-before">
      <div class="card-header">
        <h2>Magias</h2>
        <div class="no-print" style="display:flex;gap:4px">
          <button class="btn btn-sm btn-accent" id="btn-add-magia">+ Magia</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-magia-custom">Magia Personalizada</button>
        </div>
      </div>
      ${(char._slots_truque_livre || 0) > 0 && tipoConj === 'conhecidas' ? `
        <div class="info-box warning no-print" style="margin:0 0 8px;font-size:0.85rem;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>Você tem <strong>${char._slots_truque_livre}</strong> vaga(s) de truque em aberto para o seu nível.</span>
          <button class="btn btn-sm btn-primary" id="btn-preencher-slot-truque">Escolher</button>
        </div>
      ` : ''}
      ${(char._slots_magia_livre || 0) > 0 && tipoConj === 'conhecidas' ? `
        <div class="info-box warning no-print" style="margin:0 0 8px;font-size:0.85rem;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>Você tem <strong>${char._slots_magia_livre}</strong> vaga(s) de magia conhecida em aberto para o seu nível.</span>
          <button class="btn btn-sm btn-primary" id="btn-preencher-slot-magia">Escolher</button>
        </div>
      ` : ''}

      <!--
        O CONTADOR HONESTO (Tarefa 3, decisao do dono do produto; revisado
        na Tarefa 4 do sub-projeto 2026-08-29-magia-sabe-a-classe).

        NOTA: nenhum backtick neste comentario, de proposito -- ele vive
        dentro do template literal que monta este HTML inteiro, e um
        backtick aqui fecharia a string do JS.

        TRUQUES (truquesNoLimite.length) continuam FORA do escopo daquela
        tarefa 4: magias_conhecidas[] nao ganhou campo de classe, entao a
        contagem de truques ainda e do PERSONAGEM INTEIRO (soma de todas as
        classes) contra o limite de UMA classe (maxTruques, a superficie
        ativa) -- por isso contador-excedido de truques continua suprimido
        com mais de uma superficie (superficies.length <= 1), a mesma
        guarda de sempre.

        PREPARADAS (numPreparadas) mudou: magias_preparadas[].classe existe
        desde as Tarefas 2 e 3 (gravadores e migracao), entao numPreparadas
        agora e 'desta' -- so as preparadas CARIMBADAS com a classe da
        superficie ativa (preparadasPorClasse, regras-magia-classe.js). O
        ESTADO MISTO E PERMANENTE, porem: a migracao so carimba o
        inequivoco, e magia isenta (dominio/talento/especie/'sempre') nunca
        recebe carimbo -- por isso numSemClasse (classificacaoPreparadas.
        semClasse.length) tem um badge proprio logo ao lado do contador de
        preparadas, sempre que for maior que zero: a incerteza fica VISIVEL
        em vez de escondida atras de um numero que parece completo. Contra
        essa contagem por classe, contador-cheio/contador-excedido de
        preparadas nao dependem mais de superficies.length <= 1 -- dependem
        de numSemClasse === 0 (a contagem so pode alarmar quando e CERTA).

        Para classe unica (a maioria dos personagens), a migracao carimba
        TUDO -- numSemClasse e sempre 0 e numPreparadas e identico ao de
        antes: nada muda na tela para eles.
      -->
      <!--
        SELETOR DE SUPERFICIE DE CONJURACAO (Tarefa 4). So aparece com MAIS
        DE UMA superficie -- o MESMO criterio de conjuracoesPorClasse em
        sheet/ficha.js (CD/Ataque por classe): com uma classe so (a maioria
        dos personagens), a tela fica identica a antes do seletor existir.
        Clicar chama definirSuperficieSelecionada (contexto-classe.js) e
        re-renderiza a ficha inteira -- a MESMA variavel que
        sheet/grimorio.js le em superficieAtiva(), entao "+ Magia" abre
        para a classe escolhida aqui sem precisar de seletor proprio dentro
        do modal.

        DECISAO REGISTRADA: o modal "Gerenciar Magias" NAO ganhou um
        seletor proprio, de proposito. Ele tem busca digitada
        (#busca-magia-add) e aba ativa (tabAtiva, Preparadas/Truques/
        Circulo) -- estado local que hoje reinicia limpo TODA vez que o
        modal abre (tabAtiva comeca em 'preparadas', busca vazia). Um
        seletor dentro do modal levantaria a pergunta "o que fazer com esse
        estado ao trocar de classe no meio da sessao" -- e a resposta mais
        segura (limpar os dois) e EXATAMENTE o que ja acontece hoje sempre
        que o modal e reaberto. Pela expectativa do jogador: trocar de
        classe e comecar uma tarefa NOVA ("o que ja esta preparado do
        Mago?"), nao continuar a mesma busca da classe anterior -- um termo
        digitado para achar uma magia de Clerigo e ruido para a lista do
        Mago, e ficar na aba "1o Circulo" arriscaria mostrar um circulo que
        a OUTRA classe nem tem ainda. Colocar o seletor aqui fora, onde o
        estado nao existe para vazar, entrega esse reinicio de graca -- sem
        precisar decidir "o que preservar" dentro do modal so para depois
        jogar tudo fora mesmo.
      -->
      ${superficies.length > 1 ? `
        <div class="tabs no-print" id="tabs-superficie-magia" style="margin-bottom:8px;overflow-x:auto;white-space:nowrap">
          ${superficies.map(s => `<div class="tab ${s.classe === sup?.classe ? 'active' : ''}" data-tab-superficie="${escHtml(s.classe)}">${escHtml(s.classe)} ${s.nivelClasse}</div>`).join('')}
        </div>
      ` : ''}
      <!--
        Achado 1 da rodada 1 de correção da Tarefa 4 (revisão independente):
        esta caixa dizia que TRUQUES E PREPARADAS contam o personagem
        inteiro -- verdade antes da Tarefa 4, falso para preparadas depois
        dela (numPreparadas virou por classe, ver "O CONTADOR HONESTO"
        acima). O texto agora descreve as duas contagens separadas: truques
        continua PERSONAGEM INTEIRO (sem campo de classe, fora de escopo);
        preparadas conta só a classe selecionada, e cita o indicador "sem
        classe" para quem tiver alguma preparada ainda não carimbada.
      -->
      ${superficies.length > 1 ? `
        <div class="info-box info" style="margin-bottom:8px;font-size:0.78rem">
          Truques contam o personagem inteiro (todas as classes) contra o limite da classe selecionada acima.
          Já ${labelMagias.toLowerCase()} contam só as desta classe -- a lista abaixo mostra as de todas as classes, cada entrada com o rótulo da sua classe (ou "sem classe" nas fichas ainda não migradas, que também não entram nesta contagem).
        </div>
      ` : ''}
      <!-- Contador de magias preparadas/conhecidas e truques -->
      <div class="magia-contadores" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${maxTruques > 0 ? `
          <div class="magia-contador ${truquesNoLimite.length > maxTruques && truquesSemClasse.length === 0 ? 'contador-excedido' : truquesNoLimite.length === maxTruques && truquesSemClasse.length === 0 ? 'contador-cheio' : ''}">
            <span class="contador-label">Truques</span>
            <span class="contador-valor">${truquesNoLimite.length} / ${maxTruques}</span>
          </div>
        ` : ''}
        ${truquesSemClasse.length > 0 ? `
          <div class="magia-contador contador-dominio" id="ficha-contador-truques-sem-classe" title="Truques de fichas antigas (ou personalizados) cuja classe nao pode ser determinada sem chute -- nao entram nesta contagem nem no bloqueio de limite.">
            <span class="contador-label">Truques (sem classe)</span>
            <span class="contador-valor">+${truquesSemClasse.length}</span>
          </div>
        ` : ''}
        ${truquesEspecie.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Truques (Espécie)</span>
            <span class="contador-valor">${truquesEspecie.length}</span>
          </div>
        ` : ''}
        ${truquesTalento.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Truques (Talento)</span>
            <span class="contador-valor">${truquesTalento.length}</span>
          </div>
        ` : ''}
        ${truquesSempre.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Truques (Subclasse)</span>
            <span class="contador-valor">${truquesSempre.length}</span>
          </div>
        ` : ''}
        ${maxPreparadas > 0 ? `
          <div class="magia-contador ${numPreparadas > maxPreparadas && numSemClasse === 0 ? 'contador-excedido' : numPreparadas === maxPreparadas && numSemClasse === 0 ? 'contador-cheio' : ''}">
            <span class="contador-label">${labelMagias}</span>
            <span class="contador-valor">${numPreparadas} / ${maxPreparadas}</span>
          </div>
        ` : ''}
        ${numSemClasse > 0 ? `
          <div class="magia-contador contador-dominio" title="Magias de fichas antigas cuja classe não pôde ser determinada sem chute -- não entram na contagem de ${labelMagias.toLowerCase()} nem no bloqueio de limite.">
            <span class="contador-label">${labelMagias} (sem classe)</span>
            <span class="contador-valor">+${numSemClasse}</span>
          </div>
        ` : ''}
        ${preparadasEspeciais.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Especiais</span>
            <span class="contador-valor">${preparadasEspeciais.length}</span>
          </div>
        ` : ''}
        ${ehMago ? `
          <div class="magia-contador" style="background:var(--accent);color:#fff">
            <span class="contador-label">Grimório</span>
            <span class="contador-valor">${grimorio.length}</span>
          </div>
        ` : ''}
      </div>

      <!-- Espaços de magia -->
      ${(() => {
        // RESUMO POR RESERVA, nao por circulo. Ate aqui esta lista lia
        // `espacos` -- o mapa por CIRCULO, montado com um `new Set(...)`
        // que jogava a fonte fora e deixava a Conjuracao vencer a colisao.
        // Num Mago 5/Bruxo 3 os 2 espacos de Pacto do 2o circulo nao
        // apareciam em lugar nenhum, embora o modelo os tivesse e o botao
        // "Conjurar" ja soubesse gasta-los: o comentario de `espacos`
        // chamava isso de "LIMITACAO DE TELA QUE PERMANECE", defensavel
        // enquanto "multiclasse ainda nao existe em ficha de producao".
        // Multiclasse subiu na 3.0.0, e a premissa caiu junto.
        //
        // `espacos` CONTINUA existindo, sem mudanca: ele responde outra
        // pergunta ("que circulos existem?", para as listas de upcast mais
        // abaixo), e essa resposta por circulo esta certa.
        const _reservas = reservasDeEspacos().filter(r => r.total > 0);
        return _reservas.length > 0 ? `
        <div style="margin-bottom:12px">
          ${_reservas.map((data) => {
            const circ = data.circulo;
            // Extras de Fonte de Magia so somam em 'conjuracao' -- nunca em
            // 'pacto' (Oráculo 6, multiclasse-magias.test.mjs).
            const _extrasCirculo = data.fonte === 'conjuracao' ? ((char.espacos_magia_extras || {})[circ] || 0) : 0;
            const _baseTotal = data.total - _extrasCirculo;
            // A reserva de Pacto se NOMEIA: ela volta no Descanso Curto
            // (Classes.md:898) e a de Conjuracao nao, entao duas linhas
            // "2o Circulo" identicas seriam pior que esconder uma.
            const _rotuloFonte = data.fonte === 'pacto' ? ' (Pacto)' : '';
            return `
            <div class="slots-grupo">
              <label>${circ}&ordm; Círculo${_rotuloFonte}</label>
              <div style="display:flex;gap:4px">
                ${Array.from({ length: data.total }, (_, i) => `
                  <div class="slot-bolha ${i < data.usados ? 'usado' : ''} ${i >= _baseTotal ? 'slot-extra' : ''}" data-slot-circ="${circ}" data-slot-fonte="${data.fonte}" data-slot-idx="${i}"></div>
                `).join('')}
              </div>
              <span style="font-size:0.75rem;color:var(--text-muted)">
                ${data.total - data.usados}/${data.total}
                ${_extrasCirculo > 0 ? `<span style="color:var(--accent)">(+${_extrasCirculo} FM)</span>` : ''}
              </span>
            </div>`;
          }).join('')}
        </div>
      ` : '';
      })()}

      <!-- Dádivas do Pacto (Bruxo) -->
      ${renderSecaoPactoBruxo()}

      <!--
        Achado 2 da rodada 1 de correção da Tarefa 4 (revisão independente):
        o contador do topo (numPreparadas) virou por CLASSE, mas esta lista
        de cartões continua mostrando as preparadas de TODAS as classes --
        ela dirige a CONJURAÇÃO de verdade (botão "Conjurar", upcast por
        select, "Ritual"), então filtrá-la pela classe ativa esconderia a
        capacidade de conjurar a magia de OUTRA classe, um efeito colateral
        pior que a mentira que este achado aponta. A escolha (das duas que
        o achado ofereceu) foi rotular cada cartão com a classe da entrada
        -- não esconder a lista nem fingir que ela e o contador respondem
        a mesma pergunta sem dizer isso. Ver o rótulo de classe dentro do
        .map logo abaixo (só aparece com mais de uma superfície -- classe
        única não muda em nada) e o aviso reescrito acima ("Já
        ${labelMagias.toLowerCase()} contam só as desta classe...").
      -->
      ${Object.keys(preparadasPorCirculo).sort((a, b) => parseInt(a) - parseInt(b)).map(circ => {
        const magias = preparadasPorCirculo[circ];
        return `
        <details data-details-id="magias-circulo-${circ}" style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            ${circ}º Círculo (${magias.length})
          </summary>
          <div style="padding-top:4px">
            ${magias.filter(m => !m.personalizada).slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => {
              const ehEspecial = magiaEhEspecial(m);
              const origemLabel = rotuloOrigemMagia(m);
              const circulos = Object.keys(espacos).filter(c => parseInt(c) >= m.circulo).sort((a, b) => parseInt(a) - parseInt(b));
              const temUpcast = circulos.length > 1;
              // circulosComEspacoDisponivel (nao `espacos`): ver Important 3
              // no comentario de `espacos`, acima -- so desabilita quando
              // NENHUMA fonte do circulo tem espaco, nao so a prioritaria.
              const todosEsgotados = circulos.every(c => !circulosComEspacoDisponivel.has(parseInt(c)));
              return `
              <div class="magia-item preparada ${ehEspecial ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">
                      ${ehEspecial ? `<span class="badge-dominio">&#9733;</span> ` : ''}${m.nome}
                    </div>
                    ${badgesMagiaRapidos(m.nome)}
                    ${ehEspecial ? `<div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">${origemLabel}</div>` : ''}
                    ${(!ehEspecial && superficies.length > 1) ? `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:1px" title="Classe desta magia preparada">${m.classe ? escHtml(m.classe) : 'Sem classe conhecida'}</div>` : ''}
                  </div>
                  <div class="no-print" style="display:flex;align-items:center;gap:4px">
                    ${temUpcast ? `
                      <select class="form-input" data-conj-select="${m.nome}" style="width:auto;padding:2px 4px;font-size:0.75rem">
                        ${circulos.map(c => `<option value="${c}"${c == m.circulo ? ' selected' : ''}>${c}º</option>`).join('')}
                      </select>
                    ` : ''}
                    ${(m.gratis_usado === false) ? `<button class="btn btn-sm btn-accent" data-conjurar-gratis="${m.nome}">Grátis</button>` : ''}
                    <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${circulos[0] || m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
                    ${ehMagiaRitual(m.nome) ? `<button class="btn btn-sm btn-secondary" data-conjurar-ritual="${m.nome}" data-conj-circ="${m.circulo}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>` : ''}
                  </div>
                </div>
                <div class="magia-desc"></div>
              </div>`;
            }).join('')}
            ${magias.filter(m => m.personalizada).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderLinhaMagiaPersonalizada(m, m.indicePersonalizada)).join('')}
          </div>
        </details>`;
      }).join('')}

      <!-- Truques -->
      ${todosTruques.length > 0 ? `
        <details id="details-truques"${_truquesColapsados ? '' : ' open'} style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            Truques (${truquesNoLimite.length}${maxTruques ? ' / ' + maxTruques : ''}${truquesSemClasse.length > 0 ? ` + ${truquesSemClasse.length} sem classe` : ''}${truquesEspecie.length > 0 ? ` + ${truquesEspecie.length} espécie` : ''}${truquesTalento.length > 0 ? ` + ${truquesTalento.length} talento` : ''}${truquesSempre.length > 0 ? ` + ${truquesSempre.length} subclasse` : ''})
          </summary>
          <div style="padding-top:4px">
            ${truquesEspecie.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => `
              <div class="magia-item magia-dominio" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Espécie</div>
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
            ${truquesTalento.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => `
              <div class="magia-item magia-dominio" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">${rotuloOrigemMagia(m)}</div>
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
            ${truquesSempre.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => `
              <div class="magia-item magia-dominio" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Subclasse</div>
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
            ${truquesClasseDoAcervo.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => {
              const mods = truquesModificadosMapa[m.nome] || [];
              const modHtml = mods.length > 0
                ? `<div style="font-size:0.6rem;color:var(--accent);font-weight:600;margin-top:1px">${mods.map(mod => `${mod.invocacao}: ${mod.efeito}`).join(' | ')}</div>`
                : '';
              return `
              <div class="magia-item ${mods.length > 0 ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">${mods.length > 0 ? '<span class="badge-dominio">&#9889;</span> ' : ''}${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    ${modHtml}
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>`;
            }).join('')}
            ${truquesPersonalizados.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderLinhaMagiaPersonalizada(m, m.indicePersonalizada)).join('')}
          </div>
        </details>
      ` : ''}

      <!-- Grimório do Mago -->
      ${ehMago && grimorio.length > 0 ? `
        <details data-details-id="grimorio-mago" style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--accent)">
            Grimório (${grimorio.length} magias)
          </summary>
          <div style="padding-top:4px;font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">
            Livro de Magias. Prepare magias a partir daqui (limite: ${maxPreparadasGrimorio}). Magias com marcador Ritual podem ser conjuradas sem preparar.
          </div>
          <div style="padding-top:4px">
            ${Object.keys(grimorioPorCirculo).sort((a, b) => Number(a) - Number(b)).map(circ => {
              const magiasDoCirculo = grimorioPorCirculo[circ];
              return `
              <details data-details-id="grimorio-mago-circulo-${circ}" open style="margin-bottom:10px">
                <summary class="section-divider" style="margin:4px 0 6px;cursor:pointer"><span>${circ}º Círculo (${magiasDoCirculo.length})</span></summary>
                ${magiasDoCirculo.map(m => {
              const jaPreparada = preparadas.some(p => p.nome === m.nome);
              // O grimório do Mago guarda só `{nome, circulo}` -- e a magia
              // PERSONALIZADA de círculo > 0 entra aqui junto das do acervo
              // (grimorio.js, ao salvar). `ehMagiaRitual` só sabe do acervo,
              // então o `ritual: true` que o jogador marcou no formulário era
              // ignorado nesta seção: sem selo e sem botão de Ritual, embora a
              // mesma magia mostrasse os dois na lista de Magias Customizadas.
              const custom = magiasPersonalizadas.find(p => p.nome === m.nome);
              const ehRitual = custom ? custom.ritual : ehMagiaRitual(m.nome);
              const circulos = Object.keys(espacos).filter(c => parseInt(c) >= m.circulo).sort((a, b) => parseInt(a) - parseInt(b));
              const temUpcast = circulos.length > 1;
              // circulosComEspacoDisponivel (nao `espacos`): ver Important 3
              // no comentario de `espacos`, acima -- so desabilita quando
              // NENHUMA fonte do circulo tem espaco, nao so a prioritaria.
              const todosEsgotados = circulos.every(c => !circulosComEspacoDisponivel.has(parseInt(c)));
              // issue #39: a magia PERSONALIZADA de círculo > 0 também passa por
              // aqui (mesmo comentário de `custom`, acima). Com `data-magia-nome`
              // o clique caía no handler genérico, que busca a descrição em
              // `getMagiasPorCirculo` -- o acervo do livro, onde ela não está.
              // `custom` (resolvido acima para o selo de Ritual) já é o objeto
              // certo: emitir `data-magia-custom-index` faz o clique cair no
              // handler que lê `char.magias_customizadas` (o mesmo que a seção
              // Preparadas usa) em vez de reescrever a busca de descrição aqui.
              const atributoMagia = custom
                ? `data-magia-custom-index="${custom.indicePersonalizada}"`
                : `data-magia-nome="${m.nome}"`;
              return `
              <div class="magia-item ${jaPreparada ? 'preparada' : ''} ${ehRitual && !jaPreparada ? 'magia-dominio' : ''}" ${atributoMagia} data-magia-circ="${m.circulo}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="opacity:${jaPreparada || ehRitual ? '1' : '0.7'}">
                    <div class="magia-nome">${m.nome} ${jaPreparada ? '<span class="badge badge-success" style="font-size:0.6rem">Preparada</span>' : ''}${ehRitual ? ' <span class="badge" style="font-size:0.6rem;background:var(--secondary);color:#fff">Ritual</span>' : ''}</div>
                    <div class="magia-meta"><span>${m.circulo}º Círculo</span></div>
                    ${!jaPreparada && !ehRitual ? '<div style="font-size:0.65rem;color:var(--text-muted);font-style:italic">Não preparada</div>' : ''}
                  </div>
                  <div class="no-print" style="display:flex;gap:4px;align-items:center">
                    ${jaPreparada ? `
                      ${temUpcast ? `
                        <select class="form-input" data-conj-select="${m.nome}" style="width:auto;padding:2px 4px;font-size:0.75rem">
                          ${circulos.map(c => `<option value="${c}"${c == m.circulo ? ' selected' : ''}>${c}º</option>`).join('')}
                        </select>
                      ` : ''}
                      <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${circulos[0] || m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
                      <button class="btn btn-sm btn-secondary" data-despreparar-grimorio="${m.nome}" title="Despreparar">✕</button>
                    ` : `
                      <button class="btn btn-sm btn-accent" data-preparar-grimorio="${m.nome}" data-prep-circ="${m.circulo}">Preparar</button>
                      ${ehRitual ? (custom
                        // Magia personalizada usa o handler `-custom` (por
                        // índice): o do acervo se guarda com `ehMagiaRitual`,
                        // que não conhece magia personalizada, e o botão não
                        // faria nada.
                        ? `<button class="btn btn-sm btn-secondary" data-conjurar-ritual-custom="${custom.indicePersonalizada}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>`
                        : `<button class="btn btn-sm btn-secondary" data-conjurar-ritual="${m.nome}" data-conj-circ="${m.circulo}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>`) : ''}
                    `}
                    <button class="btn btn-sm btn-danger btn-icon" data-remover-grimorio="${m.nome}" title="Remover do grimório">&times;</button>
                  </div>
                </div>
                <div class="magia-desc"></div>
              </div>`;
                }).join('')}
              </details>`;
            }).join('')}
          </div>
          <div class="no-print" style="margin-top:8px">
            <button class="btn btn-sm btn-accent" id="btn-add-grimorio">+ Copiar Magia para Grimório</button>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">Custo: 50 PO por círculo da magia (2h por círculo)</div>
          </div>
        </details>
      ` : ''}
      ${ehMago && grimorio.length === 0 ? `
        <div class="no-print" style="padding:8px;text-align:center;color:var(--text-muted);font-size:0.85rem;border:1px dashed var(--border);border-radius:var(--radius);margin-bottom:8px">
          Grimório vazio. <button class="btn btn-sm btn-accent" id="btn-add-grimorio">+ Copiar magia</button>
        </div>
      ` : ''}

      <!-- Magias Customizadas (círculo > 0) não preparadas: garante local visível para editar/remover -->
      ${(() => {
        const naoPreparadas = magiasPersonalizadas.filter(m => m.circulo > 0 && !preparadas.some(p => p.nome === m.nome));
        return naoPreparadas.length > 0 ? `
        <details data-details-id="magias-customizadas-circulo" style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--accent)">
            Magias Customizadas (${naoPreparadas.length})
          </summary>
          <div style="padding-top:4px">
            ${naoPreparadas.slice().sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderLinhaMagiaPersonalizada(m, m.indicePersonalizada, { naoPreparada: true })).join('')}
          </div>
        </details>
      ` : '';
      })()}
    </div>
  `;
}

// Mapa unificado de magias com efeitos mecanicos quando conjuradas
// Opcoes de Metamagia (Feiticeiro) - constante global para uso no cast engine e config
export const OPCOES_METAMAGIA = [
  { nome: 'Magia Acelerada', custo: 2, desc: 'Ao conjurar uma magia com tempo de 1 ação, gaste 2 PF para mudar para Ação Bônus.', validar: (info) => info && /^Ação$/i.test((info.tempo_conjuracao || '').trim()), combina: false },
  { nome: 'Magia Agravada', custo: 2, desc: 'Ao conjurar com teste de resistência, gaste 2 PF para dar Desvantagem na salvaguarda.', validar: null, combina: false },
  { nome: 'Magia Buscadora', custo: 1, desc: 'Jogada de ataque com magia que erra: gaste 1 PF para re-jogar (deve usar o novo resultado).', validar: null, combina: true },
  { nome: 'Magia Cautelosa', custo: 1, desc: 'Ao conjurar com salvaguarda, gaste 1 PF e escolha criaturas = mod. Car. que passam automaticamente.', validar: null, combina: false },
  { nome: 'Magia Distante', custo: 1, desc: 'Magia com alcance 1,5m+: gaste 1 PF para dobrar. Alcance Toque vira 9m.', validar: (info) => info && info.alcance && !/pessoal/i.test(info.alcance), combina: false },
  { nome: 'Magia Duplicada', custo: 1, desc: 'Magia que mira apenas uma criatura e não tem auto-alcance: gaste 1 PF para mirar uma segunda.', validar: (info) => info && info.alcance && !/pessoal/i.test(info.alcance), combina: false },
  { nome: 'Magia Persistente', custo: 1, desc: 'Ao conjurar com Concentração e duração 1 min+: gaste 1 PF, não requer Concentração por 1 min.', validar: (info) => info && /concentra/i.test(info.duracao || ''), combina: false },
  { nome: 'Magia Potencializada', custo: 1, desc: 'Ao rolar dano de magia: gaste 1 PF para re-jogar até mod. Car. dados de dano (deve usar novos).', validar: null, combina: true },
  { nome: 'Magia Sutil', custo: 1, desc: 'Ao conjurar: gaste 1 PF para conjurar sem componentes Verbais ou Somáticos.', validar: (info) => info && /[VS]/.test(info.componentes || 'V, S'), combina: false },
  { nome: 'Magia Transmutada', custo: 1, desc: 'Ao conjurar com dano: gaste 1 PF para trocar tipo de dano por Ácido/Elétrico/Gélido/Ígneo/Trovejante/Venenoso.', validar: null, combina: false }
];

const MAGIAS_EFEITO = {
  // --- Efeitos de CA (ja implementados) ---
  'Armadura Arcana':  { tipo_efeito: 'base', valor: 13, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'CA = 13 + Des' },
  'Escudo Arcano':    { tipo_efeito: 'bonus', valor: 5, concentracao: false, permite_self: true, permite_outro: false, rotulo: '+5 CA (1 rodada)' },
  'Escudo da Fé':     { tipo_efeito: 'bonus', valor: 2, concentracao: true, permite_self: true, permite_outro: true, rotulo: '+2 CA (concentração)' },
  // Sem Concentracao: o livro (Magias.md:5778) da a Pele-Casca duracao "1 hora".
  // A flag `concentracao: true` fazia a magia ocupar a vaga de Concentracao e
  // bloquear outra magia sem precisar.
  'Pele-Casca':       { tipo_efeito: 'minimo', valor: 17, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'CA mín. 17 (1 hora)' },
  'Vínculo de Proteção': { tipo_efeito: null, concentracao: false, permite_self: false, permite_outro: true, rotulo: 'Apenas outro alvo' },
  'Celeridade':       { tipo_efeito: 'bonus', valor: 2, concentracao: true, permite_self: true, permite_outro: true, rotulo: '+2 CA (concentração)' },
  'Lentidão':         { tipo_efeito: null, concentracao: true, permite_self: false, permite_outro: true, rotulo: 'Apenas inimigos' },

  // --- PV Temporarios ---
  'Vitalidade Vazia': { tipo: 'pv_temp', media: 9, concentracao: false, permite_self: true, permite_outro: false, rotulo: 'PV Temp: 2d4+4 (média 9)' },

  // --- Reflexos (copias ilusorias) ---
  'Reflexos': { tipo: 'reflexos', copias: 3, concentracao: false, permite_self: true, permite_outro: false, rotulo: '3 Cópias Ilusórias' },

  // --- Penalidade de ataque contra o conjurador ---
  'Proteção Contra Lâminas': { tipo: 'penalidade_ataque', valor: '1d4', concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Atacantes -1d4 (concentração)', truque: true },

  // --- Condicoes ---
  'Invisibilidade':       { tipo: 'condicao', condicao: 'Invisível', encerra_ao_atacar: true, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Invisível (encerra ao atacar)' },
  'Invisibilidade Maior': { tipo: 'condicao', condicao: 'Invisível', encerra_ao_atacar: false, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Invisível (não encerra ao atacar)' },
  'Despistar':            { tipo: 'condicao', condicao: 'Invisível + Cópia', encerra_ao_atacar: true, concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Invisível + Cópia Ilusória' },
  'Forma Gasosa':         { tipo: 'condicao', condicao: 'Forma Gasosa', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Forma Gasosa (voo 3m, resistências, não ataca)' },
  'Santuário':            { tipo: 'condicao', condicao: 'Santuário', encerra_ao_atacar: true, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Santuário (encerra ao atacar/conjurar)' },
  'Simular Morte':        { tipo: 'condicao', condicao: 'Simular Morte', concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Aparenta estar morto' },
  'Mesclar-se às Rochas': { tipo: 'condicao', condicao: 'Mesclado às Rochas', concentracao: false, permite_self: true, permite_outro: false, rotulo: 'Fundido em rocha/terra' },

  // --- Resistencia temporaria ---
  'Proteção Contra Energia': { tipo: 'resistencia', tipos_dano: null, selecionar_tipo: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'], concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Resistência a 1 tipo (escolher)' },
  'Pele-Rocha':              { tipo: 'resistencia', tipos_dano: ['Contundente', 'Cortante', 'Perfurante'], concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Resist. Contundente/Cortante/Perfurante' },

  // --- Resistencia + imunidade veneno ---
  'Proteção Contra Veneno': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Venenoso'] },
    { tipo: 'buff_save_condicao', condicao: 'Envenenado', bonus: 'vantagem' },
    { tipo: 'remover_condicao', condicao: 'Envenenado' }
  ], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Resist. Venenoso + Vant. SG Envenenado' },

  // --- Protecao contra entidades ---
  'Proteção Contra o Bem e o Mal': { tipo: 'protecao', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Proteção vs Aber./Cel./Elem./Feér./Ínf./M-V' },

  // --- Aura de pureza ---
  'Aura de Pureza': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Venenoso'] },
    { tipo: 'vantagem_sg_condicoes', condicoes: ['Amedrontado', 'Atordoado', 'Cego', 'Enfeitiçado', 'Envenenado', 'Paralisado', 'Surdo'] }
  ], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: Resist. Venenoso + Vant. SG condições' },

  // --- Buff d20 ---
  'Bênção': { tipo: 'buff_d20', bonus: '+1d4', aplica_em: ['ataque', 'salvaguarda'], concentracao: true, permite_self: true, permite_outro: true, rotulo: '+1d4 ataques e salvaguardas' },

  // --- Buff arma ---
  'Arma Mágica':   { tipo: 'buff_arma', bonus_ataque: 1, bonus_dano: 1, concentracao: false, permite_self: true, permite_outro: true, rotulo: '+1 ataque e dano (arma)' },
  'Arma Elemental': { tipo: 'buff_arma', bonus_ataque: 1, dano_extra: '1d4', selecionar_tipo: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'], concentracao: true, permite_self: true, permite_outro: true, rotulo: '+1 ataque + 1d4 elemental (arma)' },
  'Aljava Veloz':   { tipo: 'buff_arma', mecanica: 'ataque_bonus', concentracao: true, permite_self: true, permite_outro: false, rotulo: '2 ataques ranged como Ação Bônus' },

  // --- Buff salvaguarda contra magias ---
  'Círculo de Poder': { tipo: 'buff_d20', bonus: 'vantagem', aplica_em: ['salvaguarda_magias'], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: Vant. SG vs magias' },
  'Aura Sagrada': { tipo: 'composto', efeitos: [
    { tipo: 'buff_d20', bonus: 'vantagem', aplica_em: ['salvaguarda'] },
    { tipo: 'desv_ataques_contra_mim' }
  ], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura: Vant. TODAS SG + Desv. ataques contra' },

  // --- Buff deslocamento ---
  'Passos Largos':           { tipo: 'deslocamento', tipo_velocidade: 'base_bonus', valor_metros: 3, concentracao: false, permite_self: true, permite_outro: true, rotulo: '+3m deslocamento' },
  'Retirada Acelerada':      { tipo: 'deslocamento', tipo_velocidade: 'dash_acao_bonus', concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Disparada como Ação Bônus' },
  'Escalada de Aranha':      { tipo: 'deslocamento', tipo_velocidade: 'escalada', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Escalada = deslocamento base' },
  'Levitação':               { tipo: 'deslocamento', tipo_velocidade: 'levitacao', valor_metros: 6, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Levitação (6m vertical/turno)' },
  'Voo':                     { tipo: 'deslocamento', tipo_velocidade: 'voo', valor_metros: 18, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Voo 18m' },
  'Movimentação Livre':      { tipo: 'deslocamento', tipo_velocidade: 'nao_impedido', concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Sem restrição de movimento' },
  'Caminhar Sobre as Águas': { tipo: 'deslocamento', tipo_velocidade: 'sobre_liquidos', concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Caminhar sobre líquidos' },
  'Caminhar no Vento':       { tipo: 'deslocamento', tipo_velocidade: 'voo', valor_metros: 48, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Voo 48m (8h)' },

  // --- Buff pericia ---
  'Passo Sem Rastro':  { tipo: 'bonus_pericia', pericia: 'Furtividade', bonus: 10, concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: +10 Furtividade' },
  'Aprimorar Atributo': { tipo: 'bonus_pericia', selecionar_atributo: ['Força', 'Destreza', 'Inteligência', 'Sabedoria', 'Carisma'], bonus: 'vantagem', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Vant. testes do atributo (escolher)' },

  // --- Cura PV ---
  'Cura Completa':          { tipo: 'cura_pv', valor: 70, remove_condicoes: ['Cego', 'Envenenado', 'Surdo'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Cura 70 PV + remove Cego/Envenenado/Surdo' },
  'Cura Completa em Massa': { tipo: 'cura_pv', valor: 70, remove_condicoes: ['Cego', 'Envenenado', 'Surdo'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Cura 70 PV (até 6 criaturas)' },
  'Reviver os Mortos':      { tipo: 'cura_pv', valor: 1, penalidade: -4, concentracao: false, permite_self: false, permite_outro: true, rotulo: 'Revive com 1 PV (penalidade -4 d20)' },
  'Ressurreição':           { tipo: 'cura_pv', valor: 'max', penalidade: -4, concentracao: false, permite_self: false, permite_outro: true, rotulo: 'Revive com PV máx (penalidade -4 d20)' },

  // --- Cura condicao ---
  'Restauração Menor': { tipo: 'cura_condicao', condicoes: ['Cego', 'Envenenado', 'Paralisado', 'Surdo'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Remove 1 condição' },
  'Restauração Maior': { tipo: 'cura_condicao', efeitos: ['Exaustão (1 nível)', 'Enfeitiçado', 'Petrificado', 'Maldição', 'Redução de atributo', 'Redução de PV máximos'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Remove 1 efeito severo' },
  'Limpar a Mente': { tipo: 'composto', efeitos: [
    { tipo: 'imunidade_condicao', condicao: 'Enfeitiçado' },
    { tipo: 'resistencia', tipos_dano: ['Psíquico'] }
  ], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Imune Enfeitiçado + Resist. Psíquico (24h)' },

  // --- Efeitos compostos ---
  'Armadura de Agathys': { tipo: 'composto', escala_circulo: true, efeitos: [
    { tipo: 'pv_temp', formula_circ: 5 },
    { tipo: 'dano_reativo', dano_circ: 5, tipo_dano: 'Gélido' }
  ], concentracao: false, permite_self: true, permite_outro: false, rotulo: 'PV Temp + Dano Gélido reativo (5×círculo)' },

  'Heroísmo': { tipo: 'composto', efeitos: [
    { tipo: 'pv_temp_por_turno', valor: 'mod_conj' },
    { tipo: 'imunidade_condicao', condicao: 'Amedrontado' }
  ], concentracao: true, permite_self: true, permite_outro: true, rotulo: 'PV Temp/turno + Imune Amedrontado' },

  'Escudo Ardente': { tipo: 'composto', selecionar_variante: {
    'Escudo Quente (Resist. Gélido, dano 2d8 Ígneo)': { resistencia: 'Gélido', dano_reativo: '2d8 Ígneo' },
    'Escudo Frio (Resist. Ígneo, dano 2d8 Gélido)': { resistencia: 'Ígneo', dano_reativo: '2d8 Gélido' }
  }, concentracao: false, permite_self: true, permite_outro: false, rotulo: 'Resist. + Dano reativo (Quente/Frio)' },

  'Aura de Vida': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Necrótico'] },
    { tipo: 'protecao_pv_max' }
  ], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: Resist. Necrótico + PV máx protegidos' },

  'Banquete de Heróis': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Venenoso'] },
    { tipo: 'imunidade_condicao', condicao: 'Amedrontado' },
    { tipo: 'imunidade_condicao', condicao: 'Envenenado' },
    { tipo: 'bonus_pv_max', media: 11 }
  ], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Resist. Venenoso + Imunidades + PV máx +2d10 (24h)' }
};

// Retorna o nome da magia de concentracao ativa (ou null)
export function getConcentracaoAtiva() {
  const efMag = char.efeitos_magicos || [];
  const ef = efMag.find(e => e.concentracao);
  return ef ? ef.nome.replace(/ \(.*\)$/, '') : null;
}

// Verifica se uma magia e de concentracao.
//
// A DURACAO manda. MAGIAS_EFEITO configura o EFEITO da magia (bonus, duracao
// em rodadas, alvo) e e curado a mao -- usa-lo como autoridade sobre
// Concentracao fazia um erro de curadoria vencer o dado do livro: Heroismo,
// Aura Sagrada, Aura de Pureza e Aura de Vida exigem Concentracao e o mapa
// dizia que nao, deixando o jogador manter as quatro ativas junto com outra
// magia de Concentracao; Pele-Casca era o inverso, ocupando a vaga sem
// precisar. O acervo (dados/magias/) bate com o livro nas 391 magias --
// conferido pelo Plano 1 do dominio Magias, zero divergencias.
//
// O mapa continua consultado como FALLBACK, para magia que o acervo nao
// tenha (personalizada, ou de outra fonte).
/**
 * Diz se uma magia do CATÁLOGO traz o marcador Ritual, derivando de
 * `tempo_conjuracao` no acervo -- o mesmo campo que db.js/getMagiasRituais e
 * sheet/classes/bruxo.js já usam. São 31 das 391 magias.
 *
 * A derivação estava escrita à mão em dois pontos deste arquivo (a ordenação
 * do grimório e o rótulo da linha). Ficar em um lugar só é a mesma disciplina
 * da Correção B: dado derivado copiado diverge em silêncio.
 *
 * Não vale para magia PERSONALIZADA -- lá o campo `ritual` existe de verdade,
 * porque o jogador o preenche no formulário.
 */
export function ehMagiaRitual(nomeMagia) {
  const info = indiceMagiasCache?.find(m => m.nome === nomeMagia);
  return /ritual/i.test(info?.tempo_conjuracao || '');
}

function ehMagiaConcentracao(nomeMagia) {
  const info = indiceMagiasCache?.find(m => m.nome === nomeMagia);
  if (info?.duracao) return /concentra/i.test(info.duracao);
  const config = MAGIAS_EFEITO[nomeMagia];
  if (config) return !!config.concentracao;
  return false;
}

// Busca info de magia no cache do indice para validacao de metamagia
function getInfoMagiaParaMetamagia(nomeMagia) {
  if (!indiceMagiasCache?.length) return null;
  return indiceMagiasCache.find(m => m.nome === nomeMagia) || null;
}

// Modal de seleção de metamagia durante a conjuração (Feiticeiro)
function mostrarModalMetamagiaConjuracao(nomeMagia, circulo, onSelecao) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) { onSelecao([], {}); return; }

  const metamagiasConhecidas = estado.metamagias || [];
  if (metamagiasConhecidas.length === 0) { onSelecao([], {}); return; }

  const infoMagia = getInfoMagiaParaMetamagia(nomeMagia);
  const feiticariaEncarnada = estado.feiticariaInataAtiva;
  const nivelChar = char.nivel || 1;
  const temApoteose = nivelChar >= 20;
  const apoteoseGratisUsado = char.recursos?.feiticeiro?.apoteose_gratis_usado_turno || false;

  // Maximo de metamagias por conjuracao (regra base: 1, Encarnada: 2)
  // Excecao: Buscadora e Potencializada podem combinar com outra opcao
  const maxPorConjuracao = feiticariaEncarnada ? 2 : 1;

  const opcoesDisponiveis = OPCOES_METAMAGIA.filter(o => metamagiasConhecidas.includes(o.nome));
  const selecionadas = new Set();

  function calcularCustos() {
    let custoTotal = 0;
    let gratisUsado = false;
    for (const nome of selecionadas) {
      const op = OPCOES_METAMAGIA.find(o => o.nome === nome);
      if (!op) continue;
      if (temApoteose && !apoteoseGratisUsado && !gratisUsado) {
        gratisUsado = true;
      } else {
        custoTotal += op.custo;
      }
    }
    return { custoTotal, gratisUsado };
  }

  function podeAdicionarOpcao(nomeOpcao) {
    if (selecionadas.has(nomeOpcao)) return true; // remover sempre pode
    const op = OPCOES_METAMAGIA.find(o => o.nome === nomeOpcao);
    if (!op) return false;

    // Verificar elegibilidade da opcao para esta magia
    if (op.validar && !op.validar(infoMagia)) return false;

    if (selecionadas.size < maxPorConjuracao) return true;

    // Acima do limite base: verificar combinacao Buscadora/Potencializada
    if (selecionadas.size >= 2) return false;
    // Tamanho == maxPorConjuracao (1 sem Encarnada): permitir apenas combinacao
    const selArray = [...selecionadas];
    const todasCombinaveis = selArray.every(n => OPCOES_METAMAGIA.find(x => x.nome === n)?.combina);
    return op.combina && todasCombinaveis;
  }

  function renderModalMetaConjuracao() {
    const pfAtuais = estado.pontosMax - (char.recursos.feiticeiro.pontos_feiticaria_gastos || 0);
    const { custoTotal } = calcularCustos();

    let html = `<div style="text-align:center;margin-bottom:8px">
      <strong>${nomeMagia}</strong> (${circulo}º Círculo)
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">PF disponíveis: <strong>${pfAtuais}</strong>${custoTotal > 0 ? ` | Custo: <strong style="color:var(--danger)">${custoTotal} PF</strong>` : ''}</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">Máx. ${maxPorConjuracao} opç${maxPorConjuracao > 1 ? 'ões' : 'ão'} por conjuração${feiticariaEncarnada ? ' (Feitiçaria Encarnada)' : ''}${temApoteose && !apoteoseGratisUsado ? ' | Apoteose: 1ª grátis' : ''}</div>
    </div>`;

    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    for (const op of opcoesDisponiveis) {
      const sel = selecionadas.has(op.nome);
      const elegivel = !op.validar || op.validar(infoMagia);
      const podeCombinar = podeAdicionarOpcao(op.nome);

      // Custo efetivo para exibicao
      let custoExibir = op.custo;
      if (temApoteose && !apoteoseGratisUsado) {
        const { gratisUsado } = calcularCustos();
        if (!gratisUsado && !sel && selecionadas.size === 0) custoExibir = 0;
        if (sel && selecionadas.size === 1 && !gratisUsado) custoExibir = 0;
      }

      const { custoTotal: custoAtual } = calcularCustos();
      const semPF = !sel && custoExibir > 0 && (custoAtual + op.custo) > pfAtuais;
      const bloqueado = (!elegivel || (!sel && !podeCombinar) || semPF) && !sel;

      html += `
        <div data-meta-cast="${op.nome}"
             style="padding:8px 10px;border-radius:6px;border:1px solid ${sel ? 'var(--primary)' : 'var(--border-light)'};background:${sel ? 'var(--bg-active, rgba(var(--primary-rgb,59,130,246),0.1))' : 'var(--bg-card)'};${bloqueado ? 'opacity:0.4;cursor:not-allowed;' : 'cursor:pointer;'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong style="font-size:0.85rem">${sel ? '✓ ' : ''}${op.nome}</strong>
              ${!elegivel ? '<span style="font-size:0.65rem;color:var(--danger);margin-left:4px">(N/A para esta magia)</span>' : ''}
              ${semPF ? '<span style="font-size:0.65rem;color:var(--danger);margin-left:4px">(PF insuf.)</span>' : ''}
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted)">${custoExibir === 0 ? 'Grátis' : op.custo + ' PF'}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${op.desc}</div>
        </div>`;
    }
    html += '</div>';
    return html;
  }

  abrirModal('Metamagia', `
    <div id="metamagia-cast-container">${renderModalMetaConjuracao()}</div>
  `, `
    <button class="btn btn-secondary" id="meta-cast-pular">Sem Metamagia</button>
    <button class="btn btn-primary" id="meta-cast-aplicar">Aplicar e Conjurar</button>
  `);

  function attachMetaCastListeners() {
    document.querySelectorAll('[data-meta-cast]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.metaCast;
        if (selecionadas.has(nome)) {
          selecionadas.delete(nome);
        } else {
          if (!podeAdicionarOpcao(nome)) {
            if (selecionadas.size >= maxPorConjuracao) {
              toast(`Máx. ${maxPorConjuracao} metamagia(s) por conjuração.`, 'error');
            }
            return;
          }
          selecionadas.add(nome);
        }
        const container = document.getElementById('metamagia-cast-container');
        if (container) container.innerHTML = renderModalMetaConjuracao();
        attachMetaCastListeners();
      });
    });
  }
  attachMetaCastListeners();

  document.getElementById('meta-cast-pular')?.addEventListener('click', () => {
    window.fecharModal();
    onSelecao([], {});
  });

  document.getElementById('meta-cast-aplicar')?.addEventListener('click', () => {
    const selecionadasArray = [...selecionadas];
    if (selecionadasArray.length === 0) {
      window.fecharModal();
      onSelecao([], {});
      return;
    }

    // Se Magia Transmutada foi selecionada, perguntar tipo de dano
    if (selecionadasArray.includes('Magia Transmutada')) {
      const tipos = ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante', 'Venenoso'];
      const container = document.getElementById('metamagia-cast-container');
      if (container) {
        container.innerHTML = `
          <div style="text-align:center;margin-bottom:12px">
            <strong>Magia Transmutada</strong>
            <div style="font-size:0.8rem;color:var(--text-muted)">Escolha o novo tipo de dano:</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
            ${tipos.map(t => `<button class="btn btn-secondary" data-meta-dano="${t}">${t}</button>`).join('')}
          </div>`;
        tipos.forEach(t => {
          document.querySelector(`[data-meta-dano="${t}"]`)?.addEventListener('click', () => {
            window.fecharModal();
            onSelecao(selecionadasArray, { tipo_dano_transmutado: t });
          });
        });
      }
      return;
    }

    window.fecharModal();
    onSelecao(selecionadasArray, {});
  });
}

// Aplica efeito mecanico de uma opcao de metamagia na conjuracao
function _aplicarEfeitoMetamagia(metaNome, nomeMagia, circ) {
  if (!char.efeitos_magicos) char.efeitos_magicos = [];

  switch (metaNome) {
    case 'Magia Persistente': {
      // Remover flag de concentracao do efeito da magia recem-aplicada
      const efConc = char.efeitos_magicos.find(e => {
        const base = e.nome.replace(/ \(.*\)$/, '');
        return base === nomeMagia && e.concentracao;
      });
      if (efConc) {
        efConc.concentracao = false;
        efConc.metamagia_persistente = true;
        efConc.rotulo = (efConc.rotulo || '') + ' [Persistente]';
      }
      break;
    }
    case 'Magia Cautelosa': {
      const modCar = Math.max(1, calcMod(char.atributos.carisma));
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Cautelosa)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: `Cautelosa: ${modCar} criatura(s) passam auto na SG`,
        temporario: true
      });
      break;
    }
    case 'Magia Agravada': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Agravada)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Agravada: Desvantagem na salvaguarda',
        temporario: true
      });
      break;
    }
    case 'Magia Distante': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Distante)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Distante: Alcance dobrado',
        temporario: true
      });
      break;
    }
    case 'Magia Duplicada': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Duplicada)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Duplicada: +1 alvo adicional',
        temporario: true
      });
      break;
    }
    case 'Magia Buscadora': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Buscadora)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Buscadora: Re-jogar ataque se errar',
        temporario: true
      });
      break;
    }
    case 'Magia Potencializada': {
      const modCar = Math.max(1, calcMod(char.atributos.carisma));
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Potencializada)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: `Potencializada: Re-jogar até ${modCar} dado(s) de dano`,
        temporario: true
      });
      break;
    }
    case 'Magia Transmutada': {
      // Tipo de dano eh registrado via opcoesMeta.tipo_dano_transmutado no historico
      break;
    }
    // Magia Acelerada e Magia Sutil: efeitos puramente informativos, sem estado adicional
  }
}

// Processa todas as metamagias selecionadas para uma conjuracao, gasta PF e aplica efeitos
function _processarMetamagiasConjuracao(metamagiasAplicadas, opcoesMeta, nomeMagia, circ) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) return '';

  const temApoteose = (char.nivel || 1) >= 20;
  let gratisUsada = false;
  const detalhes = [];

  // Limpar efeitos temporarios de metamagia anteriores
  if (char.efeitos_magicos) {
    char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.temporario);
  }

  for (const metaNome of metamagiasAplicadas) {
    const op = OPCOES_METAMAGIA.find(o => o.nome === metaNome);
    if (!op) continue;

    // Custo (Apoteose Arcana: primeira gratis por turno)
    let custo = op.custo;
    if (temApoteose && !(char.recursos.feiticeiro.apoteose_gratis_usado_turno) && !gratisUsada) {
      custo = 0;
      gratisUsada = true;
      char.recursos.feiticeiro.apoteose_gratis_usado_turno = true;
    }

    if (custo > 0) {
      if (!gastarPontosFeiticaria(custo)) {
        toast(`PF insuficientes para ${metaNome}.`, 'error');
        continue;
      }
    }

    _aplicarEfeitoMetamagia(metaNome, nomeMagia, circ);

    let detalheExtra = '';
    if (metaNome === 'Magia Transmutada' && opcoesMeta?.tipo_dano_transmutado) {
      detalheExtra = ` → ${opcoesMeta.tipo_dano_transmutado}`;
    }
    detalhes.push(`${metaNome}${detalheExtra}${custo > 0 ? ` (-${custo} PF)` : ' (grátis)'}`);
  }

  // Registrar no historico de metamagias
  if (!char.recursos.feiticeiro.metamagia_historico) char.recursos.feiticeiro.metamagia_historico = [];
  char.recursos.feiticeiro.metamagia_historico.push({
    magia: nomeMagia,
    circulo: parseInt(circ),
    metamagias: [...metamagiasAplicadas],
    opcoes: opcoesMeta || {},
    timestamp: Date.now()
  });
  // Manter apenas ultimos 20 registros
  if (char.recursos.feiticeiro.metamagia_historico.length > 20) {
    char.recursos.feiticeiro.metamagia_historico = char.recursos.feiticeiro.metamagia_historico.slice(-20);
  }

  return detalhes.length > 0 ? ` [${detalhes.join(', ')}]` : '';
}

// Modal de confirmacao para substituir concentracao ativa
function confirmarSubstituirConcentracao(magiaAtual, magiaNova, onConfirmar, onCancelar) {
  const magiaAtualSegura = escHtml(String(magiaAtual || ''));
  const magiaNovaSegura = escHtml(String(magiaNova || ''));
  abrirModal('Substituir Concentração', `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Você está concentrado em:</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--warning);margin-bottom:12px">${magiaAtualSegura}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">Conjurar <strong>${magiaNovaSegura}</strong> cancelará a concentração atual.</div>
      <div style="font-size:0.8rem;color:var(--danger);margin-top:8px">Deseja continuar?</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
      <button class="btn btn-danger" id="conc-confirmar">Sim, conjurar ${magiaNovaSegura}</button>
      <button class="btn btn-secondary" id="conc-cancelar">Cancelar</button>
    </div>
  `, '');
  document.getElementById('conc-confirmar')?.addEventListener('click', () => { window.fecharModal(); onConfirmar(); });
  document.getElementById('conc-cancelar')?.addEventListener('click', () => { window.fecharModal(); if (onCancelar) onCancelar(); });
}

// Aplica efeito mecanico da magia no personagem. Retorna {detalhe} para toast ou null.
function aplicarEfeitoMagico(nomeMagia, circ, opcoes) {
  if (!opcoes) opcoes = {};
  const config = MAGIAS_EFEITO[nomeMagia];
  if (!config) return null;
  if (!char.efeitos_magicos) char.efeitos_magicos = [];
  const concentracao = config.concentracao;

  // Se for concentracao, remover efeitos de concentracao anteriores
  if (concentracao) {
    char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
  }
  // Remover efeito duplicado da mesma magia (e filhos compostos)
  char.efeitos_magicos = char.efeitos_magicos.filter(e => {
    const base = e.nome.replace(/ \(.*\)$/, '');
    return base !== nomeMagia;
  });

  const tipo = config.tipo || null;
  const circuloNum = parseInt(circ) || 0;

  // --- Efeitos de CA (tipo_efeito legado) ---
  if (config.tipo_efeito && ['bonus', 'base', 'minimo'].includes(config.tipo_efeito)) {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo_efeito: config.tipo_efeito, valor: config.valor, concentracao: concentracao, circulo: circuloNum });
    return null;
  }

  // --- PV Temporarios ---
  if (tipo === 'pv_temp') {
    const valor = config.media || 0;
    char.pv_temporario = Math.max(char.pv_temporario || 0, valor);
    return { detalhe: `+${valor} PV Temporários` };
  }

  // --- Reflexos ---
  if (tipo === 'reflexos') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'reflexos', copias: config.copias, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Penalidade ataque contra o conjurador ---
  if (tipo === 'penalidade_ataque') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'penalidade_ataque_contra_mim', valor: config.valor, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Condicao ---
  if (tipo === 'condicao') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'condicao', condicao: config.condicao, encerra_ao_atacar: config.encerra_ao_atacar || false, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Resistencia ---
  if (tipo === 'resistencia') {
    const tipos_dano = opcoes.tipo_selecionado ? [opcoes.tipo_selecionado] : config.tipos_dano;
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'resistencia', tipos_dano: tipos_dano, concentracao: concentracao, circulo: circuloNum, rotulo: tipos_dano ? `Resist. ${tipos_dano.join(', ')}` : config.rotulo });
    return null;
  }

  // --- Protecao contra entidades ---
  if (tipo === 'protecao') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'protecao_bem_e_mal', concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Buff d20 ---
  if (tipo === 'buff_d20') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'buff_d20', bonus: config.bonus, aplica_em: config.aplica_em, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Buff arma ---
  if (tipo === 'buff_arma') {
    const entry = { nome: nomeMagia, tipo: 'buff_arma', concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo };
    if (config.bonus_ataque) entry.bonus_ataque = config.bonus_ataque;
    if (config.bonus_dano) entry.bonus_dano = config.bonus_dano;
    if (config.dano_extra) { entry.dano_extra = config.dano_extra; if (opcoes.tipo_selecionado) entry.tipo_dano_extra = opcoes.tipo_selecionado; }
    if (config.mecanica) entry.mecanica = config.mecanica;
    char.efeitos_magicos.push(entry);
    return null;
  }

  // --- Deslocamento ---
  if (tipo === 'deslocamento') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'deslocamento', tipo_velocidade: config.tipo_velocidade, valor_metros: config.valor_metros || 0, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Buff pericia ---
  if (tipo === 'bonus_pericia') {
    const atributo = opcoes.atributo_selecionado || null;
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'bonus_pericia', pericia: config.pericia || null, atributo: atributo, bonus: config.bonus, concentracao: concentracao, circulo: circuloNum, rotulo: atributo ? `Vant. testes de ${atributo}` : config.rotulo });
    return null;
  }

  // --- Cura PV ---
  if (tipo === 'cura_pv') {
    const pvMax = char.pv_max_override || char.pv_max;
    let cura;
    if (config.valor === 'max') {
      cura = pvMax - (char.pv_atual || 0);
      char.pv_atual = pvMax;
    } else {
      cura = config.valor;
      char.pv_atual = Math.min((char.pv_atual || 0) + cura, pvMax);
    }
    if (config.remove_condicoes) {
      config.remove_condicoes.forEach(c => { char.condicoes = (char.condicoes || []).filter(cond => cond !== c); });
    }
    if (config.penalidade) {
      char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'penalidade_d20', valor: config.penalidade, concentracao: false, circulo: circuloNum, rotulo: `${config.penalidade} em d20 (reduz 1/Descanso Longo)` });
    }
    return { detalhe: `${config.valor === 'max' ? 'PV ao máximo' : `+${cura} PV`}${config.remove_condicoes ? ', condições removidas' : ''}` };
  }

  // --- Cura condicao ---
  if (tipo === 'cura_condicao') {
    if (opcoes.condicao_removida) {
      if (opcoes.condicao_removida === 'Exaustão (1 nível)') {
        char.exaustao = Math.max(0, (char.exaustao || 0) - 1);
        if (char.exaustao === 0) char.condicoes = (char.condicoes || []).filter(c => c !== 'Exaustão');
      } else if (opcoes.condicao_removida === 'Redução de PV máximos') {
        delete char.pv_max_override;
      } else {
        const nomeCondicao = opcoes.condicao_removida.replace(' (1 nível)', '');
        char.condicoes = (char.condicoes || []).filter(c => c !== nomeCondicao);
      }
      return { detalhe: `${opcoes.condicao_removida} removida` };
    }
    return null;
  }

  // --- Efeito composto ---
  if (tipo === 'composto') {
    const efeitos = config.efeitos || [];
    // Variante selecionada (ex: Escudo Ardente)
    if (config.selecionar_variante && opcoes.variante_selecionada) {
      const v = config.selecionar_variante[opcoes.variante_selecionada];
      if (v) {
        if (v.resistencia) char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'resistencia', tipos_dano: [v.resistencia], concentracao: concentracao, circulo: circuloNum, rotulo: `Resist. ${v.resistencia}` });
        if (v.dano_reativo) char.efeitos_magicos.push({ nome: nomeMagia + ' (Reativo)', tipo: 'dano_reativo', dano: v.dano_reativo, concentracao: concentracao, circulo: circuloNum, rotulo: `Dano reativo: ${v.dano_reativo}` });
      }
      return null;
    }
    // Processar sub-efeitos
    for (const ef of efeitos) {
      if (ef.tipo === 'pv_temp') {
        const valor = ef.formula_circ ? ef.formula_circ * circuloNum : (ef.media || 0);
        char.pv_temporario = Math.max(char.pv_temporario || 0, valor);
      } else if (ef.tipo === 'dano_reativo') {
        const dano = ef.dano_circ ? ef.dano_circ * circuloNum : ef.dano;
        char.efeitos_magicos.push({ nome: nomeMagia + ' (Reativo)', tipo: 'dano_reativo', dano: `${dano} ${ef.tipo_dano}`, concentracao: concentracao, circulo: circuloNum, rotulo: `Dano reativo: ${dano} ${ef.tipo_dano}` });
      } else if (ef.tipo === 'pv_temp_por_turno') {
        let valor = 0;
        if (ef.valor === 'mod_conj') {
          // superficieAtiva() (Tarefa 3), não o espelho char.classe: esta
          // magia (Heroísmo) não sabe de que classe do conjurador ela foi
          // preparada -- mesma dívida documentada em normalizarGrimorioMago
          // (utils.js) e no "contador honesto" de renderSecaoMagias. Sem
          // esse dado, a superfície ATIVA (a primeira por ordem de
          // aquisição) é o mesmo proxy que o resto da seção usa.
          const infoClasse = CLASSES_INFO[superficieAtiva()?.classe];
          if (infoClasse?.atributo_conjuracao) { const key = ATRIBUTO_NOME_PARA_KEY[infoClasse.atributo_conjuracao]; valor = calcMod(char.atributos[key]); }
        }
        valor = Math.max(1, valor);
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'pv_temp_por_turno', valor: valor, concentracao: concentracao, circulo: circuloNum, rotulo: `+${valor} PV Temp/turno` });
        char.pv_temporario = Math.max(char.pv_temporario || 0, valor);
      } else if (ef.tipo === 'imunidade_condicao') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'imunidade_condicao', condicao: ef.condicao, concentracao: concentracao, circulo: circuloNum, rotulo: `Imune: ${ef.condicao}` });
      } else if (ef.tipo === 'resistencia') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'resistencia', tipos_dano: ef.tipos_dano, concentracao: concentracao, circulo: circuloNum, rotulo: `Resist. ${ef.tipos_dano.join(', ')}` });
      } else if (ef.tipo === 'remover_condicao') {
        char.condicoes = (char.condicoes || []).filter(c => c !== ef.condicao);
      } else if (ef.tipo === 'buff_save_condicao') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'buff_save_condicao', condicao: ef.condicao, bonus: ef.bonus, concentracao: concentracao, circulo: circuloNum, rotulo: `Vant. SG ${ef.condicao}` });
      } else if (ef.tipo === 'vantagem_sg_condicoes') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'vantagem_sg_condicoes', condicoes: ef.condicoes, concentracao: concentracao, circulo: circuloNum, rotulo: 'Vant. SG contra condições' });
      } else if (ef.tipo === 'buff_d20') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'buff_d20', bonus: ef.bonus, aplica_em: ef.aplica_em, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
      } else if (ef.tipo === 'desv_ataques_contra_mim') {
        char.efeitos_magicos.push({ nome: nomeMagia + ' (Desv.)', tipo: 'desv_ataques_contra_mim', concentracao: concentracao, circulo: circuloNum, rotulo: 'Inimigos: Desv. ataques contra você' });
      } else if (ef.tipo === 'protecao_pv_max') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'protecao_pv_max', concentracao: concentracao, circulo: circuloNum, rotulo: 'PV máximos protegidos' });
      } else if (ef.tipo === 'bonus_pv_max') {
        const bonusPV = ef.media || 11;
        char.pv_max_override = (char.pv_max_override || char.pv_max) + bonusPV;
        char.pv_atual = (char.pv_atual || 0) + bonusPV;
        char.efeitos_magicos.push({ nome: nomeMagia + ' (PV Máx)', tipo: 'bonus_pv_max', valor: bonusPV, concentracao: concentracao, circulo: circuloNum, rotulo: `PV máx +${bonusPV}` });
      }
    }
    return null;
  }
  return null;
}

// Modal de selecao de alvo (self/outro)
function mostrarModalAlvoMagia(nomeMagia, circ, onEscolha) {
  const config = MAGIAS_EFEITO[nomeMagia];
  if (!config) { onEscolha('self'); return; }
  if (config.permite_self && !config.permite_outro) { onEscolha('self'); return; }
  if (!config.permite_self && config.permite_outro) { onEscolha('outro'); return; }

  abrirModal('Alvo da Magia', `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${nomeMagia}</strong> (${circ}º Círculo)
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${config.rotulo}</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn btn-primary" id="alvo-self">Em mim</button>
      <button class="btn btn-secondary" id="alvo-outro">Outra criatura</button>
    </div>
  `, '');
  document.getElementById('alvo-self')?.addEventListener('click', () => { window.fecharModal(); onEscolha('self'); });
  document.getElementById('alvo-outro')?.addEventListener('click', () => { window.fecharModal(); onEscolha('outro'); });
}

/**
 * Rastreia concentração de magia sem mecânica própria em MAGIAS_EFEITO --
 * a mesma vaga única que `getConcentracaoAtiva` lê.
 */
function rastrearConcentracaoGenerica(nome, circulo) {
  if (!ehMagiaConcentracao(nome)) return;
  if (!char.efeitos_magicos) char.efeitos_magicos = [];
  char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
  char.efeitos_magicos.push({
    nome, tipo: 'concentracao_generica', concentracao: true,
    circulo: parseInt(circulo) || 0, rotulo: `Concentrando em ${nome}`,
  });
}

/**
 * Núcleo da conjuração que NÃO gasta espaço: aplica o efeito mecânico da
 * magia (perguntando o alvo quando a magia aceita os dois) e registra a
 * concentração, exatamente como a conjuração normal faz -- só sem debitar o
 * espaço. Não confirma troca de concentração: quem chama já decidiu isso.
 */
function aplicarConjuracaoSemEspaco(nome, circulo, mensagem) {
  const finalizar = () => {
    salvar();
    renderFichaCompleta();
    toast(mensagem, 'success');
  };
  const config = MAGIAS_EFEITO[nome];
  if (config) {
    const precisaAlvo = config.permite_self && config.permite_outro;
    const autoSelf = config.permite_self && !config.permite_outro;
    if (precisaAlvo) {
      mostrarModalAlvoMagia(nome, circulo, (alvo) => {
        // Em outra criatura, `aplicarEfeitoMagico` não entra -- a
        // concentração ainda precisa ser registrada aqui.
        if (alvo === 'self') aplicarEfeitoMagico(nome, circulo);
        else rastrearConcentracaoGenerica(nome, circulo);
        finalizar();
      });
      return;
    }
    if (autoSelf) {
      aplicarEfeitoMagico(nome, circulo);
      finalizar();
      return;
    }
  }
  rastrearConcentracaoGenerica(nome, circulo);
  finalizar();
}

/**
 * Conjura uma magia SEM gastar espaço de magia, com tudo o que a conjuração
 * normal faz de resto: efeito mecânico, alvo, concentração (inclusive a
 * confirmação de troca).
 *
 * Existe porque o que o livro dispensa nessas características é o ESPAÇO, e
 * só ele. A Maestria de Magias e a Assinatura Mágica do Mago
 * (sheet/habilidades.js) apenas emitiam um toast: conjurar Armadura Arcana
 * pela Maestria não mexia na CA, e valia para qualquer magia com efeito
 * mecânico. Uma rota só, compartilhada, é o que impede as duas telas de
 * responderem coisas diferentes para a mesma regra.
 *
 * @param {string} nome nome da magia
 * @param {number} circulo círculo em que ela sai
 * @param {string} mensagem texto do toast de sucesso
 */
export function conjurarSemEspaco(nome, circulo, mensagem) {
  const concentracaoAtiva = getConcentracaoAtiva();
  if (ehMagiaConcentracao(nome) && concentracaoAtiva && concentracaoAtiva !== nome) {
    confirmarSubstituirConcentracao(concentracaoAtiva, nome,
      () => aplicarConjuracaoSemEspaco(nome, circulo, mensagem));
    return;
  }
  aplicarConjuracaoSemEspaco(nome, circulo, mensagem);
}

// Modal de selecao de opcao (tipo de dano, atributo, variante)
function mostrarModalSelecaoMagia(nomeMagia, circ, listaOpcoes, titulo, onSelecao) {
  const html = `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${nomeMagia}</strong> (${circ}º Círculo)
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
      ${listaOpcoes.map((op, i) => `<button class="btn btn-secondary" data-sel-idx="${i}">${op}</button>`).join('')}
    </div>
  `;
  abrirModal(titulo, html, '');
  listaOpcoes.forEach((op, i) => {
    document.querySelector(`[data-sel-idx="${i}"]`)?.addEventListener('click', () => { window.fecharModal(); onSelecao(op); });
  });
}

// Modal de selecao de condicao a remover (Restauracao Menor/Maior)
function mostrarModalCuraCondicao(nomeMagia, circ, opcoesRemover, onSelecao) {
  const condicoesAtivas = char.condicoes || [];
  let disponiveis;
  if (nomeMagia === 'Restauração Maior') {
    disponiveis = opcoesRemover;
  } else {
    disponiveis = opcoesRemover.filter(c => condicoesAtivas.includes(c));
  }
  if (disponiveis.length === 0) {
    toast(`${nomeMagia}: Nenhuma condição removível encontrada.`, 'info');
    return;
  }
  const html = `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${nomeMagia}</strong> (${circ}º Círculo)<br>
      <span style="font-size:0.8rem;color:var(--text-muted)">Selecione a condição a remover:</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
      ${disponiveis.map((c, i) => `<button class="btn btn-secondary" data-cura-idx="${i}">${c}</button>`).join('')}
    </div>
  `;
  abrirModal('Remover Condição', html, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>');
  disponiveis.forEach((c, i) => {
    document.querySelector(`[data-cura-idx="${i}"]`)?.addEventListener('click', () => { window.fecharModal(); onSelecao(c); });
  });
}

/**
 * Modal "De qual reserva conjurar?" (Tarefa 7, sub-projeto 4) -- só é
 * chamado quando o círculo pedido tem espaço disponível nas DUAS fontes
 * (Conjuração e Magia de Pacto) ao mesmo tempo; com uma reserva só, o
 * chamador gasta dela direto, sem abrir modal nenhum -- mesmo precedente
 * do seletor de dado de vida (montarSeletorDeReserva, hp-descanso.js,
 * sub-projeto 3e): o seletor só aparece com mais de uma opção.
 *
 * A DECISÃO DE PRODUTO: livro:2116 diz "pode usar" -- permissão, não
 * ordem de gasto (uma varredura por termos de ordem no livro e em
 * Classes.md não retorna nada). E a escolha não é neutra: o pacto volta
 * no Descanso Curto (Classes.md:898) e a Conjuração só no Longo, então
 * gastar o pacto primeiro é quase sempre a jogada ótima -- MAS há
 * invocações que CONSOMEM espaço de pacto para outra coisa
 * (Classes.md:1342, :1473), então o jogador pode querer guardá-lo de
 * propósito. Uma ordem automática (ex.: "gasta pacto primeiro sempre")
 * jogaria pelo jogador e estragaria esse recurso reservado -- por isso o
 * app pergunta, em vez de decidir.
 *
 * @param {string} nome Nome da magia, só para o texto do modal.
 * @param {number|string} circulo Círculo em que a magia sai.
 * @param {Array<{fonte:'conjuracao'|'pacto', total:number, usados:number, disponiveis:number}>} fontes
 *   As reservas candidatas -- o chamador já filtrou por disponiveis > 0.
 * @param {(fonte: 'conjuracao'|'pacto') => void} onEscolher Chamado com a
 *   fonte escolhida quando o jogador confirma.
 */
function mostrarSeletorFonteMagia(nome, circulo, fontes, onEscolher) {
  const rotuloFonte = (f) => f.fonte === 'conjuracao' ? 'Conjuração' : 'Magia de Pacto';
  const idSelect = 'select-fonte-magia';
  const idConfirmar = 'btn-confirmar-fonte-magia';
  const html = `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${escHtml(nome)}</strong> (${circulo}º Círculo)<br>
      <span style="font-size:0.8rem;color:var(--text-muted)">De qual reserva conjurar?</span>
    </div>
    <select id="${idSelect}" class="input" style="width:100%">
      ${fontes.map(f => `<option value="${f.fonte}">${rotuloFonte(f)} — ${f.disponiveis} de ${f.total} disponíveis</option>`).join('')}
    </select>
  `;
  abrirModal('Escolher Reserva', html,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>'
    + `<button class="btn btn-primary" id="${idConfirmar}">Conjurar</button>`
  );
  document.getElementById(idConfirmar)?.addEventListener('click', () => {
    const fonte = document.getElementById(idSelect)?.value || fontes[0].fonte;
    window.fecharModal();
    onEscolher(fonte);
  });
}

/**
 * Decide SE mostra o seletor "De qual reserva?" e chama `continuar(fonte)`
 * com a fonte final -- compartilhado pelos DOIS botões que gastam espaço
 * de magia (preparada, `[data-conjurar]`; personalizada,
 * `[data-conjurar-magia-custom]`). Extraído na revisão desta tarefa: os
 * dois handlers tinham as MESMAS oito linhas (filtrar por círculo e
 * disponibilidade, ramificar em `length > 1`, sobrescrever a fonte
 * escolhida, continuar) -- e este projeto já pagou pelo custo de duas
 * cópias de seletor divergirem (sub-projeto 3e, `montarSeletorDeReserva`
 * foi extraído pelo mesmo motivo). Pelo próprio argumento de produto
 * desta tarefa -- a pergunta "de qual reserva sai o espaço?" é sobre
 * CONJURAR, não sobre um tipo de magia -- os dois caminhos têm de decidir
 * IGUAL, e um helper único é o que garante isso sem depender de disciplina
 * de cópia-e-cola.
 *
 * @param {string} nome Nome da magia, só para o texto do modal.
 * @param {number|string} circulo Círculo em que a magia sai.
 * @param {(fonte: 'conjuracao'|'pacto') => void} continuar Chamado com a
 *   fonte final, exatamente uma vez -- com o seletor (duas ou mais
 *   reservas com espaço), com a ÚNICA reserva que sobrou com espaço
 *   (`fontesDoCirculo[0]`, achado da revisão de branch, Important 3 --
 *   antes este caso caía direto em `reservaDoCirculo`, que resolve por
 *   PRECEDÊNCIA e não por disponibilidade, e podia devolver uma fonte já
 *   esgotada mesmo com a outra ainda de pé), ou com o resultado de
 *   `reservaDoCirculo` só quando NENHUMA fonte deste círculo tem espaço
 *   (`fontesDoCirculo` vazio -- não há resposta certa, e o gate de
 *   `setupEventosEspacosMagia` já bloqueou o clique antes de chegar aqui).
 */
function decidirFonteEContinuar(nome, circulo, continuar) {
  const circuloNum = Number(circulo);
  const fontesDoCirculo = reservasDeEspacos()
    .filter(r => r.circulo === circuloNum && r.disponiveis > 0);
  if (fontesDoCirculo.length > 1) {
    mostrarSeletorFonteMagia(nome, circulo, fontesDoCirculo, continuar);
  } else {
    continuar((fontesDoCirculo[0] || reservaDoCirculo(circulo))?.fonte);
  }
}

export function setupEventosEspacosMagia() {
  // Seletor de superficie de conjuracao (Tarefa 4, sub-projeto "tela
  // magias por classe") -- ver o comentario de `tabs-superficie-magia` em
  // renderSecaoMagias. Clicar so grava a escolha e re-renderiza; toda a
  // logica de "qual classe" continua em superficieAtiva()/
  // superficieAtivaDaFicha, nunca duplicada aqui.
  document.querySelectorAll('[data-tab-superficie]').forEach(tab => {
    tab.addEventListener('click', () => {
      definirSuperficieSelecionada(tab.dataset.tabSuperficie);
      renderFichaCompleta();
    });
  });

  // Clicar nas bolhas de espaço de magia -- Tarefa 4 (sub-projeto 4):
  // convertido para os escritores autorizados de sheet/reservas-espacos.js.
  // O clique continua podendo "pular" direto para o índice clicado (gastar
  // ou restaurar vários de uma vez, não só 1) -- por isso o laço, em vez de
  // uma única chamada: gastarEspaco/recuperarUmEspaco só fazem 1 espaço por
  // chamada, e não existe (nem deveria existir) um escritor de valor
  // absoluto -- ver o docblock de recuperarUmEspaco.
  document.querySelectorAll('.slot-bolha').forEach(el => {
    el.addEventListener('click', () => {
      const fonte = el.dataset.slotFonte;
      const circ = el.dataset.slotCirc;
      const idx = parseInt(el.dataset.slotIdx);
      const reserva = reservasDeEspacos().find(r => r.fonte === fonte && r.circulo === Number(circ));
      if (!reserva) return;
      if (idx < reserva.usados) {
        // Restaurar até este slot (inclusive)
        for (let i = reserva.usados; i > idx; i--) recuperarUmEspaco(char, fonte, circ);
      } else {
        // Gastar até este slot (inclusive)
        for (let i = reserva.usados; i <= idx; i++) gastarEspaco(char, fonte, circ);
      }
      salvar();
      renderFichaCompleta();
    });
  });

  // Sortudo: gastar ponto de sorte
  document.querySelectorAll('[data-sortudo-acao]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.sortudo) char.recursos.sortudo = { pontos_gastos: 0 };
      const total = bonusProficiencia(char.nivel);
      if (char.recursos.sortudo.pontos_gastos >= total) return;
      char.recursos.sortudo.pontos_gastos++;
      const acao = btn.dataset.sortudoAcao;
      const disponiveis = total - char.recursos.sortudo.pontos_gastos;
      if (acao === 'vantagem') {
        toast(`Sortudo: Vantagem ativada! Role novamente e use o melhor resultado. (${disponiveis} ponto(s) restante(s))`, 'success');
      } else {
        toast(`Sortudo: Desvantagem imposta ao atacante como Reação! (${disponiveis} ponto(s) restante(s))`, 'success');
      }
      salvar();
      renderFichaCompleta();
    });
  });

  // Conjurar magia (gasta slot)
  document.querySelectorAll('[data-conjurar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const nome = btn.dataset.conjurar;
      const selectEl = btn.parentElement?.querySelector(`[data-conj-select="${nome}"]`);
      const circ = selectEl ? selectEl.value : btn.dataset.conjCirc;
      // CRITICAL da revisao do controlador: esta era a leitura na forma
      // ANTIGA que fazia "Conjurar" virar no-op silencioso para qualquer
      // conjurador de classe unica -- a forma PRINCIPAL de gastar espaco no
      // app. O gate confere se ALGUMA fonte deste circulo tem espaco --
      // nao mais so a prioritaria (achado da revisao de branch, Important
      // 3): com `reservaDoCirculo` sozinho, a conjuracao esgotada bloqueava
      // o clique mesmo com o pacto colidido ainda de pe, um beco sem saida
      // para Bruxo/Mago no mesmo circulo. `decidirFonteEContinuar` (abaixo)
      // resolve QUAL fonte gastar; este gate so decide SE pode prosseguir.
      const circuloNum = Number(circ);
      const temEspacoNesteCirculo = reservasDeEspacos()
        .some(r => r.circulo === circuloNum && r.disponiveis > 0);
      if (!temEspacoNesteCirculo) {
        toast(`Sem espaços de ${circ}º círculo!`, 'error');
        return;
      }

      // Verificar conflito de concentracao ANTES de prosseguir
      const magiaEhConc = ehMagiaConcentracao(nome);
      const concAtiva = getConcentracaoAtiva();
      const temConflitoConc = magiaEhConc && concAtiva && concAtiva !== nome;

      // Tarefa 7 (sub-projeto 4): a fonte que _executarConjuracao vai
      // gastar -- sempre definida por decidirFonteEContinuar (abaixo)
      // antes de qualquer chamada a _executarConjuracao, direto (uma
      // reserva so) ou depois do jogador escolher no seletor. Ligada por
      // PARAMETRO em cada chamada de _executarConjuracao, nao por closure,
      // porque essa funcao vive fora deste forEach e e chamada de varios
      // pontos do fluxo (alguns atras de modais assincronos de efeito/
      // metamagia).
      let _fonteEscolhida;

      const _prosseguirConjuracao = () => {

      const config = MAGIAS_EFEITO[nome];
      if (config) {
        const precisaAlvo = config.permite_self && config.permite_outro;
        const autoSelf = config.permite_self && !config.permite_outro;

        const prosseguir = (aplicarSelf) => {
          if (!aplicarSelf) {
            _executarConjuracao(nome, circ, btn.dataset.conjCirc, false, undefined, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);
            return;
          }
          // Verificar modais de selecao necessarios
          if (config.selecionar_tipo) {
            mostrarModalSelecaoMagia(nome, circ, config.selecionar_tipo, 'Escolher Tipo', (tipo) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { tipo_selecionado: tipo }, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);
            });
          } else if (config.selecionar_atributo) {
            mostrarModalSelecaoMagia(nome, circ, config.selecionar_atributo, 'Escolher Atributo', (attr) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { atributo_selecionado: attr }, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);
            });
          } else if (config.selecionar_variante) {
            mostrarModalSelecaoMagia(nome, circ, Object.keys(config.selecionar_variante), 'Escolher Variante', (v) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { variante_selecionada: v }, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);
            });
          } else if (config.tipo === 'cura_condicao') {
            const lista = config.condicoes || config.efeitos || [];
            mostrarModalCuraCondicao(nome, circ, lista, (c) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { condicao_removida: c }, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);
            });
          } else {
            _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, undefined, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);
          }
        };

        if (precisaAlvo) {
          mostrarModalAlvoMagia(nome, circ, (alvo) => prosseguir(alvo === 'self'));
        } else {
          prosseguir(autoSelf);
        }
        return;
      }

      // Magia sem efeito especifico - apenas gasta slot e mostra toast
      _executarConjuracao(nome, circ, btn.dataset.conjCirc, false, undefined, _metasAplicadas, _opcoesMetaConj, _fonteEscolhida);

      }; // fim de _prosseguirConjuracao

      // Estado de metamagia para esta conjuracao (Feiticeiro)
      let _metasAplicadas = [];
      let _opcoesMetaConj = {};

      const _iniciarConjuracaoComMetamagia = () => {
        if (char.classe === 'Feiticeiro' && (char.nivel || 1) >= 2) {
          const estadoFeit = getEstadoRecursosFeiticeiro();
          if (estadoFeit && estadoFeit.metamagias.length > 0 && estadoFeit.pontosAtuais > 0) {
            mostrarModalMetamagiaConjuracao(nome, circ, (metas, opcoesMeta) => {
              _metasAplicadas = metas || [];
              _opcoesMetaConj = opcoesMeta || {};
              _prosseguirConjuracao();
            });
            return;
          }
          // Feedback quando metamagia é pulada por falta de PF
          if (estadoFeit && estadoFeit.metamagias.length > 0 && estadoFeit.pontosAtuais === 0) {
            toast('Metamagia indisponível: sem Pontos de Feitiçaria.', 'info');
          }
        }
        _prosseguirConjuracao();
      };

      const _continuarAposEscolherFonte = () => {
        // Se ha conflito de concentracao, pedir confirmacao
        if (temConflitoConc) {
          confirmarSubstituirConcentracao(concAtiva, nome, _iniciarConjuracaoComMetamagia);
        } else {
          _iniciarConjuracaoComMetamagia();
        }
      };

      // O SELETOR DE RESERVA (Tarefa 7): decidirFonteEContinuar (acima)
      // só abre o modal quando as DUAS fontes tem espaco disponivel NESTE
      // circulo -- com uma reserva so, nada muda na tela e o gasto segue
      // direto. livro:2116 da PERMISSAO ("pode usar"), nao ORDEM de gasto
      // -- ver o docblock de mostrarSeletorFonteMagia para o raciocinio
      // completo (por que uma ordem automatica jogaria pelo jogador).
      decidirFonteEContinuar(nome, circ, (fonte) => {
        _fonteEscolhida = fonte;
        _continuarAposEscolherFonte();
      });
    });
  });

  function _executarConjuracao(nome, circ, baseCirc, aplicarEfeitoSelf, opcoes, metamagiasAplicadas, opcoesMeta, fonte) {
    // A fonte vem por PARAMETRO desde a Tarefa 7 (sub-projeto 4): o
    // seletor "De qual reserva?" (mostrarSeletorFonteMagia, acima) deixa a
    // escolha com o jogador quando as duas tem espaco; com uma reserva so,
    // o chamador ja resolveu `fonte` antes de abrir qualquer modal. O
    // fallback (`reservaDoCirculo(circ)?.fonte`, a MESMA prioridade da
    // checagem que liberou o clique) cobre so a folga entre o clique e
    // aqui -- gastarEspaco falha e devolve false silenciosamente se a
    // reserva pedida tiver esvaziado nesse meio-tempo (concorrencia de
    // UI), o que e aceitavel: o botao ja checou "disponivel" antes de abrir
    // qualquer modal.
    gastarEspaco(char, fonte || reservaDoCirculo(circ)?.fonte, circ);

    if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem')) {
      const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
      if (estadoFeiticeiro && !estadoFeiticeiro.subclasses.selvagem.mares_caos_disponivel) {
        char.recursos.feiticeiro.subclasses.selvagem.mares_caos_disponivel = true;
        char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = true;
      }
    }

    let resultado = null;
    if (aplicarEfeitoSelf) {
      resultado = aplicarEfeitoMagico(nome, circ, opcoes);
    }

    // Rastrear concentracao de magias sem mecanica no MAGIAS_EFEITO
    const magiaTemConc = ehMagiaConcentracao(nome);
    if (magiaTemConc && !aplicarEfeitoSelf) {
      if (!char.efeitos_magicos) char.efeitos_magicos = [];
      // Remover concentracoes anteriores
      char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
      // Registrar concentracao generica
      char.efeitos_magicos.push({ nome: nome, tipo: 'concentracao_generica', concentracao: true, circulo: parseInt(circ) || 0, rotulo: `Concentrando em ${nome}` });
    }

    // Processar metamagias aplicadas (Feiticeiro)
    let metaTexto = '';
    if (metamagiasAplicadas && metamagiasAplicadas.length > 0 && char.classe === 'Feiticeiro') {
      metaTexto = _processarMetamagiasConjuracao(metamagiasAplicadas, opcoesMeta, nome, circ);
    }

    salvar();
    const upcast = parseInt(circ) > parseInt(baseCirc);
    const sufixoAlvo = aplicarEfeitoSelf ? ' (em você)' : '';
    const detalhe = resultado?.detalhe ? ` — ${resultado.detalhe}` : '';
    if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem') && char.recursos?.feiticeiro?.subclasses?.selvagem?.surto_pendente_automatico) {
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}${sufixoAlvo}${detalhe}${metaTexto}! Surto de Magia Selvagem automático pendente.`, 'success');
    } else {
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}${sufixoAlvo}${detalhe}${metaTexto}!`, 'success');
    }
    renderFichaCompleta();
  }

  // Função auxiliar para conjuração gratuita (talentos).
  //
  // Delega para `aplicarConjuracaoSemEspaco`, a mesma rota que a Maestria de
  // Magias e a Assinatura Mágica do Mago usam: esta função tinha uma CÓPIA da
  // aplicação de efeito/alvo/concentração, e dado derivado copiado diverge em
  // silêncio -- foi por não existir essa rota compartilhada que os botões do
  // Mago nasceram sem efeito nenhum.
  function _executarConjuracaoGratis(entrada, nome) {
    entrada.gratis_usado = true;
    aplicarConjuracaoSemEspaco(nome, entrada.circulo, `${nome} conjurada gratuitamente (talento)!`);
  }

  // Conjurar magia gratuitamente (talentos: 1x por descanso longo)
  document.querySelectorAll('[data-conjurar-gratis]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const nome = btn.dataset.conjurarGratis;
      const entrada = char.magias_preparadas.find(m => m.nome === nome && m.gratis_usado === false);
      if (!entrada) return;

      // Verificar conflito de concentração
      const magiaEhConc = ehMagiaConcentracao(nome);
      const concAtiva = getConcentracaoAtiva();
      if (magiaEhConc && concAtiva && concAtiva !== nome) {
        confirmar(
          `Você já está concentrando em <strong>${escHtml(concAtiva)}</strong>. Deseja perder a concentração e conjurar <strong>${escHtml(nome)}</strong> gratuitamente?`,
          () => {
            removerConcentracao();
            _executarConjuracaoGratis(entrada, nome);
          }
        );
        return;
      }

      _executarConjuracaoGratis(entrada, nome);
    });
  });

  // Lancar truque (nao gasta espaco de magia)
  document.querySelectorAll('[data-lancar-truque]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }
      const nome = btn.dataset.lancarTruque;

      // Verificar conflito de concentracao antes de executar
      const truqueEhConc = ehMagiaConcentracao(nome);
      const concAtiva = getConcentracaoAtiva();
      const temConflitoConc = truqueEhConc && concAtiva && concAtiva !== nome;

      const _executarTruque = () => {
        // Truque com efeito mecanico (ex: Protecao Contra Laminas)
        const config = MAGIAS_EFEITO[nome];
        if (config && config.truque && config.permite_self) {
          aplicarEfeitoMagico(nome, 0);
          salvar();
          renderFichaCompleta();
          toast(`${nome} lançado (em você)!`, 'success');
          return;
        }
        // Truque de concentracao sem mecanica: rastrear genericamente
        if (truqueEhConc) {
          if (!char.efeitos_magicos) char.efeitos_magicos = [];
          char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
          char.efeitos_magicos.push({ nome: nome, tipo: 'concentracao_generica', concentracao: true, circulo: 0, rotulo: `Concentrando em ${nome}` });
          salvar();
          renderFichaCompleta();
        }
        toast(`${nome} lançado!`, 'success');
      };

      if (temConflitoConc) {
        confirmarSubstituirConcentracao(concAtiva, nome, _executarTruque);
      } else {
        _executarTruque();
      }
    });
  });

  document.querySelectorAll('[data-conjurar-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const indice = Number(btn.dataset.conjurarMagiaCustom);
      const magia = normalizarMagiaPersonalizada((char.magias_customizadas || [])[indice], indice);
      const select = btn.parentElement?.querySelector(`[data-conj-select-custom="${indice}"]`);
      const circulo = Number(select?.value || btn.dataset.conjCirc);

      // A fonte que conjurarMagiaPersonalizada vai gastar -- sempre
      // definida por decidirFonteEContinuar (abaixo) antes de qualquer
      // chamada a executar(), direto (uma reserva so) ou depois do
      // jogador escolher no seletor.
      let _fonteEscolhida;

      const _prosseguirComFonte = () => {
        const concentracaoAtiva = getConcentracaoAtiva();
        const executar = () => conjurarMagiaPersonalizada(indice, circulo, _fonteEscolhida);
        if (magiaPersonalizadaEhConcentracao(magia) && concentracaoAtiva && concentracaoAtiva !== magia.nome) {
          confirmarSubstituirConcentracao(concentracaoAtiva, magia.nome, executar);
        } else {
          executar();
        }
      };

      // O SELETOR DE RESERVA (Tarefa 7, estendido por RULING do
      // controlador para a magia personalizada -- a mesma pergunta
      // "de qual reserva sai o espaço?" vale para qualquer gasto, não só
      // o de magia preparada): decidirFonteEContinuar é o MESMO helper
      // que o botão "Conjurar" de magia preparada usa, para os dois
      // caminhos nunca divergirem sobre quando perguntar.
      decidirFonteEContinuar(magia.nome, circulo, (fonte) => {
        _fonteEscolhida = fonte;
        _prosseguirComFonte();
      });
    });
  });

  document.querySelectorAll('[data-lancar-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const indice = Number(btn.dataset.lancarMagiaCustom);
      const registro = (char.magias_customizadas || [])[indice];
      if (!registro) return;
      const magia = normalizarMagiaPersonalizada(registro, indice);
      if (magia.circulo !== 0) return;

      const executar = () => {
        registrarConcentracaoMagiaPersonalizada(magia, 0);
        salvar();
        renderFichaCompleta();
        toast(`${magia.nome} lançado!`, 'success');
      };
      const concentracaoAtiva = getConcentracaoAtiva();
      if (magiaPersonalizadaEhConcentracao(magia) && concentracaoAtiva && concentracaoAtiva !== magia.nome) {
        confirmarSubstituirConcentracao(concentracaoAtiva, magia.nome, executar);
      } else {
        executar();
      }
    });
  });

  // Conjuração como RITUAL para magia do CATÁLOGO.
  //
  // Magias.md:62 -- "A magia pode ser conjurada conforme as regras normais de
  // conjuração ou como um Ritual. A versão Ritual de uma magia leva 10 minutos
  // a mais para ser conjurada, mas não utiliza um espaço de magia."
  //
  // Esta rota não existia: o único botão de ritual era o de magia
  // PERSONALIZADA (`-custom`, logo abaixo), e o do grimório do Mago estava
  // ligado ao handler do Pacto do Bruxo -- que só emitia um toast dizendo
  // "via Pacto". Um Mago com Detectar Magia preparada não tinha como
  // conjurá-la como Ritual: ou gastava um espaço, ou não conjurava.
  //
  // Os 10 minutos a mais não são modelados de propósito: o app é ficha, não
  // mesa, e não controla passagem de tempo em nenhum outro lugar. O que ele
  // modela -- o espaço de magia -- é justamente o que o Ritual não gasta.
  document.querySelectorAll('[data-conjurar-ritual]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const nome = btn.dataset.conjurarRitual;
      if (!nome || !ehMagiaRitual(nome)) return;

      const executar = () => {
        // Concentração vale igual na versão Ritual: o que muda é o espaço.
        // A vaga é a mesma que `getConcentracaoAtiva` lê -- um só efeito com
        // `concentracao: true` em `char.efeitos_magicos`.
        if (ehMagiaConcentracao(nome)) {
          const circulo = Number(btn.dataset.conjCirc) || 0;
          if (!char.efeitos_magicos) char.efeitos_magicos = [];
          char.efeitos_magicos = char.efeitos_magicos.filter(efeito => !efeito.concentracao);
          char.efeitos_magicos.push({
            nome,
            tipo: 'concentracao_generica',
            concentracao: true,
            circulo,
            rotulo: `Concentrando em ${nome}`,
          });
        }
        salvar();
        renderFichaCompleta();
        toast(`${nome} conjurada como Ritual (sem gastar espaço).`, 'success');
      };

      const concAtiva = getConcentracaoAtiva();
      if (ehMagiaConcentracao(nome) && concAtiva && concAtiva !== nome) {
        confirmarSubstituirConcentracao(concAtiva, nome, executar);
      } else {
        executar();
      }
    });
  });

  document.querySelectorAll('[data-conjurar-ritual-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const indice = Number(btn.dataset.conjurarRitualCustom);
      const registro = (char.magias_customizadas || [])[indice];
      if (!registro) return;
      const magia = normalizarMagiaPersonalizada(registro, indice);
      if (!magia.ritual || magia.circulo <= 0) return;

      const executar = () => {
        registrarConcentracaoMagiaPersonalizada(magia, magia.circulo);
        salvar();
        renderFichaCompleta();
        toast(`${magia.nome} conjurada como Ritual (sem gastar espaço).`, 'success');
      };
      const concentracaoAtiva = getConcentracaoAtiva();
      if (magiaPersonalizadaEhConcentracao(magia) && concentracaoAtiva && concentracaoAtiva !== magia.nome) {
        confirmarSubstituirConcentracao(concentracaoAtiva, magia.nome, executar);
      } else {
        executar();
      }
    });
  });

  // Expandir detalhes da magia ao clicar
  document.querySelectorAll('.magia-item[data-magia-nome]').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      const nome = item.dataset.magiaNome;
      const circ = parseInt(item.dataset.magiaCirc);
      const descEl = item.querySelector('.magia-desc');

      if (item.classList.contains('expandida')) {
        item.classList.remove('expandida');
        return;
      }

      // Carregar descrição se vazia
      if (!descEl.innerHTML.trim()) {
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (magia) {
          descEl.innerHTML = `
            <div class="magia-meta" style="margin-bottom:4px">
              <span>${magia.escola}</span> | <span>${magia.tempo_conjuracao}</span> |
              <span>${magia.alcance}</span> | <span>${magia.componentes}</span> |
              <span>${magia.duracao}</span>
            </div>
            <div class="md-content">${mdParaHtml(magia.descricao)}</div>
            ${magia.circulo_superior ? `<div class="info-box info" style="margin-top:4px"><strong>Circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
          `;
        }
      }
      item.classList.add('expandida');
    });
  });

  document.querySelectorAll('.magia-item[data-magia-custom-index]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      const indice = Number(item.dataset.magiaCustomIndex);
      const magia = normalizarMagiaPersonalizada((char.magias_customizadas || [])[indice], indice);
      const descEl = item.querySelector('.magia-desc');
      if (item.classList.contains('expandida')) {
        item.classList.remove('expandida');
        return;
      }
      if (descEl && !descEl.innerHTML.trim()) descEl.innerHTML = renderDetalhesMagiaPersonalizada(magia);
      item.classList.add('expandida');
    });
  });

  // Adicionar magia do livro
  document.getElementById('btn-add-magia')?.addEventListener('click', () => mostrarBuscaMagia());

  // Adicionar talento manualmente
  document.getElementById('btn-add-talento')?.addEventListener('click', () => abrirModalAdicionarTalento());
  document.querySelectorAll('[data-talento-recurso]').forEach(btn => {
    btn.addEventListener('click', () => {
      const recursos = char.recursos?.talentos;
      if (!recursos) return;
      switch (btn.dataset.talentoRecurso) {
        case 'ritual-rapido':
          recursos.conjurador_ritualista.ritual_rapido_usado =
            !recursos.conjurador_ritualista.ritual_rapido_usado;
          break;
        case 'recuperacao-ate-morte':
          recursos.dadiva_recuperacao.ate_a_morte_usado =
            !recursos.dadiva_recuperacao.ate_a_morte_usado;
          break;
        case 'recuperacao-dado':
          recursos.dadiva_recuperacao.dados_vitalidade_gastos =
            Math.min(10, (recursos.dadiva_recuperacao.dados_vitalidade_gastos || 0) + 1);
          break;
        case 'dadiva-destino':
          recursos.dadiva_destino.usado = !recursos.dadiva_destino.usado;
          break;
        case 'dadiva-proeza':
          recursos.dadiva_proeza_combate.usado_no_turno =
            !recursos.dadiva_proeza_combate.usado_no_turno;
          break;
        default:
          return;
      }
      salvar();
      renderFichaCompleta();
    });
  });

  // Substituição de Magia (Iniciado em Magia): trocar truques/magia de uma instância
  document.querySelectorAll('[data-editar-im]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarIniciadoEmMagia(parseInt(btn.dataset.editarIm)));
  });

  // Preencher slot de magia liberado por ajuste automático (bug de magia passiva duplicada)
  document.getElementById('btn-preencher-slot-magia')?.addEventListener('click', () => abrirPreenchimentoSlotMagia('magia'));
  document.getElementById('btn-preencher-slot-truque')?.addEventListener('click', () => abrirPreenchimentoSlotMagia('truque'));

  // Adicionar magia customizada
  document.getElementById('btn-add-magia-custom')?.addEventListener('click', () => mostrarFormMagiaCustom());

  document.querySelectorAll('[data-editar-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.editarMagiaCustom);
      if (Number.isInteger(idx) && (char.magias_customizadas || [])[idx]) mostrarFormMagiaCustom(idx);
    });
  });

  // Remover magia customizada
  document.querySelectorAll('[data-remover-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.removerMagiaCustom);
      const magia = (char.magias_customizadas || [])[idx];
      if (!magia) return;
      abrirModal(
        'Remover magia personalizada',
        `<p>Remover <strong>${escHtml(String(magia.nome || 'esta magia'))}</strong>?</p><p style="font-size:0.8rem;color:var(--text-muted)">Esta ação não altera seus espaços de magia nem as demais magias.</p>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-remover-magia-custom">Remover</button>'
      );
      document.getElementById('btn-confirmar-remover-magia-custom')?.addEventListener('click', () => {
        const atual = (char.magias_customizadas || [])[idx];
        if (!atual) {
          fecharModal();
          return;
        }
        const nome = String(atual.nome || 'Magia personalizada');
        // temClasse (Tarefa 3), não o espelho char.classe: mesma correção
        // de `ehMago` acima -- um Clérigo 5/Mago 1 também precisa que a
        // remoção de uma magia personalizada tire a entrada do grimório.
        if (temClasse(char, 'Mago') && Array.isArray(char.grimorio)) {
          const idxGrimorio = char.grimorio.findIndex(m => m?.nome === atual.nome);
          if (idxGrimorio >= 0) char.grimorio.splice(idxGrimorio, 1);
        }
        char.magias_preparadas = (char.magias_preparadas || []).filter(m => !(m.personalizada && m.nome === atual.nome));
        char.magias_customizadas.splice(idx, 1);
        fecharModal();
        salvar();
        renderFichaCompleta();
        toast(`${nome} removida.`, 'success');
      });
    });
  });

  // Grimório: preparar magia do grimório (com validação de limite)
  document.querySelectorAll('[data-preparar-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.prepararGrimorio;
      const circ = parseInt(btn.dataset.prepCirc);
      if (char.magias_preparadas.find(m => m.nome === nome)) return;

      // Validar limite de magias preparadas. O grimório é sempre do Mago
      // (nivelETabelaDoMago, topo do arquivo) -- nunca a tabela/nível da
      // classe INICIAL (`classeData`/`char.nivel`, os espelhos): num
      // Clérigo 5/Mago 1 esse par apontava para o Clérigo e o nível TOTAL,
      // travando (ou liberando) o botão pelo limite errado.
      const { nivel: _nivelMago, tabela: _tabelaMago } = nivelETabelaDoMago();
      const maxPrep = _tabelaMago ? getMagiaPreparadas(_tabelaMago, _nivelMago) : 99;
      // ACHADO IMPORTANT da revisão da Tarefa 3: a CONTAGEM tinha o mesmo
      // problema que o LIMITE tinha antes daquela tarefa, só do outro lado.
      // `char.magias_preparadas` era GLOBAL (todas as classes, sem campo
      // que dissesse de quem era cada entrada) -- confrontá-la crua contra
      // o limite do Mago travava o botão PERMANENTEMENTE para qualquer
      // personagem com outra classe conjuradora: Clérigo 5/Mago 1 tinha 9
      // preparadas do Clérigo, o limite do Mago 1 é 4, e `9 >= 4` nunca
      // deixava de ser verdade -- "Preparar" nunca funcionava.
      //
      // Tarefa 4 do sub-projeto "magia sabe a classe": o proxy antigo
      // (contar só as preparadas que TAMBÉM estão no grimório, e só
      // bloquear com uma superfície só) dá lugar à medida DIRETA --
      // `preparadasPorClasse(char, 'Mago')` ('Mago' literal pelo mesmo
      // motivo do `char.magias_preparadas.push` logo abaixo). Regra do
      // BLOQUEIO: só recusa com contagem CERTA (`semClasse.length === 0`)
      // -- havendo magia sem classe, a contagem é incerta e o botão deixa
      // passar (o contador "+N sem classe" já avisa o jogador na tela).
      const classificacaoMago = preparadasPorClasse(char, 'Mago');
      const preparadasDoMago = classificacaoMago.desta;
      if (preparadasDoMago.length >= maxPrep && classificacaoMago.semClasse.length === 0) {
        toast(`Limite de magias preparadas atingido (${maxPrep}). Desprepare uma magia primeiro.`, 'error');
        return;
      }

      const ehCustomizadaCirculo = (char.magias_customizadas || []).some(m => m?.nome === nome && Number(m.circulo) > 0);
      // 'Mago' literal, nao superficieAtiva()?.classe: este painel de
      // grimorio e renderizado por `ehMago = temClasse(char, 'Mago')`
      // (linha 651), independente de qual classe esta selecionada no
      // seletor da ficha -- um Clerigo 5/Mago 1 com o Clerigo como
      // superficie ativa ainda ve e usa este botao. A magia que sai do
      // grimorio e sempre do Mago, e usar a superficie ativa carimbaria a
      // classe ERRADA sempre que o seletor nao estiver no Mago.
      char.magias_preparadas.push({ nome, circulo: circ, classe: 'Mago', ...(ehCustomizadaCirculo ? { personalizada: true } : {}) });
      salvar();
      renderFichaCompleta();
      toast(`${nome} preparada a partir do grimório (${preparadasDoMago.length + 1}/${maxPrep})`, 'success');
    });
  });

  // Grimório: despreparar magia (mantém no grimório)
  document.querySelectorAll('[data-despreparar-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.desprepararGrimorio;
      char.magias_preparadas = (char.magias_preparadas || []).filter(m => m.nome !== nome);
      salvar();
      renderFichaCompleta();
      toast(`${nome} despreparada (permanece no grimório)`, 'info');
    });
  });

  // Grimório: remover magia do grimório
  document.querySelectorAll('[data-remover-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.removerGrimorio;
      abrirModal('Remover magia do grimório',
        `<p>Remover <strong>${escHtml(nome)}</strong> do grimório?</p><p style="font-size:0.8rem;color:var(--text-muted)">A magia também deixará sua lista de magias preparadas.</p>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-remover-grimorio">Remover</button>'
      );
      document.getElementById('btn-confirmar-remover-grimorio')?.addEventListener('click', () => {
        // Também remover das preparadas se estava preparada
        char.magias_preparadas = (char.magias_preparadas || []).filter(m => m.nome !== nome);
        char.grimorio = (char.grimorio || []).filter(m => m.nome !== nome);
        fecharModal();
        salvar();
        renderFichaCompleta();
        toast(`${nome} removida do grimório`, 'success');
      });
    });
  });

  // Grimório: botão de copiar magia
  document.getElementById('btn-add-grimorio')?.addEventListener('click', () => mostrarBuscaGrimorio());
}
