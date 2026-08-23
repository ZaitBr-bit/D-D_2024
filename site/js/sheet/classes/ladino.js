// ============================================================
// Progressao e recursos do Ladino
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { getConjuracaoSubclasse } from '../../regras-conjuracao-subclasse.js';
import { bonusProficiencia, calcMod } from '../../utils.js';
import { char } from '../estado.js';
import { temClasse, nivelNa, subclasseDe } from '../../regras-multiclasse.js';
import { dadosDe } from '../contexto-classe.js';

/**
 * Tabela de conjuração do Trapaceiro Arcano (subclasse do Ladino) para o
 * personagem aberto na ficha.
 *
 * `opcoes` permite consultar uma combinação diferente da que está gravada
 * -- é o que a subida de nível usa para perguntar "e se a subclasse
 * escolhida AGORA fosse esta, no nível para o qual estou subindo?", já que
 * `char.subclasse` só é gravada depois que o nível é confirmado.
 */
export function getTrapaceiroArcanoConjuracao(opcoes = {}) {
  // Os fallbacks vinham dos espelhos (char.classe/char.subclasse), que so
  // descrevem a classe INICIAL: um Guerreiro 5/Ladino 7 Trapaceiro Arcano
  // nao recebia espaco de magia nenhum. O nome da classe NAO e chapado --
  // se o personagem nao tem Ladino, `classe` fica null e
  // getConjuracaoSubclasse devolve null (`def.classe !== classe`), que e
  // exatamente o "nada" de antes.
  const classe = opcoes.classe ?? (temClasse(char, 'Ladino') ? 'Ladino' : null);
  const subclasse = opcoes.subclasse ?? subclasseDe(char, 'Ladino');
  // nivelNa em vez de char?.nivel: e o nivel do personagem NA classe
  // Ladino que importa aqui, nao o total.
  const nivel = opcoes.nivel ?? nivelNa(char, 'Ladino') ?? 1;
  return getConjuracaoSubclasse(classe, subclasse === 'Trapaceiro Arcano' ? subclasse : null, nivel);
}

// ============================================================
// Progressão e recursos do Ladino
// ============================================================
function getProgressaoLadino() {
  // temClasse/dadosDe/nivelNa: o portao e a leitura da tabela tem de ser
  // da classe Ladino, mesmo quando ela nao e a inicial do personagem.
  const dados = dadosDe('Ladino');
  if (!temClasse(char, 'Ladino') || !dados?.tabela_caracteristicas) return null;
  const nivelLadino = nivelNa(char, 'Ladino') || 1;
  const row = dados.tabela_caracteristicas.find(r => parseInt(r['Nível']) === nivelLadino);
  if (!row) return null;
  const furtStr = String(row['Ataque Furtivo'] || '1d6');
  const furtMatch = furtStr.match(/(\d+)d(\d+)/);
  const furtivoDados = furtMatch ? parseInt(furtMatch[1]) : Math.ceil(nivelLadino / 2);
  return { furtivoDados };
}

