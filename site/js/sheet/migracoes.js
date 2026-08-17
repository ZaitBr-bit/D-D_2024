// ============================================================
// Migracoes de fichas legadas
//
// Rodam na abertura da ficha, antes do primeiro render. Cada uma
// converte um formato antigo de dado para o atual, sem efeito se ja
// estiver convertido.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { MAGIAS_LEGADO_ESPECIE, _concederMagiaAutomatica } from '../levelup.js';
import { getTruquesFixosAcumulados } from '../regras-conjuracao-subclasse.js';
import { getLimitesMagias } from '../utils.js';
import { char, classeData, indiceMagiasCache, magiasDominioCache, magiasSempreCache, salvar } from './estado.js';
import { getSubclasseConjuradoraConjuracao, magiaContaNoLimite } from './magias.js';

/** Migra magias de domínio legadas adicionando origem: 'dominio' */
export function migrarMagiasDominio() {
  if (!magiasDominioCache?.length || !char.magias_preparadas?.length) return;
  let alterado = false;
  const nomesDominio = new Set(magiasDominioCache.map(m => m.nome));
  char.magias_preparadas.forEach(m => {
    if (nomesDominio.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre' && m.origem !== 'especie_legado') {
      m.origem = 'dominio';
      alterado = true;
    }
  });
  if (alterado) salvar();
}

/** Migra magias sempre preparadas legadas adicionando origem: 'sempre' */
/**
 * Detecta retroativamente se o personagem tem menos magias manuais do que o
 * limite permite — situação causada por magias salvas com origem: 'sempre'
 * antes de a migração registrar os slots liberados.
 */
export function migrarSlotsMagiaLivre() {
  const info = CLASSES_INFO[char.classe];
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info?.tipo_conjuracao || (subConj ? 'conhecidas' : 'preparadas');
  if (tipoConj !== 'conhecidas') return; // só Feiticeiro-like conta magias conhecidas fixas

  const tabela = classeData?.tabela_caracteristicas;
  if (!tabela) return;

  // getLimitesMagias cai para a tabela da subclasse quando a da classe não
  // tem colunas de magia: sem isso o limite de um Trapaceiro Arcano/
  // Cavaleiro Místico era lido como 0 e a vaga nunca era oferecida -- foi o
  // que deixou sem saída os personagens que subiram para o nível 3 antes da
  // correção do fluxo de subida (que não pedia truque nem magia nenhuma).
  const limites = getLimitesMagias(tabela, char.nivel, subConj);
  let alterado = false;

  if (limites.preparadas > 0) {
    const atual = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).length;
    const deficit = limites.preparadas - atual;
    // Se o slot já foi contabilizado, não duplicar
    if (deficit > 0 && deficit > (char._slots_magia_livre || 0)) {
      char._slots_magia_livre = deficit;
      alterado = true;
    }
  }

  if (limites.truques > 0) {
    // Truques de espécie/talento não ocupam o limite de classe (mesma
    // separação que a seção Magias da ficha faz nos contadores).
    const origensForaDoLimite = ['especie', 'especie_legado', 'iniciado_em_magia',
      'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista', 'telecinetico'];
    const atuais = (char.magias_conhecidas || [])
      .filter(m => m.circulo === 0 && !origensForaDoLimite.includes(m?.origem)).length;
    const deficit = limites.truques - atuais;
    if (deficit > 0 && deficit > (char._slots_truque_livre || 0)) {
      char._slots_truque_livre = deficit;
      alterado = true;
    }
  }

  if (alterado) salvar();
}

/**
 * Concede os truques que a subclasse dá de graça (Mãos Mágicas do
 * Trapaceiro Arcano) a fichas que subiram de nível antes de o fluxo de
 * subida passar a concedê-los.
 */
export function migrarTruquesFixosSubclasse() {
  const fixos = getTruquesFixosAcumulados(char.classe, char.subclasse, char.nivel || 1);
  if (fixos.length === 0) return;
  if (!char.magias_conhecidas) char.magias_conhecidas = [];
  let alterado = false;
  for (const nome of fixos) {
    if (!char.magias_conhecidas.some(m => m.nome === nome)) {
      char.magias_conhecidas.push({ nome, circulo: 0, origem: 'subclasse_fixa' });
      alterado = true;
    }
  }
  if (alterado) salvar();
}

