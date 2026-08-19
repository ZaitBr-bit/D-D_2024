// ============================================================
// Ficha de Personagem - Visualização e Edição
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { getPersonagem } from '../store.js';
import { getClasse, getIndiceMagias, getTalentos, getEspecies } from '../db.js';
import { getEspacosMagia, getMagiaPreparadas, normalizarGrimorioMago } from '../utils.js';
import { obterTodasMagiasDominio, obterTodasMagiasSemprePreparadas } from '../levelup.js';
import { getSyncStatus, onSyncStatusChange } from '../sync.js';
import { resolverPassivosTalentos } from '../talentos-effects.js';
import { abrirGridManobras } from '../manobras-ui.js';
import { definirChar, definirContainer, definirClasseData, definirIndiceMagias, definirTalentos, definirEspecies, definirMagiasDominio, definirMagiasSempre, definirPassivosTalentos } from '../sheet/estado.js';
import { getEstadoRecursosGuerreiro } from '../sheet/classes/guerreiro.js';
import { sincronizarMagiasFixasMago } from '../sheet/classes/mago.js';
import { _carregarEstadoColapso } from '../sheet/colapso.js';
import { char, classeData, salvar } from '../sheet/estado.js';
import { renderFichaCompleta } from '../sheet/ficha.js';
import { carregarDescricoesMagias } from '../sheet/impressao.js';
import { ehSubclasseConjuradora, getSubclasseConjuradoraConjuracao } from '../sheet/magias.js';
import { migrarEscolhasClasseLegadas, migrarMagiasDominio, migrarMagiasLegadoEspecie, migrarMagiasSemprePreparadas, migrarNomePericiaLidarAnimais, migrarPericiaEspecie, migrarPericiasEspecie, migrarPericiasTalentos, migrarProficienciasTalentos, migrarSlotsMagiaLivre, migrarTalentoVersatilHumano, migrarTruquesEspecie, migrarTruquesFixosSubclasse } from '../sheet/migracoes.js';
import { baixarPdfFicha } from '../sheet/pdf.js';
import { migrarAdeptoElementalTipos, migrarIniciadoEmMagiaInstancias } from '../sheet/talentos.js';
let _syncSubscribed = false;

export async function renderSheet(container, charId) {
  definirContainer(container);
  definirChar(getPersonagem(charId));
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
  const indiceData = await getIndiceMagias();
  definirIndiceMagias(indiceData?.magias || []);
  definirTalentos(await getTalentos());
  definirEspecies(await getEspecies());

  // Pré-carregar magias de domínio e migrar dados legados
  definirMagiasDominio(await obterTodasMagiasDominio(char.classe, char.subclasse, char.nivel));
  definirMagiasSempre(await obterTodasMagiasSemprePreparadas(char.classe, char.subclasse, char.nivel));
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
  const limitePreparadasMago = classeData?.tabela_caracteristicas
    ? getMagiaPreparadas(classeData.tabela_caracteristicas, char.nivel) : undefined;
  if (normalizarGrimorioMago(char, limitePreparadasMago).alterado) salvar();

  // Sincronizar espaços de magia de conjuradores regulares
  const _infoClasse = CLASSES_INFO[char.classe];
  if (_infoClasse?.conjurador && classeData?.tabela_caracteristicas) {
    const _espacosCorretos = getEspacosMagia(classeData.tabela_caracteristicas, char.nivel);
    if (!char.espacos_magia) char.espacos_magia = {};
    const _extras = char.espacos_magia_extras || {};

    // Atualizar totais conforme tabela da classe + slots extras de Fonte de Magia
    Object.keys(_espacosCorretos).forEach(circ => {
      const baseTotal = _espacosCorretos[circ].total;
      const extraTotal = _extras[circ] || 0;
      if (!char.espacos_magia[circ]) {
        char.espacos_magia[circ] = { total: baseTotal + extraTotal, usados: 0 };
      } else {
        char.espacos_magia[circ].total = baseTotal + extraTotal;
        if (char.espacos_magia[circ].usados > char.espacos_magia[circ].total) {
          char.espacos_magia[circ].usados = char.espacos_magia[circ].total;
        }
      }
    });

    // Slots extras em círculos que não existem na tabela base
    Object.keys(_extras).forEach(circ => {
      if (!_espacosCorretos[circ] && _extras[circ] > 0) {
        if (!char.espacos_magia[circ]) {
          char.espacos_magia[circ] = { total: _extras[circ], usados: 0 };
        } else {
          char.espacos_magia[circ].total = _extras[circ];
        }
      }
    });

    // Remover círculos que não existem mais E não têm extras
    Object.keys(char.espacos_magia).forEach(circ => {
      if (!_espacosCorretos[circ] && !(_extras[circ] > 0)) {
        delete char.espacos_magia[circ];
      }
    });
    salvar();
  }

  // Sincronizar espaços de magia de subclasses conjuradoras (Cavaleiro Místico / Trapaceiro Arcano)
  if (ehSubclasseConjuradora()) {
    const conjSub = getSubclasseConjuradoraConjuracao();
    if (conjSub) {
      if (!char.espacos_magia) char.espacos_magia = {};
      // Atualizar totais com base na tabela de progressão
      Object.entries(conjSub.espacos).forEach(([circ, total]) => {
        if (!char.espacos_magia[circ]) {
          char.espacos_magia[circ] = { total, usados: 0 };
        } else {
          char.espacos_magia[circ].total = total;
        }
      });
      // Remover círculos que não estão na progressão
      Object.keys(char.espacos_magia).forEach(circ => {
        if (!conjSub.espacos[circ]) {
          delete char.espacos_magia[circ];
        }
      });
      salvar();
    }
  }

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