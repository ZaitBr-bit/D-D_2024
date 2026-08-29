// ============================================================
// Reservas de espaco de magia por multiclasse.
//
// Funcao PURA que deriva o TOTAL de espacos a cada chamada, no mesmo
// espirito das reservas de dado de vida (regras-multiclasse.js,
// reservasDadosVida): total armazenado e um segundo lugar dizendo a
// verdade, e os dois divergem em silencio. So `usados` e estado do
// jogador.
//
// Este modulo e o escritor AUTORIZADO de char.espacos_magia em runtime,
// atraves de gastarEspaco/restaurarEspacosDePacto/
// restaurarEspacosDeConjuracao (Tarefa 3) e recuperarUmEspaco (Tarefa 4,
// o inverso de gastarEspaco para UM espaco so) -- nenhum outro lugar
// deveria escrever o campo depois disso. A migracao da forma antiga para a
// nova (Tarefa 2, migrarEspacosDeMagia em regras-multiclasse-
// conjuracao.js) e um escritor autorizado A PARTE, que roda uma unica
// vez na abertura da ficha.
// ============================================================
import { usaTabelaUnificada, espacosPorCirculo, classesConjuradoras, temMagiaDePacto, migrarEspacosDeMagia }
  from '../regras-multiclasse-conjuracao.js';
import { nivelNa, subclasseDe } from '../regras-multiclasse.js';
import { getEspacosSubclasseConjuradora } from '../regras-conjuracao-subclasse.js';
import { getEspacosMagia } from '../utils.js';
import { char, classesData } from './estado.js';

/**
 * Espacos brutos (formato `{circulo: {total, usados}}`) da UNICA classe
 * conjuradora do personagem, no NIVEL DELA -- livro:2071.
 *
 * Um terco conjuradores por SUBCLASSE (Cavaleiro Mistico do Guerreiro,
 * Trapaceiro Arcano do Ladino) nao tem tabela em `tabela_caracteristicas`:
 * guerreiro.json e ladino.json nao tem colunas de magia -- a tabela deles
 * vive em regras-conjuracao-subclasse.js, indexada por CLASSE+SUBCLASSE,
 * nao so por classe. Usar `tabela_caracteristicas` para essas duas
 * devolveria `{}` (getEspacosMagia sem tabela) -- vazio mas TRUTHY -- e um
 * `if (bruto)` ingenuo leria isso como "zero espacos" e produziria uma
 * reserva de Conjuracao vazia em silencio: a MESMA armadilha que o
 * docblock de `espacosPorCirculo` documenta para o motor (`null`, nunca
 * `{}`). Por isso esta funcao devolve null -- nao {} -- sempre que a
 * tabela escolhida nao resolve nenhum espaco, e o chamador confere
 * truthiness do retorno antes de usar.
 *
 * @param {object} personagem
 * @param {Map<string, object>} mapaDados
 * @param {{classe:string, nivel:number, categoria:string}} unica
 * @returns {{[circulo: number]: {total:number, usados:number}}|null}
 */
function espacosDaUnicaConjuradora(personagem, mapaDados, unica) {
  const bruto = unica.categoria === 'um_terco_subclasse'
    ? getEspacosSubclasseConjuradora(unica.classe, subclasseDe(personagem, unica.classe), unica.nivel)
    : getEspacosMagia(mapaDados?.get?.(unica.classe)?.tabela_caracteristicas, unica.nivel);
  return Object.keys(bruto).length ? bruto : null;
}

