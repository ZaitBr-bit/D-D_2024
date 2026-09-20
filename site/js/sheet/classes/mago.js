// ============================================================
// Progressao e recursos do Mago
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { char, salvar } from '../estado.js';
import { temClasse, nivelNa, subclasseDe } from '../../regras-multiclasse.js';

// Magias que o Mago "sempre tem preparadas" por característica de classe,
// e o círculo que cada vaga aceita (PHB 2024):
//   Maestria de Magias (nível 18) -- 1 magia de 1º e 1 de 2º círculo do
//     livro de magias, com tempo de conjuração de uma ação.
//   Assinatura Mágica (nível 20) -- 2 magias de 3º círculo do livro.
// A `origem` é o que marca essas magias como especiais na ficha: elas
// ficam sempre preparadas e NÃO ocupam vaga do limite de preparadas
// (magiaContaNoLimite, sheet/magias.js).
export const MAGIAS_FIXAS_MAGO = {
  maestria_magias: {
    nivel: 18, rotulo: 'Maestria de Magias',
    vagas: [{ chave: 'c1', circulo: 1 }, { chave: 'c2', circulo: 2 }],
    exigeAcao: true
  },
  assinatura_magica: {
    nivel: 20, rotulo: 'Assinatura Mágica',
    vagas: [{ chave: 'm1', circulo: 3 }, { chave: 'm2', circulo: 3 }],
    exigeAcao: false
  }
};

// ============================================================
// Progressão e recursos do Mago
// ============================================================
export function getEstadoRecursosMago() {
  if (!temClasse(char, 'Mago')) return null;
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
  // Quais magias o jogador escolheu para cada característica (antes as
  // duas existiam só como flag "ativa": a ficha oferecia os botões de
  // Assinatura Mágica sem nunca perguntar QUAL magia era a assinatura, e
  // a Maestria de Magias não perguntava nada).
  if (!r.maestria_magias) r.maestria_magias = { c1: '', c2: '' };
  if (!r.assinaturas) r.assinaturas = { m1: '', m2: '' };

  const nivel = nivelNa(char, 'Mago') || 1;

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
  // subclasseDe em vez do espelho char.subclasse: o espelho aponta para a
  // subclasse da classe INICIAL -- um Ladino/Mago Abjurador perderia os
  // recursos da tradicao sem nenhum aviso.
  const sub = subclasseDe(char, 'Mago') || '';
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
    // Criaturas Espectrais migrou para o botão "Grátis" da lista de Magias
    // (issue #76, `char.magias_preparadas[].gratis_usado`) -- não tem mais
    // bookkeeping próprio aqui.
    if (!r.subclasses.ilusionista) r.subclasses.ilusionista = {};
    const s = r.subclasses.ilusionista;
    if (typeof s.autoimagem_usada !== 'boolean') s.autoimagem_usada = false;
    subData = {
      autoimagemUsada: s.autoimagem_usada,
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
    maestriaMagia1: r.maestria_magias.c1 || '',
    maestriaMagia2: r.maestria_magias.c2 || '',
    assinaturaMagicaAtiva,
    assinatura1: r.assinaturas.m1 || '',
    assinatura2: r.assinaturas.m2 || '',
    assinatura1Usada: r.assinatura_magia_1_usada,
    assinatura2Usada: r.assinatura_magia_2_usada,
    ...subData
  };
}

/**
 * Issue #68: diz se UMA magia de Maestria de Magias/Assinatura Mágica tem
 * uso gratuito disponível AGORA, lendo a mesma fonte que o painel de
 * recursos do Mago (renderPainelRecursosMago, sheet/ficha.js) já usa --
 * sem guardar um segundo estado em `magias_preparadas`, que ficaria
 * desatualizado assim que o jogador conjurasse por QUALQUER um dos dois
 * lugares (painel de cima ou o botão "Grátis" da lista de preparadas).
 *
 * Maestria de Magias é "à vontade" (Classes.md:5330 -- nunca esgota,
 * sempre `true`); Assinatura Mágica esgota 1x por Descanso Curto/Longo,
 * por VAGA (m1/m2) -- lê `assinatura_magia_1_usada`/`_2_usada`.
 *
 * @param {string} nome
 * @returns {boolean|null} `null` quando a magia não é nem Maestria nem
 *   Assinatura -- quem chama decide o que fazer com a magia nesse caso
 *   (ex.: cair no mecanismo genérico de `gratis_usado`).
 */
