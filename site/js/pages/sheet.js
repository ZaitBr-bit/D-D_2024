// ============================================================
// Ficha de Personagem - Visualização e Edição
// ============================================================
import { getPersonagem } from '../store.js';
import { getClasse, getIndiceMagias, getTalentos, getEspecies } from '../db.js';
import { getMagiaPreparadas, normalizarGrimorioMago } from '../utils.js';
import { obterMagiasAutomaticasDoPersonagem } from '../levelup.js';
import { getSyncStatus, onSyncStatusChange } from '../sync.js';
import { resolverPassivosTalentos } from '../talentos-effects.js';
import { abrirGridManobras } from '../manobras-ui.js';
import { definirChar, definirContainer, definirClasseData, definirIndiceMagias, definirTalentos, definirEspecies, definirMagiasDominio, definirMagiasSempre, definirPassivosTalentos } from '../sheet/estado.js';
import { garantirDadosDeClasses, resetarSuperficieSelecionada } from '../sheet/contexto-classe.js';
import { getEstadoRecursosGuerreiro } from '../sheet/classes/guerreiro.js';
import { sincronizarMagiasFixasMago } from '../sheet/classes/mago.js';
import { _carregarEstadoColapso } from '../sheet/colapso.js';
import { char, classeData, salvar } from '../sheet/estado.js';
// nivelNa (Tarefa 3, sub-projeto "tela magias por classe"): ver o
// comentário de `limitePreparadasMago`, abaixo -- o nível NA classe Mago,
// nunca o espelho `char.nivel` (o TOTAL).
import { nivelNa } from '../regras-multiclasse.js';
import { renderFichaCompleta } from '../sheet/ficha.js';
import { carregarDescricoesMagias } from '../sheet/impressao.js';
import { migrarEscolhasClasseLegadas, migrarEspacosMagia, migrarMagiaClasse, migrarMagiasDominio, migrarMagiasLegadoEspecie, migrarMagiasSemprePreparadas, migrarMulticlasse, migrarNomePericiaLidarAnimais, migrarPericiaEspecie, migrarPericiasEspecie, migrarPericiasTalentos, migrarProficienciasTalentos, migrarSlotsMagiaLivre, migrarTalentoVersatilHumano, migrarTruquesEspecie, migrarTruquesFixosSubclasse } from '../sheet/migracoes.js';
import { baixarPdfFicha } from '../sheet/pdf.js';
import { migrarAdeptoElementalTipos, migrarIniciadoEmMagiaInstancias } from '../sheet/talentos.js';
let _syncSubscribed = false;