export function getEstadoRecursosLadino() {
  if (!temClasse(char, 'Ladino')) return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.ladino) {
    char.recursos.ladino = {
      golpe_sorte_usado: false
    };
  }

  // Inicializar recursos de subclasses do Ladino
  if (!char.recursos.ladino.subclasses) {
    char.recursos.ladino.subclasses = {
      adaga_espiritual: {
        dados_psionicos_gastos: 0,
        sussurros_gratis_usado: false,
        veu_psiquico_usado: false,
        rasgar_mente_usado: false
      }
    };
  }
  const subL = char.recursos.ladino.subclasses;
  if (!subL.adaga_espiritual) subL.adaga_espiritual = { dados_psionicos_gastos: 0, sussurros_gratis_usado: false, veu_psiquico_usado: false, rasgar_mente_usado: false };

  const ae = subL.adaga_espiritual;
  if (typeof ae.dados_psionicos_gastos !== 'number') ae.dados_psionicos_gastos = 0;
  if (typeof ae.sussurros_gratis_usado !== 'boolean') ae.sussurros_gratis_usado = false;
  if (typeof ae.veu_psiquico_usado !== 'boolean') ae.veu_psiquico_usado = false;
  if (typeof ae.rasgar_mente_usado !== 'boolean') ae.rasgar_mente_usado = false;

  const r = char.recursos.ladino;
  if (typeof r.golpe_sorte_usado !== 'boolean') r.golpe_sorte_usado = false;

  const nivel = nivelNa(char, 'Ladino') || 1;
  const prog = getProgressaoLadino() || { furtivoDados: Math.ceil(nivel / 2) };

  // CD Golpe Astuto: 8 + mod Des + prof. bonusProficiencia usa o nivel
  // TOTAL do personagem (livro:2047), nao o nivel na classe Ladino -- por
  // isso le char.nivel direto aqui, em vez da variavel `nivel` (que e
  // nivelNa e alimenta os degraus de progressao do Ladino abaixo).
  const cdGolpeAstuto = 8 + calcMod(char.atributos.destreza) + bonusProficiencia(char.nivel || 1);

  // Ação Ardilosa (nível 2+)
  const acaoArdilosaAtiva = nivel >= 2;

  // Mira Firme (nível 3+)
  const miraFirmeAtiva = nivel >= 3;

  // Golpe Astuto (nível 5+)
  const golpeAstutoAtivo = nivel >= 5;

  // Esquiva Sobrenatural (nível 5+)
  const esquivaSobrenaturalAtiva = nivel >= 5;

  // Evasão (nível 7+)
  const evasaoAtiva = nivel >= 7;

  // Talento Confiável (nível 7+)
  const talentoConfiavelAtivo = nivel >= 7;

  // Golpe Astuto Aprimorado (nível 11+)
  const golpeAprimoradoAtivo = nivel >= 11;

  // Golpes Sujos (nível 14+)
  const golpesSujosAtivo = nivel >= 14;

  // Mente Escorregadia (nível 15+)
  const menteEscorregadiaAtiva = nivel >= 15;

  // Elusivo (nível 18+)
  const elusivoAtivo = nivel >= 18;

  // Golpe de Sorte (nível 20)
  const golpeSorteAtivo = nivel >= 20;

  // --- Adaga Espiritual ---
  // subclasseDe em vez do espelho char.subclasse: o espelho aponta para a
  // subclasse da classe INICIAL -- um Guerreiro/Ladino Adaga Espiritual
  // perderia os dados psionicos e a CD da subclasse sem nenhum aviso.
  const ehAdagaEspiritual = subclasseDe(char, 'Ladino') === 'Adaga Espiritual';
  let dadosPsionicosMaxL = 0, tipoDadoPsionicoL = 'd6';
  if (ehAdagaEspiritual && nivel >= 3) {
    if (nivel >= 17) { dadosPsionicosMaxL = 12; tipoDadoPsionicoL = 'd12'; }
    else if (nivel >= 13) { dadosPsionicosMaxL = 10; tipoDadoPsionicoL = 'd10'; }
    else if (nivel >= 11) { dadosPsionicosMaxL = 8; tipoDadoPsionicoL = 'd10'; }
    else if (nivel >= 9) { dadosPsionicosMaxL = 8; tipoDadoPsionicoL = 'd8'; }
    else if (nivel >= 5) { dadosPsionicosMaxL = 6; tipoDadoPsionicoL = 'd8'; }
    else { dadosPsionicosMaxL = 4; tipoDadoPsionicoL = 'd6'; }
  }
  // CD psiônica do Adaga Espiritual: 8 + mod Des + prof. Mesmo motivo do
  // cdGolpeAstuto acima: bonusProficiencia usa o nivel TOTAL, le char.nivel
  // direto em vez da variavel `nivel` (nivelNa).
  const cdPsionicaAdaga = ehAdagaEspiritual ? 8 + calcMod(char.atributos?.destreza || 10) + bonusProficiencia(char.nivel || 1) : 0;
  const laminasAlmaAtivas = ehAdagaEspiritual && nivel >= 9;
  const veuPsiquicoAtivo = ehAdagaEspiritual && nivel >= 13;
  const rasgarMenteAtivo = ehAdagaEspiritual && nivel >= 17;

  return {
    nivel,
    furtivoDados: prog.furtivoDados,
    furtivoTexto: `${prog.furtivoDados}d6`,
    cdGolpeAstuto,
    acaoArdilosaAtiva,
    miraFirmeAtiva,
    golpeAstutoAtivo,
    esquivaSobrenaturalAtiva,
    evasaoAtiva,
    talentoConfiavelAtivo,
    golpeAprimoradoAtivo,
    golpesSujosAtivo,
    menteEscorregadiaAtiva,
    elusivoAtivo,
    golpeSorteAtivo,
    golpeSorteUsado: r.golpe_sorte_usado,
    // Adaga Espiritual
    ehAdagaEspiritual,
    dadosPsionicosMaxL,
    dadosPsionicosDisponiveisL: Math.max(0, dadosPsionicosMaxL - ae.dados_psionicos_gastos),
    dadosPsionicosGastosL: ae.dados_psionicos_gastos,
    tipoDadoPsionicoL,
    cdPsionicaAdaga,
    sussurrosGratisUsado: ae.sussurros_gratis_usado,
    laminasAlmaAtivas,
    veuPsiquicoAtivo,
    veuPsiquicoUsado: ae.veu_psiquico_usado,
    rasgarMenteAtivo,
    rasgarMenteUsado: ae.rasgar_mente_usado,
    subclasses: subL
  };
}