// ============================================================
// Adaptador de uso grátis de magia para RECURSO DEDICADO (issue #76, Fase C).
//
// `magia.gratis_usado` (regras-origens-magia.js/levelup.js) só guarda
// usado/não-usado -- serve para 1 uso por descanso. Inimigo Favorito
// (Guardião), Reforços Feéricos/Andarilho Nebuloso (Andarilho Feérico) e
// Mapa Estelar (Círculo das Estrelas) concedem uso MÚLTIPLO ou ESCALADO
// por atributo/nível, e por isso já têm contagem própria em
// `char.recursos.<classe>.*` (sheet/classes/guardiao.js e druida.js,
// getEstadoRecursosGuardiao/getEstadoRecursosDruida) -- a MESMA contagem
// que os botões do painel de recursos leem. Duplicar o contador aqui, em
// `gratis_usado`, reproduziria o bug já encontrado no Ilusionista nesta
// mesma issue: duas fontes de verdade para o mesmo uso, uma permitindo o
// que a outra já negou.
//
// Este módulo é o único lugar onde a lista principal de Magias (sheet/
// magias.js) pergunta "existe recurso dedicado para esta magia, e ele
// ainda tem uso?" -- em vez de reimplementar getEstadoRecursos<Classe>()
// nem inventar um contador próprio na entrada da magia.
//
// Lê `char` do módulo `estado.js`, nunca por parâmetro -- mesmo padrão de
// `magiaFixaMagoGratisDisponivel` (sheet/classes/mago.js), que este módulo
// espelha para as demais classes. `getEstadoRecursos<Classe>()` já lê o
// mesmo `char`; um parâmetro próprio aqui divergiria da fonte real sem
// ganhar nada.
// ============================================================
import { char } from './sheet/estado.js';
import { getEstadoRecursosGuardiao } from './sheet/classes/guardiao.js';
import { getEstadoRecursosDruida } from './sheet/classes/druida.js';
import { nivelNa, subclasseDe, temClasse } from './regras-multiclasse.js';

/** Estado do Guardião só quando a característica que concede o uso grátis
 *  já foi ganha -- sem o nível mínimo, `getEstadoRecursosGuardiao` ainda
 *  devolveria um objeto (ele inicializa `subclasses.andarilho` para
 *  QUALQUER Guardião, não só o Andarilho Feérico), e o botão apareceria
 *  antes da hora. */
function estadoAndarilhoFeerico(nivelMinimo) {
  if (!temClasse(char, 'Guardião')) return null;
  if (subclasseDe(char, 'Guardião') !== 'Andarilho Feérico') return null;
  if (nivelNa(char, 'Guardião') < nivelMinimo) return null;
  return getEstadoRecursosGuardiao();
}

/** Mesmo raciocínio de `estadoAndarilhoFeerico`, para o Círculo das
 *  Estrelas do Druida (Mapa Estelar, nível 3). */
function estadoCirculoDasEstrelas(nivelMinimo) {
  if (!temClasse(char, 'Druida')) return null;
  if (subclasseDe(char, 'Druida') !== 'Círculo das Estrelas') return null;
  if (nivelNa(char, 'Druida') < nivelMinimo) return null;
  return getEstadoRecursosDruida();
}

/**
 * Uma entrada por magia com uso grátis controlado por recurso dedicado.
 *
 * `aplicavel` responde "ESTE personagem tem a característica que concede
 * este uso?" -- e é o que separa o adaptador do NOME da magia. Nenhuma
 * destas magias é exclusiva da característica que as concede aqui: "Passo
 * Nebuloso" também vem do talento Tocado Por Fadas (regras-cobertura.js,
 * levelup.js) com uso grátis pelo booleano `gratis_usado`, e da Linhagem
 * Élfica do Alto Elfo. Reivindicar o nome sem `aplicavel` devolveria
 * "sem uso disponível" para esse personagem e APAGARIA o botão do talento
 * -- regressão numa funcionalidade que já estava em produção.
 *
 * `disponivel` responde "tem uso agora?" e `consumir` gasta um uso: as duas
 * leem/escrevem o MESMO campo que o painel de recursos da classe, nunca um
 * contador próprio desta lista.
 */
