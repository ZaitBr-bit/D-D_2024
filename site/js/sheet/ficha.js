// ============================================================
// Render principal da ficha
//
// renderFichaCompleta monta a pagina inteira chamando os renderSecao*
// dos demais modulos, e restaura o estado aberto/fechado dos <details>.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY, CLASSES_INFO, PERICIAS } from '../dados-classes.js';
import { XP_POR_NIVEL } from '../levelup.js';
import { seloFonte, ligarSelosFonte } from '../fontes.js';
import { _renderSyncIndicadorHtml } from '../pages/sheet.js';
import { atributoDefinidoPorItem, atributoEfetivo, textosAtributoPorItem } from '../regras-atributos.js';
import { magiasDeItens } from '../regras-magias-itens.js';
import { conjuraPorAlgumaClasse } from '../regras-multiclasse-conjuracao.js';
import { armadurasDoPersonagem, armasDoPersonagem } from '../regras-multiclasse-proficiencias.js';
import { classesDe, reservasDadosVida } from '../regras-multiclasse.js';
import { possuiAlgumaMagia } from '../regras-origens-magia.js';
import { ehProficienteEmSalvaguarda } from '../regras-salvaguardas.js';
import { resolverPassivosTalentos } from '../talentos-effects.js';
import { bonusProficiencia, calcBonusPericia, calcCA, calcMod, calcPVMulticlasse, calcSalvaguarda, coletarCAsAlternativas, conjuracoesPorClasse, equipamentoDeCA, escHtml, escolherCAAlternativa, fmtMod, getDeslocamento, getTamanho } from '../utils.js';
import { renderSecaoCaracteristicas, renderSecaoSubclasse, renderSecaoTracosEspecie } from './caracteristicas.js';
import { getEstadoFuria, setupEventosSubclasseBarbaro } from './classes/barbaro.js';
import { setupEventosArtifice } from './classes/artifice.js';
import { renderSecaoCompanheirosArtifice, setupEventosCompanheirosArtifice } from './companheiros-artifice.js';
import { renderSecaoFamiliar, setupEventosFamiliar } from './familiar.js';
import { renderSecaoMortosVivos, setupEventosMortosVivos } from './necromante.js';
import { renderSecaoFormaSelvagem, setupEventosFormaSelvagem } from './forma-selvagem.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { getEstadoRecursosPaladino } from './classes/paladino.js';
import { setupEventosDetalhesColapso, setupEventosTruquesColapso } from './colapso.js';
import { calcVantagemDesvantagemPericia, calcVantagemDesvantagemSalvaguarda, forcaPrimordialAtiva, getAtaquesPorAcao, getDeslocamentoFinal, getModIniciativa, getTruquesExtraEstiloLuta, setupEventosVantagemDesvantagem } from './combate.js';
import { renderSecaoCondicoes, renderSecaoDefesas, renderSecaoSentidos, setupEventosCondicoes, setupEventosDefesas } from './condicoes.js';
import { renderSecaoDetalhes } from './detalhes.js';
import { setupEventosEdicao } from './edicao.js';
import { ATRIBUTO_ESTILO, char, containerRef, definirPassivosTalentos, especiesCache, marcaAjusteManual, passivosTalentosCache, salvar, seloEdicao, seloPrerequisitoDispensado } from './estado.js';
import { setupEventosHabilidades } from './habilidades.js';
import { setupEventosDescanso, setupEventosHP, sincronizarBonusPvNiveis } from './hp-descanso.js';
import { defesasDeItens } from '../regras-passivos-itens.js';
import { getEstadoCarga, renderSecaoInventario, setupEventosInventarioSheet } from './inventario.js';
import { renderSecaoMagias, setupEventosEspacosMagia } from './magias.js';
import { renderSecaoAtaques, setupEventosAtaques } from './ataques.js';
import { migrarMulticlasse } from './migracoes.js';
import { montarRecursosClasse, renderCardRecursosClasse, renderFaixaRecursosMagias, setupEventosRecursosClasse } from './recursos-classe.js';
import { abrirModalRecuperarDadivaEpica, precisaRecuperarDadivaEpica, renderSecaoTalentos } from './talentos.js';

/** Salva o estado open/closed de todos os <details> no container */
function salvarEstadoDetails() {
  const estado = {};
  containerRef?.querySelectorAll('details').forEach((det, i) => {
    const id = det.dataset.detailsId || det.querySelector('summary')?.textContent?.trim() || `det_${i}`;
    estado[id] = det.open;
  });
  return estado;
}

/** Restaura o estado open/closed dos <details> salvos */
function restaurarEstadoDetails(estado) {
  if (!estado || Object.keys(estado).length === 0) return;
  containerRef?.querySelectorAll('details').forEach((det, i) => {
    const id = det.dataset.detailsId || det.querySelector('summary')?.textContent?.trim() || `det_${i}`;
    if (id in estado) det.open = estado[id];
  });
}

/**
 * Selos dos efeitos mágicos ativos que passam em `filtro`. O clique no selo
 * remove o efeito (`data-remover-efeito`, ligado em hp-descanso.js).
 * Deduplica pelo nome base: efeitos compostos geram filhos com " (Reativo)" etc.;
 * `concentracao_generica` só aparece no indicador de condições.
 * @param {(ef: object) => boolean} filtro Quais efeitos entram neste campo.
 * @returns {string} HTML dos selos, ou '' sem efeitos.
 */
