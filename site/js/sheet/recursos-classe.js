// ============================================================
// Faixa de recursos de classe da ficha.
//
// Os painéis azuis que ficavam acima de CA/Iniciativa foram movidos para
// onde o jogador usa o recurso:
//   - classes conjuradoras: faixa no topo do card Magias;
//   - demais classes (e conjuradoras sem card de Magias): card
//     "Recursos de Classe" logo antes das Características de Classe.
//
// Cada recurso é um chip. Clicar no chip (fora dos botões) abre um popup com
// a descrição da característica, lida dos dados da classe. Os botões mantêm
// os mesmos atributos `data-*-acao` de antes; os handlers continuam em
// habilidades.js e nos módulos de classe.
// ============================================================
import { abrirModal, escHtml, mdParaHtml, semAcento } from '../utils.js';
import { nivelNa, subclasseDe } from '../regras-multiclasse.js';
import { char, containerRef } from './estado.js';
import { contextosDeClasse } from './contexto-classe.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { getEstadoInspiracaoBardo } from './classes/bardo.js';
import { descricaoInvocacaoBruxo, getEstadoRecursosBruxo } from './classes/bruxo.js';
import { getEstadoRecursosDruida } from './classes/druida.js';
import { getEstadoRecursosFeiticeiro } from './classes/feiticeiro.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { getEstadoRecursosGuerreiro } from './classes/guerreiro.js';
import { getEstadoRecursosLadino } from './classes/ladino.js';
import { getEstadoRecursosMago } from './classes/mago.js';
import { getEstadoRecursosMonge } from './classes/monge.js';
import { getEstadoRecursosPaladino } from './classes/paladino.js';
import { temArmaduraPesadaEquipada } from './combate.js';
import { reservasDeEspacos } from './reservas-espacos.js';

const DESABILITADO = 'disabled style="opacity:0.5;cursor:not-allowed"';

// Informações dos chips da última montagem, lidas pelo popup (id -> dados).
const infosRecursos = new Map();

// Chips criados desde o último bloco; `grupo` os consome para montar o resumo
// do cabeçalho recolhível.
let chipsPendentes = [];

/** Os blocos nascem recolhidos em qualquer largura; o estado escolhido pelo jogador prevalece nos re-renders. */
function blocosAbertosPorPadrao() {
  return false;
}

/**
 * Botão de um chip. `attrs` leva o atributo `data-*-acao` escrito por
 * extenso no ponto de chamada, para o inventário de gatilhos achá-lo.
 * @param {string} rotulo Texto do botão (já escapado quando dinâmico).
 * @param {string} attrs Atributos HTML do botão.
 * @param {{variante?: string, desabilitado?: boolean, titulo?: string}} [opcoes]
 * @returns {string} HTML do botão.
 */
function botao(rotulo, attrs, { variante = 'accent', desabilitado = false, titulo = '' } = {}) {
  return `<button class="btn btn-sm btn-${variante}" ${attrs} ${desabilitado ? DESABILITADO : ''}${titulo ? ` title="${escHtml(titulo)}"` : ''}>${rotulo}</button>`;
}

/**
 * Chip de um recurso. Registra os dados do popup e devolve o HTML.
 * @param {object} c
 * @param {string} c.id Identificador estável do chip.
 * @param {string} c.nome Nome do recurso.
 * @param {string} [c.estado] Texto de estado (ex.: "Disponível", "1/2").
 * @param {'ok'|'warn'|'off'|''} [c.tom] Cor do estado.
 * @param {string} [c.detalhe] HTML de apoio sob o estado.
 * @param {string} [c.botoes] HTML dos botões.
 * @param {string[]} [c.caracteristica] Nomes de característica a buscar nos dados da classe.
 * @param {string} [c.classe] Classe dona da característica.
 * @param {string} [c.resumo] Texto do popup quando a característica não é achada.
 * @param {boolean} [c.larga] Ocupa a linha inteira.
 * @param {string} [c.attrsExtras] Atributos extras do elemento raiz.
 * @returns {string} HTML do chip.
 */
function chip(c) {
  chipsPendentes.push({ nome: c.nome, estado: c.estado || '', tom: c.tom || '' });
  infosRecursos.set(c.id, {
    nome: c.nome,
    estado: c.estado || '',
    caracteristica: c.caracteristica || [],
    classe: c.classe || '',
    resumo: c.resumo || '',
    descricaoMd: c.descricaoMd || '',
    extra: c.detalheInfo || '',
  });
  const titulo = c.estado ? `${c.nome}: ${c.estado}` : c.nome;
  return `
    <div class="recurso-chip${c.larga ? ' recurso-chip-larga' : ''}" data-recurso-info="${escHtml(c.id)}" tabindex="0" role="button"
         title="${escHtml(titulo)} — clique para ver o que é" ${c.attrsExtras || ''}>
      <div class="recurso-chip-nome">${escHtml(c.nome)} <span class="recurso-chip-i" aria-hidden="true">ⓘ</span></div>
      ${c.estado ? `<div class="recurso-chip-estado ${c.tom || ''}">${escHtml(c.estado)}</div>` : ''}
      ${c.detalhe ? `<div class="recurso-chip-detalhe">${c.detalhe}</div>` : ''}
      ${c.botoes ? `<div class="recurso-chip-acoes no-print">${c.botoes}</div>` : ''}
    </div>`;
}

/**
 * Bloco de uma classe: título + chips + notas de características passivas.
 * @param {string} titulo Título já escapado.
 * @param {string[]} chips HTML dos chips.
 * @param {{id?: string, notas?: string, tipo?: string}} [opcoes]
 * @returns {string} HTML do bloco, ou '' sem chips.
 */
