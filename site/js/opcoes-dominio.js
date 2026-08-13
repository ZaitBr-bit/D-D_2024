// ============================================================
// Adaptadores de domínio para o contrato de ui-opcoes.js.
//
// Existe porque talento aparece em 3 telas, arma em 2 e magia em 4 -- a
// mesma tradução repetida em cada tela é como os vocabulários divergentes
// de card nasceram. É aqui, e não no componente, que se decide o que está
// bloqueado e por quê.
// ============================================================
import { PERICIAS } from './dados-classes.js';
import { talentoElegivelParaPersonagem } from './levelup.js';
import { escHtml, mdParaHtml } from './utils.js';

/**
 * Monta o carregador do detalhe de uma magia, para o card abrir sob demanda.
 *
 * As listas que alimentam os cards de magia (dados/classes/magias_<classe>.json)
 * trazem só nome, escola e `especial` -- a descrição vive em
 * dados/magias/circulo_N.json. Carregar tudo só para desenhar a lista seria
 * caro e desnecessário, então o card recebe uma FUNÇÃO e o popup a executa no
 * clique. É o mesmo caminho de `mostrarDetalheMagia` (creator/passo-magias.js),
 * que já fazia isso para a descrição de magia no criador.
 *
 * Devolve null quando não há círculo conhecido -- sem ele não há arquivo onde
 * procurar, e o card simplesmente não ganha "ver detalhes".
 */
