
async function renderSheet(container, charId) {
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
  migrarSlotsMagiaLivre();
  migrarTruquesEspecie();
  migrarMagiasLegadoEspecie();
  migrarEscolhasClasseLegadas();
  migrarNomePericiaLidarAnimais();
  migrarTalentoVersatilHumano();
  migrarPericiaEspecie();
  migrarPericiasEspecie();
  migrarPericiasTalentos();
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