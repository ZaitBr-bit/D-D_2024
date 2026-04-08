// ============================================================
// Motor de efeitos passivos de talentos
// Centraliza resolução de bônus e flags derivados de talentos
// ============================================================
import { bonusProficiencia } from './utils.js';

/**
 * Normaliza array de talentos para lista de nomes (strings).
 * Cada entrada pode ser uma string ou objeto com .nome.
 */
export function normalizarTalentos(talentos = []) {
  return talentos.map(t => (typeof t === 'string' ? t : t?.nome)).filter(Boolean);
}

/**
 * Normaliza o estilo de luta ativo do personagem, unificando fontes
 * (escolha de classe e talentos) em um Set canônico sem duplicações.
 */
function getEstiloAtivo(char, nomesTalentos) {
  const estilo = char?.escolhas_classe?.estilo_luta?.[0] || '';
  // Mapa de nomes abreviados (escolha de classe) para nomes canônicos (talentos.json)
  const mapaEstilos = {
    'Arremesso': 'Combate com Armas de Arremesso',
    'Armas Grandes': 'Combate com Armas Grandes',
    'Duas Armas': 'Combate com Duas Armas',
    'Desarmado': 'Combate Desarmado'
  };
  const estiloCanon = mapaEstilos[estilo] || estilo;
  const ativos = new Set();
  if (estiloCanon) ativos.add(estiloCanon);
  // Nomes canônicos de todos os estilos de luta
  const todosEstilos = [
    'Arquearia', 'Combate com Armas de Arremesso', 'Combate com Armas Grandes',
    'Combate com Duas Armas', 'Combate Desarmado', 'Defensivo',
    'Duelismo', 'Interceptação', 'Luta às Cegas', 'Protetivo'
  ];
  for (const t of nomesTalentos) {
    if (todosEstilos.includes(t)) ativos.add(t);
  }
  return ativos;
}

/**
 * Resolve todos os efeitos passivos derivados dos talentos do personagem.
 * Retorna objeto com bônus numéricos, proficiências extras, resistências e flags.
 */