/**
 * Reservas de espaco de magia do personagem, uma entrada por FONTE e
 * CIRCULO.
 *
 * O total e DERIVADO da regra a cada chamada -- so `usados` e estado do
 * jogador. E a mesma separacao que o 3e fez para dado de vida, e pelo
 * mesmo motivo: total armazenado e um segundo lugar dizendo a verdade,
 * e os dois divergem em silencio.
 *
 * Tres fontes, e elas NAO se somam:
 *  - 'conjuracao': tabela unificada (livro:2104-2110) com DUAS ou mais
 *    classes conjuradoras; com UMA so, a tabela daquela classe no nivel
 *    DELA -- nunca no total;
 *  - 'pacto': Magia de Pacto do Bruxo, reserva separada que volta no
 *    Descanso Curto (Classes.md:898);
 *  - os extras de Fonte de Magia (`espacos_magia_extras`) somam ao
 *    total de 'conjuracao' no circulo correspondente, porque e isso que
 *    eles sao: espacos a mais para conjurar.
 *
 * PONTO CEGO NOMEADO (achado da revisao da Tarefa 4, Ruling 11): apagar
 * `char.espacos_magia` inteiro e esvazia-lo (`{}`) sao INDISTINGUIVEIS
 * para esta funcao -- `armazenado?.[fonte]?.[circulo]` degrada os dois
 * para 0 do mesmo jeito, e e por isso que a maioria das mutacoes que
 * destroem o campo nao mudam nada observavel (prova por mutacao da
 * Tarefa 4: apagar as chaves 'conjuracao'/'pacto' produziu o MESMO
 * resultado que zera-las). Essa resiliencia quebra numa forma HIBRIDA
 * especifica: chaves de FONTE ausentes ('conjuracao'/'pacto' nao
 * presentes) mas chaves NUMERICAS de circulo presentes (ex.:
 * `{"1":{"total":4,"usados":0}}`). Contra essa forma, a guarda de
 * idempotencia de migrarEspacosDeMagia (regras-multiclasse-conjuracao.js,
 * `if (antigo.conjuracao || antigo.pacto) return false`) conclui "ainda
 * nao migrada" e RE-MIGRA -- silenciosamente absorvendo o que estiver
 * nas chaves numericas como se fosse gasto legado real, sem lancar nem
 * avisar. Era exatamente a forma que a subida de nivel ainda nao
 * convertida (site/js/levelup.js, `atualizarEspacosMagia` e o bloco de
 * subclasse conjuradora em `subirDeNivel`) produzia ao escrever chaves de
 * circulo direto sobre uma ficha ja migrada -- por isso nenhum dos
 * oraculos desta suite pegava aquela regressao: a degradacao graciosa
 * que protege todo OUTRO caso de campo ausente/vazio nao protege este.
 * O SUB-PROJETO 5 FECHOU ESSE BURACO: as duas escritas sairam
 * (`atualizarEspacosMagia` deixou de existir) e nada mais no app grava
 * chave NUMERICA de circulo -- medido pelo guarda de escrita de espelho
 * em multiclasse-fundacao.test.mjs, que hoje nao acha escrita nenhuma em
 * levelup.js. A forma hibrida so volta por ficha importada a mao; o aviso
 * fica porque a fragilidade de migrarEspacosDeMagia contra ela continua
 * real.
 * Quem mexer nesta funcao ou em migrarEspacosDeMagia depois precisa saber
 * que a forma hibrida e a UNICA excecao.
 *
 * SEGUNDA DEGRADACAO, DE RENDER (achado da revisao de conformidade,
 * 2026-08-26): com `mapaDados` vazio ou nao carregado -- a promessa de
 * dados de classe ainda em voo, ou uma falha de rede -- esta funcao
 * devolve LISTA VAZIA, e a caixa de espacos de magia simplesmente SOME
 * da tela. Antes do 4, com o total armazenado, o valor antigo ainda
 * aparecia. Nao ha perda de dado (o `usados` continua em disco, e o
 * proximo render com os dados carregados o mostra de novo), mas o
 * jogador ve uma ficha sem espacos nenhum e nao ha aviso na tela nem no
 * console. O docblock de gastarEspaco (abaixo) ja registra a mesma causa
 * para o `false` inesperado da ESCRITA; esta linha registra o lado da
 * LEITURA, que estava sem registro.
 *
 * @param {object} personagem
 * @param {Map<string, object>} mapaDados dados por nome de classe.
 * @returns {Array<{fonte:'conjuracao'|'pacto', circulo:number, total:number, usados:number, disponiveis:number}>}
 */