export function migrarMagiasSemprePreparadas() {
  if (!char.magias_preparadas?.length) return;
  let alterado = false;
  let slotsLiberados = 0;
  const nomesSempre = new Set((magiasSempreCache || []).map(m => m.nome));

  // Higienização: remove magias marcadas como "sempre" que não estão mais
  // na lista real de magias sempre preparadas (corrige parsing antigo/errado)
  char.magias_preparadas = char.magias_preparadas.filter(m => {
    if (m?.origem !== 'sempre') return true;
    if (nomesSempre.has(m.nome)) return true;
    alterado = true;
    return false;
  });

  char.magias_preparadas.forEach(m => {
    if (nomesSempre.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre' && m.origem !== 'especie_legado') {
      m.origem = 'sempre';
      slotsLiberados++;
      alterado = true;
    }
  });

  // Se havia magias sem origem que agora são "sempre", o jogador perdeu uma
  // escolha manual — marcar para que a UI ofereça preencher o slot.
  if (slotsLiberados > 0) {
    char._slots_magia_livre = (char._slots_magia_livre || 0) + slotsLiberados;
    alterado = true;
  }

  // Realocar truques sempre-preparados salvos errado como magias de 1º círculo
  // (bug antigo: circulo 0 virava 1 e caía em magias_preparadas)
  const circuloPorNome = new Map((magiasSempreCache || []).map(m => [m.nome, m.circulo]));
  const realocar = char.magias_preparadas.filter(m => m.origem === 'sempre' && circuloPorNome.get(m.nome) === 0);
  if (realocar.length > 0) {
    if (!char.magias_conhecidas) char.magias_conhecidas = [];
    for (const m of realocar) {
      if (!char.magias_conhecidas.find(x => x.nome === m.nome)) {
        char.magias_conhecidas.push({ nome: m.nome, circulo: 0, origem: 'sempre' });
      }
    }
    char.magias_preparadas = char.magias_preparadas.filter(m => !(m.origem === 'sempre' && circuloPorNome.get(m.nome) === 0));
    alterado = true;
  }

  if (alterado) salvar();
}

/** Adiciona truques concedidos pela espécie que estejam faltando */
export function migrarTruquesEspecie() {
  if (!char.especie) return;
  const truques = obterTruquesEspecieFicha(char.especie, char.tracos_escolhidos || []);
  if (truques.length === 0) return;

  if (!char.magias_conhecidas) char.magias_conhecidas = [];
  let alterado = false;
  for (const nome of truques) {
    if (!char.magias_conhecidas.find(m => m.nome === nome)) {
      char.magias_conhecidas.push({ nome, circulo: 0, origem: 'especie' });
      alterado = true;
    }
  }
  if (alterado) salvar();
}

/**
 * Migração retroativa: concede a magia de Legado Ínfero (Tiferino) / Linhagem
 * Élfica (Elfo) dos níveis 3 e 5 para fichas que já estavam nesses níveis antes
 * de essa concessão automática existir em subirDeNivel (Task 4). Idempotente,
 * no mesmo padrão de migrarTruquesEspecie.
 */
export function migrarMagiasLegadoEspecie() {
  if (!char.especie || !char.nivel) return;
  const legadoEscolhido = (char.tracos_escolhidos || [])[0];
  const tabelaLegado = MAGIAS_LEGADO_ESPECIE[char.especie]?.[legadoEscolhido];
  if (!tabelaLegado) return;

  if (!char.magias_preparadas) char.magias_preparadas = [];
  let alterado = false;
  for (const [nivelStr, nomeMagia] of Object.entries(tabelaLegado)) {
    const nivel = Number(nivelStr);
    if (nivel > char.nivel) continue;
    const jaTem = char.magias_preparadas.find(m => m.nome === nomeMagia && m.origem === 'especie_legado');
    if (jaTem) continue;
    const magiaIdx = (indiceMagiasCache || []).find(m => m.nome === nomeMagia);
    const circulo = magiaIdx?.circulo ?? (nivel === 3 ? 1 : 2);
    _concederMagiaAutomatica(char.magias_preparadas, { nome: nomeMagia, circulo }, 'especie_legado');
    alterado = true;
  }
  if (alterado) salvar();
}

