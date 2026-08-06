// ============================================================
// Progressao e recursos do Mago
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { char } from '../estado.js';

// ============================================================
// Progressão e recursos do Mago
// ============================================================
export function getEstadoRecursosMago() {
  if (char?.classe !== 'Mago') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.mago) {
    char.recursos.mago = {
      recuperacao_arcana_usada: false,
      assinatura_magia_1_usada: false,
      assinatura_magia_2_usada: false
    };
  }

  const r = char.recursos.mago;
  if (typeof r.recuperacao_arcana_usada !== 'boolean') r.recuperacao_arcana_usada = false;
  if (typeof r.assinatura_magia_1_usada !== 'boolean') r.assinatura_magia_1_usada = false;
  if (typeof r.assinatura_magia_2_usada !== 'boolean') r.assinatura_magia_2_usada = false;

  const nivel = char.nivel || 1;

  // Recuperação Arcana: recupera círculos combinados <= metade do nível (arredondado para cima), máx 5º círculo
  const recuperacaoArcanaMax = Math.ceil(nivel / 2);

  // Memorizar Magia (nível 5+)
  const memorizarMagiaAtivo = nivel >= 5;

  // Maestria de Magias (nível 18+)
  const maestriaMagiasAtiva = nivel >= 18;

  // Assinatura Mágica (nível 20): 2 magias de 3º círculo, 1x cada por descanso curto/longo
  const assinaturaMagicaAtiva = nivel >= 20;

  const intMod = Math.floor(((char.atributos?.inteligencia || 10) - 10) / 2);

  // Subclasses de Mago
  if (!r.subclasses) r.subclasses = {};
  const sub = char.subclasse || '';
  let subData = {};

  if (sub === 'Abjurador') {
    if (!r.subclasses.abjurador) r.subclasses.abjurador = {};
    const s = r.subclasses.abjurador;
    if (typeof s.protecao_criada !== 'boolean') s.protecao_criada = false;
    if (typeof s.protecao_pv_atual !== 'number') s.protecao_pv_atual = 0;
    const protecaoMax = (nivel * 2) + intMod;
    subData = {
      protecaoCriada: s.protecao_criada,
      protecaoPvAtual: Math.min(s.protecao_pv_atual, protecaoMax),
      protecaoPvMax: protecaoMax
    };
  }

  if (sub === 'Adivinhador') {
    if (!r.subclasses.adivinhador) r.subclasses.adivinhador = {};
    const s = r.subclasses.adivinhador;
    const numDados = nivel >= 14 ? 3 : 2;
    if (typeof s.prodigio_dado_1 !== 'number') s.prodigio_dado_1 = 0;
    if (typeof s.prodigio_dado_1_usado !== 'boolean') s.prodigio_dado_1_usado = false;
    if (typeof s.prodigio_dado_2 !== 'number') s.prodigio_dado_2 = 0;
    if (typeof s.prodigio_dado_2_usado !== 'boolean') s.prodigio_dado_2_usado = false;
    if (typeof s.prodigio_dado_3 !== 'number') s.prodigio_dado_3 = 0;
    if (typeof s.prodigio_dado_3_usado !== 'boolean') s.prodigio_dado_3_usado = false;
    if (typeof s.terceiro_olho_usado !== 'boolean') s.terceiro_olho_usado = false;
    if (typeof s.terceiro_olho_escolha !== 'string') s.terceiro_olho_escolha = '';
    subData = {
      numDadosProdigio: numDados,
      prodigioDado1: s.prodigio_dado_1,
      prodigioDado1Usado: s.prodigio_dado_1_usado,
      prodigioDado2: s.prodigio_dado_2,
      prodigioDado2Usado: s.prodigio_dado_2_usado,
      prodigioDado3: s.prodigio_dado_3,
      prodigioDado3Usado: s.prodigio_dado_3_usado,
      terceiroOlhoUsado: s.terceiro_olho_usado,
      terceiroOlhoEscolha: s.terceiro_olho_escolha,
      terceiroOlhoAtivo: nivel >= 10
    };
  }

  if (sub === 'Evocador') {
    if (!r.subclasses.evocador) r.subclasses.evocador = {};
    const s = r.subclasses.evocador;
    if (typeof s.sobrecarga_usos !== 'number') s.sobrecarga_usos = 0;
    subData = {
      sobrecargaUsos: s.sobrecarga_usos,
      sobrecargaAtiva: nivel >= 14
    };
  }

  if (sub === 'Ilusionista') {
    if (!r.subclasses.ilusionista) r.subclasses.ilusionista = {};
    const s = r.subclasses.ilusionista;
    if (typeof s.feerica_usada !== 'boolean') s.feerica_usada = false;
    if (typeof s.fera_usada !== 'boolean') s.fera_usada = false;
    if (typeof s.autoimagem_usada !== 'boolean') s.autoimagem_usada = false;
    subData = {
      feericaUsada: s.feerica_usada,
      feraUsada: s.fera_usada,
      autoimagemUsada: s.autoimagem_usada,
      criaturasEspectraisAtiva: nivel >= 6,
      autoimagemAtiva: nivel >= 10
    };
  }

  return {
    nivel,
    intMod,
    recuperacaoArcanaMax,
    recuperacaoArcanaUsada: r.recuperacao_arcana_usada,
    memorizarMagiaAtivo,
    maestriaMagiasAtiva,
    assinaturaMagicaAtiva,
    assinatura1Usada: r.assinatura_magia_1_usada,
    assinatura2Usada: r.assinatura_magia_2_usada,
    ...subData
  };
}