function chipsEfeitosMagicos(filtro) {
  const vistos = new Set();
  const unicos = (char.efeitos_magicos || []).filter((ef) => {
    if (ef.tipo === 'concentracao_generica' || !filtro(ef)) return false;
    const base = ef.nome.replace(/ \(.*\)$/, '');
    if (vistos.has(base)) return false;
    vistos.add(base);
    return true;
  });
  if (unicos.length === 0) return '';
  return `<div style="font-size:0.6rem;margin-top:2px">${unicos.map((ef) => {
    const base = ef.nome.replace(/ \(.*\)$/, '');
    const tooltip = ef.rotulo || ef.nome;
    return `<span class="no-print" style="display:inline-flex;align-items:center;gap:2px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:8px;margin:1px;cursor:pointer;font-size:0.6rem" data-remover-efeito="${base}" title="${tooltip}">${base}${ef.concentracao ? ' (C)' : ''} &times;</span>`;
  }).join('')}</div>`;
}

export function renderFichaCompleta() {
  // Reconcilia classes[] a partir dos espelhos ANTES de qualquer leitura de
  // classesData/contextosDeClasse.
  //
  // `subirDeNivel` (levelup.js:1411 e :1429) escreve SÓ nos espelhos
  // (char.nivel, char.subclasse) -- classes[] nunca é tocado ali. Enquanto
  // isso, a seção de Características (Tarefa 2 deste sub-projeto) passou a
  // ler classes[] em vez do espelho. Sem reconciliar aqui, toda subida de
  // nível deixava a ficha mostrando o estado ANTERIOR até o jogador fechar
  // e reabrir -- um Clérigo que sobe de 4 para 5 não via Fulminar
  // Mortos-Vivos até um F5. É a mesma família de defeito do
  // passivosTalentosCache logo abaixo: um escritor mexe num campo, outro lê
  // noutro momento, e o sintoma aparece longe da causa.
  // migrarMulticlasse() é a mesma casca que renderSheet já chama na
  // abertura (pages/sheet.js); reconciliar de novo aqui é seguro porque
  // migrarParaMulticlasse() só grava quando há divergência real (idempotente),
  // então um render sem subida de nível não grava nada em disco.
  migrarMulticlasse();

  // Recalcula os passivos de talentos ANTES de qualquer leitura do cache.
  //
  // `passivosTalentosCache` (sheet/estado.js) era escrito num unico lugar:
  // `renderSheet` (pages/sheet.js), que so roda ao carregar/navegar para a
  // ficha. Toda via que muta `char.talentos` (ou `char.nivel`, que entra no
  // bonus de proficiencia de Alerta/Envenenador/Telecinetico) e depois so
  // chama `renderFichaCompleta()` deixava o cache velho -- o talento
  // aparecia na lista, mas nenhum efeito passivo dele entrava ate um F5.
  // Era o caso do botao "+ Talento" da ficha (sheet/talentos.js,
  // `persistirTalento`), do Iniciado em Magia e das invocacoes do Bruxo.
  // Recalcular aqui cobre todas essas vias de uma vez, porque nenhuma
  // delas altera a ficha sem passar por este render. O custo e uma
  // varredura de Set sobre a lista de talentos por render.
  definirPassivosTalentos(resolverPassivosTalentos(char));

  const estadoDetails = salvarEstadoDetails();
  // `info` ainda alimenta: as proficiências de armadura/arma, o destaque
  // do atributo primário/de conjuração na grade de atributos, e o gate
  // que decide se a seção de Magias aparece (`info.conjurador`). A caixa
  // "Dados de Vida" parou de lê-la na Tarefa 3 (sub-projeto 3e); o
  // recálculo de PV (fallback quando pv_max <= 0, logo abaixo) parou de
  // lê-la na Tarefa 4, que passou a usar calcPVMulticlasse (soma o dado
  // de vida de CADA classe) em vez do dado da classe INICIAL sozinho --
  // Ruling 2 da Tarefa 3: não remova esta declaração só porque um
  // consumidor saiu dela; só a Tarefa 11, que vê o arquivo inteiro já
  // convertido, decide entre remover e declarar exceção.
  const info = CLASSES_INFO[char.classe] || {};
  const prof = bonusProficiencia(char.nivel);
  const ca = calcCA(char, passivosTalentosCache);
  // CA alternativa: as candidatas e a ativa, para o seletor da caixa de CA.
  //
  // O contexto de equipamento e OBRIGATORIO e sai de equipamentoDeCA(), a
  // MESMA leitura de inventario que calcCA faz. Sem ele, o coletor
  // ofereceria a Defesa sem Armadura do Monge a um Monge de escudo -- que o
  // livro exclui (Classes.md:5174-5176) e que calcCA ja nao conta. Tela e
  // numero divergiriam, e o seletor mostraria uma fonte inativa.
  const _caEquip = equipamentoDeCA(char);
  const caCandidatas = coletarCAsAlternativas(char, {
    temArmadura: !!_caEquip.armadura, temEscudo: !!_caEquip.escudo,
  });
  const caAtiva = escolherCAAlternativa(char, caCandidatas);
  // Empate em VALOR nao e empate em EFEITO: o Barbaro permite Escudo e o
  // Monge nao. Quando as candidatas empatam, o seletor avisa que o numero
  // nao muda agora -- o que muda e o que acontece ao equipar um Escudo.
  const caEmpatadas = caCandidatas.length >= 2
    && caCandidatas.every(c => c.valor === caCandidatas[0].valor);
  // atributo-base: este modCon só alimenta o recálculo de PV de ficha corrompida (pv_max <= 0) com o valor-base; nesse ramo o marcador do bônus de item é zerado e sincronizarBonusPvNiveis reaplica o bônus no render seguinte
  const modCon = calcMod(char.atributos.constituicao);
  const iniciativa = getModIniciativa();
  const ataquesPorAcao = getAtaquesPorAcao();
  const estadoGuardiao = getEstadoRecursosGuardiao();
  // O card Magias aparece por qualquer um destes caminhos; os recursos das
  // classes conjuradoras vão para a faixa dele, ou para o card Recursos de
  // Classe quando ele não existe.
  const temSecaoMagias = !!(conjuraPorAlgumaClasse(char) || getTruquesExtraEstiloLuta() > 0 || char.iniciado_em_magia?.lista || (char.iniciado_em_magia_instancias?.length > 0) || possuiAlgumaMagia(char) || magiasDeItens(char).length > 0);
  const recursosClasse = montarRecursosClasse({ temSecaoMagias });

  sincronizarBonusPvNiveis();

  // Recalcular PV max se necessário.
  //
  // calcPVMulticlasse em vez de calcPVTotal: a forma antiga recebia UM
  // dado de vida (o da classe INICIAL) e o nivel TOTAL, entao esta rede
  // -- que so dispara em ficha corrompida, mas quando dispara decide o PV
  // inteiro -- dava 62 a um Mago 5/Barbaro 5 que o livro diz ter 77
  // (livro:2039-2041).
  if (char.pv_max <= 0) {
    char.pv_max = calcPVMulticlasse(char, modCon);
    char.pv_atual = char.pv_max;
    // O PV recalculado não inclui o bônus de item; zera o marcador para a
    // próxima sincronização aplicá-lo de novo.
    char.bonus_pv_itens_con_aplicado = 0;
    salvar();
  }

  // Calcular deslocamento e tamanho a partir dos dados da espécie
  const _espData = especiesCache?.especies?.find(e => e.nome === char.especie);
  const _deslocamentoBase = _espData ? getDeslocamento(_espData.texto_completo) : '9 metros';
  const _deslocamento = getDeslocamentoFinal(_deslocamentoBase);
  const _deslMatch = _deslocamento.match(/^([\d,\.]+)\s*metros(.*)$/);
  const _deslNumero = _deslMatch ? _deslMatch[1] : _deslocamento;
  const _deslExtra = _deslMatch ? (_deslMatch[2] || '').trim() : '';
  const _tamanho = char.tamanho || (_espData ? getTamanho(_espData.texto_completo) : 'Médio');
  const _deslSobrecarga = !!(char?.config?.sobrecarga_afeta_deslocamento && getEstadoCarga().sobrecarregado);

  const container = containerRef;
  container.innerHTML = `
    <!-- Cabeçalho do personagem -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:start;gap:10px;flex:1;min-width:0">
          <div style="flex:1;min-width:0">
            <h2 style="font-size:1.3rem;margin-bottom:2px" id="char-nome-display">${escHtml(char.nome) || 'Sem Nome'}</h2>
            <div style="font-size:0.9rem;color:var(--text-muted)">
              ${/* classesDe: o cabecalho mostrava so a classe INICIAL, entao
                    uma ficha que exibe recursos de Barbaro dizia "Mago 10" --
                    o app se contradizendo na propria tela, mesma familia do
                    tooltip que o 3c consertou. Com uma classe so o texto e
                    identico ao de antes: classe unica nao pode mudar.
                    `Nivel` continua sendo o TOTAL (livro:2037). */''}
              ${escHtml(char.especie || '')}${seloFonte(_espData?.fonte)} ${(() => {
                const cs = classesDe(char);
                return cs.map((c) =>
                  `${escHtml(c.classe)}${seloFonte(CLASSES_INFO[c.classe]?.fonte)}${c.subclasse ? ` (${escHtml(c.subclasse)})` : ''}${cs.length > 1 ? ` ${c.nivel}` : ''}${seloPrerequisitoDispensado(c.classe, { comBotaoRemover: true })}`
                ).join(' / ');
              })()} &middot; Nível ${char.nivel}
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Antecedente: ${escHtml(char.antecedente || '–')}${char.alinhamento ? ' | Alinhamento: ' + escHtml(char.alinhamento) : ''}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Tamanho: ${escHtml(_tamanho)}${(char.idiomas && char.idiomas.length) ? ' | Idiomas: ' + char.idiomas.map(escHtml).join(', ') : ''}</div>
            ${(estadoGuardiao && estadoGuardiao.sentidosSelvagensAtivo) ? '<div style="font-size:0.8rem;color:var(--text-muted)">Sentidos: Visão às Cegas 9 m</div>' : ''}
            ${(estadoGuardiao && estadoGuardiao.exaustao > 0) ? `<div style="font-size:0.8rem;color:var(--danger)">Exaustão: ${estadoGuardiao.exaustao}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
              XP: <span style="font-weight:600;color:var(--accent);cursor:pointer" id="xp-display" title="Clique para editar XP">${char.xp || 0}</span>
              ${char.nivel < 20 ? ` / ${XP_POR_NIVEL[char.nivel + 1]}` : ' (Nível Máximo)'}
            </div>
          </div>
          ${char.imagem ? `<div class="char-avatar" style="width:64px;height:64px;font-size:1.6rem;flex-shrink:0"><img src="${escHtml(char.imagem)}" alt=""></div>` : ''}
        </div>
        <div class="no-print" style="display:flex;gap:4px;flex-direction:column">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-secondary" id="btn-editar-ficha">Editar ficha</button>
            <button class="btn btn-sm btn-primary" id="btn-print" title="Gerar PDF da ficha" style="gap:4px">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 18h6M9 12h2"/></svg> Gerar PDF
            </button>
          </div>
          ${_renderSyncIndicadorHtml()}
          ${char.nivel < 20 ? `
            <button class="btn btn-sm btn-accent" id="btn-levelup" style="font-weight:700">
              ⬆ Subir de Nível (Nível ${char.nivel + 1})
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    ${renderSecaoFormaSelvagem()}

    ${precisaRecuperarDadivaEpica() ? `
      <div class="info-box warning no-print" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="font-size:0.85rem">
          <strong>Escolha de nível 19 pendente:</strong> registre a Dádiva Épica ou outro talento recebido nesse nível.
        </div>
        <button class="btn btn-sm btn-accent" id="btn-recuperar-dadiva-epica">Registrar talento de nível 19</button>
      </div>
    ` : ''}

    <!-- Stats combate -->
    <div class="card">
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-label">CA</div>
          <div class="stat-value">${ca}</div>
          ${caCandidatas.length >= 2 && caAtiva ? `<div class="no-print" style="font-size:0.62rem;margin-top:2px"><span data-ca-acao="escolher-alternativa" style="display:inline-flex;align-items:center;gap:3px;background:var(--bg-hover, transparent);border:1px solid var(--border-light);border-radius:8px;padding:1px 6px;cursor:pointer;color:var(--text-muted)" title="${escHtml(`CA sem armadura: ${caAtiva.classe}${caEmpatadas ? '. As fontes empatam em valor -- a escolha nao muda o numero agora, mas decide o que acontece ao equipar um Escudo' : ''}. Clique para trocar a fonte.`)}">${escHtml(caAtiva.classe)} &#9662;</span></div>` : ''}
          ${chipsEfeitosMagicos((ef) => ef.tipo !== 'deslocamento')}
        </div>
        <div class="stat-box">
          <div class="stat-label">Iniciativa</div>
          <div class="stat-value">${fmtMod(iniciativa.valor)}</div>
          ${iniciativa.vantagem ? `<div style="font-size:0.65rem;color:var(--success);font-weight:700"${iniciativa.fontesVantagem?.length ? ` title="${escHtml(iniciativa.fontesVantagem.join(', '))}"` : ''}>Vantagem</div>` : ''}
          ${iniciativa.dadosExtras?.length ? `<div style="font-size:0.65rem;color:var(--accent);font-weight:700" title="${escHtml(iniciativa.dadosExtras.join(', '))}">${escHtml(iniciativa.dadosExtras.map((d) => `+${d.split(' ')[0]}`).join(' '))}</div>` : ''}
        </div>
        <div class="stat-box" ${_deslSobrecarga ? 'style="cursor:pointer;position:relative" onclick="window.avisarSobrecargaDeslocamento()"' : ''}>
          <div class="stat-label">Deslocamento</div>
          <div class="stat-value">${_deslNumero}<br><span class="stat-unit">metros</span></div>
          ${_deslExtra ? `<div style="font-size:0.6rem;color:var(--text-muted)">${_deslExtra}</div>` : ''}
          ${chipsEfeitosMagicos((ef) => ef.tipo === 'deslocamento')}
          ${_deslSobrecarga ? '<div class="no-print" style="position:absolute;bottom:2px;left:0;right:0;font-size:0.55rem;color:var(--danger);font-weight:700">&#9888; Sobrecarga</div>' : ''}
        </div>
        <div class="stat-box">
          <div class="stat-label">Ataques</div>
          <div class="stat-value">${ataquesPorAcao}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">por Ação Atacar</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Prof.</div>
          <div class="stat-value">+${prof}</div>
        </div>
        <!--
          Uma caixa de CD e uma de Ataque POR CLASSE que conjura. O
          livro:2075 manda usar "o atributo de conjuração dessa classe":
          num Clérigo 5/Mago 5 são DUAS CDs diferentes, e mostrar só a da
          classe inicial punha a de Sabedoria nas magias de Mago.

          Com UMA classe conjuradora -- toda ficha de classe única -- sai
          exatamente o HTML de antes, rótulo sem sufixo; o nome da classe
          só entra quando há mais de uma e os números divergem de verdade.

          conjuracoesPorClasse cobre tudo que "info.conjurador ||
          ehSubclasseConjuradora()" cobria, Cavaleiro Místico e
          Trapaceiro Arcano inclusive (que conjuram por tabela própria e
          por isso davam "CD Magia 0" antes de utils.js enxergar o
          atributo da subclasse), sem ler o espelho da classe inicial.
        -->
        ${(() => {
          const conjuracoes = conjuracoesPorClasse(char);
          const sufixo = conjuracoes.length > 1;
          return conjuracoes.map((c) => `
          <div class="stat-box">
            <div class="stat-label">CD Magia${sufixo ? ` (${escHtml(c.classe)})` : ''}</div>
            <div class="stat-value">${c.cd}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Atq. Magia${sufixo ? ` (${escHtml(c.classe)})` : ''}</div>
            <div class="stat-value">${fmtMod(c.ataque)}</div>
          </div>
        `).join('');
        })()}
      </div>

      <!-- Proficiencias de Armas e Armaduras -->
      ${(() => {
        // Mesclar proficiencias base da classe com extras (subclasse, talentos, etc.)
        const extras = (char.proficiencias_extra || []).map(p => p.toLowerCase());
        // Uniao das classes (livro:2051). Era `info.armaduras`, o espelho
        // da classe inicial: num Mago 5/Guerreiro 1 a ficha listava
        // "Nenhuma" em armaduras com o Guerreiro na mesma pagina.
        const armadurasProf = armadurasDoPersonagem(char);
        const armasProf = armasDoPersonagem(char);
        const armadurasExtras = [];
        const armasExtras = [];
        // Mapear proficiencias extras para categorias
        for (const extra of extras) {
          if (extra === 'armadura pesada' && !armadurasProf.includes('Pesada')) { armadurasProf.push('Pesada'); armadurasExtras.push('Pesada'); }
          else if ((extra === 'armadura média' || extra === 'armadura media') && !armadurasProf.includes('Média')) { armadurasProf.push('Média'); armadurasExtras.push('Média'); }
          else if (extra === 'armadura leve' && !armadurasProf.includes('Leve')) { armadurasProf.push('Leve'); armadurasExtras.push('Leve'); }
          else if (extra === 'escudo' && !armadurasProf.includes('Escudo')) { armadurasProf.push('Escudo'); armadurasExtras.push('Escudo'); }
          else if (extra === 'armas marciais' && !armasProf.includes('Marcial')) { armasProf.push('Marcial'); armasExtras.push('Marcial'); }
          else if (extra === 'armas simples' && !armasProf.includes('Simples')) { armasProf.push('Simples'); armasExtras.push('Simples'); }
        }
        return `
      <div class="prof-equip-row">
        <div class="prof-equip-group">
          <span class="prof-equip-label">Armaduras:</span>
          ${armadurasProf.length > 0
            ? armadurasProf.map(a => `<span class="prof-equip-badge prof-equip-armadura${armadurasExtras.includes(a) ? ' prof-equip-extra' : ''}">${a}${armadurasExtras.includes(a) ? '*' : ''}</span>`).join('')
            : '<span class="prof-equip-badge prof-equip-nenhuma">Nenhuma</span>'
          }
        </div>
        <div class="prof-equip-group">
          <span class="prof-equip-label">Armas:</span>
          ${armasProf.map(a => `<span class="prof-equip-badge prof-equip-arma${armasExtras.includes(a) ? ' prof-equip-extra' : ''}">${a}${armasExtras.includes(a) ? '*' : ''}</span>`).join('')}
        </div>
        ${armadurasExtras.length > 0 || armasExtras.length > 0 ? '<div style="width:100%;font-size:0.6rem;color:var(--text-muted);text-align:center;margin-top:2px">* Concedida por subclasse/talento</div>' : ''}
      </div>`;
      })()}

      <!-- HP / Inspiracao Heroica -->
      <div class="hp-section">
        <!-- Coluna principal: PV -->
        <div class="hp-main">
          <div class="hp-pv-display">
            <div class="hp-pv-label">Pontos de Vida</div>
            <div class="hp-pv-value" style="color:${char.pv_atual <= (char.pv_max_override || char.pv_max) * 0.25 ? 'var(--danger)' : char.pv_atual <= (char.pv_max_override || char.pv_max) * 0.5 ? 'var(--warning)' : 'var(--success)'}">
              ${char.pv_atual} / ${char.pv_max_override || char.pv_max}
            </div>
            ${char.pv_max_override && char.pv_max_override !== char.pv_max ? `<div style="font-size:0.7rem;color:var(--info)">(Base: ${char.pv_max} | Bonus: +${char.pv_max_override - char.pv_max})</div>` : ''}
          </div>
          <div class="no-print hp-buttons">
            <button class="btn btn-sm btn-danger" id="hp-minus">Dano</button>
            <button class="btn btn-sm btn-success" id="hp-plus">Cura</button>
            <button class="btn btn-sm btn-secondary" id="hp-temp">PV Temp</button>
            <button class="btn btn-sm btn-secondary" id="hp-max-override" title="Sobrescrever PV Máximo">&#9881; PV Max</button>
          </div>
        </div>
        <!-- Coluna secundaria: PV Temp + Dados de Vida -->
        <div class="hp-secondary">
          <div class="hp-sub-box hp-temp-box">
            <div class="hp-sub-label">PV Temporario</div>
            <div class="hp-sub-value" style="color:var(--info)">${char.pv_temporario || 0}</div>
          </div>
          <div class="hp-sub-box hp-dv-box">
            <div class="hp-sub-label">Dados de Vida</div>
            ${/* reservasDadosVida: o livro manda somar os dados de todas as classes,
                  combinando os do mesmo tipo e mantendo separados os de tipos
                  diferentes (livro:2043). char.nivel e o dado da classe INICIAL
                  mostravam "10 / 10 d6" num Mago 5/Barbaro 5, que tem 5 d6 e 5 d12.
                  Com UMA reserva a frase e identica a de antes -- classe unica nao
                  pode mudar. */''}
            <div class="hp-sub-value">${reservasDadosVida(char).map((r) =>
              `${r.disponiveis} / ${r.total} <span style="font-size:0.8em;color:var(--text-muted)">d${r.faces}</span>`
            ).join('<br>') || `0 / 0 <span style="font-size:0.8em;color:var(--text-muted)">d?</span>`}</div>
            <button class="btn btn-sm btn-secondary no-print" id="btn-usar-dv" style="margin-top:4px;font-size:0.72rem;padding:3px 8px">Usar DV</button>
          </div>
        </div>
        <!-- Inspiracao Heroica -->
        <div id="inspiracao-toggle" class="no-print hp-inspiracao ${char.inspiracao_heroica ? 'hp-inspiracao-ativa' : ''}" title="Inspiração Heroica">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${char.inspiracao_heroica ? '#fff' : 'var(--text-muted)'}" stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span class="hp-inspiracao-texto">${char.inspiracao_heroica ? 'Inspirada!' : 'Inspiracao'}</span>
        </div>
      </div>

      ${char.pv_atual <= 0 ? `
      <!-- Salvaguarda Contra Morte -->
      <div style="margin-top:12px;padding:12px;border:2px solid var(--danger);border-radius:var(--radius);background:rgba(192,57,43,0.05)">
        <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--danger);text-align:center;margin-bottom:8px">☠ Salvaguarda Contra Morte</div>
        ${char.especie === 'Renascido' ? '<div data-lembrete-morte style="font-size:0.75rem;font-weight:600;color:var(--success);text-align:center;margin-bottom:6px" title="Escapou da Morte (Renascido)">Vantagem (Renascido)</div>' : ''}
        <div style="display:flex;justify-content:center;gap:24px">
          <div style="text-align:center">
            <div style="font-size:0.7rem;font-weight:600;color:var(--success);margin-bottom:4px">Sucessos</div>
            <div style="display:flex;gap:6px;justify-content:center">
              ${[0,1,2].map(i => `<label class="morte-check" style="cursor:pointer"><input type="checkbox" data-morte-sucesso="${i}" ${(char.morte_sucessos || 0) > i ? 'checked' : ''} style="display:none"><span class="morte-bolha ${(char.morte_sucessos || 0) > i ? 'morte-sucesso' : ''}"></span></label>`).join('')}
            </div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.7rem;font-weight:600;color:var(--danger);margin-bottom:4px">Falhas</div>
            <div style="display:flex;gap:6px;justify-content:center">
              ${[0,1,2].map(i => `<label class="morte-check" style="cursor:pointer"><input type="checkbox" data-morte-falha="${i}" ${(char.morte_falhas || 0) > i ? 'checked' : ''} style="display:none"><span class="morte-bolha ${(char.morte_falhas || 0) > i ? 'morte-falha' : ''}"></span></label>`).join('')}
            </div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- FAB Descanso (flutuante) -->
    <div id="fab-descanso" class="fab-descanso no-print">
      <button class="fab-btn" id="fab-toggle-descanso" title="Descanso">🏕️</button>
      <div class="fab-menu" id="fab-menu-descanso" style="display:none">
        <button class="btn btn-accent btn-sm" id="btn-descanso-curto">☀ Descanso Curto</button>
        <button class="btn btn-accent btn-sm" id="btn-descanso-longo">🌙 Descanso Longo</button>
      </div>
    </div>

    <!-- Atributos -->
    <div class="card">
      <div class="card-header"><h2>Atributos</h2></div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const val = atributoEfetivo(char, key);
          const mod = calcMod(val);
          // Marca o valor-base quando um item sintonizado define o atributo.
          const porItem = atributoDefinidoPorItem(char, key);
          const textosItem = porItem ? textosAtributoPorItem(porItem) : null;
          const marcaItem = porItem
            ? `<div class="atributo-por-item" data-atributo-item="${key}" title="${escHtml(textosItem.titulo)}" style="font-size:0.6rem;color:var(--text-muted)">${escHtml(textosItem.rotulo)}</div>`
            : '';
          const isPrimario = info.atributo_primario?.includes(nome);
          // O selo 🔮 vale para o atributo de conjuração de QUALQUER classe
          // do personagem (livro:2075), não só o da inicial: num Clérigo/Mago
          // Sabedoria e Inteligência recebem o selo. Antes lia `info`, o
          // espelho, e um Bárbaro/Mago não marcava atributo nenhum.
          // A chamada por atributo (6 por render, cada uma varrendo no
          // máximo 3 classes) sai mais barata que carregar a lista por fora
          // do map e é a mudança de menor superfície.
          const isConjuracao = conjuracoesPorClasse(char).some(c => c.atributo === nome);
          const attrStyle = ATRIBUTO_ESTILO[key] || {};
          return `
            <div class="atributo-box ${isPrimario ? 'destaque' : ''}" style="border-color:${attrStyle.cor || 'var(--border)'}">
              <div class="atributo-nome" style="color:${attrStyle.cor || 'var(--text-muted)'}">${attrStyle.emoji || ''} ${nome}${seloEdicao(`atributos.${key}`)}</div>
              <div class="atributo-mod" style="color:${attrStyle.cor || 'var(--primary)'}">${fmtMod(mod)}</div>
              <div class="atributo-valor">${val}</div>
              ${marcaItem}
              ${marcaAjusteManual(key)}
              ${isConjuracao ? '<div style="font-size:0.6rem;font-weight:700;color:var(--accent);margin-top:2px">🔮 Conjuração</div>' : ''}
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Salvaguardas -->
    <div class="card">
      <div class="card-header"><h2>Salvaguardas</h2></div>
      ${char.especie === 'Pequenino' ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px"><span class="badge" style="font-size:0.7rem;padding:3px 8px;background:var(--success);color:#fff" title="Ao tirar 1 natural em qualquer d20, re-jogue e use o novo resultado.">Sorte: Re-roll nat 1</span></div>' : ''}
      ${(() => {
        // Calcular imunidades a condições para exibir na seção
        const _imunidades = [];
        const _ef = getEstadoFuria();
        if (_ef?.ativa && _ef?.furiaIrracional) {
          _imunidades.push({ condicao: 'Amedrontado', fonte: 'Furia Irracional' });
          _imunidades.push({ condicao: 'Enfeitiçado', fonte: 'Furia Irracional' });
        }
        const _ep = getEstadoRecursosPaladino();
        if (_ep?.auraCoragemAtiva) {
          if (!_imunidades.find(i => i.condicao === 'Amedrontado')) {
            _imunidades.push({ condicao: 'Amedrontado', fonte: 'Aura de Coragem' });
          }
        }
        if (_ep?.auraDevocaoAtiva) {
          if (!_imunidades.find(i => i.condicao === 'Enfeitiçado')) {
            _imunidades.push({ condicao: 'Enfeitiçado', fonte: 'Aura de Devoção' });
          }
        }
        // Imunidades a condição de itens mágicos ativos (4C).
        for (const i of defesasDeItens(char).imunidadesCondicao) {
          if (!_imunidades.find(x => x.condicao === i.condicao)) _imunidades.push({ condicao: i.condicao, fonte: i.origem });
        }
        return _imunidades.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
            ${_imunidades.map(i => `<span class="badge" style="font-size:0.65rem;padding:2px 6px;background:var(--success);color:#fff" title="${escHtml(i.fonte)}">Imune: ${escHtml(i.condicao)} (${escHtml(i.fonte)})</span>`).join('')}
          </div>` : '';
      })()}
      <div class="salvaguardas-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          // Quem é proficiente em salvaguarda mora em regras-salvaguardas.js.
          // Aqui se lia "char.salvaguardas_proficientes" direto, e por isso a
          // proficiência que Sobrevivente Disciplinado concede no nível 14 --
          // exibida como texto 250 linhas acima, em ficha.js:480 -- nunca
          // marcava salvaguarda nenhuma (issue #21).
          const proficiente = ehProficienteEmSalvaguarda(char, nome);
          const bonus = calcSalvaguarda(char, key);

          const vd = calcVantagemDesvantagemSalvaguarda(nome);
          const temVant = vd.vantagens.length > 0;
          const temDesv = vd.desvantagens.length > 0;
          let indicadorSalv = '';
          if (vd.falhaAutomatica) {
            indicadorSalv = `<span class="pericia-vd-badge falha-automatica" data-vd-info="Falha automática: ${vd.fontesFalha.map(escHtml).join(', ')}">F</span>`;
          } else if (temVant && temDesv) {
            indicadorSalv = `<span class="pericia-vd-badge neutro" data-vd-info="Vantagem (${vd.vantagens.map(escHtml).join(', ')}) e Desvantagem (${vd.desvantagens.map(escHtml).join(', ')}) se anulam">—</span>`;
          } else if (temVant) {
            indicadorSalv = `<span class="pericia-vd-badge vantagem" data-vd-info="Vantagem: ${vd.vantagens.map(escHtml).join(', ')}">V</span>`;
          } else if (temDesv) {
            indicadorSalv = `<span class="pericia-vd-badge desvantagem" data-vd-info="Desvantagem: ${vd.desvantagens.map(escHtml).join(', ')}">D</span>`;
          }
          // Vantagem condicional de item (4C): selo informativo, fora do cálculo de V/D.
          if (vd.notas?.length) {
            indicadorSalv += `<span class="pericia-vd-badge vantagem-nota" data-vd-info="${vd.notas.map(escHtml).join('; ')}">V*</span>`;
          }
          return `
            <div class="salva-item ${proficiente ? 'proficiente' : ''}">
              <div class="pericia-prof ${proficiente ? 'ativo' : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome" style="flex:1">${nome}</span>
              ${indicadorSalv}
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Condicoes ativas do personagem -->
    ${renderSecaoCondicoes()}

    <!-- Defesas: Resistencias, Vulnerabilidades, Imunidades -->
    ${renderSecaoDefesas()}

    <!-- Sentidos Passivos -->
    ${renderSecaoSentidos()}

    <!-- Pericias em ordem customizada -->
    <div class="card">
      <div class="card-header"><h2>Perícias</h2></div>
      <div class="pericias-lista-custom">
        ${(() => {
          // Ordem customizada de exibicao das pericias
          const ordemPericias = [
            'Percepção', 'Intuição', 'Investigação', 'Religião', 'História',
            'Prestidigitação', 'Furtividade', 'Persuasão', 'Atletismo', 'Medicina',
            'Acrobacia', 'Enganação', 'Arcanismo', 'Sobrevivência', 'Natureza',
            'Atuação', 'Intimidação', 'Lidar com Animais'
          ];
          return ordemPericias.map(nome => {
            const p = PERICIAS.find(x => x.nome === nome);
            if (!p) return '';
            const key = ATRIBUTO_NOME_PARA_KEY[p.atributo];
            const estilo = ATRIBUTO_ESTILO[key] || {};
            const proficiente = (char.pericias_proficientes || []).includes(p.nome);
            const expertise = (char.pericias_expertise || []).includes(p.nome);
            const bonus = calcBonusPericia(char, p.nome, {
              emFuria: !!getEstadoFuria()?.ativa,
              forcaPrimordialAtiva: forcaPrimordialAtiva()
            });
            const vd = calcVantagemDesvantagemPericia(p.nome);
            const temVant = vd.vantagens.length > 0;
            const temDesv = vd.desvantagens.length > 0;
            let indicador = '';
            if (temVant && temDesv) {
              indicador = `<span class="pericia-vd-badge neutro" data-vd-info="Vantagem (${vd.vantagens.map(escHtml).join(', ')}) e Desvantagem (${vd.desvantagens.map(escHtml).join(', ')}) se anulam">—</span>`;
            } else if (temVant) {
              indicador = `<span class="pericia-vd-badge vantagem" data-vd-info="Vantagem: ${vd.vantagens.map(escHtml).join(', ')}">V</span>`;
            } else if (temDesv) {
              indicador = `<span class="pericia-vd-badge desvantagem" data-vd-info="Desvantagem: ${vd.desvantagens.map(escHtml).join(', ')}">D</span>`;
            }
            // Vantagem condicional de item (4C): selo informativo, fora do cálculo de V/D.
            if (vd.notas?.length) {
              indicador += `<span class="pericia-vd-badge vantagem-nota" data-vd-info="${vd.notas.map(escHtml).join('; ')}">V*</span>`;
            }
            return `
            <div class="pericia-item" style="border-left:3px solid ${estilo.cor || 'var(--border)'}">
              <div class="pericia-prof ${proficiente ? (expertise ? 'expertise' : 'ativo') : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome">${p.nome}</span>
              <span class="pericia-atributo-tag" style="color:${estilo.cor || 'var(--text-muted)'}">${p.atributo.substring(0,3).toUpperCase()}</span>
              ${indicador}
            </div>`;
          }).join('');
        })()}
      </div>
    </div>

    <!-- Talentos -->
    ${renderSecaoTalentos()}

    <!-- Sortudo: Pontos de Sorte -->
    ${passivosTalentosCache?.flags?.sortudo ? (() => {
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.sortudo) char.recursos.sortudo = { pontos_gastos: 0 };
      const total = bonusProficiencia(char.nivel);
      const disponiveis = Math.max(0, total - (char.recursos.sortudo.pontos_gastos || 0));
      return `
    <div class="card" style="border-left:3px solid var(--accent)">
      <div class="card-header" style="padding-bottom:4px"><h2 style="font-size:0.95rem">Sortudo — Pontos de Sorte</h2></div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${disponiveis}/${total} disponível(is) · Recarrega no Descanso Longo</div>
      <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-sortudo-acao="vantagem" ${disponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar: Vantagem</button>
        <button class="btn btn-sm btn-secondary" data-sortudo-acao="desvantagem" ${disponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar: Desvantagem (reação)</button>
      </div>
    </div>`;
    })() : ''}

    <!-- Características de Classe -->
    ${renderSecaoCaracteristicas(renderCardRecursosClasse(recursosClasse.recursos))}

    <!-- Características de Subclasse -->
    ${renderSecaoSubclasse()}

    <!-- Companheiros do Artífice -->
    ${renderSecaoCompanheirosArtifice()}

    <!-- Traços da Espécie/Raça -->
    ${renderSecaoTracosEspecie()}

    <!-- Espaços de Magia e Magias -->
    <!--
      O último termo, possuiAlgumaMagia (regras-origens-magia.js), é o que
      cobre quem não conjura por classe nem subclasse mas tem magia por outro
      caminho: talento (Tocado Por Fadas/Pelas Sombras, Conjurador Ritualista,
      Telecinético), legado de espécie, magia personalizada. Antes da issue #20
      isto era uma lista de casos e faltavam quase todos -- um Monge com Tocado
      Por Fadas tinha as duas magias gravadas e a ficha pulava de Traços de
      Espécie direto para Inventário, sem erro nenhum no console.
      As condições de Iniciado em Magia continuam aqui de propósito: elas leem
      a INSTÂNCIA do talento, que existe mesmo antes de as magias entrarem nas
      listas do personagem.
      O primeiro termo era "info.conjurador || ehSubclasseConjuradora()", e os
      dois liam o espelho da classe INICIAL: um Bárbaro 5/Mago 1 SEM nenhuma
      magia registrada dava falso em todos os termos e não via a seção -- que é
      a única superfície com o botão "Preparar Magias", então ele ficava sem caminho
      para registrar a primeira. possuiAlgumaMagia não o salvava justamente por
      ele ainda não ter magia nenhuma. conjuraPorAlgumaClasse pergunta pelas
      classes de verdade (regras-multiclasse-conjuracao.js), Magia de Pacto
      inclusive.
    -->
    ${renderSecaoMortosVivos()}
    ${renderSecaoFamiliar()}
    ${temSecaoMagias ? renderSecaoMagias(renderFaixaRecursosMagias(recursosClasse.magias)) : ''}

    <!-- Ataques (só com arma equipada) -->
    ${renderSecaoAtaques()}

    <!-- Inventário -->
    ${renderSecaoInventario()}

    <!-- Detalhes pessoais -->
    ${renderSecaoDetalhes()}

    <!-- Ações da ficha -->
    <div class="card no-print mt-3">
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-danger btn-sm" id="btn-excluir-char">Excluir Personagem</button>
      </div>
    </div>
  `;

  // --- Eventos ---
  setupEventosHP();
  setupEventosDescanso();
  setupEventosEdicao();
  setupEventosInventarioSheet();
  setupEventosAtaques();
  setupEventosEspacosMagia();
  setupEventosHabilidades();
  setupEventosArtifice();
  setupEventosCompanheirosArtifice();
  setupEventosFamiliar();
  setupEventosMortosVivos();
  setupEventosFormaSelvagem();
  ligarSelosFonte(containerRef);
  setupEventosSubclasseBarbaro();
  setupEventosCondicoes();
  setupEventosDefesas();
  setupEventosVantagemDesvantagem();
  setupEventosDetalhesColapso();
  setupEventosTruquesColapso();
  setupEventosRecursosClasse();
  document.getElementById('btn-recuperar-dadiva-epica')
    ?.addEventListener('click', abrirModalRecuperarDadivaEpica);

  // Restaurar estado dos details
  restaurarEstadoDetails(estadoDetails);
}