/** Retorna truques concedidos pela espécie/traço escolhido */
function obterTruquesEspecieFicha(especie, tracosEscolhidos) {
  const truques = [];
  const escolha = (tracosEscolhidos || [])[0] || '';

  if (especie === 'Aasimar') {
    truques.push('Luz');
  } else if (especie === 'Gnomo') {
    if (escolha === 'Gnomo das Rochas') {
      truques.push('Prestidigitação Arcana', 'Reparar');
    } else if (escolha === 'Gnomo do Bosque') {
      truques.push('Ilusão Menor');
    }
  } else if (especie === 'Tiferino') {
    truques.push('Taumaturgia');
    const legadoTruque = { 'Abissal': 'Rajada de Veneno', 'Ctônico': 'Toque Necrótico', 'Infernal': 'Raio de Fogo' };
    if (legadoTruque[escolha]) truques.push(legadoTruque[escolha]);
  } else if (especie === 'Elfo') {
    const linhagemTruque = { 'Alto Elfo': 'Prestidigitação Arcana', 'Drow': 'Luzes Dançantes', 'Elfo Silvestre': 'Arte Druídica' };
    if (linhagemTruque[escolha]) truques.push(linhagemTruque[escolha]);
  }

  return truques;
}

/** Migra escolhas_classe legadas aplicando expertise e idiomas mecanicamente */
export function migrarEscolhasClasseLegadas() {
  if (!char.escolhas_classe) return;
  let alterado = false;
  if (!char.pericias_expertise) char.pericias_expertise = [];

  // Aplicar especialista (Ladino / Guardião) -> pericias_expertise
  const especialista = char.escolhas_classe.especialista || [];
  especialista.forEach(p => {
    if (!char.pericias_expertise.includes(p)) {
      char.pericias_expertise.push(p);
      alterado = true;
    }
  });

  // Aplicar acadêmico (Mago) -> pericias_expertise
  const academico = char.escolhas_classe.academico || [];
  academico.forEach(p => {
    if (!char.pericias_expertise.includes(p)) {
      char.pericias_expertise.push(p);
      alterado = true;
    }
  });

  if (alterado) salvar();
}

/** Migra nome legado da pericia 'Adestrar Animais' para 'Lidar com Animais' (Livro do Jogador 2024) */
export function migrarNomePericiaLidarAnimais() {
  let alterado = false;
  const substituir = (arr) => {
    if (!arr) return;
    const idx = arr.indexOf('Adestrar Animais');
    if (idx !== -1) { arr[idx] = 'Lidar com Animais'; alterado = true; }
  };
  substituir(char.pericias_proficientes);
  substituir(char.pericias_expertise);
  if (alterado) salvar();
}

/** Migra talento Versatil do Humano: garante que esteja no array de talentos */
export function migrarTalentoVersatilHumano() {
  if (char.especie !== 'Humano' || !char.talento_versatil) return;
  if (!char.talentos) char.talentos = [];
  if (!char.talentos.includes(char.talento_versatil)) {
    char.talentos.push(char.talento_versatil);
    salvar();
  }
}

/** Garante que a pericia de especie (Habil/Sentidos Aguçados) esteja nas proficiencias */
export function migrarPericiaEspecie() {
  if (!char.pericia_especie) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  if (!char.pericias_proficientes.includes(char.pericia_especie)) {
    char.pericias_proficientes.push(char.pericia_especie);
    salvar();
  }
}

/** Garante que pericias de especie (array, ex: Kenku) estejam nas proficiencias */
export function migrarPericiasEspecie() {
  if (!char.pericias_especie?.length) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  let changed = false;
  char.pericias_especie.forEach(p => {
    if (p && !char.pericias_proficientes.includes(p)) {
      char.pericias_proficientes.push(p);
      changed = true;
    }
  });
  if (changed) salvar();
}

/** Garante que pericias de talentos (Habilidoso) estejam nas proficiencias */
export function migrarPericiasTalentos() {
  if (!char.escolhas_talento) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  const PERICIAS_NOMES = [
    'Acrobacia', 'Lidar com Animais', 'Arcanismo', 'Atletismo', 'Atuação',
    'Enganação', 'Furtividade', 'História', 'Intimidação', 'Intuição',
    'Investigação', 'Medicina', 'Natureza', 'Percepção', 'Persuasão',
    'Prestidigitação', 'Religião', 'Sobrevivência'
  ];
  let changed = false;
  // Iterar sobre todos os contextos (antecedente, versatil, levelup_N)
  Object.keys(char.escolhas_talento).forEach(ctx => {
    const escolhas = char.escolhas_talento[ctx] || [];
    escolhas.forEach(e => {
      // So pericias, nao ferramentas
      if (PERICIAS_NOMES.includes(e) && !char.pericias_proficientes.includes(e)) {
        char.pericias_proficientes.push(e);
        changed = true;
      }
    });
  });
  if (changed) salvar();
}