function _carregadorDetalheMagia(nome, circulo) {
  if (typeof circulo !== 'number') return null;
  return async () => {
    const { getMagiasPorCirculo } = await import('./db.js');
    const dados = await getMagiasPorCirculo(circulo);
    const magia = dados?.magias?.find(m => m.nome === nome);
    if (!magia) return '';
    const meta = [
      circulo === 0 ? 'Truque' : `${circulo}º Círculo`,
      magia.escola, magia.tempo_conjuracao, magia.alcance,
      magia.componentes, magia.duracao,
    ].filter(Boolean).map(t => `<span>${escHtml(t)}</span>`).join('');
    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem;margin-bottom:8px">${meta}</div>
      <div class="md-content">${mdParaHtml(magia.descricao || '')}</div>
      ${magia.circulo_superior
        ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${escHtml(magia.circulo_superior)}</div>`
        : ''}
      ${magia.classes?.length
        ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${escHtml(magia.classes.join(', '))}</div>`
        : ''}`;
  };
}

/**
 * Traduz talentos para opções. O resumo sai dos NOMES dos benefícios --
 * a descrição de topo costuma ser só "Você adquire os seguintes benefícios",
 * e o texto completo tem mediana de 402 caracteres (paredão num card).
 *
 * @param {Array} talentos entradas de dados/talentos/talentos.json (chave `todos`)
 * @param {object} ctx { jaPossui: Set<string>, motivoIndisponivel: (t) => string|null }
 */
export function deTalentos(talentos, ctx = {}) {
  const jaPossui = ctx.jaPossui || new Set();
  return talentos.map(t => {
    const beneficios = t.beneficios || [];
    // Talentos "Repetível" (Aumento no Valor de Atributo, Adepto Elemental,
    // Iniciado em Magia etc.) podem ser adquiridos de novo mesmo já
    // possuídos -- bloqueá-los aqui reproduziria o bug que
    // talentos-repetivel.spec.mjs existe para travar (achado M8).
    const repetivel = beneficios.some(b => b.nome === 'Repetível');
    let bloqueado = null;
    if (jaPossui.has(t.nome) && !repetivel) {
      bloqueado = { motivo: 'você já possui este talento' };
    } else {
      const motivo = ctx.motivoIndisponivel?.(t);
      if (motivo) bloqueado = { motivo };
    }
    return {
      id: t.nome,
      nome: t.nome,
      resumo: beneficios.map(b => b.nome).join(' · ') || (t.descricao || ''),
      detalhe: beneficios.map(b =>
        `<div style="margin-bottom:4px"><strong>${b.nome}:</strong> ${b.descricao}</div>`).join(''),
      tags: [],
      grupo: t.categoria || 'Geral',
      bloqueado,
    };
  });
}

/**
 * Traduz armas para opções. Mostra o que decide a escolha de maestria:
 * dano, propriedades e qual maestria a arma concede.
 *
 * @param {Array} armas entradas de dados/equipamento/armas.json (chave `armas`)
 * @param {object} ctx { jaTem: Set<string>, descricoesMaestria: Map<string,string> }
 */
export function deArmas(armas, ctx = {}) {
  const jaTem = ctx.jaTem || new Set();
  const descricoes = ctx.descricoesMaestria || new Map();
  return armas.map(a => ({
    id: a.nome,
    nome: a.nome,
    resumo: [a.dano, a.maestria ? `Maestria: ${a.maestria}` : null].filter(Boolean).join(' · '),
    detalhe: [
      a.propriedades ? `<div><strong>Propriedades:</strong> ${a.propriedades}</div>` : '',
      a.maestria && descricoes.get(a.maestria)
        ? `<div style="margin-top:4px"><strong>${a.maestria}:</strong> ${descricoes.get(a.maestria)}</div>` : '',
    ].join(''),
    tags: [],
    grupo: a.categoria || '',
    bloqueado: jaTem.has(a.nome) ? { motivo: 'você já tem maestria nesta arma' } : null,
  }));
}

/**
 * Traduz magias para opções: círculo, escola e concentração no resumo.
 *
 * CORREÇÃO (achado I2 da revisão final): esta função e seu comentário
 * afirmavam que "`especial` não existe em nenhuma das 391 magias" e que a
 * concentração só vinha embutida como texto no início de `duracao`. Isso
 * era verdade só para UMA das duas fontes de magia do app -- e errado como
 * afirmação geral, o que virou uma pegadinha para quem mexesse aqui depois.
 * As DUAS fontes reais, medidas (não supostas):
 *   - `dados/magias/_indice.json` (391 magias): tem `duracao`
 *     ("Concentração, até 1 minuto"), NÃO tem `especial`.
 *   - `dados/classes/magias_<classe>.json` (987 entradas, formato
 *     `{"nome":"Amigos","escola":"Encantamento","especial":"C"}`): tem
 *     `especial`, NÃO tem `duracao`. É esta fonte que alimenta as TROCAS de
 *     magia/truque/Iniciado em Magia (ctx._listaMagiasClasse, levelup-ui.js)
 *     -- por isso os cards dessas trocas nunca mostravam "Concentração": a
 *     função só sabia ler `duracao`, que essa fonte não tem.
 * `especial` é uma lista separada por vírgula, não um valor único -- "C, R"
 * (concentração + ritual), "C, M" (concentração + componente material com
 * custo) também existem nos dados. Comparar com `especial === 'C'` perderia
 * essas combinações; por isso o split abaixo.
 */
export function deMagias(magias, ctx = {}) {
  const jaTem = ctx.jaTem || new Set();
  return magias.map(m => ({
    id: m.nome,
    nome: m.nome,
    resumo: [
      m.circulo === 0 ? 'Truque' : `${m.circulo}º Círculo`,
      m.escola || null,
      _magiaEhConcentracao(m) ? 'Concentração' : null,
    ].filter(Boolean).join(' · '),
    // Descrição pronta quando a fonte a traz (circulo_N.json); senão, um
    // carregador que a busca no clique -- ver _carregadorDetalheMagia.
    detalhe: m.descricao
      ? `<div class="md-content">${mdParaHtml(m.descricao)}</div>`
      : _carregadorDetalheMagia(m.nome, m.circulo),
    tags: [],
    grupo: m.circulo === 0 ? 'Truques' : `${m.circulo}º Círculo`,
    bloqueado: jaTem.has(m.nome) ? { motivo: 'você já conhece esta magia' } : null,
  }));
}

// Concentração a partir de QUALQUER uma das duas fontes -- ver o comentário
// de deMagias acima para a origem de cada campo.
function _magiaEhConcentracao(m) {
  if (m.duracao) return m.duracao.startsWith('Concentração');
  if (m.especial) return m.especial.split(',').map(s => s.trim()).includes('C');
  return false;
}

/** Traduz manobras para opções: a descrição já é curta e vira o resumo. */
export function deManobras(manobras, ctx = {}) {
  const jaTem = ctx.jaTem || new Set();
  return manobras.map(m => ({
    id: m.nome,
    nome: m.nome,
    resumo: m.descricao || '',
    detalhe: '',
    tags: [],
    grupo: '',
    bloqueado: jaTem.has(m.nome) ? { motivo: 'você já conhece esta manobra' } : null,
  }));
}

/**
 * Traduz estilos de luta. A lista já vem no formato { nome, descricao }
 * (OPCOES_ESTILO_LUTA_BASE, levelup-cards.js) -- é só renomear os campos.
 */
export function deEstilosLuta(estilos, ctx = {}) {
  const jaTem = ctx.jaTem || new Set();
  return estilos.map(e => ({
    id: e.nome,
    nome: e.nome,
    resumo: e.descricao || '',
    detalhe: '',
    tags: [],
    grupo: '',
    bloqueado: jaTem.has(e.nome) ? { motivo: 'já é o seu estilo atual' } : null,
  }));
}

/**
 * Rótulo de uma perícia com o atributo base por extenso -- o formato que
 * Memória Kenku e Hábil já usam. Perícias NAO viram card (não há dado além
 * do atributo); esta função é o que os nove pontos de escolha passam a usar.
 */
export function rotuloPericia(nome) {
  const p = PERICIAS.find(x => x.nome === nome);
  return p ? `${p.nome} (${p.atributo})` : nome;
}

/**
 * Traduz o pré-requisito de um talento no motivo de ele estar indisponível,
 * comparando com o personagem. Devolve null quando o talento é elegível.
 * O formato do texto é o que aparece no card: "exige Destreza 13 — você tem 10".
 *
 * A ELEGIBILIDADE não é decidida aqui: vem de `talentoElegivelParaPersonagem`
 * (levelup.js), a mesma engine que filtra a lista de talentos da subida de
 * nível e valida a Dádiva Épica no confirmar. Esta função só REDIGE o texto
 * do motivo quando a engine diz que o talento não é elegível.
 *
 * Reimplementar a decisão aqui (com uma regex própria) foi exatamente o que
 * deu errado antes (achado C2 da revisão final): a regex de atributo exigia
 * " ou " entre os nomes, mas os dados reais também usam vírgula --
 * "Inteligência, Sabedoria ou Carisma 13 ou superior" -- e ela lia só
 * "Sabedoria ou Carisma", concluindo (errado) que um Mago com Inteligência
 * alta não atendia. A função também não entendia "Característica de Estilo
 * de Luta", "Característica Conjuração ou Magia de Pacto", "Treinamento com
 * Armadura ..." nem "Característica de Conjuração" -- 19 talentos ficavam
 * sem aviso nenhum. Delegar a decisão para a engine elimina as duas
 * divergências de uma vez; o texto abaixo só precisa cobrir as mesmas
 * famílias de pré-requisito, na mesma ordem de checagem da engine (nível,
 * atributo, conjuração, armadura, estilo de luta), para explicar qual delas
 * falhou.
 */
export function motivoPreRequisito(talento, char) {
  const pre = (talento.prerequisito || '').trim();
  if (!pre) return null;

  // `permitirExistente: true` -- "você já possui este talento" é decidido à
  // parte, por `deTalentos`/`ctx.jaPossui`; não é assunto de pré-requisito.
  if (talentoElegivelParaPersonagem(char, talento, char?.nivel, { permitirExistente: true })) {
    return null;
  }

  const nivelExigido = pre.match(/N[íi]vel (\d+)/i);
  if (nivelExigido && (char?.nivel || 1) < Number(nivelExigido[1])) {
    return `exige nível ${nivelExigido[1]} — você está no ${char?.nivel || 1}`;
  }

  // "Força ou Destreza 13 ou superior" / "Inteligência, Sabedoria ou
  // Carisma 13 ou superior": os nomes de atributo antes do número são
  // separados por " ou " OU por vírgula (a forma real com 3 atributos usa
  // os dois: "Inteligência, Sabedoria ou Carisma") -- basta um deles
  // atender.
  const attr = pre.match(/((?:Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)(?:\s*(?:,|ou)\s*(?:Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma))*)\s+(\d+)/i);
  if (attr) {
    const mapa = {
      'Força': 'forca', 'Destreza': 'destreza', 'Constituição': 'constituicao',
      'Inteligência': 'inteligencia', 'Sabedoria': 'sabedoria', 'Carisma': 'carisma',
    };
    const nomes = attr[1].split(/\s*(?:,|ou)\s*/i).filter(Boolean);
    const minimo = Number(attr[2]);
    const valores = nomes.map(n => (char?.atributos || {})[mapa[n]] ?? 10);
    if (!valores.some(v => Number.isFinite(v) && v >= minimo)) {
      return `exige ${nomes.join(' ou ')} ${minimo} — você tem ${valores.join('/')}`;
    }
  }

  // "Característica Conjuração ou Magia de Pacto" / "Característica de
  // Conjuração": o personagem precisa ter conjuração (ou magia de pacto).
  if (/caracter[íi]stica (?:de )?conjura[çc][ãa]o|magia de pacto/i.test(pre)) {
    return 'exige Característica de Conjuração ou Magia de Pacto — seu personagem não tem';
  }

  // "Treinamento com Armadura Leve/Média/Pesada" / "Treinamento com Escudo".
  const armadura = pre.match(/Treinamento com (Armadura (?:Leve|M[ée]dia|Pesada)|Escudo)/i);
  if (armadura) {
    return `exige Treinamento com ${armadura[1]} — você não tem`;
  }

  // "Característica de Estilo de Luta": precisa já ter um estilo escolhido.
  if (/caracter[íi]stica de estilo de luta/i.test(pre)) {
    return 'exige Característica de Estilo de Luta — você ainda não escolheu um estilo';
  }

  // Fallback: a engine (`talentoElegivelParaPersonagem`) disse que o
  // talento não é elegível, mas nenhuma das famílias conhecidas acima bateu
  // -- não deveria acontecer com as formas hoje em
  // dados/talentos/talentos.json (ver talentos-prerequisito.test.mjs), mas
  // evita devolver `null` (elegível) por engano se surgir uma forma nova.
  return `exige ${pre} — pré-requisito não atendido`;
}