const ADAPTADORES = [
  {
    nomeMagia: 'Marca do Caçador',
    nomeFeature: 'Inimigo Favorito',
    aplicavel: () => temClasse(char, 'Guardião') && (getEstadoRecursosGuardiao()?.inimigoFavoritoMax ?? 0) > 0,
    disponivel: () => (getEstadoRecursosGuardiao()?.inimigoFavoritoDisponiveis ?? 0) > 0,
    consumir: () => { char.recursos.guardiao.inimigo_favorito_usos_gastos += 1; },
  },
  {
    nomeMagia: 'Convocar Feérico',
    nomeFeature: 'Reforços Feéricos',
    aplicavel: () => estadoAndarilhoFeerico(11) !== null,
    disponivel: () => estadoAndarilhoFeerico(11)?.reforcosFeericosUsado === false,
    consumir: () => { char.recursos.guardiao.subclasses.andarilho.reforcos_feericos_usado = true; },
  },
  {
    nomeMagia: 'Passo Nebuloso',
    nomeFeature: 'Andarilho Nebuloso',
    aplicavel: () => estadoAndarilhoFeerico(15) !== null,
    disponivel: () => (estadoAndarilhoFeerico(15)?.andarilhoNebulosoDisponiveis ?? 0) > 0,
    consumir: () => { char.recursos.guardiao.subclasses.andarilho.andarilho_nebuloso_usos_gastos += 1; },
  },
  {
    nomeMagia: 'Raio Guia',
    nomeFeature: 'Mapa Estelar',
    aplicavel: () => estadoCirculoDasEstrelas(3) !== null,
    disponivel: () => (estadoCirculoDasEstrelas(3)?.mapaEstelarDisponiveis ?? 0) > 0,
    consumir: () => { char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos += 1; },
  },
];

/**
 * Diz se `nomeFeature` (nome da CARACTERÍSTICA, não da magia) tem um
 * adaptador cadastrado acima -- usado por sheet/habilidades.js para
 * suprimir o toggle/contador GENÉRICO do card de Características de
 * Classe (`char.usos_habilidades`) nessas quatro, que já têm controle
 * pelo botão "Grátis" da lista de Magias. Não checa `aplicavel()`: mesmo
 * quando o personagem ainda não tem a característica, o NOME continua
 * reservado -- não existe outro uso legítimo de "Inimigo Favorito" fora
 * do Guardião que precisasse do toggle genérico.
 */
export function featureTemUsoGratisPorRecursoDedicado(nomeFeature) {
  return ADAPTADORES.some((a) => a.nomeFeature === nomeFeature);
}

/** A entrada cadastrada para `nomeMagia`, só se ela se aplica a ESTE
 *  personagem (ver `aplicavel` acima). */
function adaptadorAplicavel(nomeMagia) {
  const def = ADAPTADORES.find((a) => a.nomeMagia === nomeMagia);
  return def && def.aplicavel() ? def : null;
}

/**
 * `true`/`false` quando o recurso dedicado se aplica a este personagem --
 * `null` quando não se aplica (nome não cadastrado, ou personagem sem a
 * característica), e quem chama cai no mecanismo padrão (`gratis_usado`
 * booleano). Mesmo contrato de `magiaFixaMagoGratisDisponivel`.
 */
export function magiaRecursoDedicadoGratisDisponivel(nomeMagia) {
  const def = adaptadorAplicavel(nomeMagia);
  return def ? def.disponivel() : null;
}

/**
 * Gasta um uso do recurso dedicado de `nomeMagia` e devolve `true`.
 * Devolve `false` sem tocar em nada quando o adaptador não se aplica ao
 * personagem OU quando o recurso dedicado já esgotou -- nos dois casos
 * quem chama assume com o mecanismo padrão (`entrada.gratis_usado`). É o
 * que permite a um Andarilho Feérico COM Tocado Por Fadas gastar os dois
 * recursos que o livro concede para a mesma magia, em vez de perder um.
 */
export function consumirUsoRecursoDedicadoGratis(nomeMagia) {
  const def = adaptadorAplicavel(nomeMagia);
  if (!def || !def.disponivel()) return false;
  def.consumir();
  return true;
}
