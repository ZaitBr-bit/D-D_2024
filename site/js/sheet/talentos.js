// ============================================================
// Secao de talentos e seus modais
//
// Inclui as duas migracoes de dados de talento e a recuperacao de
// Dadiva Epica.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES } from '../dados-classes.js';
import { getMagiasClasse, getTalentos } from '../db.js';
import { bindEscolhasTalento, renderEscolhasTalento } from '../levelup-ui.js';
import { aplicarASITalento, exigeDadivaEpica, obterAtributosASITalento, obterTalentosElegiveis, registrarDadivaEpicaLegada, talentoPermitidoNaRecuperacaoDadiva } from '../levelup.js';
import { aplicarEfeitoTalento, getRegraTalento, obterEscolhasObrigatoriasTalento, validarEscolhasTalento } from '../regras-cobertura.js';
import { abrirModal, escHtml, mdParaHtml, nomesMagiaCirculo1Conhecidas, semAcento, toast } from '../utils.js';
import { montarSeletor } from '../ui-opcoes.js';
import { deMagias, deTalentos, motivoPreRequisito } from '../opcoes-dominio.js';
import { char, passivosTalentosCache, salvar, talentosCache } from './estado.js';
import { renderFichaCompleta } from './ficha.js';

export function precisaRecuperarDadivaEpica() {
  return Number(char?.nivel) >= 19 &&
    exigeDadivaEpica(char?.classe, 19) &&
    !char?.escolhas_classe?.dadiva_epica_nivel_19;
}