export function resolverPassivosTalentos(char) {
  const nomes = new Set(normalizarTalentos(char?.talentos));

  const passivos = {
    bonusIniciativa: 0,
    bonusDeslocamento: 0,
    bonusCA: 0,
    bonusCAArmaduraMediaMaxDes: null,
    bonusAtaqueDistancia: 0,
    bonusDanoUmaMao: 0,
    bonusDanoArremesso: 0,
    bonusDanoDesarmado: null,
    proficienciasExtra: [],
    resistenciasExtra: [],
    flags: {},
    estilosAtivos: new Set()
  };

  // ==========================================================
  // --- Talentos de Origem ---
  // ==========================================================

  // Alerta: bônus de proficiência na iniciativa + flag de troca
  if (nomes.has('Alerta')) {
    passivos.bonusIniciativa += bonusProficiencia(char.nivel || 1);
    passivos.flags.alerta_troca_iniciativa = true;
  }

  // Artifista: desconto em compras e fabricação rápida
  if (nomes.has('Artifista')) {
    passivos.flags.artifista_desconto = true;
    passivos.flags.artifista_fabricacao_rapida = true;
  }

  // Atacante Selvagem: rolar novamente 1 no dado de dano de arma
  if (nomes.has('Atacante Selvagem')) {
    passivos.flags.atacante_selvagem = true;
  }

  // Curandeiro: médico de combate e cura garantida
  if (nomes.has('Curandeiro')) {
    passivos.flags.curandeiro_medico_combate = true;
    passivos.flags.curandeiro_cura_garantida = true;
  }

  // Músico: canção encorajadora
  if (nomes.has('Músico')) {
    passivos.flags.musico_cancao_encorajadora = true;
  }

  // Sortudo: pontos de sorte = bônus de proficiência
  if (nomes.has('Sortudo')) {
    passivos.flags.sortudo = true;
  }

  // Valentão de Taverna: dano desarmado 1d4, empurrar, armamento improvisado, dano garantido
  if (nomes.has('Valentão de Taverna')) {
    passivos.bonusDanoDesarmado = '1d4';
    passivos.flags.valentao_empurrar = true;
    passivos.flags.valentao_armamento_improvisado = true;
    passivos.flags.valentao_dano_garantido = true;
  }

  // Treinamento com Armas Marciais: proficiência extra
  if (nomes.has('Treinamento com Armas Marciais')) {
    passivos.proficienciasExtra.push('Armas Marciais');
  }

  // ==========================================================
  // --- Talentos Gerais: Proficiências ---
  // ==========================================================

  if (nomes.has('Especialista em Armaduras Leves')) {
    passivos.proficienciasExtra.push('Armadura Leve');
  }
  if (nomes.has('Especialista em Armaduras Médias')) {
    passivos.proficienciasExtra.push('Armadura Média');
  }
  if (nomes.has('Especialista em Armaduras Pesadas')) {
    passivos.proficienciasExtra.push('Armadura Pesada');
  }

  // ==========================================================
  // --- Talentos Gerais: CA ---
  // ==========================================================

  // Mestre em Armaduras Médias: limite máximo de Destreza na CA sobe para +3
  if (nomes.has('Mestre em Armaduras Médias')) {
    passivos.bonusCAArmaduraMediaMaxDes = 3;
  }

  // Mestre em Armaduras Pesadas: redução de dano
  if (nomes.has('Mestre em Armaduras Pesadas')) {
    passivos.flags.mestre_armadura_pesada_reducao_dano = true;
  }

  // Mestre em Escudos: golpe e interposição com escudo
  if (nomes.has('Mestre em Escudos')) {
    passivos.flags.mestre_escudos_golpe = true;
    passivos.flags.mestre_escudos_interpor = true;
  }

  // ==========================================================
  // --- Talentos Gerais: Combate ---
  // ==========================================================

  // Agressor: corrida e investida
  if (nomes.has('Agressor')) {
    passivos.flags.agressor_corrida = true;
    passivos.flags.agressor_investida = true;
  }

  // Combatente Montado
  if (nomes.has('Combatente Montado')) {
    passivos.flags.combatente_montado = true;
  }

  // Conjurador Bélico: concentração, magia reativa e componentes somáticos
  if (nomes.has('Conjurador Bélico')) {
    passivos.flags.conjurador_belico_concentracao = true;
    passivos.flags.conjurador_belico_magia_reativa = true;
    passivos.flags.conjurador_belico_somaticos = true;
  }

  // Duelista Defensivo: aparar
  if (nomes.has('Duelista Defensivo')) {
    passivos.flags.duelista_defensivo_aparar = true;
  }

  // Envenenador: veneno potente e preparação
  if (nomes.has('Envenenador')) {
    passivos.flags.envenenador_potente = true;
    passivos.flags.envenenador_preparar = true;
  }

  // Esmagador: empurrar e crítico aprimorado
  if (nomes.has('Esmagador')) {
    passivos.flags.esmagador_empurrar = true;
    passivos.flags.esmagador_critico = true;
  }

  // Especialista Ambidestro: ambidestria aprimorada e saque rápido
  if (nomes.has('Especialista Ambidestro')) {
    passivos.flags.ambidestro_aprimorado = true;
    passivos.flags.ambidestro_saque_rapido = true;
  }

  // Especialista em Besta: ignorar recarga, queima-roupa e duas armas
  if (nomes.has('Especialista em Besta')) {
    passivos.flags.besta_ignorar_recarga = true;
    passivos.flags.besta_queima_roupa = true;
    passivos.flags.besta_duas_armas = true;
  }

  // Exterminador de Conjuradores: quebrar concentração e resguardo
  if (nomes.has('Exterminador de Conjuradores')) {
    passivos.flags.exterminador_quebra_concentracao = true;
    passivos.flags.exterminador_resguardo = true;
  }

  // Imobilizador: socar, vantagem em agarrar e agarre veloz
  if (nomes.has('Imobilizador')) {
    passivos.flags.imobilizador_socar = true;
    passivos.flags.imobilizador_vantagem = true;
    passivos.flags.imobilizador_veloz = true;
  }

  // Mestre das Armas: maestria extra
  if (nomes.has('Mestre das Armas')) {
    passivos.flags.mestre_armas_maestria_extra = true;
  }

  // Mestre em Armas de Haste: golpe e ataque reativo
  if (nomes.has('Mestre em Armas de Haste')) {
    passivos.flags.mestre_haste_golpe = true;
    passivos.flags.mestre_haste_reativo = true;
  }

  // Mestre em Armas Grandes: maestria e cortar
  if (nomes.has('Mestre em Armas Grandes')) {
    passivos.flags.mestre_armas_grandes_maestria = true;
    passivos.flags.mestre_armas_grandes_cortar = true;
  }

  // Mestre-Atirador: ignorar cobertura, queima-roupa e tiro longo
  if (nomes.has('Mestre-Atirador')) {
    passivos.flags.mestre_atirador_cobertura = true;
    passivos.flags.mestre_atirador_queima_roupa = true;
    passivos.flags.mestre_atirador_tiro_longo = true;
  }

  // Atirador Arcano: ignorar cobertura, queima-roupa e alcance
  if (nomes.has('Atirador Arcano')) {
    passivos.flags.atirador_arcano_cobertura = true;
    passivos.flags.atirador_arcano_queima_roupa = true;
    passivos.flags.atirador_arcano_alcance = true;
  }

  // Perfurador: punção e crítico aprimorado
  if (nomes.has('Perfurador')) {
    passivos.flags.perfurador_puncao = true;
    passivos.flags.perfurador_critico = true;
  }

  // Resistente: recuperação rápida e vantagem em testes de morte
  if (nomes.has('Resistente')) {
    passivos.flags.resistente_recuperacao_rapida = true;
    passivos.flags.resistente_vantagem_morte = true;
  }

  // Sentinela: diligente e deter
  if (nomes.has('Sentinela')) {
    passivos.flags.sentinela_diligente = true;
    passivos.flags.sentinela_deter = true;
  }

  // Talhador: debilitar e crítico aprimorado
  if (nomes.has('Talhador')) {
    passivos.flags.talhador_debilitar = true;
    passivos.flags.talhador_critico = true;
  }

  // Velocista: +3 deslocamento, terreno difícil e agilidade
  if (nomes.has('Velocista')) {
    passivos.bonusDeslocamento += 3;
    passivos.flags.velocista_terreno_dificil = true;
    passivos.flags.velocista_agi = true;
  }

  // Dádiva da Velocidade: +9 de deslocamento
  if (nomes.has('Dádiva da Velocidade')) {
    passivos.bonusDeslocamento += 9;
  }

  // ==========================================================
  // --- Talentos Gerais: Habilidades ---
  // ==========================================================

  // Atleta: escalada e salto aprimorados
  if (nomes.has('Atleta')) {
    passivos.flags.atleta_escalada = true;
    passivos.flags.atleta_salto = true;
  }

  // Ator: personificação e mimetismo
  if (nomes.has('Ator')) {
    passivos.flags.ator_personificacao = true;
    passivos.flags.ator_mimetismo = true;
  }

  // Chef: refeição revigorante e guloseimas
  if (nomes.has('Chef')) {
    passivos.flags.chef_refeicao = true;
    passivos.flags.chef_guloseimas = true;
  }

  // Líder Inspirador: inspiração em descanso
  if (nomes.has('Líder Inspirador')) {
    passivos.flags.lider_inspirador = true;
  }

  // Sorrateiro: visão às cegas 3m, névoa e atirador
  if (nomes.has('Sorrateiro')) {
    passivos.flags.sorrateiro_visao_cegas_3m = true;
    passivos.flags.sorrateiro_nevoa = true;
    passivos.flags.sorrateiro_atirador = true;
  }

  // Telecinético: telecinese menor e empurrão
  if (nomes.has('Telecinético')) {
    passivos.flags.telecinetico_menor = true;
    passivos.flags.telecinetico_empurrao = true;
  }

  // Telepático: enunciado e detecção
  if (nomes.has('Telepático')) {
    passivos.flags.telepatico_enunciado = true;
    passivos.flags.telepatico_detectar = true;
  }

  // ==========================================================
  // --- Estilos de Luta (classe + talentos, sem duplicação) ---
  // ==========================================================
  const estilosAtivos = getEstiloAtivo(char, nomes);
  passivos.estilosAtivos = estilosAtivos;

  // Arquearia: +2 nas jogadas de ataque à distância
  if (estilosAtivos.has('Arquearia')) passivos.bonusAtaqueDistancia += 2;

  // Duelismo: +2 no dano com arma de uma mão
  if (estilosAtivos.has('Duelismo')) passivos.bonusDanoUmaMao += 2;

  // Combate com Armas de Arremesso: +2 no dano de arremesso
  if (estilosAtivos.has('Combate com Armas de Arremesso')) passivos.bonusDanoArremesso += 2;

  // Combate com Armas Grandes: re-rolar 1 ou 2 no dado de dano (duas mãos)
  if (estilosAtivos.has('Combate com Armas Grandes')) passivos.flags.estilo_armas_grandes = true;

  // Combate com Duas Armas: adicionar modificador ao dano da mão secundária
  if (estilosAtivos.has('Combate com Duas Armas')) passivos.flags.estilo_duas_armas = true;

  // Combate Desarmado: dano desarmado melhora para 1d6
  if (estilosAtivos.has('Combate Desarmado')) passivos.bonusDanoDesarmado = '1d6';

  // Defensivo: +1 CA já tratado em calcCA (utils.js) — flag apenas para referência
  if (estilosAtivos.has('Defensivo')) passivos.flags.estilo_defensivo = true;

  // Interceptação: reação para reduzir dano a aliado adjacente
  if (estilosAtivos.has('Interceptação')) passivos.flags.estilo_interceptacao = true;

  // Luta às Cegas: visão às cegas 3m
  if (estilosAtivos.has('Luta às Cegas')) passivos.flags.estilo_luta_cegas_3m = true;

  // Protetivo: impor desvantagem em ataques contra aliados adjacentes
  if (estilosAtivos.has('Protetivo')) passivos.flags.estilo_protetivo = true;

  return passivos;
}