export function magiaFixaMagoGratisDisponivel(nome) {
  const estado = getEstadoRecursosMago();
  if (!estado) return null;
  if (estado.maestriaMagiasAtiva && (nome === estado.maestriaMagia1 || nome === estado.maestriaMagia2)) {
    return true;
  }
  if (estado.assinaturaMagicaAtiva) {
    if (nome === estado.assinatura1) return !estado.assinatura1Usada;
    if (nome === estado.assinatura2) return !estado.assinatura2Usada;
  }
  return null;
}

/**
 * Marca como usada a Assinatura Mágica correspondente ao nome, se houver
 * (a MESMA escrita que o botão dedicado do painel de recursos já faz,
 * habilidades.js:2176-2177) -- para o botão "Grátis" da lista de
 * preparadas (issue #68) não abrir uma segunda contabilidade. Maestria de
 * Magias nunca marca nada: é "à vontade" por regra do livro.
 *
 * @param {string} nome
 * @returns {boolean} true se encontrou e marcou uma assinatura.
 */
export function marcarAssinaturaMagicaUsada(nome) {
  if (!temClasse(char, 'Mago') || !char.recursos?.mago) return false;
  const estado = getEstadoRecursosMago();
  if (!estado?.assinaturaMagicaAtiva) return false;
  if (nome === estado.assinatura1) { char.recursos.mago.assinatura_magia_1_usada = true; return true; }
  if (nome === estado.assinatura2) { char.recursos.mago.assinatura_magia_2_usada = true; return true; }
  return false;
}

/**
 * Grava as magias escolhidas para uma característica de magia fixa do Mago
 * (`maestria_magias` ou `assinatura_magica`) e sincroniza a lista de
 * preparadas.
 * @param {string} tipo - Chave de MAGIAS_FIXAS_MAGO
 * @param {Object} escolhas - { chaveDaVaga: nomeDaMagia }
 */
export function definirMagiasFixasMago(tipo, escolhas = {}) {
  const def = MAGIAS_FIXAS_MAGO[tipo];
  if (!def || !temClasse(char, 'Mago')) return;
  const destino = tipo === 'maestria_magias' ? char.recursos.mago.maestria_magias
    : char.recursos.mago.assinaturas;
  for (const vaga of def.vagas) {
    if (Object.prototype.hasOwnProperty.call(escolhas, vaga.chave)) {
      destino[vaga.chave] = escolhas[vaga.chave] || '';
    }
  }
  sincronizarMagiasFixasMago();
  salvar();
}

/**
 * Mantém `magias_preparadas` de acordo com as escolhas de Maestria de
 * Magias e Assinatura Mágica: o livro diz que essas magias ficam SEMPRE
 * preparadas. Tira da lista o que deixou de ser escolhido (ou o que o
 * personagem perdeu ao mudar de nível) e acrescenta o que falta.
 *
 * Chamada ao gravar a escolha e na abertura da ficha, para consertar
 * personagens que já passaram do nível 18/20 antes destas telas existirem.
 */
export function sincronizarMagiasFixasMago() {
  if (!temClasse(char, 'Mago')) return false;
  if (!char.recursos?.mago) return false;
  if (!Array.isArray(char.magias_preparadas)) char.magias_preparadas = [];
  const nivel = nivelNa(char, 'Mago') || 1;
  let alterado = false;

  for (const [tipo, def] of Object.entries(MAGIAS_FIXAS_MAGO)) {
    const destino = tipo === 'maestria_magias' ? char.recursos.mago.maestria_magias
      : char.recursos.mago.assinaturas;
    const ativa = nivel >= def.nivel;
    const escolhidas = ativa
      ? def.vagas.map(v => ({ nome: destino?.[v.chave] || '', circulo: v.circulo }))
        .filter(m => m.nome)
      : [];
    const nomes = new Set(escolhidas.map(m => m.nome));

    // Fora as que não são mais escolha desta característica
    const antes = char.magias_preparadas.length;
    char.magias_preparadas = char.magias_preparadas.filter(
      m => m?.origem !== tipo || nomes.has(m.nome));
    if (char.magias_preparadas.length !== antes) alterado = true;

    // Dentro as que faltam (sem duplicar uma magia que já está preparada
    // por escolha normal -- nesse caso só troca a origem, para não contar
    // duas vezes no limite)
    for (const escolha of escolhidas) {
      const existente = char.magias_preparadas.find(m => m.nome === escolha.nome);
      if (!existente) {
        char.magias_preparadas.push({ nome: escolha.nome, circulo: escolha.circulo, origem: tipo });
        alterado = true;
      } else if (existente.origem !== tipo) {
        existente.origem = tipo;
        alterado = true;
      }
    }
  }

  return alterado;
}