export function montarReservasDeEspacos(personagem, mapaDados) {
  const reservas = [];
  const armazenado = (personagem && typeof personagem.espacos_magia === 'object' && personagem.espacos_magia) || {};
  // `usados` e o UNICO campo de estado do jogador; uma ficha ainda na
  // forma antiga (sem `espacos_magia` na forma { fonte: { circulo: usados } })
  // simplesmente devolve 0 aqui -- degradacao deliberada, ver Tarefa 2.
  const usadosDe = (fonte, circulo) => {
    const n = Number(armazenado?.[fonte]?.[circulo]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  // CONJURACAO -- unificada com 2+ classes conjuradoras, propria com 1.
  let porCirculo = null;
  if (usaTabelaUnificada(personagem)) {
    porCirculo = espacosPorCirculo(personagem);
  } else {
    const unica = classesConjuradoras(personagem)[0];
    // nivel DELA, nao o total: livro:2071 manda seguir as regras daquela
    // classe quando so ha uma conjuradora.
    const bruto = unica ? espacosDaUnicaConjuradora(personagem, mapaDados, unica) : null;
    if (bruto) {
      porCirculo = {};
      Object.keys(bruto).forEach((c) => { porCirculo[c] = bruto[c].total; });
    }
  }
  const extras = (personagem && personagem.espacos_magia_extras) || {};
  const circulosConj = new Set([...Object.keys(porCirculo || {}), ...Object.keys(extras)]);
  for (const c of circulosConj) {
    const circulo = Number(c);
    const total = (porCirculo?.[c] || 0) + (Number(extras[c]) || 0);
    if (total <= 0) continue;
    const usados = Math.min(total, usadosDe('conjuracao', c));
    reservas.push({ fonte: 'conjuracao', circulo, total, usados, disponiveis: total - usados });
  }

  // PACTO -- reserva separada (Classes.md:898), so do Bruxo.
  if (temMagiaDePacto(personagem)) {
    const tabelaBruxo = mapaDados?.get?.('Bruxo')?.tabela_caracteristicas;
    const nivelBruxo = nivelNa(personagem, 'Bruxo');
    if (tabelaBruxo && nivelBruxo > 0) {
      const bruto = getEspacosMagia(tabelaBruxo, nivelBruxo);
      for (const c of Object.keys(bruto)) {
        const circulo = Number(c);
        const total = bruto[c].total;
        if (total <= 0) continue;
        const usados = Math.min(total, usadosDe('pacto', c));
        reservas.push({ fonte: 'pacto', circulo, total, usados, disponiveis: total - usados });
      }
    }
  }

  return reservas.sort((a, b) => a.circulo - b.circulo || a.fonte.localeCompare(b.fonte));
}

/**
 * Casca no idioma da ficha: le os live bindings de estado.js.
 * A logica esta em montarReservasDeEspacos, pura e testavel fora do
 * navegador.
 */
export function reservasDeEspacos() {
  return montarReservasDeEspacos(char, classesData);
}

/**
 * Gasta UM espaco da reserva escolhida (fonte + circulo).
 *
 * Escritor AUTORIZADO de char.espacos_magia em runtime -- nenhum outro
 * lugar deveria escrever o campo (a migracao da forma antiga, Tarefa 2,
 * e um escritor autorizado a parte, que roda uma unica vez na abertura
 * da ficha). Com dois escritores o estado diverge em silencio -- mesma
 * regra que o sub-projeto 3e aplicou a dado de vida.
 *
 * NORMALIZA antes de gastar (migrarEspacosDeMagia -- Tarefa 2,
 * idempotente, provada por mutacao la). Medido na revisao desta tarefa:
 * sem isso, gastar numa ficha ainda na forma antiga ({circulo: {total,
 * usados}}) carimbava a forma nova por cima (`.conjuracao`/`.pacto`)
 * sem nunca carregar o `usados` antigo -- a migracao seguinte via os
 * dois campos ja presentes, concluia "ja migrada" e abandonava o gasto
 * antigo em silencio. Um escritor nao pode depender da ordem de chamada
 * em relacao a outra funcao para nao corromper dado.
 *
 * A reserva alvo vem de montarReservasDeEspacos com o MESMO mapa de
 * dados que a casca (reservasDeEspacos, acima) usa -- o live binding
 * `classesData` de estado.js. `p` pode ser qualquer personagem (nao so
 * o `char` global; e assim que os testes de unidade exercitam esta
 * funcao), mas o mapa de dados de classe e sempre o carregado pela
 * ficha aberta no navegador.
 *
 * @param {object} p Personagem, mutado no lugar.
 * @param {'conjuracao'|'pacto'} fonte
 * @param {number|string} circulo
 * @returns {boolean} true se gastou; false se a reserva pedida nao
 *   existe (fonte/circulo sem espacos) ou esta esgotada -- as DUAS
 *   causas devolvem o mesmo `false`, sem distincao. Uma terceira causa
 *   cai no mesmo `false` por acidente: `classesData` (estado.js) ainda
 *   nao carregado faz montarReservasDeEspacos devolver lista vazia, o
 *   que parece "reserva esgotada" sem ser. Fora de teste isso nao
 *   acontece (a ficha so chama este escritor depois de carregar os
 *   dados de classe), mas fica registrado para quem depurar um `false`
 *   inesperado.
 */
export function gastarEspaco(p, fonte, circulo) {
  if (!p || typeof p !== 'object') return false;
  migrarEspacosDeMagia(p);
  const alvo = montarReservasDeEspacos(p, classesData)
    .find((r) => r.fonte === fonte && r.circulo === Number(circulo));
  if (!alvo || alvo.disponiveis <= 0) return false;
  if (!p.espacos_magia || typeof p.espacos_magia !== 'object') p.espacos_magia = { conjuracao: {}, pacto: {} };
  if (!p.espacos_magia[fonte]) p.espacos_magia[fonte] = {};
  p.espacos_magia[fonte][circulo] = alvo.usados + 1;
  return true;
}

/**
 * Devolve UM espaco de uma reserva (fonte + circulo) -- o inverso de
 * gastarEspaco, mas so 1, nao TODOS (isso e restaurarEspacosDePacto/
 * restaurarEspacosDeConjuracao, acima). Escritor AUTORIZADO, adicionado na
 * Tarefa 4 (sub-projeto 4) para dois consumidores que precisam devolver
 * exatamente um espaco: a caixa de bolhas clicaveis de sheet/magias.js
 * (clicar numa bolha ja gasta restaura ate ali) e recursos que trocam um
 * espaco por outro efeito e podem devolve-lo se o efeito for desfeito (ex.:
 * Ressurgimento Selvagem do Druida, via consumirEspacoMagiaDisponivel/
 * recuperarEspacoMagia em sheet/magias.js).
 *
 * NORMALIZA antes de escrever, mesmo motivo de gastarEspaco.
 *
 * @param {object} p Personagem, mutado no lugar.
 * @param {'conjuracao'|'pacto'} fonte
 * @param {number|string} circulo
 * @returns {boolean} true se havia ao menos 1 espaco gasto para devolver
 *   nessa reserva; false se a reserva nao existe ou ja estava em 0.
 */
export function recuperarUmEspaco(p, fonte, circulo) {
  if (!p || typeof p !== 'object') return false;
  migrarEspacosDeMagia(p);
  const alvo = montarReservasDeEspacos(p, classesData)
    .find((r) => r.fonte === fonte && r.circulo === Number(circulo));
  if (!alvo || alvo.usados <= 0) return false;
  // Sem a guarda "if (!p.espacos_magia[fonte]) p.espacos_magia[fonte] = {}"
  // que gastarEspaco tem (acima): aqui e seguro por construcao, nao por
  // descuido. `alvo.usados > 0` (linha acima) so e verdadeiro quando
  // `armazenado?.[fonte]?.[circulo]` (montarReservasDeEspacos) ja leu um
  // numero positivo dali -- o que exige que `p.espacos_magia[fonte]` JA
  // exista como objeto com essa chave. gastarEspaco precisa da guarda
  // porque pode gastar de uma reserva com 0 usados (a chave pode nao
  // existir ainda); recuperarUmEspaco nunca escreve numa reserva que nao
  // tinha gasto nenhum.
  p.espacos_magia[fonte][circulo] = alvo.usados - 1;
  return true;
}

/**
 * Devolve TODOS os espacos de Magia de Pacto gastos.
 * Classes.md:898: "Voce restaura todos os espacos de Magia de Pacto
 * gastos ao completar um Descanso Curto ou Longo." Curto OU Longo -- e
 * por isso a reserva de pacto precisa ficar SEPARADA da de Conjuracao,
 * que so volta no Longo (restaurarEspacosDeConjuracao, abaixo). Zerar
 * as duas aqui devolveria ao jogador, num Descanso Curto, espacos que a
 * regra so libera no Longo.
 *
 * NORMALIZA antes de restaurar -- mesmo motivo de gastarEspaco, acima:
 * sem migrar primeiro, restaurar sobre uma ficha ainda na forma antiga
 * tambem orfanizava o gasto antigo em vez de zera-lo.
 *
 * @param {object} p Personagem, mutado no lugar. Sem efeito se `p` nao
 *   tiver `espacos_magia` (nada para restaurar).
 */
export function restaurarEspacosDePacto(p) {
  if (!p || typeof p !== 'object' || !p.espacos_magia) return;
  migrarEspacosDeMagia(p);
  p.espacos_magia.pacto = {};
}

/**
 * Devolve TODOS os espacos de Conjuracao gastos. Descanso LONGO apenas
 * -- livro:2772 (regra geral de Espacos de Magia, ilustrada no Bardo):
 * "Voce restaura todos os espacos gastos ao completar um Descanso
 * Longo". A Magia de Pacto tem regra propria (Classes.md:898, tambem
 * Curto) e por isso vive em restaurarEspacosDePacto, acima -- as duas
 * reservas nunca se restauram pela mesma chamada.
 *
 * NORMALIZA antes de restaurar -- mesmo motivo de gastarEspaco, acima.
 *
 * @param {object} p Personagem, mutado no lugar. Sem efeito se `p` nao
 *   tiver `espacos_magia` (nada para restaurar).
 */
export function restaurarEspacosDeConjuracao(p) {
  if (!p || typeof p !== 'object' || !p.espacos_magia) return;
  migrarEspacosDeMagia(p);
  p.espacos_magia.conjuracao = {};
}