export async function renderSheet(container, charId) {
  definirContainer(container);
  definirChar(getPersonagem(charId));
  // Seletor de superficie de conjuracao (Tarefa 4, sub-projeto "tela
  // magias por classe"): a escolha e uma variavel de MODULO
  // (contexto-classe.js), nao presa a este personagem -- sem resetar
  // aqui, abrir um SEGUNDO personagem que por coincidencia tem uma classe
  // do mesmo nome herdaria a classe escolhida no personagem anterior.
  resetarSuperficieSelecionada();
  if (!char) {
    container.innerHTML = '<div class="empty-state"><h2>Personagem nao encontrado</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar</button></div>';
    return;
  }

  // Resolver efeitos passivos de talentos (consumo em tasks futuras)
  definirPassivosTalentos(resolverPassivosTalentos(char));

  // Atualizar header
  window.definirTituloHeader?.(char.nome || 'Ficha');
  document.getElementById('header-acoes').innerHTML = '';

  // Carregar dados complementares
  definirClasseData(await getClasse(char.classe));
  // Dados de TODAS as classes, para os renderizadores que precisam de
  // contexto por classe. getClasse tem cache em memoria (db.js), entao a
  // segunda classe custa uma requisicao na primeira abertura e zero depois.
  // classeData acima continua sendo a classe INICIAL, e nao muda.
  //
  // `doZero: true` -- o mapa e NOVO a cada abertura. A mesma funcao e
  // chamada por levelup-ui.js depois de uma subida, mas la ela COMPLETA o
  // mapa (a classe recem-aberta); aqui herdar o mapa deixaria as classes
  // do personagem anterior visiveis neste.
  await garantirDadosDeClasses(char, true);
  const indiceData = await getIndiceMagias();
  definirIndiceMagias(indiceData?.magias || []);
  definirTalentos(await getTalentos());
  definirEspecies(await getEspecies());

  // Pré-carregar magias de domínio/sempre preparadas de TODAS as classes,
  // cada uma no nível DELA. Montar esses dois caches pelos espelhos (que
  // apontam para a classe INICIAL e para o nível TOTAL) era
  // perda de dado, não só exibição incompleta: migrarMagiasSemprePreparadas,
  // logo abaixo, REMOVE de char.magias_preparadas toda entrada
  // `origem: 'sempre'` ausente do cache e chama salvar() -- então a magia
  // sempre preparada que a subclasse de uma SEGUNDA classe concedeu (o
  // juramento de um Paladino 3 num Mago 5/Paladino 3, por exemplo)
  // desaparecia da ficha na reabertura seguinte, em silêncio e persistida.
  // A face inversa era ler a classe inicial no nível TOTAL: um Paladino
  // 5/Mago 3 recebia o cache do Paladino nível 8 e marcava como "sempre"
  // magias a que ainda não tem direito.
  const magiasAutomaticas = await obterMagiasAutomaticasDoPersonagem(char);
  definirMagiasDominio(magiasAutomaticas.dominio);
  definirMagiasSempre(magiasAutomaticas.sempre);
  // Antes das OUTRAS migrações (não antes de tudo: as leituras de
  // char.classe/subclasse/nivel logo acima já rodaram -- hoje sobra a de
  // `getClasse(char.classe)` para `classeData`, porque `classeData` É a
  // classe inicial por definição; as duas linhas de cache acima deixaram
  // de ler espelho quando passaram a percorrer classesDe(char)). Isso é
  // inofensivo porque, enquanto a ficha tiver uma única classe, os
  // espelhos são invariantes sob migrarMulticlasse() -- ela só carimba
  // schema_versao e reconcilia classes[] a partir deles, nunca o
  // contrário -- e `classesDe` já faz o mesmo fallback de espelho que a
  // migração faria. Migrar antes das demais migrações garante que ELAS
  // leiam valores consistentes.
  migrarMulticlasse();
  migrarMagiasDominio();
  migrarMagiasSemprePreparadas();
  // Antes de migrarSlotsMagiaLivre: o truque concedido pela subclasse conta
  // no limite, e contá-lo depois ofereceria uma vaga livre a mais.
  migrarTruquesFixosSubclasse();
  // Mago nível 18/20: mantém as magias de Maestria de Magias e Assinatura
  // Mágica sempre preparadas (e tira as que deixaram de ser escolhidas).
  if (sincronizarMagiasFixasMago()) salvar();
  migrarSlotsMagiaLivre();
  migrarTruquesEspecie();
  migrarMagiasLegadoEspecie();
  // Depois de TODA migração que atribui `origem` a entradas de
  // magias_preparadas (Tarefa 3, sub-projeto "magia sabe a classe"): esta é
  // a última delas na ordem acima -- migrarMagiasDominio ('dominio'),
  // migrarMagiasSemprePreparadas ('sempre'), sincronizarMagiasFixasMago
  // ('maestria_magias'/'assinatura_magica', linha ~100) e
  // migrarMagiasLegadoEspecie ('especie_legado', logo acima) mutam entradas
  // JÁ EXISTENTES que ainda não tinham origem. Uma magia de domínio cuja
  // origem ainda não tivesse sido atribuída pareceria uma magia normal de
  // classe para classeDaMagiaPreparada, e seria carimbada -- exatamente o
  // que a regra "sem chute" proíbe, e de forma permanente, porque esta
  // migração nunca sobrescreve um carimbo já gravado. Também depois de
  // migrarMulticlasse() (linha ~92): sem classes[] reconciliado,
  // superficiesDeConjuracao não enxerga as classes do personagem.
  await migrarMagiaClasse();
  migrarEscolhasClasseLegadas();
  migrarNomePericiaLidarAnimais();
  migrarTalentoVersatilHumano();
  migrarPericiaEspecie();
  migrarPericiasEspecie();
  migrarPericiasTalentos();
  // Depois de migrarPericiasTalentos: as duas leem char.talentos, mas
  // gravam em arrays diferentes (perícias x proficiencias_extra/ferramentas).
  migrarProficienciasTalentos();
  migrarIniciadoEmMagiaInstancias();
  migrarAdeptoElementalTipos();

  // Migrar fichas legadas: magias preparadas normais já existentes pertencem ao grimório.
  // `normalizarGrimorioMago` só age quando `char.classe === 'Mago'` (o
  // espelho aponta para Mago, ver o comentário dela em utils.js) -- então
  // `classeData` aqui É a tabela do Mago sempre que este cálculo importa.
  // O nível não podia seguir o mesmo raciocínio: `char.nivel` é o TOTAL do
  // personagem, não o nível NA classe Mago -- um Mago 5/Ladino 3 confrontava
  // a tabela do Mago no nível 8 e inflava `limitePreparadas` (hoje só
  // alimenta `pendentes`, que nenhum chamador lê, mas a conta ficava errada
  // mesmo assim). `nivelNa` corrige sem mudar nada para classe única (as
  // duas contagens coincidem por construção).
  const limitePreparadasMago = classeData?.tabela_caracteristicas
    ? getMagiaPreparadas(classeData.tabela_caracteristicas, nivelNa(char, 'Mago')) : undefined;
  if (normalizarGrimorioMago(char, limitePreparadasMago).alterado) salvar();

  // Os totais de espaco de magia deixaram de ser reconciliados aqui no
  // sub-projeto 4: eles sao DERIVADOS por montarReservasDeEspacos
  // (sheet/reservas-espacos.js), que le a tabela unificada quando ha duas
  // ou mais classes conjuradoras e a tabela da propria classe quando ha
  // uma so. O bloco antigo usava a tabela da classe INICIAL contra o
  // nivel TOTAL, e APAGAVA circulos fora dela -- o que teria apagado a
  // reserva de Magia de Pacto de um Bruxo multiclasse.
  migrarEspacosMagia();

  _carregarEstadoColapso();
  renderFichaCompleta();

  // Registrar atualização do indicador de sync (somente uma vez por sessão)
  if (!_syncSubscribed) {
    _syncSubscribed = true;
    onSyncStatusChange(_atualizarIndicadorSync);
  }

  document.getElementById('btn-print')?.addEventListener('click', () => baixarPdfFicha());

  // Pre-aquecer cache de descricoes de magias em segundo plano, para que o
  // clique em Imprimir nao dependa de fetch de rede (mobile exige window.print()
  // sincrono no gesto do usuario; fetch no meio quebra a ativacao e o print e ignorado).
  carregarDescricoesMagias().catch(() => {});

  document.getElementById('btn-escolher-manobras-pendentes')?.addEventListener('click', () => {
    const estado = getEstadoRecursosGuerreiro();
    if (!estado) return;
    const opcoesDisponiveis = classeData?.subclasses?.find(sc => sc.nome === 'Mestre da Batalha')?.opcoes_manobra || [];
    const jaTem = new Set(char.manobras_conhecidas || []);
    const candidatas = opcoesDisponiveis.filter(m => !jaTem.has(m.nome));
    const selSet = new Set();
    const qtdPendente = estado.manobrasPendentes;
    abrirGridManobras(`Escolher ${qtdPendente} manobra(s) pendente(s)`, qtdPendente, candidatas, selSet, (selecionadas) => {
      if (selecionadas.length !== qtdPendente) return;
      char.manobras_conhecidas = [...jaTem, ...selecionadas];
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });
}

/** Retorna texto e cor CSS do indicador de sync conforme o status atual */
function _textoStatusSync(status) {
  switch (status) {
    case 'sincronizando': return { texto: '\u27F3 Salvando...', cor: 'var(--text-muted)' };
    case 'ok':            return { texto: '\u2713 Salvo', cor: 'var(--success, #2e7d32)' };
    case 'erro':          return { texto: '! Erro ao salvar', cor: 'var(--danger, #c62828)' };
    case 'offline':       return { texto: '\u23F8 Offline', cor: 'var(--warning, #e65100)' };
    default:              return { texto: '', cor: '' };
  }
}

/** Retorna HTML do elemento do indicador com o status atual */
export function _renderSyncIndicadorHtml() {
  const { texto, cor } = _textoStatusSync(getSyncStatus());
  return `<div id="sync-status-indicator" style="font-size:0.7rem;text-align:right;min-height:1em"><span style="color:${cor}">${texto}</span></div>`;
}

/** Atualiza o indicador de sync no DOM sem re-render completo */
function _atualizarIndicadorSync(status) {
  const el = document.getElementById('sync-status-indicator');
  if (!el) return;
  const { texto, cor } = _textoStatusSync(status);
  el.innerHTML = `<span style="color:${cor}">${texto}</span>`;
}