export async function abrirModalRecuperarDadivaEpica() {
  if (!precisaRecuperarDadivaEpica()) return;
  const dados = talentosCache || await getTalentos();
  const talentos = obterTalentosElegiveis(char, dados, 19)
    .filter(talentoPermitidoNaRecuperacaoDadiva);
  const porCategoria = talentos.reduce((grupos, talento) => {
    const categoria = talento.categoria || 'Outros';
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria].push(talento);
    return grupos;
  }, {});
  const ctxTalento = {
    char,
    helpers: {
      obterListasIniciadoEmMagiaUsadas,
      obterTiposAdeptoElementalUsados
    }
  };

  abrirModal('Dádiva Épica ou Outro Talento', `
    <div class="info-box warning" style="font-size:0.8rem;margin-bottom:10px">
      Esta ficha chegou ao nível 19 sem registrar a escolha obrigatória. Selecione o talento recebido nesse nível.
      A recuperação automática mostra apenas alternativas cujos efeitos podem ser reaplicados integralmente e sem ambiguidade.
    </div>
    <select id="recuperar-dadiva-talento" class="form-input" style="width:100%;margin-bottom:8px">
      <option value="">-- Selecione um talento --</option>
      ${Object.entries(porCategoria).map(([categoria, lista]) => `
        <optgroup label="${escHtml(categoria)}">
          ${lista.map(talento => `<option value="${escHtml(talento.nome)}">${escHtml(talento.nome)}</option>`).join('')}
        </optgroup>`).join('')}
    </select>
    <div id="recuperar-dadiva-detalhe"></div>
    <div id="levelup-talento-escolhas"></div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-recuperar-dadiva">Registrar</button>');

  const select = document.getElementById('recuperar-dadiva-talento');
  select?.addEventListener('change', () => {
    const talento = talentos.find(item => item.nome === select.value);
    const detalhe = document.getElementById('recuperar-dadiva-detalhe');
    const escolhas = document.getElementById('levelup-talento-escolhas');
    if (!talento) {
      if (detalhe) detalhe.innerHTML = '';
      if (escolhas) escolhas.innerHTML = '';
      return;
    }
    if (detalhe) {
      detalhe.innerHTML = `<div class="info-box info" style="font-size:0.8rem"><strong>${escHtml(talento.nome)}</strong><br>${escHtml(talento.prerequisito || '')}</div>`;
    }
    if (escolhas) {
      escolhas.innerHTML = renderEscolhasTalento(talento.nome, talento, ctxTalento, {});
      bindEscolhasTalento(talento.nome, talento, ctxTalento);
    }
  });

  document.getElementById('btn-confirmar-recuperar-dadiva')?.addEventListener('click', () => {
    const nome = select?.value || '';
    const talento = talentos.find(item => item.nome === nome);
    if (!talento) {
      toast('Selecione um talento.', 'error');
      return;
    }
    const opcoes = { talento: nome };
    if (nome === 'Aumento no Valor de Atributo') {
      opcoes.aumentos_atributo = {};
      ATRIBUTOS_KEYS.forEach(key => {
        const valor = parseInt(document.getElementById(`levelup-talento-attr-${key}`)?.value) || 0;
        if (valor > 0) opcoes.aumentos_atributo[key] = valor;
      });
    }
    const asi = document.getElementById('levelup-talento-asi')?.value || '';
    if (asi) opcoes.talento_asi = asi;
    const escolhas = [...document.querySelectorAll('.escolha-talento-levelup')]
      .map(item => item.value).filter(Boolean);
    const magia = document.getElementById('levelup-magia-escola-select')?.value || '';
    const rituais = [...document.querySelectorAll('.levelup-ritual-check:checked')].map(item => item.value);
    opcoes.escolhas_talento_levelup = magia ? [magia] : rituais.length > 0 ? rituais : escolhas;
    const energias = [...document.querySelectorAll('.dadiva-energia-escolha')]
      .map(item => item.value).filter(Boolean);
    if (energias.length > 0) {
      if (energias.length !== 2 || new Set(energias).size !== 2) {
        toast('Selecione 2 tipos de energia diferentes.', 'error');
        return;
      }
      opcoes.dadiva_resistencia_energia = energias;
    }

    const resultado = registrarDadivaEpicaLegada(char, opcoes, dados);
    if (!resultado.sucesso) {
      toast(resultado.erro || 'Não foi possível registrar o talento.', 'error');
      return;
    }
    salvar();
    window.fecharModal?.();
    renderFichaCompleta();
    toast(`Talento de nível 19 registrado: ${resultado.talento}`, 'success');
  });
}

// --- Talentos ---
export function renderSecaoTalentos() {
  if (!char.talentos) char.talentos = [];
  
  // Buscar descrições dos talentos no cache
  const todosOsTalentos = [];
  if (talentosCache?.por_categoria) {
    Object.values(talentosCache.por_categoria).forEach(lista => {
      lista.forEach(t => todosOsTalentos.push(t));
    });
  }
  
  return `
    <div class="card">
      <div class="card-header">
        <h2>Talentos</h2>
        <button class="btn btn-sm btn-accent no-print" id="btn-add-talento">+ Talento</button>
      </div>
      ${char.talentos.map((t, tIdx) => {
        const nome = typeof t === 'string' ? t : t.nome;
        // Busca exata primeiro; se não encontrar, tenta pelo nome base (sem parênteses)
        let talentoData = todosOsTalentos.find(td => td.nome === nome);
        if (!talentoData) {
          const nomeBase = nome.replace(/\s*\(.*\)$/, '').trim();
          talentoData = todosOsTalentos.find(td => td.nome === nomeBase);
        }
        const descricao = talentoData?.descricao || '';
        const beneficios = talentoData?.beneficios || [];

        // Informações de escolhas específicas do talento
        // Entradas podem vir com sufixo de lista do antecedente, ex. "Iniciado em Magia (Clérigo)"
        const _ehIM = (n) => n.replace(/\s*\(.*\)$/, '').trim() === 'Iniciado em Magia';
        let infoEscolhas = '';
        if (_ehIM(nome)) {
          // Formato novo: array de instâncias
          const instancias = char.iniciado_em_magia_instancias || [];
          // Formato legado (pré-migração)
          const legado = char.iniciado_em_magia?.lista ? [char.iniciado_em_magia] : [];
          const todas = instancias.length > 0 ? instancias : legado;
          // Cada entrada "Iniciado em Magia" em char.talentos corresponde a UMA instância,
          // pela posição ordinal entre as entradas com esse nome (evita listar todas em cada uma)
          const ordinal = char.talentos.slice(0, tIdx).filter(x => _ehIM(typeof x === 'string' ? x : x.nome || '')).length;
          const im = todas[ordinal];
          if (im) {
            infoEscolhas = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px">
              <strong>Lista:</strong> ${im.lista} | <strong>Atributo:</strong> ${ATRIBUTOS_NOMES[im.atributo] || im.atributo || '—'}
              <br><strong>Truques:</strong> ${(im.truques || []).join(', ') || '—'}
              <br><strong>Magia 1o Círculo:</strong> ${im.magia || '—'}
              <div class="no-print" style="margin-top:6px">
                <button class="btn btn-sm btn-secondary" data-editar-im="${ordinal}">Substituir magia</button>
              </div>
            </div>`;
          }
        }
        if (nome === 'Adepto Elemental') {
          // Formato novo: array de tipos
          const tipos = char.adepto_elemental_tipos || [];
          // Formato legado (pré-migração)
          const legado = char.adepto_elemental_tipo ? [char.adepto_elemental_tipo] : [];
          const todos = tipos.length > 0 ? tipos : legado;
          if (todos.length > 0) {
            infoEscolhas = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Domínio Elemental:</strong> ${todos.join(', ')}</div>`;
          }
        }
        if (nome === 'Resiliente') {
          const atributo = char.talentos_parametros?.resiliente?.atributo;
          if (atributo) {
            infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Salvaguarda:</strong> ${ATRIBUTOS_NOMES[atributo] || atributo}</div>`;
          }
        }
        if (nome === 'Especialista em Perícia') {
          const parametros = char.talentos_parametros?.especialista_pericia;
          if (parametros) {
            infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Proficiência:</strong> ${parametros.proficiencia} | <strong>Especialização:</strong> ${parametros.expertise}</div>`;
          }
        }
        if (nome === 'Envenenador' || nome === 'Telecinético') {
          const chave = nome === 'Envenenador' ? 'envenenador' : 'telecinetico';
          const atributo = char.talentos_parametros?.[chave]?.atributo;
          const cd = passivosTalentosCache?.cdTalentos?.[chave];
          if (atributo) {
            infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Atributo:</strong> ${ATRIBUTOS_NOMES[atributo] || atributo}${cd ? ` | <strong>CD:</strong> ${cd}` : ''}</div>`;
          }
        }
        if (nome === 'Dádiva da Resistência à Energia') {
          const energias = char.talentos_parametros?.dadiva_resistencia_energia || [];
          if (energias.length > 0) {
            infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Resistências:</strong> ${energias.join(', ')}</div>`;
          }
        }
        if (nome === 'Conjurador Ritualista' && char.recursos?.talentos?.conjurador_ritualista) {
          const usado = char.recursos.talentos.conjurador_ritualista.ritual_rapido_usado;
          infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Ritual Rápido:</strong> ${usado ? 'usado' : 'disponível'} <button class="btn btn-sm btn-secondary no-print" data-talento-recurso="ritual-rapido">${usado ? 'Restaurar' : 'Marcar uso'}</button></div>`;
        }
        if (nome === 'Dádiva da Recuperação' && char.recursos?.talentos?.dadiva_recuperacao) {
          const recurso = char.recursos.talentos.dadiva_recuperacao;
          infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Até a Morte:</strong> ${recurso.ate_a_morte_usado ? 'usado' : 'disponível'} <button class="btn btn-sm btn-secondary no-print" data-talento-recurso="recuperacao-ate-morte">${recurso.ate_a_morte_usado ? 'Restaurar' : 'Marcar uso'}</button><br><strong>Dados de Vitalidade:</strong> ${10 - (recurso.dados_vitalidade_gastos || 0)}/10 <button class="btn btn-sm btn-secondary no-print" data-talento-recurso="recuperacao-dado" ${(recurso.dados_vitalidade_gastos || 0) >= 10 ? 'disabled' : ''}>Gastar 1d10</button></div>`;
        }
        if (nome === 'Dádiva do Destino' && char.recursos?.talentos?.dadiva_destino) {
          const usado = char.recursos.talentos.dadiva_destino.usado;
          infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Aprimorar Destino:</strong> ${usado ? 'usado' : 'disponível'} <button class="btn btn-sm btn-secondary no-print" data-talento-recurso="dadiva-destino">${usado ? 'Restaurar' : 'Marcar uso'}</button></div>`;
        }
        if (nome === 'Dádiva da Proeza em Combate' && char.recursos?.talentos?.dadiva_proeza_combate) {
          const usado = char.recursos.talentos.dadiva_proeza_combate.usado_no_turno;
          infoEscolhas += `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Pontaria Inigualável:</strong> ${usado ? 'usada neste turno' : 'disponível'} <button class="btn btn-sm btn-secondary no-print" data-talento-recurso="dadiva-proeza">${usado ? 'Novo turno' : 'Marcar uso'}</button></div>`;
        }
        // Talentos com escolhas de proficiencias/ferramentas/instrumentos
        if (['Habilidoso', 'Artifista', 'Músico'].includes(nome) && char.escolhas_talento) {
          const entradas = [];
          const ctxLabels = { antecedente: 'Antecedente', versatil: 'Versátil' };
          for (const [ctx, escolhas] of Object.entries(char.escolhas_talento)) {
            if (!Array.isArray(escolhas) || escolhas.length === 0) continue;
            // Filtrar: contexto versatil pertence ao talento_versatil
            if (ctx === 'versatil' && char.talento_versatil !== nome) continue;
            // Contexto antecedente: sem como saber qual talento, mostra se o nome atual esta nos talentos
            // e o talento_versatil nao e o mesmo (evita duplicar)
            if (ctx === 'antecedente' && char.talento_versatil === nome) {
              // So mostrar se Habilidoso aparece mais de 1 vez nos talentos
              const count = char.talentos.filter(t => (typeof t === 'string' ? t : t.nome) === nome).length;
              if (count <= 1) continue;
            }
            let label = ctxLabels[ctx] || ctx;
            if (ctx.startsWith('levelup_')) {
              label = `Nível ${ctx.replace('levelup_', '')}`;
            }
            entradas.push({ label, escolhas });
          }
          if (entradas.length > 0) {
            const rotulo = nome === 'Artifista' ? 'Ferramentas' : nome === 'Músico' ? 'Instrumentos' : 'Proficiências';
            infoEscolhas += entradas.map(e =>
              `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>${e.label} — ${rotulo}:</strong> ${e.escolhas.join(', ')}</div>`
            ).join('');
          }
        }
        
        return `
          <details style="margin-bottom:6px">
            <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;padding:6px 0;border-bottom:1px solid var(--border-light)">
              ${nome}
              ${talentoData?.categoria ? `<span class="badge badge-secondary" style="font-size:0.65rem;margin-left:4px">${talentoData.categoria}</span>` : ''}
            </summary>
            <div style="padding:6px 0 6px 16px;font-size:0.85rem">
              ${descricao ? `<div class="md-content">${mdParaHtml(descricao)}</div>` : ''}
              ${beneficios.length > 0 ? `
                <div style="margin-top:6px">
                  ${beneficios.map(b => `
                    <div style="margin-bottom:4px">
                      <strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${infoEscolhas}
            </div>
          </details>
        `;
      }).join('')}
    </div>
  `;
}

/** Sincroniza char.talentos com talentos concedidos por invocações (Lições dos Grandes Antigos) */
export function sincronizarTalentosInvocacoes() {
  const invs = char.recursos?.bruxo?.invocacoes || [];
  const desejados = invs
    .filter(i => semAcento(i.nome || '') === semAcento('Lições dos Grandes Antigos') && i.talento)
    .map(i => i.talento);
  if (!char.talentos) char.talentos = [];

  // Remover TODAS as entradas que esta função adicionou anteriormente (tag própria) —
  // nunca toca em entradas manuais (string simples) ou de outras origens.
  char.talentos = char.talentos.filter(t => !(typeof t === 'object' && t?.origem === 'invocacao_grandes_antigos'));

  // Recriar entradas para o estado atual desejado
  const anteriores = char.talentos_via_invocacao || [];
  const novos = [];
  const contagemAnteriores = {};
  anteriores.forEach(t => { contagemAnteriores[t] = (contagemAnteriores[t] || 0) + 1; });
  const contagemAtual = {};
  for (const t of desejados) {
    contagemAtual[t] = (contagemAtual[t] || 0) + 1;
    char.talentos.push({ nome: t, origem: 'invocacao_grandes_antigos' });
    if (contagemAtual[t] > (contagemAnteriores[t] || 0)) {
      novos.push(t);
    }
  }
  char.talentos_via_invocacao = desejados;
  return novos;
}

/** Migra formato antigo de Iniciado em Magia (objeto) para array de instâncias */
export function migrarIniciadoEmMagiaInstancias() {
  if (char.iniciado_em_magia && typeof char.iniciado_em_magia === 'object' && !Array.isArray(char.iniciado_em_magia)) {
    if (char.iniciado_em_magia.lista) {
      if (!char.iniciado_em_magia_instancias) char.iniciado_em_magia_instancias = [];
      // Evitar duplicata se já migrou
      const jaExiste = char.iniciado_em_magia_instancias.some(i => i.lista === char.iniciado_em_magia.lista);
      if (!jaExiste) {
        char.iniciado_em_magia_instancias.push({ ...char.iniciado_em_magia });
      }
    }
    delete char.iniciado_em_magia;
    salvar();
  }
}

/** Migra formato antigo de Adepto Elemental (string) para array de tipos */
export function migrarAdeptoElementalTipos() {
  if (char.adepto_elemental_tipo && typeof char.adepto_elemental_tipo === 'string') {
    if (!char.adepto_elemental_tipos) char.adepto_elemental_tipos = [];
    if (!char.adepto_elemental_tipos.includes(char.adepto_elemental_tipo)) {
      char.adepto_elemental_tipos.push(char.adepto_elemental_tipo);
    }
    delete char.adepto_elemental_tipo;
    salvar();
  }
}

/** Retorna listas de magias já usadas pelo talento Iniciado em Magia */
export function obterListasIniciadoEmMagiaUsadas() {
  const usadas = [];
  // Formato novo (array de instâncias)
  if (Array.isArray(char.iniciado_em_magia_instancias)) {
    char.iniciado_em_magia_instancias.forEach(i => { if (i.lista) usadas.push(i.lista); });
  }
  // Formato legado (objeto único, caso migração ainda não rodou)
  if (char.iniciado_em_magia?.lista && !usadas.includes(char.iniciado_em_magia.lista)) {
    usadas.push(char.iniciado_em_magia.lista);
  }
  return usadas;
}

/** Modal para escolher lista/atributo/truques/magia de uma nova instância de Iniciado em Magia */
export async function abrirModalIniciadoEmMagiaFicha(restantes = 1, aoSalvar = null) {
  const listasUsadas = obterListasIniciadoEmMagiaUsadas();
  const listas = ['Clérigo', 'Druida', 'Mago'].filter(l => !listasUsadas.includes(l));
  if (listas.length === 0) {
    toast('Todas as listas de Iniciado em Magia já foram usadas', 'error');
    return;
  }

  const estado = { lista: '', atributo: 'sabedoria', truques: [], magia: '' };

  const renderCorpo = () => `
    <div class="info-box info" style="font-size:0.8rem">Escolha a lista, o atributo de conjuração, 2 truques e 1 magia de 1º círculo.</div>
    <label class="form-label">Lista de magias</label>
    <select class="form-input" id="im-ficha-lista">
      <option value="">Selecione...</option>
      ${listas.map(l => `<option value="${l}" ${estado.lista === l ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <label class="form-label" style="margin-top:8px">Atributo de conjuração</label>
    <select class="form-input" id="im-ficha-atributo">
      ${[['inteligencia', 'Inteligência'], ['sabedoria', 'Sabedoria'], ['carisma', 'Carisma']].map(([k, n]) => `<option value="${k}" ${estado.atributo === k ? 'selected' : ''}>${n}</option>`).join('')}
    </select>
    <div id="im-ficha-magias" style="margin-top:8px"></div>
  `;

  abrirModal('Iniciado em Magia — Escolhas', `<div id="im-ficha-conteudo">${renderCorpo()}</div>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-im-ficha">Salvar</button>');

  const renderMagias = async () => {
    const area = document.getElementById('im-ficha-magias');
    if (!area) return;
    if (!estado.lista) { area.innerHTML = ''; return; }
    const dados = await getMagiasClasse(estado.lista);
    const listaMagias = dados?.lista_magias || {};
    const truquesDisp = (listaMagias['Truques'] || []).map(m => typeof m === 'string' ? { nome: m } : m);
    // `circulo: 1` forçado aqui porque as entradas de `lista_magias['1º
    // Círculo']` (dados/classes/magias_*.json) não trazem esse campo --
    // deMagias (opcoes-dominio.js) precisa dele para o resumo do card;
    // sem isto o card mostrava "undefinedº Círculo" (achado ao converter
    // para montarSeletor, Task 14).
    const c1Disp = (listaMagias['1º Círculo'] || [])
      .map(m => typeof m === 'string' ? { nome: m } : m)
      .map(m => ({ ...m, circulo: 1 }));

    // Truques/magias já conhecidos por outra fonte — impede escolher duplicata sem ganho
    const jaTemTruqueIM = new Set((char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
    const jaTemMagiaIM = nomesMagiaCirculo1Conhecidas(char);

    area.innerHTML = `
      <div style="font-weight:600;font-size:0.85rem">Truques (2)</div>
      <div id="im-ficha-truques-lista"></div>
      <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magia de 1º Círculo</div>
      <div id="im-ficha-magia-lista"></div>
    `;

    // Truques em cards, como o resto do app: em checkbox o jogador escolhia
    // dois truques vendo so o nome. `circulo: 0` e injetado porque a lista da
    // classe nao traz o campo, e sem ele o card nao sabe onde buscar o texto
    // completo do "ver detalhes". A ja conhecida por outra fonte fica
    // bloqueada, exceto as que o proprio estado ja tinha marcado.
    const jaTemTruqueCard = new Set([...jaTemTruqueIM].filter(n => !estado.truques.includes(n)));
    montarSeletor(document.getElementById('im-ficha-truques-lista'), {
      opcoes: deMagias(truquesDisp.map(m => ({ ...m, circulo: 0 })), { jaTem: jaTemTruqueCard }),
      densidade: 'densa', max: 2, busca: true,
      selecionadas: [...estado.truques],
      aoMudar: (sel) => { estado.truques = sel; },
    });
    // Magia de 1º Círculo: círculo e escola passam a aparecer sem clicar. A
    // já conhecida por outra fonte fica bloqueada, exceto a que o próprio
    // estado já tinha marcado (reabrir a lista ao trocar de lista e voltar
    // não pode apagar a escolha em curso).
    const jaTemMagiaCard = new Set(jaTemMagiaIM);
    if (estado.magia) jaTemMagiaCard.delete(estado.magia);
    montarSeletor(document.getElementById('im-ficha-magia-lista'), {
      opcoes: deMagias(c1Disp, { jaTem: jaTemMagiaCard }),
      densidade: 'densa', max: 1, busca: true,
      selecionadas: estado.magia ? [estado.magia] : [],
      aoMudar: (sel) => { estado.magia = sel[0] || ''; },
    });
  };

  document.getElementById('im-ficha-lista')?.addEventListener('change', async (e) => {
    estado.lista = e.target.value;
    estado.truques = [];
    estado.magia = '';
    await renderMagias();
  });
  document.getElementById('im-ficha-atributo')?.addEventListener('change', (e) => { estado.atributo = e.target.value; });

  document.getElementById('btn-salvar-im-ficha')?.addEventListener('click', () => {
    if (!estado.lista) { toast('Selecione a lista de magias', 'error'); return; }
    if (estado.truques.length < 2) { toast('Selecione 2 truques', 'error'); return; }
    if (!estado.magia) { toast('Selecione 1 magia de 1º círculo', 'error'); return; }

    const resultado = aplicarEfeitoTalento(char, 'Iniciado em Magia', {
      iniciado_em_magia: {
        lista: estado.lista,
        atributo: estado.atributo,
        truques: [...estado.truques],
        magia: estado.magia
      }
    });
    if (!resultado.sucesso) {
      toast(resultado.erro, 'error');
      return;
    }
    aoSalvar?.();

    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast('Iniciado em Magia configurado!', 'success');

    if (restantes > 1) {
      abrirModalIniciadoEmMagiaFicha(restantes - 1);
    }
  });
}

/**
 * Modal de "Substituição de Magia" do talento Iniciado em Magia.
 * Regra 2024: ao alcançar um novo nível, pode substituir uma das magias escolhidas
 * para o talento por outra do mesmo círculo, da mesma lista. A lista e o atributo
 * de conjuração ficam fixos; troca-se truques (círculo 0) e/ou a magia de 1º círculo.
 * @param {number} ordinal - índice da instância em char.iniciado_em_magia_instancias
 */
export async function abrirModalEditarIniciadoEmMagia(ordinal) {
  const instancias = char.iniciado_em_magia_instancias || [];
  const inst = instancias[ordinal];
  if (!inst) { toast('Instância de Iniciado em Magia não encontrada', 'error'); return; }

  // Estado de edição (cópia; só aplica ao salvar)
  const estado = { truques: [...(inst.truques || [])], magia: inst.magia || '' };
  const outrasInstancias = instancias.filter((_, i) => i !== ordinal);

  abrirModal('Iniciado em Magia — Substituir Magia',
    `<div class="info-box info" style="font-size:0.8rem">Lista: <strong>${inst.lista}</strong> · Atributo: <strong>${ATRIBUTOS_NOMES[inst.atributo] || inst.atributo || '—'}</strong><br>Substitua truques ou a magia de 1º círculo por outras da mesma lista.</div>
     <div id="im-edit-magias" style="margin-top:8px">Carregando...</div>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-im-edit">Salvar</button>');

  const dados = await getMagiasClasse(inst.lista);
  const listaMagias = dados?.lista_magias || {};
  const truquesDisp = (listaMagias['Truques'] || []).map(m => typeof m === 'string' ? { nome: m } : m);
  // `circulo: 1` forçado aqui porque as entradas de `lista_magias['1º
  // Círculo']` (dados/classes/magias_*.json) não trazem esse campo --
  // deMagias (opcoes-dominio.js) precisa dele para o resumo do card; sem
  // isto o card mostrava "undefinedº Círculo" (achado ao converter para
  // montarSeletor, Task 14).
  const c1Disp = (listaMagias['1º Círculo'] || [])
    .map(m => typeof m === 'string' ? { nome: m } : m)
    .map(m => ({ ...m, circulo: 1 }));

  const renderMagias = () => {
    const area = document.getElementById('im-edit-magias');
    if (!area) return;

    // Truques/magias já conhecidos por OUTRA fonte (não pela seleção atual desta instância)
    const jaTemTruqueIM = new Set((char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
    const jaTemMagiaIM = nomesMagiaCirculo1Conhecidas(char);

    area.innerHTML = `
      <div style="font-weight:600;font-size:0.85rem">Truques (2)</div>
      <div id="im-edit-truques-lista"></div>
      <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magia de 1º Círculo</div>
      <div id="im-edit-magia-lista"></div>
    `;

    // Truques em cards, como o resto do app: em checkbox o jogador escolhia
    // dois truques vendo so o nome. `circulo: 0` e injetado porque a lista da
    // classe nao traz o campo, e sem ele o card nao sabe onde buscar o texto
    // completo do "ver detalhes". A ja conhecida por outra fonte fica
    // bloqueada, exceto as que o proprio estado ja tinha marcado.
    const jaTemTruqueCard = new Set([...jaTemTruqueIM].filter(n => !estado.truques.includes(n)));
    montarSeletor(document.getElementById('im-edit-truques-lista'), {
      opcoes: deMagias(truquesDisp.map(m => ({ ...m, circulo: 0 })), { jaTem: jaTemTruqueCard }),
      densidade: 'densa', max: 2, busca: true,
      selecionadas: [...estado.truques],
      aoMudar: (sel) => { estado.truques = sel; },
    });
    // Magia de 1º Círculo: círculo e escola passam a aparecer sem clicar. A
    // magia já conhecida por OUTRA fonte fica bloqueada -- exceto a que
    // esta própria instância já usa (senão a magia atual apareceria
    // bloqueada nela mesma, já que ela conta como conhecida).
    const jaTemMagiaCard = new Set(jaTemMagiaIM);
    if (estado.magia) jaTemMagiaCard.delete(estado.magia);
    montarSeletor(document.getElementById('im-edit-magia-lista'), {
      opcoes: deMagias(c1Disp, { jaTem: jaTemMagiaCard }),
      densidade: 'densa', max: 1, busca: true,
      selecionadas: estado.magia ? [estado.magia] : [],
      aoMudar: (sel) => { estado.magia = sel[0] || ''; },
    });
  };

  renderMagias();

  document.getElementById('btn-salvar-im-edit')?.addEventListener('click', () => {
    if (estado.truques.length !== 2) { toast('Selecione exatamente 2 truques', 'error'); return; }
    if (!estado.magia) { toast('Selecione 1 magia de 1º círculo', 'error'); return; }

    const oldTruques = inst.truques || [];
    const oldMagia = inst.magia || '';
    // Truques ainda usados por outras instâncias — não remover das conhecidas
    const truquesOutras = new Set(outrasInstancias.flatMap(i => i.truques || []));
    const magiasOutras = new Set(outrasInstancias.map(i => i.magia).filter(Boolean));

    if (!char.magias_conhecidas) char.magias_conhecidas = [];
    if (!char.magias_preparadas) char.magias_preparadas = [];

    // Remover truques que saíram (se vieram do IM e não são usados por outra instância)
    for (const nome of oldTruques) {
      if (estado.truques.includes(nome)) continue;
      if (truquesOutras.has(nome)) continue;
      char.magias_conhecidas = char.magias_conhecidas.filter(m => !(m.nome === nome && m.circulo === 0 && m.origem === 'iniciado_em_magia'));
    }
    // Adicionar truques novos
    for (const nome of estado.truques) {
      if (!char.magias_conhecidas.find(m => m.nome === nome && m.circulo === 0)) {
        char.magias_conhecidas.push({ nome, circulo: 0, origem: 'iniciado_em_magia' });
      }
    }
    // Trocar magia de 1º círculo, se mudou
    if (oldMagia !== estado.magia) {
      if (oldMagia && !magiasOutras.has(oldMagia)) {
        char.magias_preparadas = char.magias_preparadas.filter(m => !(m.nome === oldMagia && m.origem === 'iniciado_em_magia'));
      }
      const existenteIM = char.magias_preparadas.find(m => m.nome === estado.magia);
      if (existenteIM) {
        existenteIM.origem = 'iniciado_em_magia';
        existenteIM.gratis_usado = false;
      } else {
        char.magias_preparadas.push({ nome: estado.magia, circulo: 1, origem: 'iniciado_em_magia', gratis_usado: false });
      }
    }

    inst.truques = [...estado.truques];
    inst.magia = estado.magia;

    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast('Magias do talento substituídas!', 'success');
  });
}

/** Modal para adicionar um talento manualmente à ficha */
export async function abrirModalAdicionarTalento() {
  const data = talentosCache || await getTalentos();
  const categorias = Object.keys(data?.por_categoria || {});
  if (categorias.length === 0) { toast('Não foi possível carregar os talentos', 'error'); return; }

  const jaTem = new Set((char.talentos || []).map(t => typeof t === 'string' ? t : t.nome));
  const todosTalentos = Object.values(data.por_categoria || {}).flat();
  const encontrarTalento = (nome) => todosTalentos.find(t => t.nome === nome);
  // Talento marcado no card (montarSeletor abaixo) -- lido pelo botão
  // "Adicionar" no lugar do antigo `#add-tal-nome`?.value.
  let talentoEscolhido = '';
  const persistirTalento = (nome, talento, atributoASI, escolhasCobertura = {}) => {
    const nomesAtributo = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };
    if (nome === 'Resiliente' && (char.salvaguardas_proficientes || []).includes(nomesAtributo[atributoASI])) {
      toast('Escolha um atributo sem proficiência em salvaguarda para Resiliente.', 'error');
      return false;
    }
    const escolhasCompletas = { ...escolhasCobertura, atributo: atributoASI, talento_asi: atributoASI };
    const validacao = validarEscolhasTalento(char, nome, escolhasCompletas);
    if (!validacao.valido) {
      toast(validacao.erro, 'error');
      return false;
    }
    if (atributoASI) {
      const resultadoASI = aplicarASITalento(char, talento, atributoASI);
      if (!resultadoASI.sucesso) { toast(resultadoASI.erro, 'error'); return false; }
    }
    const resultadoEfeito = aplicarEfeitoTalento(char, nome, escolhasCompletas);
    if (!resultadoEfeito.sucesso) {
      toast(resultadoEfeito.erro, 'error');
      return false;
    }
    if (!char.talentos) char.talentos = [];
    char.talentos.push(nome);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`Talento "${nome}" adicionado`, 'success');
    return true;
  };

  abrirModal('Adicionar Talento', `
    <div class="info-box warning" style="font-size:0.8rem">Use para talentos concedidos fora do fluxo normal (invocações, bênçãos do Mestre etc.). Efeitos com escolhas (perícias, magias) podem exigir configuração manual.</div>
    <div id="add-talento-lista"></div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-add-talento">Adicionar</button>');

  // "+ Talento" da ficha: mesma lista da subida de nível, sem o select de
  // categoria (que vira filtro) e sem o de talento (que vira card).
  //
  // Decisão do dono do produto (revisão da Task 13, I2): este modal existe
  // PARA conceder talentos fora do fluxo normal (o próprio aviso acima diz
  // isso -- invocações, bênçãos do Mestre etc.), então pré-requisito não
  // atendido não pode travar a seleção aqui como trava na subida de nível
  // -- um Clérigo Força 8 recebendo um talento do Mestre não tinha outro
  // caminho no app para registrá-lo. Por isso `motivoIndisponivel` NÃO é
  // passado a `deTalentos` nesta tela -- ele é quem decide `bloqueado`, e
  // um card bloqueado fica inselecionável (`pointer-events:none` em
  // app.css) e sem "ver detalhes" (cardOpcaoHtml, ui-opcoes.js). Em vez
  // disso, o motivo (quando existe) é dobrado dentro do `resumo` de cada
  // opção logo abaixo -- o único campo do contrato de opção
  // (ui-opcoes.js) que aparece incondicionalmente no card, sem desabilitar
  // nada. "Você já possui este talento" CONTINUA vindo de `jaPossui` (não
  // mexido): essa é a única restrição real do modal original (não dava
  // pra readicionar o mesmo talento não-repetível pelo dropdown antigo,
  // Task 13 entrega original) e continua bloqueando de verdade.
  const motivosPreRequisito = new Map(
    todosTalentos
      .map(t => [t.nome, motivoPreRequisito(t, char)])
      .filter(([, motivo]) => motivo)
  );
  const opcoesTalento = deTalentos(todosTalentos, { jaPossui: jaTem })
    .map(o => {
      const motivo = motivosPreRequisito.get(o.id);
      // Só anota quem NÃO está bloqueado (o já-possuído continua mostrando
      // só o motivo de bloqueio, sem ruído do pré-requisito por cima).
      if (!motivo || o.bloqueado) return o;
      return { ...o, resumo: `⚠ ${motivo}${o.resumo ? ` · ${o.resumo}` : ''}` };
    });
  montarSeletor(document.getElementById('add-talento-lista'), {
    opcoes: opcoesTalento,
    densidade: 'densa', max: 1, busca: true,
    // Rótulos idênticos a `talento.categoria` (ver mesmo achado em
    // levelup-ui.js/bindEventosASI).
    filtros: ['de Origem', 'Geral', 'de Estilo de Luta', 'de Dádiva Épica'],
    // Continua ligado: com o pré-requisito virando aviso (acima), a única
    // razão de bloqueio que sobra nesta tela é "já possui" -- e essa
    // continua correta e vale esconder atrás do "revelar" por padrão
    // (declutter num catálogo de 75 talentos). Nada que o Mestre queira
    // conceder fica escondido por isto: pré-requisito não atendido não é
    // mais motivo de bloqueio, então nunca cai no grupo "travadas" que
    // este filtro esconde -- só filtra o que realmente permanece proibido.
    filtroElegiveis: true,
    aoMudar: (sel) => { talentoEscolhido = sel[0] || ''; },
  });

  document.getElementById('btn-confirmar-add-talento')?.addEventListener('click', () => {
    const nome = talentoEscolhido;
    if (!nome) { toast('Selecione um talento', 'error'); return; }
    const talento = encontrarTalento(nome);
    if (nome === 'Iniciado em Magia') {
      window.fecharModal();
      abrirModalIniciadoEmMagiaFicha(1, () => {
        if (!char.talentos) char.talentos = [];
        char.talentos.push(nome);
      });
      return;
    }

    const regraTalento = getRegraTalento(nome);
    const atributosASI = obterAtributosASITalento(talento);
    const escolhasObrigatorias = obterEscolhasObrigatoriasTalento(regraTalento, char);
    if (atributosASI.length === 0 && escolhasObrigatorias.length === 0) {
      persistirTalento(nome, talento);
      return;
    }

    const ctxTalento = {
      char,
      helpers: {
        obterTiposAdeptoElementalUsados,
        obterListasIniciadoEmMagiaUsadas
      }
    };
    abrirModal('Configurar Talento', `
      <div class="info-box info" style="font-size:0.8rem">Preencha todas as escolhas obrigatórias de ${nome}.</div>
      ${renderEscolhasTalento(nome, talento, ctxTalento, {})}
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-add-talento-asi">Adicionar</button>');
    // Mestre das Armas / Tocado Por Fadas / Tocado Pelas Sombras viraram
    // cards (montarSeletor) dentro de renderEscolhasTalento/bindEscolhasTalento
    // (levelup-ui.js, Task 14) -- a escolha é gravada pelo callback `aoMudar`
    // no objeto passado como `state`, não mais lida de um <select> com classe
    // `.escolha-talento-levelup`/id `levelup-magia-escola-select` (que não
    // existem mais para estes três talentos). Sem passar este objeto, a
    // mutação do callback iria para um `{}` descartável (o padrão de
    // `state = {}` do parâmetro) e o botão abaixo nunca veria a escolha.
    const escolhaCard = { escolhasTalento: [] };
    bindEscolhasTalento(nome, talento, ctxTalento, escolhaCard);

    let confirmado = false;
    document.getElementById('btn-confirmar-add-talento-asi')?.addEventListener('click', () => {
      if (confirmado) return;
      const atributo = document.getElementById('levelup-talento-asi')?.value || '';
      const talentosViraramCard = ['Mestre das Armas', 'Tocado Por Fadas', 'Tocado Pelas Sombras', 'Conjurador Ritualista'];
      const selecoes = talentosViraramCard.includes(nome)
        ? (escolhaCard.escolhasTalento || [])
        : [...document.querySelectorAll('.escolha-talento-levelup')].map(select => select.value).filter(Boolean);
      const magia = (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras')
        ? (escolhaCard.escolhasTalento?.[0] || '')
        : (document.getElementById('levelup-magia-escola-select')?.value || '');
      // Conjurador Ritualista: as magias rituais viraram cards de
      // montarSeletor (levelup-ui.js/bindEscolhasTalento), que gravam em
      // `escolhaCard.escolhasTalento`. Os checkboxes `.levelup-ritual-check`
      // não existem mais -- lê-los devolveria [] e o talento seria gravado
      // sem magia nenhuma, em silêncio.
      const rituais = nome === 'Conjurador Ritualista'
        ? [...(escolhaCard.escolhasTalento || [])]
        : [];
      const energias = [...document.querySelectorAll('.dadiva-energia-escolha')]
        .map(select => select.value)
        .filter(Boolean);
      confirmado = persistirTalento(nome, talento, atributo, {
        selecoes: magia ? [magia] : rituais.length > 0 ? rituais : selecoes,
        magia,
        rituais,
        energias
      });
    });
  });
}

/** Retorna tipos de dano já usados pelo talento Adepto Elemental */
export function obterTiposAdeptoElementalUsados() {
  const usados = [];
  // Formato novo (array)
  if (Array.isArray(char.adepto_elemental_tipos)) {
    usados.push(...char.adepto_elemental_tipos);
  }
  // Formato legado (string única, caso migração ainda não rodou)
  if (char.adepto_elemental_tipo && !usados.includes(char.adepto_elemental_tipo)) {
    usados.push(char.adepto_elemental_tipo);
  }
  return usados;
}