function grupo(titulo, chips, { id = '', notas = '', tipo = 'info', extra = '' } = {}) {
  const resumo = chipsPendentes;
  chipsPendentes = [];
  const lista = chips.filter(Boolean);
  if (!lista.length) return '';
  const slug = semAcento(titulo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const itensResumo = resumo.map((c) =>
    `<span class="recursos-resumo-item ${c.tom}">${escHtml(c.nome)}${c.estado ? `: ${escHtml(c.estado)}` : ''}</span>`).join('');
  return `
    <details class="info-box ${tipo} recursos-grupo"${id ? ` id="${id}"` : ''} data-details-id="recursos-${slug}"${blocosAbertosPorPadrao() ? ' open' : ''}>
      <summary class="recursos-grupo-titulo"><strong>${titulo}</strong><span class="recursos-resumo">${itensResumo}</span></summary>
      <div class="recursos-chips">${lista.join('')}</div>
      ${notas ? `<div class="recursos-notas">${notas}</div>` : ''}
    </details>${extra}`;
}

/** Texto "Nome: valor" em linha única para as notas de passivas. */
function notaPassiva(ativa, texto) {
  return ativa ? `${texto} ` : '';
}

// ---------------- Classes conjuradoras ----------------

/**
 * Recursos do Mago: Recuperação Arcana, Maestria de Magias, Assinatura
 * Mágica e Grimório. Mantém o id `painel-recursos-mago` do painel anterior.
 */
function gruposMago(e) {
  const temAssinaturas = !!(e.assinatura1 || e.assinatura2);
  const temMaestria = !!(e.maestriaMagia1 || e.maestriaMagia2);
  const attrsMago = (usada) =>
    `${usada ? DESABILITADO : ''} title="${usada ? 'Já usada neste descanso' : 'Conjurar sem gastar espaço de magia'}"`;
  const rotuloMagia = (nome, usada) => `${escHtml(nome)}${usada ? ' (usada)' : ''}`;

  const chips = [
    chip({
      id: 'mago-recuperacao-arcana', nome: 'Recuperação Arcana', classe: 'Mago',
      estado: e.recuperacaoArcanaUsada ? 'Usada' : `Disponível (até ${e.recuperacaoArcanaMax}º combinado)`,
      tom: e.recuperacaoArcanaUsada ? 'off' : 'ok',
      caracteristica: ['Recuperação Arcana'],
      botoes: botao('Recuperação Arcana', 'data-mago-acao="recuperacao-arcana"', { desabilitado: e.recuperacaoArcanaUsada }),
    }),
    e.maestriaMagiasAtiva ? chip({
      id: 'mago-maestria-magias', nome: 'Maestria de Magias', classe: 'Mago',
      estado: temMaestria ? 'À vontade, sem gastar espaço' : 'Nenhuma magia escolhida',
      tom: temMaestria ? 'ok' : 'warn',
      caracteristica: ['Maestria de Magias'],
      botoes: [
        e.maestriaMagia1 ? `<button class="btn btn-sm btn-primary" data-mago-acao="maestria-1" ${attrsMago(false)}>${rotuloMagia(e.maestriaMagia1, false)}</button>` : '',
        e.maestriaMagia2 ? `<button class="btn btn-sm btn-primary" data-mago-acao="maestria-2" ${attrsMago(false)}>${rotuloMagia(e.maestriaMagia2, false)}</button>` : '',
        `<button class="btn btn-sm btn-accent" data-mago-acao="definir-maestria-magias">${temMaestria ? 'Trocar' : 'Escolher Magias'}</button>`,
      ].join(''),
      larga: true,
    }) : '',
    e.assinaturaMagicaAtiva ? chip({
      id: 'mago-assinatura-magica', nome: 'Assinatura Mágica', classe: 'Mago',
      estado: temAssinaturas ? '1x cada por Descanso Curto/Longo' : 'Nenhuma magia escolhida',
      tom: temAssinaturas ? 'ok' : 'warn',
      caracteristica: ['Assinatura Mágica'],
      botoes: [
        e.assinatura1 ? `<button class="btn btn-sm btn-primary" data-mago-acao="assinatura-1" ${attrsMago(e.assinatura1Usada)}>${rotuloMagia(e.assinatura1, e.assinatura1Usada)}</button>` : '',
        e.assinatura2 ? `<button class="btn btn-sm btn-primary" data-mago-acao="assinatura-2" ${attrsMago(e.assinatura2Usada)}>${rotuloMagia(e.assinatura2, e.assinatura2Usada)}</button>` : '',
        `<button class="btn btn-sm btn-accent" data-mago-acao="definir-assinaturas">${temAssinaturas ? 'Trocar' : 'Escolher Magias'}</button>`,
      ].join(''),
      larga: true,
    }) : '',
    chip({
      id: 'mago-grimorio', nome: 'Grimório', classe: 'Mago',
      estado: 'Preparar magias no Descanso Longo',
      caracteristica: ['Grimório', 'Conjuração'],
      resumo: 'O grimório guarda as magias de Mago. As magias preparadas são trocadas no Descanso Longo.'
        + (e.memorizarMagiaAtivo ? ' Memorizar Magia: troque 1 magia preparada no Descanso Curto.' : ''),
      detalhe: e.memorizarMagiaAtivo ? 'Memorizar Magia: trocar 1 magia preparada no Descanso Curto.' : '',
    }),
  ];
  return grupo('Recursos do Mago:', chips, { id: 'painel-recursos-mago' });
}

/**
 * Chips das Invocações Místicas com ação ou regra própria (Punição Mística,
 * Sorvedouro de Vida, Presente dos Protetores, Olhar de Duas Mentes e
 * Investimento do Mestre da Corrente). Cada chip só existe com a invocação
 * escolhida e o nível da classe exigido.
 */
function chipsInvocacoesBruxo(e) {
  const tem = (nome) => e.invocacoes.some((i) => semAcento(typeof i === 'string' ? i : i.nome) === semAcento(nome));
  const nivelB = nivelNa(char, 'Bruxo');
  const espacosPacto = reservasDeEspacos().filter((r) => r.fonte === 'pacto').reduce((s, r) => s + r.disponiveis, 0);
  const chips = [];
  if (tem('Punição Mística') && nivelB >= 5) {
    chips.push(chip({
      id: 'bruxo-punicao-mistica', nome: 'Punição Mística', classe: 'Bruxo',
      estado: `Espaços de Pacto: ${espacosPacto}`, tom: espacosPacto > 0 ? 'ok' : 'off',
      descricaoMd: descricaoInvocacaoBruxo('Punição Mística'),
      botoes: botao('Punição Mística', 'data-bruxo-invocacao-acao="punicao-mistica"', { desabilitado: espacosPacto <= 0 }),
    }));
  }
  if (tem('Sorvedouro de Vida') && nivelB >= 9) {
    chips.push(chip({
      id: 'bruxo-sorvedouro-vida', nome: 'Sorvedouro de Vida', classe: 'Bruxo',
      estado: '1d6 extra, 1x por turno', tom: 'ok',
      descricaoMd: descricaoInvocacaoBruxo('Sorvedouro de Vida'),
      botoes: botao('Sorvedouro de Vida', 'data-bruxo-invocacao-acao="sorvedouro-vida"'),
    }));
  }
  if (tem('Presente dos Protetores') && nivelB >= 9) {
    chips.push(chip({
      id: 'bruxo-presente-protetores', nome: 'Presente dos Protetores', classe: 'Bruxo',
      estado: `Nomes ${e.protetoresNomes.length}/${e.modCar} · ${e.protetoresUsado ? 'Disparado' : 'Disponível'}`,
      tom: e.protetoresUsado ? 'off' : 'ok',
      descricaoMd: descricaoInvocacaoBruxo('Presente dos Protetores'),
      detalheInfo: e.protetoresNomes.length ? `<p><strong>Nomes na página:</strong> ${e.protetoresNomes.map(escHtml).join(', ')}</p>` : '',
      botoes: [
        botao('Nomes', 'data-bruxo-invocacao-acao="protetores-nomes"', { variante: 'secondary' }),
        botao(e.protetoresUsado ? 'Reativar' : 'Marcar disparo', 'data-bruxo-invocacao-acao="protetores-disparo"', { variante: 'secondary' }),
      ].join(''),
      larga: true,
    }));
  }
  if (tem('Olhar de Duas Mentes') && nivelB >= 5) {
    chips.push(chip({
      id: 'bruxo-olhar-duas-mentes', nome: 'Olhar de Duas Mentes', classe: 'Bruxo',
      estado: 'Ação Bônus', descricaoMd: descricaoInvocacaoBruxo('Olhar de Duas Mentes'),
    }));
  }
  if (tem('Investimento do Mestre da Corrente') && nivelB >= 5) {
    chips.push(chip({
      id: 'bruxo-investimento-corrente', nome: 'Investimento do Mestre da Corrente', classe: 'Bruxo',
      estado: 'Benefícios do familiar', descricaoMd: descricaoInvocacaoBruxo('Investimento do Mestre da Corrente'),
    }));
  }
  return chips;
}

/** Recursos do Bruxo: Astúcia Mágica, Invocações, Pacto e Arcana Mística. */
function gruposBruxo(e) {
  const badges = e.invocacoes.map((inv) => {
    const nome = typeof inv === 'string' ? inv : inv.nome;
    const extra = inv?.truque ? ` (${inv.truque})` : inv?.talento ? ` (${inv.talento})` : '';
    return `<span class="badge" style="font-size:0.65rem;margin:1px 2px;background:var(--bg-card);border:1px solid var(--border-light)">${escHtml(nome)}${escHtml(extra)}</span>`;
  }).join('');
  const passivas = e.invocacoesPassivas?.length > 0
    ? `<div id="bruxo-invocacoes-passivas">${e.invocacoesPassivas.map((p) =>
      `<div><strong>${escHtml(p.invocacao)}:</strong> ${escHtml(p.efeito)}</div>`).join('')}</div>`
    : '';

  const chips = [
    chip({
      id: 'bruxo-astucia-magica', nome: 'Astúcia Mágica', classe: 'Bruxo',
      estado: e.astuciaUsada ? 'Usada' : 'Disponível', tom: e.astuciaUsada ? 'off' : 'ok',
      caracteristica: ['Astúcia Mágica'],
      botoes: botao('Usar Astúcia Mágica', 'data-bruxo-astucia-acao="usar"', { desabilitado: e.astuciaUsada }),
    }),
    chip({
      id: 'bruxo-invocacoes', nome: 'Invocações Místicas', classe: 'Bruxo',
      estado: `Invocações: ${e.invocacoes.length}/${e.invocacoesMax}`,
      tom: e.invocacoes.length < e.invocacoesMax ? 'warn' : 'ok',
      caracteristica: ['Invocações Místicas'],
      detalhe: `${badges}${passivas}`,
      detalheInfo: e.invocacoes.length ? `<p><strong>Escolhidas:</strong> ${e.invocacoes.map((i) => escHtml(typeof i === 'string' ? i : i.nome)).join(', ')}</p>` : '',
      botoes: botao('Gerenciar Pacto/Invocações/Arcanum', 'data-bruxo-recursos="abrir"', { variante: 'secondary' }),
      larga: true,
    }),
    // O Pacto é uma Invocação Mística: sem pacto escolhido não há chip, para
    // não parecer vaga vazia quando outras invocações já ocupam o limite.
    e.pactos.length ? chip({
      id: 'bruxo-pacto', nome: 'Pacto', classe: 'Bruxo',
      estado: e.pactos.join(', '), tom: 'ok',
      caracteristica: e.pactos,
      resumo: 'O Pacto é uma Invocação Mística de nível 1 (Corrente, Lâmina ou Tomo).',
    }) : '',
    ...chipsInvocacoesBruxo(e),
    ...e.circulosArcanum.map((c) => {
      const dado = e.arcanum[c] || { magia: '', usado: false };
      return chip({
        id: `bruxo-arcana-${c}`, nome: `Arcana Mística ${c}º`, classe: 'Bruxo',
        estado: `${dado.magia || 'Não definida'} (${dado.usado ? 'usada' : 'disponível'})`,
        tom: dado.usado ? 'off' : (dado.magia ? 'ok' : 'warn'),
        caracteristica: ['Arcana Mística'],
        botoes: `<button class="btn btn-sm btn-secondary" data-bruxo-arcanum-toggle="${c}">${dado.usado ? 'Restaurar' : 'Marcar uso'}</button>`,
      });
    }),
  ];
  return grupo('Recursos do Bruxo:', chips);
}

/** Recursos do Feiticeiro: Pontos, Feitiçaria Inata, Restauração, Metamagia. */
function gruposFeiticeiro(e) {
  const sub = semAcento(subclasseDe(char, 'Feiticeiro'));
  const selvagem = sub === semAcento('Feitiçaria Selvagem');
  const draconica = sub === semAcento('Feitiçaria Dracônica');
  const chips = [
    chip({
      id: 'feiticeiro-pontos', nome: 'Pontos de Feitiçaria', classe: 'Feiticeiro',
      estado: `${e.pontosAtuais}/${e.pontosMax}`, tom: e.pontosAtuais > 0 ? 'ok' : 'off',
      caracteristica: ['Feiticaria Inata', 'Fonte de Magia'],
      resumo: 'Pontos de Feitiçaria alimentam Metamagia e a conversão de espaços de magia.',
    }),
    chip({
      id: 'feiticeiro-feiticaria-inata', nome: 'Feitiçaria Inata', classe: 'Feiticeiro',
      estado: `${e.feiticariaInataUsosDisponiveis}/${e.feiticariaInataUsosMax} · ${e.feiticariaInataAtiva ? 'Ativa' : 'Inativa'}`,
      tom: e.feiticariaInataAtiva ? 'ok' : '',
      caracteristica: ['Feitiçaria Inata'],
      botoes: `<button class="btn btn-sm ${e.feiticariaInataAtiva ? 'btn-secondary' : 'btn-accent'}" data-feiticeiro-acao="${e.feiticariaInataAtiva ? 'encerrar-feiticaria-inata' : 'ativar-feiticaria-inata'}">${e.feiticariaInataAtiva ? 'Encerrar Feitiçaria Inata' : 'Ativar Feitiçaria Inata'}</button>`,
    }),
    nivelNa(char, 'Feiticeiro') >= 5 ? chip({
      id: 'feiticeiro-restauracao', nome: 'Restauração Feiticeira', classe: 'Feiticeiro',
      estado: e.restauracaoFeiticeiraUsada ? 'Usada' : 'Disponível', tom: e.restauracaoFeiticeiraUsada ? 'off' : 'ok',
      caracteristica: ['Restauração Feiticeira'],
      botoes: botao('Restauração Feiticeira', 'data-feiticeiro-acao="restauracao-feiticeira"', { variante: 'primary', desabilitado: e.restauracaoFeiticeiraUsada }),
    }) : '',
    chip({
      id: 'feiticeiro-metamagia', nome: 'Metamagia', classe: 'Feiticeiro',
      estado: 'Opções escolhidas', caracteristica: ['Metamagia'],
      botoes: botao('Metamagia', 'data-feiticeiro-acao="metamagia-config"', { variante: 'secondary' }),
    }),
    selvagem ? chip({
      id: 'feiticeiro-mares-caos', nome: 'Marés do Caos', classe: 'Feiticeiro',
      estado: e.subclasses.selvagem.mares_caos_disponivel ? 'Disponível' : 'Indisponível',
      tom: e.subclasses.selvagem.mares_caos_disponivel ? 'ok' : 'off',
      caracteristica: ['Marés do Caos'],
    }) : '',
    draconica ? chip({
      id: 'feiticeiro-afinidade', nome: 'Afinidade Elemental', classe: 'Feiticeiro',
      estado: e.subclasses.draconica.afinidade_elemental || 'Não definida',
      tom: e.subclasses.draconica.afinidade_elemental ? 'ok' : 'warn',
      caracteristica: ['Afinidade Elemental'],
    }) : '',
    selvagem && e.subclasses.selvagem.surto_pendente_automatico ? chip({
      id: 'feiticeiro-surto', nome: 'Surto de Magia Selvagem', classe: 'Feiticeiro',
      estado: 'Pendente', tom: 'warn',
      detalhe: 'Surto de Magia Selvagem automático pendente na próxima conjuração com espaço.',
      caracteristica: ['Surto de Magia Selvagem'],
      botoes: botao('Marcar resolvido', 'data-feiticeiro-acao="surto-resolvido"', { variante: 'secondary' }),
      larga: true,
    }) : '',
  ];
  return grupo('Recursos do Feiticeiro:', chips);
}

/** Recursos do Druida: Forma Selvagem, Companheiro, Ressurgimento. */
function gruposDruida(e) {
  const semEspaco = !reservasDeEspacos().some((r) => r.disponiveis > 0);
  const chips = [
    chip({
      id: 'druida-forma-selvagem', nome: 'Forma Selvagem', classe: 'Druida',
      estado: `${e.usosDisponiveis}/${e.usosMax} · ${e.formaSelvagemAtiva ? `ATIVA${e.formaSelvagemAtual ? `: ${e.formaSelvagemAtual}` : ''}` : 'Inativa'}`,
      tom: e.formaSelvagemAtiva ? 'ok' : (e.usosDisponiveis > 0 ? '' : 'off'),
      caracteristica: ['Forma Selvagem'],
      botoes: `<button class="btn btn-sm ${e.formaSelvagemAtiva ? 'btn-secondary' : 'btn-accent'}" data-druida-forma-acao="${e.formaSelvagemAtiva ? 'encerrar' : 'ativar'}" ${(e.usosDisponiveis <= 0 && !e.formaSelvagemAtiva) ? DESABILITADO : ''}>${e.formaSelvagemAtiva ? 'Sair da forma' : 'Ativar Forma Selvagem'}</button><button class="btn btn-sm btn-secondary" data-druida-forma-acao="formas">Formas conhecidas</button>`,
    }),
    chip({
      id: 'druida-companheiro-selvagem', nome: 'Companheiro Selvagem', classe: 'Druida',
      estado: e.companheiroSelvagemAtivo ? `Ativo${e.familiarCompanheiro ? `: ${e.familiarCompanheiro}` : ''}` : 'Inativo', tom: e.companheiroSelvagemAtivo ? 'ok' : '',
      caracteristica: ['Companheiro Selvagem'],
      botoes: `<button class="btn btn-sm btn-secondary" data-druida-companheiro-acao="toggle" ${(e.usosDisponiveis <= 0 && !e.companheiroSelvagemAtivo && semEspaco) ? DESABILITADO : ''}>${e.companheiroSelvagemAtivo ? 'Dispensar Companheiro Selvagem' : 'Invocar Companheiro Selvagem'}</button>`,
    }),
    nivelNa(char, 'Druida') >= 5 ? chip({
      id: 'druida-ressurgimento', nome: 'Ressurgimento', classe: 'Druida',
      estado: `Slot 1º: ${e.ressurgimentoSlotRecuperadoHoje ? 'Já usado' : 'Disponível'}`,
      tom: e.ressurgimentoSlotRecuperadoHoje ? 'off' : 'ok',
      caracteristica: ['Ressurgimento Selvagem', 'Ressurgimento'],
      botoes: e.ressurgimentoAtivo ? [
        `<button class="btn btn-sm btn-primary" data-druida-ressurgimento-acao="recuperar-forma" ${e.usosDisponiveis > 0 ? DESABILITADO : ''}>Ressurgimento: recuperar Forma</button>`,
        `<button class="btn btn-sm btn-primary" data-druida-ressurgimento-acao="recuperar-slot" ${(e.ressurgimentoSlotRecuperadoHoje || e.usosDisponiveis <= 0) ? DESABILITADO : ''}>Ressurgimento: recuperar slot 1º</button>`,
      ].join('') : '',
      larga: true,
    }) : '',
    e.arquidruidaAtivo ? chip({
      id: 'druida-arquidruida', nome: 'Arquidruida', classe: 'Druida',
      estado: 'Iniciativa recupera Forma Selvagem', caracteristica: ['Arquidruida'],
      botoes: '<button class="btn btn-sm btn-secondary" data-druida-iniciativa="1">Iniciativa (Arquidruida)</button>',
    }) : '',
  ];
  return grupo('Recursos do Druida:', chips);
}

/** Recursos do Guardião: Marca do Caçador, Incansável, Véu da Natureza. */
function gruposGuardiao(e) {
  const chips = [
    chip({
      id: 'guardiao-marca', nome: 'Marca do Caçador', classe: 'Guardião',
      estado: `${e.marcaPredadorAtiva ? 'Ativa' : 'Inativa'} · Inimigo Favorito ${e.inimigoFavoritoDisponiveis}/${e.inimigoFavoritoMax} · Dano ${e.marcaPredadorDado}`,
      tom: e.marcaPredadorAtiva ? 'ok' : '',
      caracteristica: ['Inimigo Favorito', 'Marca do Caçador'],
      botoes: `<button class="btn btn-sm btn-accent" data-guardiao-acao="${e.marcaPredadorAtiva ? 'encerrar-marca' : 'usar-marca'}" ${(!e.marcaPredadorAtiva && e.inimigoFavoritoDisponiveis <= 0) ? DESABILITADO : ''}>${e.marcaPredadorAtiva ? 'Encerrar Marca' : 'Marca sem Espaço'}</button>`,
      larga: true,
    }),
    e.incansavelAtivo ? chip({
      id: 'guardiao-incansavel', nome: 'Incansável', classe: 'Guardião',
      estado: `${e.incansavelDisponiveis}/${e.incansavelMax}`, tom: e.incansavelDisponiveis > 0 ? 'ok' : 'off',
      caracteristica: ['Incansável'],
      botoes: botao('Usar Incansável', 'data-guardiao-acao="incansavel"', { variante: 'secondary', desabilitado: e.incansavelDisponiveis <= 0 }),
    }) : '',
    e.veuNaturezaAtivo ? chip({
      id: 'guardiao-veu', nome: 'Véu da Natureza', classe: 'Guardião',
      estado: `${e.veuNaturezaDisponiveis}/${e.veuNaturezaMax}`, tom: e.veuNaturezaDisponiveis > 0 ? 'ok' : 'off',
      caracteristica: ['Véu da Natureza'],
      botoes: botao('Usar Véu da Natureza', 'data-guardiao-acao="veu"', { variante: 'secondary', desabilitado: e.veuNaturezaDisponiveis <= 0 }),
    }) : '',
  ];
  const notas = [
    notaPassiva(e.predadorImplacavelAtivo, 'Predador Implacável: sofrer dano não quebra sua Concentração de Marca do Caçador.'),
    notaPassiva(e.cacadorPrecisoAtivo, 'Caçador Preciso: ataques contra alvo marcado têm vantagem.'),
    notaPassiva(e.sentidosSelvagensAtivo, 'Sentidos Selvagens: Visão às Cegas 9 m.'),
  ].join('');
  return grupo('Recursos do Guardião:', chips, { notas });
}

/** Inspiração de Bardo. */
function gruposBardo(e) {
  const chips = [
    chip({
      id: 'bardo-inspiracao', nome: 'Inspiração de Bardo', classe: 'Bardo',
      estado: `d${e.dado} · ${e.usosDisponiveis}/${e.usosMax} · Recarga: ${e.recuperaCurto ? 'Descanso Curto/Longo' : 'Descanso Longo'}`,
      tom: e.usosDisponiveis > 0 ? 'ok' : 'off',
      caracteristica: ['Inspiração de Bardo'],
      botoes: [
        botao('Usar Inspiração', 'data-inspiracao-acao="usar"', { desabilitado: e.usosDisponiveis <= 0 }),
        nivelNa(char, 'Bardo') >= 18 ? '<button class="btn btn-sm btn-secondary" data-inspiracao-acao="iniciativa">Rolar Iniciativa (recuperar até 2)</button>' : '',
      ].join(''),
      larga: true,
    }),
  ];
  return grupo('Inspiração de Bardo:', chips);
}

/** Recursos do Paladino: Mãos Consagradas, Canalizar Divindade, Aura. */
function gruposPaladino(e) {
  const chips = [
    chip({
      id: 'paladino-maos', nome: 'Mãos Consagradas', classe: 'Paladino',
      estado: `${e.maosAtuais}/${e.maosMax} PV`, tom: e.maosAtuais > 0 ? 'ok' : 'off',
      caracteristica: ['Mãos Consagradas'],
      botoes: botao('Usar Mãos Consagradas', 'data-paladino-acao="maos-consagradas"', { desabilitado: e.maosAtuais <= 0 }),
    }),
    e.canalizarMax > 0 ? chip({
      id: 'paladino-canalizar', nome: 'Canalizar Divindade', classe: 'Paladino',
      estado: `${e.canalizarDisponiveis}/${e.canalizarMax}`, tom: e.canalizarDisponiveis > 0 ? 'ok' : 'off',
      caracteristica: ['Canalizar Divindade'],
      botoes: botao('Canalizar Divindade', 'data-paladino-acao="canalizar"', { variante: 'secondary', desabilitado: e.canalizarDisponiveis <= 0 }),
    }) : '',
    e.auraProtecaoAtiva ? chip({
      id: 'paladino-aura', nome: 'Aura de Proteção', classe: 'Paladino',
      estado: `+${e.bonusAura} Salvaguardas (${e.auraRaio}m)`, tom: 'ok',
      caracteristica: ['Aura de Proteção'],
    }) : '',
  ];
  const notas = [
    notaPassiva(e.golpesRadiantesAtivo, 'Golpes Radiantes: +1d8 Radiante em ataques corpo a corpo.'),
    notaPassiva(e.auraCoragemAtiva, 'Aura de Coragem: Imunidade a Amedrontado na aura.'),
    notaPassiva(e.auraDevocaoAtiva, 'Aura de Devoção: Imunidade a Enfeitiçado na aura.'),
    notaPassiva(e.toqueRestauradorAtivo, 'Toque Restaurador: remover condições com 5 PV da reserva.'),
  ].join('');
  return grupo('Recursos do Paladino:', chips, { notas });
}

// ---------------- Classes sem magia ----------------

/** Fúria do Bárbaro. */
function gruposBarbaro(e) {
  const nivelB = nivelNa(char, 'Bárbaro');
  const detalhes = [
    `Dano: +${e.dano}`,
    e.ativa ? `Resist: ${escHtml(e.resistencias.join(', '))}` : '',
    e.ativa ? 'Vant. FOR' : '',
    e.ativa ? 'Sem Magias/Concentração' : '',
    temArmaduraPesadaEquipada() ? '<span style="color:var(--danger)">Armadura pesada equipada</span>' : '',
    e.temForcaIndomavel ? '<span title="Piso de Força: se o total do teste/salvaguarda de FOR for menor que seu valor de FOR, use o valor de FOR">Força Indomável</span>' : '',
    e.furiaImplacavel ? `<span title="Se reduzido a 0 PV com Fúria ativa: SG CON CD ${e.furiaImplacavelCD}. Sucesso = PV = ${nivelB * 2}">Implacável CD ${e.furiaImplacavelCD}</span>` : '',
  ].filter(Boolean).join(' · ');
  const chips = [
    chip({
      id: 'barbaro-furia', nome: 'Fúria', classe: 'Bárbaro',
      estado: `${e.ativa ? 'Ativa' : 'Inativa'} · Usos: ${e.usosDisponiveis}/${e.usosMax}`,
      tom: e.ativa ? 'warn' : (e.usosDisponiveis > 0 ? 'ok' : 'off'),
      caracteristica: ['Fúria'], detalhe: detalhes, larga: true,
      botoes: [
        `<button class="btn btn-sm ${e.ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-toggle="${e.ativa ? 'desativar' : 'ativar'}">${e.ativa ? 'Encerrar Fúria' : 'Entrar em Fúria'}</button>`,
        nivelB >= 15 ? '<button class="btn btn-sm btn-secondary" data-furia-iniciativa="1">Rolar Iniciativa (recuperar Fúrias)</button>' : '',
        e.furiaImplacavel && e.ativa ? '<button class="btn btn-sm btn-info" data-furia-implacavel="1">Fúria Implacável</button>' : '',
      ].join(''),
    }),
  ];
  return grupo('Fúria:', chips, { tipo: e.ativa ? 'danger' : 'info' });
}

/** Recursos do Guerreiro (Mestre da Batalha / Combatente Psíquico). */
function gruposGuerreiro(e) {
  if (!(e.ehMestreBatalha || e.ehCombatentePsiquico)) return '';
  const chips = [];
  if (e.ehMestreBatalha) {
    chips.push(chip({
      id: 'guerreiro-superioridade', nome: 'Dados de Superioridade', classe: 'Guerreiro',
      estado: `${e.dadosSuperioridadeDisponiveis}/${e.dadosSuperioridadeMax} (${e.tipoDadoSuperioridade}) · CD ${e.cdSuperioridade}`,
      tom: e.dadosSuperioridadeDisponiveis > 0 ? 'ok' : 'off',
      caracteristica: ['Superioridade em Combate', 'Dados de Superioridade'],
      botoes: e.manobrasComDescricao.length === 0
        ? botao('Usar Dado Superioridade', 'data-guerreiro-acao="usar-superioridade"', { variante: 'primary', desabilitado: e.dadosSuperioridadeDisponiveis <= 0 })
        : '',
      larga: true,
    }));
    chips.push(chip({
      id: 'guerreiro-manobras', nome: 'Manobras', classe: 'Guerreiro',
      estado: `${e.manobrasConhecidas}/${e.manobrasEsperadas}${e.manobrasPendentes > 0 ? ` (${e.manobrasPendentes} pendente(s))` : ''}`,
      tom: e.manobrasPendentes > 0 ? 'warn' : 'ok',
      caracteristica: ['Superioridade em Combate'],
      detalheInfo: e.manobrasComDescricao.length
        ? e.manobrasComDescricao.map((m) => `<p><strong>${escHtml(m.nome)}</strong><br>${escHtml(m.descricao)}</p>`).join('')
        : '',
    }));
    if (e.conhecaInimigoAtivo) {
      chips.push(chip({
        id: 'guerreiro-conheca-inimigo', nome: 'Conheça Seu Inimigo', classe: 'Guerreiro',
        estado: e.conhecaInimigoUsado ? 'Usado' : 'Disponível', tom: e.conhecaInimigoUsado ? 'off' : 'ok',
        caracteristica: ['Conheça Seu Inimigo'],
      }));
    }
  }
  if (e.ehCombatentePsiquico) {
    chips.push(chip({
      id: 'guerreiro-dados-psionicos', nome: 'Dados Psiônicos', classe: 'Guerreiro',
      estado: `${e.dadosPsionicosDisponiveisG}/${e.dadosPsionicosMaxG} (${e.tipoDadoPsionicoG})`,
      tom: e.dadosPsionicosDisponiveisG > 0 ? 'ok' : 'off',
      caracteristica: ['Poder Psiônico', 'Dados Psiônicos'],
      botoes: [
        botao('Golpe Psiônico', 'data-guerreiro-acao="golpe-psionico"', { variante: 'primary', desabilitado: e.dadosPsionicosDisponiveisG <= 0 }),
        botao('Vínculo Protetivo', 'data-guerreiro-acao="vinculo-protetivo"', { desabilitado: e.dadosPsionicosDisponiveisG <= 0 }),
      ].join(''),
      larga: true,
    }));
    chips.push(chip({
      id: 'guerreiro-mov-telecinetico', nome: 'Movimento Telecinético', classe: 'Guerreiro',
      estado: e.movimentoTelecineticoUsado ? 'Usado' : 'Disponível', tom: e.movimentoTelecineticoUsado ? 'off' : 'ok',
      caracteristica: ['Movimento Telecinético'],
    }));
    if (e.adeptoTelecineticoAtivo) {
      chips.push(chip({
        id: 'guerreiro-salto', nome: 'Salto de Impulsão', classe: 'Guerreiro',
        estado: e.saltoImpulsaoUsado ? 'Usado' : 'Disponível', tom: e.saltoImpulsaoUsado ? 'off' : 'ok',
        caracteristica: ['Adepto Telecinético'],
      }));
    }
    if (e.baluarteEnergiaAtivo) {
      chips.push(chip({
        id: 'guerreiro-baluarte', nome: 'Baluarte de Energia', classe: 'Guerreiro',
        estado: e.baluarteUsado ? 'Usado' : 'Disponível', tom: e.baluarteUsado ? 'off' : 'ok',
        caracteristica: ['Baluarte de Energia'],
      }));
    }
    if (e.mestreTelecineticoAtivo) {
      chips.push(chip({
        id: 'guerreiro-telecinese', nome: 'Mestre Telecinético', classe: 'Guerreiro',
        estado: e.mestreTelecineticoUsado ? 'Usada' : 'Disponível', tom: e.mestreTelecineticoUsado ? 'off' : 'ok',
        caracteristica: ['Mestre Telecinético'],
      }));
    }
  }
  const notas = [
    notaPassiva(e.ehMestreBatalha && e.implacavelAtivo, 'Implacável: 1x/turno, 1d8 grátis em vez de gastar dado.'),
    notaPassiva(e.ehCombatentePsiquico && e.resguardoMentalAtivo, 'Resguardo Mental: Resistência a dano Psíquico. Gaste dado para encerrar Amedrontado/Enfeitiçado.'),
  ].join('');
  const pendente = e.ehMestreBatalha && e.manobrasPendentes > 0 ? `
    <div class="info-box warning" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span style="font-size:0.85rem">Você tem <strong>${e.manobrasPendentes}</strong> manobra(s) pendente(s) de escolha (Mestre da Batalha).</span>
      <button class="btn btn-sm btn-accent no-print" id="btn-escolher-manobras-pendentes">Escolher agora</button>
    </div>` : '';
  return grupo(`Recursos do Guerreiro (${escHtml(subclasseDe(char, 'Guerreiro'))}):`, chips, { notas, extra: pendente });
}

/** Recursos do Monge: Artes Marciais, Pontos de Foco e golpes. */
function gruposMonge(e) {
  const chips = [
    chip({
      id: 'monge-artes-marciais', nome: 'Artes Marciais', classe: 'Monge',
      estado: `d${e.dadoArtesMarciais} · CD Foco ${e.cdFoco}`, tom: 'ok',
      caracteristica: ['Artes Marciais'],
      detalhe: e.bonusMovimento > 0 ? `Mov. Bônus: +${escHtml(String(e.bonusMovimento).replace('.', ','))}m` : '',
    }),
    e.pontosMax > 0 ? chip({
      id: 'monge-foco', nome: 'Pontos de Foco', classe: 'Monge',
      estado: `${e.pontosAtuais}/${e.pontosMax}`, tom: e.pontosAtuais > 0 ? 'ok' : 'off',
      caracteristica: ['Foco do Monge', 'Pontos de Foco'],
      botoes: [
        botao('Gastar Ponto de Foco', 'data-monge-acao="gastar-ponto"', { desabilitado: e.pontosAtuais <= 0 }),
        e.golpeAtordoanteAtivo ? botao('Golpe Atordoante', 'data-monge-acao="golpe-atordoante"', { variante: 'primary', desabilitado: e.pontosAtuais <= 0 }) : '',
      ].join(''),
      larga: true,
    }) : '',
    !e.metabolismoUsado ? chip({
      id: 'monge-metabolismo', nome: 'Metabolismo Incomum', classe: 'Monge',
      estado: 'Disponível', tom: 'ok', caracteristica: ['Metabolismo Incomum'],
      botoes: '<button class="btn btn-sm btn-secondary" data-monge-acao="metabolismo">Metabolismo Incomum</button>',
    }) : '',
  ];
  const notas = [
    notaPassiva(e.desviarAtivo, `Desviar Ataques: reduz ${e.desviarReducao} de dano.`),
    notaPassiva(e.quedaLentaAtiva, `Queda Lenta: reduz ${e.quedaReducao} dano de queda.`),
    notaPassiva(e.evasaoAtiva, 'Evasão: salvaguarda Des sucesso = 0 dano.'),
    notaPassiva(e.sobreviventeAtivo, 'Proficiência em todas as salvaguardas.'),
    notaPassiva(e.defesaSuperiorAtiva, 'Defesa Superior: 3 PF = resist. a todos exceto Energético.'),
  ].join('');
  return grupo('Recursos do Monge:', chips, { notas });
}

/** Recursos do Ladino: Ataque Furtivo, Golpe de Sorte, Dados Psiônicos. */
function gruposLadino(e) {
  const chips = [
    chip({
      id: 'ladino-furtivo', nome: 'Ataque Furtivo', classe: 'Ladino',
      estado: e.furtivoTexto, tom: 'ok', caracteristica: ['Ataque Furtivo'],
      detalhe: e.golpeAstutoAtivo ? `CD Golpe Astuto: ${e.cdGolpeAstuto}` : '',
    }),
    e.golpeSorteAtivo ? chip({
      id: 'ladino-golpe-sorte', nome: 'Golpe de Sorte', classe: 'Ladino',
      estado: e.golpeSorteUsado ? 'Usado' : 'Disponível', tom: e.golpeSorteUsado ? 'off' : 'ok',
      caracteristica: ['Golpe de Sorte'],
      botoes: botao('Usar Golpe de Sorte', 'data-ladino-acao="golpe-sorte"', { desabilitado: e.golpeSorteUsado }),
    }) : '',
  ];
  if (e.ehAdagaEspiritual) {
    chips.push(chip({
      id: 'ladino-dados-psionicos', nome: 'Dados Psiônicos', classe: 'Ladino',
      estado: `${e.dadosPsionicosDisponiveisL}/${e.dadosPsionicosMaxL} (${e.tipoDadoPsionicoL}) · CD ${e.cdPsionicaAdaga}`,
      tom: e.dadosPsionicosDisponiveisL > 0 ? 'ok' : 'off',
      caracteristica: ['Poder Psiônico', 'Dados Psiônicos'],
      botoes: [
        botao('Gastar Dado Psionico', 'data-ladino-acao="gastar-dado-psionico"', { variante: 'primary', desabilitado: e.dadosPsionicosDisponiveisL <= 0 }),
        e.veuPsiquicoAtivo ? botao(e.veuPsiquicoUsado ? 'Veu (dado)' : 'Veu Psiquico', 'data-ladino-acao="veu-psiquico"', { variante: 'secondary', desabilitado: e.veuPsiquicoUsado && e.dadosPsionicosDisponiveisL <= 0 }) : '',
      ].join(''),
      larga: true,
    }));
    chips.push(chip({
      id: 'ladino-sussurros', nome: 'Sussurros Psíquicos', classe: 'Ladino',
      estado: e.sussurrosGratisUsado ? 'Grátis usado' : 'Grátis disponível', tom: e.sussurrosGratisUsado ? 'off' : 'ok',
      caracteristica: ['Sussurros Psíquicos'],
    }));
    if (e.rasgarMenteAtivo) {
      chips.push(chip({
        id: 'ladino-rasgar-mente', nome: 'Rasgar Mente', classe: 'Ladino',
        estado: e.rasgarMenteUsado ? 'Usado' : 'Disponível', tom: e.rasgarMenteUsado ? 'off' : 'ok',
        caracteristica: ['Rasgar Mente'],
      }));
    }
  }
  const notas = [
    notaPassiva(e.acaoArdilosaAtiva, 'Ação Ardilosa: Correr/Desengajar/Esconder como Ação Bônus.'),
    notaPassiva(e.miraFirmeAtiva, 'Mira Firme: Vantagem no ataque (sem mover).'),
    notaPassiva(e.esquivaSobrenaturalAtiva, 'Esquiva Sobrenatural: Reação = metade do dano.'),
    notaPassiva(e.evasaoAtiva, 'Evasão: Des sucesso = 0 dano.'),
    notaPassiva(e.talentoConfiavelAtivo, 'Talento Confiável: d20 <= 9 conta como 10 em proficiências.'),
    notaPassiva(e.menteEscorregadiaAtiva, 'Mente Escorregadia: Prof. salvaguardas Sab/Car.'),
    notaPassiva(e.elusivoAtivo, 'Elusivo: ninguém tem Vantagem contra você.'),
    notaPassiva(e.ehAdagaEspiritual, 'Lâminas Psíquicas: 1d6 Psíquico (Acuidade, Arremesso 18/36m). Ação Bônus: 2º ataque 1d4.'),
    notaPassiva(e.ehAdagaEspiritual && e.laminasAlmaAtivas, 'Golpes Teleguiados: dado ao errar ataque. Teleporte Psíquico: gasta dado.'),
  ].join('');
  return grupo(`Recursos do Ladino${e.ehAdagaEspiritual ? ' (Adaga Espiritual)' : ''}:`, chips, { notas });
}

// ---------------- Montagem ----------------

/**
 * Monta os blocos de recursos de todas as classes do personagem e os separa
 * por destino: `magias` (classes conjuradoras, quando o card Magias existe)
 * e `recursos` (as demais, e as conjuradoras sem card de Magias).
 * @param {{temSecaoMagias: boolean}} opcoes
 * @returns {{magias: string, recursos: string}} HTML de cada destino.
 */
export function montarRecursosClasse({ temSecaoMagias }) {
  infosRecursos.clear();
  const conjuradoras = [];
  const outras = [];

  const mago = getEstadoRecursosMago();
  if (mago) conjuradoras.push(gruposMago(mago));
  const bruxo = getEstadoRecursosBruxo();
  if (bruxo) conjuradoras.push(gruposBruxo(bruxo));
  const feiticeiro = getEstadoRecursosFeiticeiro();
  if (feiticeiro) conjuradoras.push(gruposFeiticeiro(feiticeiro));
  const druida = getEstadoRecursosDruida();
  if (druida) conjuradoras.push(gruposDruida(druida));
  const guardiao = getEstadoRecursosGuardiao();
  if (guardiao) conjuradoras.push(gruposGuardiao(guardiao));
  const bardo = getEstadoInspiracaoBardo();
  if (bardo) conjuradoras.push(gruposBardo(bardo));
  const paladino = getEstadoRecursosPaladino();
  if (paladino) conjuradoras.push(gruposPaladino(paladino));

  const furia = getEstadoFuria();
  if (furia) outras.push(gruposBarbaro(furia));
  const guerreiro = getEstadoRecursosGuerreiro();
  if (guerreiro) outras.push(gruposGuerreiro(guerreiro));
  const monge = getEstadoRecursosMonge();
  if (monge) outras.push(gruposMonge(monge));
  const ladino = getEstadoRecursosLadino();
  if (ladino) outras.push(gruposLadino(ladino));

  const magiasHtml = conjuradoras.filter(Boolean).join('');
  const outrasHtml = outras.filter(Boolean).join('');
  return {
    magias: temSecaoMagias ? magiasHtml : '',
    recursos: temSecaoMagias ? outrasHtml : `${magiasHtml}${outrasHtml}`,
  };
}

/**
 * Card "Recursos de Classe" (classes sem card de Magias).
 * @param {string} html Blocos já montados.
 * @returns {string} HTML do card, ou '' sem blocos.
 */
export function renderCardRecursosClasse(html) {
  if (!html) return '';
  return `
    <div class="card" id="card-recursos-classe">
      <div class="card-header"><h2>Recursos de Classe</h2></div>
      ${html}
    </div>`;
}

/**
 * Faixa de recursos no topo do card Magias.
 * @param {string} html Blocos já montados.
 * @returns {string} HTML da faixa, ou '' sem blocos.
 */
export function renderFaixaRecursosMagias(html) {
  if (!html) return '';
  return `<div class="recursos-faixa" id="faixa-recursos-magias">${html}</div>`;
}

/**
 * Descrição de uma característica nos dados das classes do personagem
 * (classe e subclasse ativa).
 * @param {string[]} nomes Nomes aceitos, em ordem de preferência.
 * @param {string} classe Classe dona; vazio busca em todas.
 * @returns {{nome: string, descricao: string}|null}
 */
function buscarCaracteristica(nomes, classe) {
  const alvos = nomes.map(semAcento);
  for (const ctx of contextosDeClasse()) {
    if (classe && ctx.classe !== classe) continue;
    const subclasse = (ctx.dados?.subclasses || []).find((s) => s.nome === ctx.subclasse);
    const listas = [ctx.dados?.caracteristicas || [], subclasse?.caracteristicas || []];
    for (const alvo of alvos) {
      for (const lista of listas) {
        const achada = lista.find((f) => semAcento(f.nome) === alvo && f.descricao);
        if (achada) return achada;
      }
    }
  }
  return null;
}

/**
 * Abre o popup com a descrição do recurso do chip.
 * @param {string} id Identificador do chip.
 */
function abrirPopupRecurso(id) {
  const info = infosRecursos.get(id);
  if (!info) return;
  const feat = info.descricaoMd ? null : buscarCaracteristica(info.caracteristica, info.classe);
  const descricao = info.descricaoMd
    ? mdParaHtml(info.descricaoMd)
    : feat?.descricao
    ? mdParaHtml(feat.descricao)
    : `<p>${escHtml(info.resumo || 'Sem descrição disponível.')}</p>`;
  const corpo = `
    ${info.estado ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px"><strong>Estado:</strong> ${escHtml(info.estado)}</div>` : ''}
    ${info.extra || ''}
    <div class="md-content">${descricao}</div>`;
  abrirModal(info.nome, corpo, '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>');
}

/**
 * Liga o clique dos chips ao popup. Clique em botão, seletor ou link do
 * chip não abre o popup; só o resto do chip.
 */
export function setupEventosRecursosClasse() {
  containerRef?.querySelectorAll('[data-recurso-info]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('button, select, a, input, label')) return;
      abrirPopupRecurso(el.dataset.recursoInfo);
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.target !== el || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault();
      abrirPopupRecurso(el.dataset.recursoInfo);
    });
  });
}
