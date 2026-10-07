// ============================================================
// Seletor de itens: o modal "Adicionar Item".
//
// Compartilhado pelo criador (creator/passo-equipamento.js) e pela ficha
// (sheet/inventario.js). Ate 2026-08-13 eram DUAS telas diferentes -- o
// criador tinha 4 botoes com um modal por tipo, a ficha um modal so com
// filtros de categoria -- e a divergencia era deriva historica, nao
// decisao (ver docs/superpowers/specs/2026-08-13-seletor-itens-unificado-design.md).
//
// REGRA DE DEPENDENCIA: este modulo NAO importa de sheet/ nem de creator/.
// O personagem e os callbacks de persistencia vem por parametro (`ctx`),
// no mesmo padrao de renderEscolhasTalento (levelup-ui.js). Importar
// sheet/estado.js aqui reintroduziria o acoplamento que a extracao
// desfez, e importar store.js impediria o criador de usar uma preferencia
// de sessao em vez do localStorage.
// ============================================================
import { getArmaduras, getArmas, getEquipamentoAventura, getFerramentas, getItensMagicos } from './db.js';
import {
  abrirItemMagico, aplicarSeVigente, criarGuardaRequisicao, htmlListaItensMagicos, renderCategoriaMagicos
} from './itens-magicos-ui.js';
import { filtrarAcervo, nomesReaproveitadosDoEquipamento, termosDaBusca } from './itens-magicos-catalogo.js';
import { ajustarOverlayAoTeclado } from './modal-teclado.js';
import { pagarCusto, parseCusto, podePagarCusto } from './moedas.js';
import { abrirModal, escHtml, inserirNoInicio, mdParaHtml, semAcento, toast } from './utils.js';
import {
  atendeRequisitoForca, badgeProficiencia,
  temProficienciaArma, temProficienciaArmadura
} from './regras-equipamento.js';

/** Cache local dos dados de equipamento */
let _cacheEquipSheet = null;

/** Categorias da loja, na ordem em que a busca em "Todos" as percorre. */
const CATEGORIAS_DA_LOJA = ['armas', 'armaduras', 'consumiveis', 'municao', 'equipamento', 'ferramentas'];
/** Rótulo da categoria de origem mostrado nos resultados da busca em "Todos". */
const ROTULO_CATEGORIA = {
  armas: 'Armas', armaduras: 'Armaduras', consumiveis: 'Consumíveis',
  municao: 'Munição', equipamento: 'Equipamento', ferramentas: 'Ferramentas',
};
/** Máximo de linhas renderizadas por busca em "Todos". */
const LIMITE_RESULTADOS_TODOS = 80;

/**
 * Monta a lista de ferramentas da loja a partir da tabela do livro.
 * Ferramenta comum vira um item; Instrumento Musical e Kit de Jogos (custo
 * "Varia") viram um item por variante, com o custo e o peso dela. A
 * descrição reúne Atributo, Usar Objeto e Fabricação.
 * @param {Array<object>} tabela `ferramentas.json` -> tabelas[0].dados
 * @returns {Array<{nome: string, custo: string, peso: string, descricao: string}>}
 */
export function montarFerramentasLoja(tabela = []) {
  const saida = [];
  for (const f of tabela) {
    const det = f.detalhes || {};
    const descricao = [
      f.Atributo ? `**Atributo:** ${f.Atributo}` : '',
      det.usar_objeto ? `**Usar Objeto:** ${det.usar_objeto}` : '',
      det.fabricacao ? `**Fabricação:** ${det.fabricacao}` : '',
    ].filter(Boolean).join('\n\n');
    if (det.variantes) {
      // "Alaúde (35 PO, 1 kg), Flauta (2 PO, 0,5 kg)" / "Dados (1 PP), Baralho (5 PP)"
      for (const v of det.variantes.split(/\),\s*/)) {
        const m = v.replace(/\)$/, '').match(/^(.+?) \((.+)$/);
        if (!m) continue;
        const [custo, peso] = m[2].split(',').map(x => x.trim());
        saida.push({ nome: `${f.Ferramenta} (${m[1].trim()})`, custo: custo || '', peso: peso || '', descricao });
      }
    } else {
      saida.push({ nome: f.Ferramenta, custo: f.Custo || '', peso: f.Peso || '', descricao });
    }
  }
  return saida;
}

/** Carrega (com cache) armas, armaduras, equipamento de aventura/munição e ferramentas usados pelo seletor e pelo popup de detalhe de item da ficha */
export async function carregarDadosEquipSheet() {
  if (_cacheEquipSheet) return _cacheEquipSheet;
  const [armasData, armadurasData, equipData, ferramentasData] = await Promise.all([
    getArmas(), getArmaduras(), getEquipamentoAventura(), getFerramentas()
  ]);
  // `ferramentas` entrou aqui pela issue #43: o peso das ferramentas
  // ("Ferramentas de Ladrao", 0,5 kg) so existe nesse arquivo, e sem ele o
  // pacote inicial do Ladino resolvia o nome contra nenhuma lista e caia no
  // ramo generico, sem peso. E DADO, nao CATEGORIA: `abrirSeletorItens`
  // (abaixo) continua com as mesmas cinco categorias -- por a ferramenta na
  // loja e outra decisao, fora do escopo da issue.
  const tabelaFerramentas = (ferramentasData?.tabelas || [])
    .find(t => (t.cabecalhos || []).includes('Ferramenta'));
  _cacheEquipSheet = {
    armas: armasData?.armas || [],
    propriedadesArmas: armasData?.propriedades || [],
    armaduras: armadurasData?.armaduras || [],
    equipAvent: equipData?.itens || [],
    municao: (equipData?.municao || []).map(m => ({
      nome: m.tipo,
      custo: m.custo || '',
      peso: m.peso || '',
      descricao: `Quantidade: ${m.quantidade || '—'} | Armazenamento: ${m.armazenamento || '—'}`
    })),
    ferramentas: (tabelaFerramentas?.dados || []).map(f => ({
      nome: f.Ferramenta || '',
      custo: f.Custo || '',
      peso: f.Peso || '',
      atributo: f.Atributo || ''
    })),
    // Issue #120: ferramentas à venda (uma por variante quando o custo varia).
    ferramentasLoja: montarFerramentasLoja(tabelaFerramentas?.dados || []),
    // Variantes nomeadas de "Foco Arcano" e "Foco Druidico". Na tabela
    // principal os dois pesam "Varia" (= 0 kg na balanca); o peso de
    // verdade e por FORMA (Cajado 2 kg, Orbe 1,5 kg...), numa tabela
    // propria dentro da descricao. Sem elas, "Foco Arcano (Cajado)" --
    // citado por escrito na issue #43 -- casava com a entrada generica e
    // continuava pesando zero.
    focos: equipData?.focos || []
  };
  return _cacheEquipSheet;
}

/** Abre o seletor de itens dividido por categorias */
export async function abrirSeletorItens(ctx) {
  const dados = await carregarDadosEquipSheet();

  // Categorias de itens consumíveis / poções do equipamento de aventura
  const ITENS_CONSUMIVEIS = ['Ácido', 'Água Benta', 'Antitoxina', 'Fogo Alquímico', 'Óleo', 'Veneno Básico'];

  const consumiveis = dados.equipAvent.filter(i => ITENS_CONSUMIVEIS.some(c => i.nome.includes(c)));
  const municao = dados.municao || [];
  // Na ficha (`ctx.permitirMagicos`) os registros que o acervo mágico reaproveita
  // via `livro_jogador` (Pergaminho Mágico, issue #103; Poção de Cura) só existem
  // em Itens Mágicos. O criador não tem essa categoria e continua listando tudo.
  // Os registros seguem em equipamento_aventura.json porque a variante do acervo
  // os usa; só a listagem da ficha os esconde. O conjunto de nomes vem do acervo,
  // carregado só quando Equipamento ou Todos é aberto (null = ainda não
  // carregado; vazio = criador ou acervo indisponível, nada é escondido).
  let nomesSoMagicos = ctx.permitirMagicos ? null : new Set();
  /** Guarda os nomes do acervo; acervo ausente deixa o conjunto vazio. */
  const definirNomesSoMagicos = (acervo) => { nomesSoMagicos = nomesReaproveitadosDoEquipamento(acervo?.itens); };
  /** Equipamento de aventura sem consumíveis e sem os registros exclusivos do acervo mágico. */
  const listarOutrosEquip = () => dados.equipAvent.filter(i =>
    !ITENS_CONSUMIVEIS.some(c => i.nome.includes(c)) && !nomesSoMagicos?.has(i.nome)
  );

  const categorias = [
    // "Todos" não lista nada sem busca (evita renderizar o catálogo inteiro);
    // com texto, varre todas as categorias ignorando os filtros delas.
    { id: 'todos', label: 'Todos', icon: '&#128269;' },
    { id: 'armas', label: 'Armas', icon: '&#9876;' },
    { id: 'armaduras', label: 'Armaduras', icon: '&#128737;' },
    { id: 'consumiveis', label: 'Consumiveis', icon: '&#9878;' },
    { id: 'municao', label: 'Municao', icon: '&#10148;' },
    { id: 'equipamento', label: 'Equipamento', icon: '&#128188;' },
    { id: 'ferramentas', label: 'Ferramentas', icon: '&#128295;' }
  ];
  // Itens Mágicos só onde a UI completa de inventário existe (a ficha, via
  // ctx.permitirMagicos); o criador mantém as seis categorias originais.
  if (ctx.permitirMagicos) categorias.push({ id: 'magicos', label: 'Itens Mágicos', icon: '&#10024;' });
  // Filtros de raridade/tipo de Itens Mágicos: valem só nesta abertura do modal.
  const estadoMagicos = { raridade: '', tipo: '' };
  // Token das buscas de Itens Mágicos: respostas atrasadas são ignoradas.
  const guardaBuscaMagicos = criarGuardaRequisicao();

  const html = `
    <div class="search-box"><input type="text" id="busca-inv-cat" placeholder="Buscar item..." class="form-input" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></div>
    <select class="form-input filtro-tipo-compacto faixa-recolhivel" id="sel-inv-cat" aria-label="Categoria">
      ${categorias.map(c => `<option value="${c.id}"${c.id === 'armas' ? ' selected' : ''}>${c.label}</option>`).join('')}
    </select>
    <div id="lista-inv-cat"></div>
  `;

  // Layout próprio do seletor (altura fixa, só a lista rola) e ajuste ao
  // teclado virtual; ambos são desfeitos ao fechar o modal.
  let desligarTeclado = () => {};
  abrirModal('Adicionar Item', html, '', () => {
    document.getElementById('toggle-comprar-item')?.closest('label')?.remove();
    document.getElementById('modal-container')?.classList.remove('seletor-itens');
    desligarTeclado();
  });
  document.getElementById('modal-container')?.classList.add('seletor-itens');
  desligarTeclado = ajustarOverlayAoTeclado(document.getElementById('modal-overlay'));

  let catAtual = 'armas';
  let comprarAtivo = ctx.lerComprarAtivo();

  // Filtro de armas (Todas / Proficientes / Simples / Marcial): existia so no
  // criador antes de 2026-08-13 e foi preservado na unificacao, entao a ficha
  // ganha junto. So aparece na categoria Armas -- nas outras a linha nem e
  // renderizada.
  let filtroArma = 'todas';
  // Filtro de armaduras (Todas / Proficientes / Leve / Media / Pesada):
  // mesmo caso do filtro de armas acima -- existia em mostrarSeletorArmadura
  // (seletor proprio do criador, apagado na Task 5) e precisava sobreviver a
  // unificacao (correcao da rodada 1 de revisao da Task 5). Variavel
  // PROPRIA, separada de filtroArma -- sem isso, escolher "Marcial" em Armas
  // e trocar para Armaduras deixaria um filtro sem sentido nenhum ativo.
  let filtroArmadura = 'todas';

  const headerFechar = document.querySelector('#modal-header .modal-fechar');
  if (headerFechar) {
    headerFechar.insertAdjacentHTML('beforebegin', `
      <label class="form-check" style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:400;white-space:nowrap;cursor:pointer;margin-left:auto">
        <input type="checkbox" id="toggle-comprar-item" ${comprarAtivo ? 'checked' : ''}>
        💰 Comprar
      </label>
    `);
    document.getElementById('toggle-comprar-item')?.addEventListener('change', (e) => {
      comprarAtivo = e.target.checked;
      ctx.salvarComprarAtivo(comprarAtivo);
    });
  }

  /**
   * Renderiza a lista de itens da categoria escolhida em #lista-inv-cat,
   * aplicando o filtro de busca, e liga o clique de cada item ao popup de
   * detalhe/confirmação.
   * @param {string} cat id da categoria ('todos' inclusive)
   * @param {string} filtroTexto busca já normalizada por semAcento
   * @param {Array<object>} [magicosTodos] só para 'todos': itens do acervo que casam a busca (undefined = ainda não carregados)
   */
  function renderCategoria(cat, filtroTexto, magicosTodos) {
    const listaEl = document.getElementById('lista-inv-cat');
    if (!listaEl) return;

    // Itens mágicos do acervo do Livro do Mestre: lista e modal próprios
    // (itens-magicos-ui.js), sem compra e com variante/base.
    if (cat === 'magicos') {
      // "Carregando…" só quando a lista de itens mágicos ainda não está na
      // tela; ao digitar, a lista anterior fica até chegar o novo resultado.
      if (!listaEl.querySelector('#filtro-tipo-magico')) {
        listaEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px">Carregando…</div>';
      }
      const avisoErro = () => {
        if (catAtual === 'magicos') listaEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px">Não foi possível carregar os itens mágicos</div>';
      };
      aplicarSeVigente(guardaBuscaMagicos, getItensMagicos(), acervo => {
        if (catAtual !== 'magicos') return;
        if (!acervo?.itens) { avisoErro(); return; }
        renderCategoriaMagicos(listaEl, {
          texto: filtroTexto, acervo: acervo.itens, estado: estadoMagicos,
          catalogos: { armas: dados.armas, armaduras: dados.armaduras },
          equipamentoPHB: dados.equipAvent, personagem: ctx.personagem, aoAdicionar: ctx.aoAdicionar,
        });
      }, avisoErro);
      return;
    }
    // Equipamento na ficha: espera os nomes do acervo para esconder os registros exclusivos de Itens Mágicos.
    if (cat === 'equipamento' && nomesSoMagicos === null) {
      listaEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px">Carregando…</div>';
      aplicarSeVigente(guardaBuscaMagicos, getItensMagicos(), acervo => {
        definirNomesSoMagicos(acervo);
        if (catAtual === 'equipamento') renderCategoria('equipamento', filtroTexto);
      }, () => {
        definirNomesSoMagicos(null);
        if (catAtual === 'equipamento') renderCategoria('equipamento', filtroTexto);
      });
      return;
    }
    // Todos sem texto: não lista nada, o catálogo inteiro não é renderizado.
    if (cat === 'todos' && !filtroTexto) {
      guardaBuscaMagicos.nova();
      listaEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px">Digite para buscar em todos os itens</div>';
      return;
    }
    // Todos com texto, na ficha: o acervo de itens mágicos entra na busca e
    // chega de forma assíncrona; a lista só renderiza quando ele chega (ou falha).
    if (cat === 'todos' && ctx.permitirMagicos && magicosTodos === undefined) {
      aplicarSeVigente(guardaBuscaMagicos, getItensMagicos(), acervo => {
        definirNomesSoMagicos(acervo);
        if (catAtual !== 'todos') return;
        renderCategoria('todos', filtroTexto, acervo?.itens ? filtrarAcervo(acervo.itens, { texto: filtroTexto }) : []);
      }, () => {
        definirNomesSoMagicos(null);
        if (catAtual === 'todos') renderCategoria('todos', filtroTexto, []);
      });
      return;
    }
    // Outra categoria invalida qualquer busca de itens mágicos ainda em andamento.
    guardaBuscaMagicos.nova();

    // "Todos" percorre as categorias da loja e ignora os filtros de arma e
    // armadura; as demais categorias renderizam só a própria.
    const ehTodos = cat === 'todos';
    const fArma = ehTodos ? 'todas' : filtroArma;
    const fArmadura = ehTodos ? 'todas' : filtroArmadura;
    const acumulado = [];
    let itens = [];
    for (const catItem of (ehTodos ? CATEGORIAS_DA_LOJA : [cat])) {
      itens = [];
      switch (catItem) {
        case 'armas':
          itens = dados.armas.map(a => {
            const prof = temProficienciaArma(ctx.personagem, a);
            // Verificar se o personagem tem maestria com esta arma
            const temMaestriaArma = (ctx.personagem.maestrias_arma || []).includes(a.nome);
            const maestriaBadgeAdd = temMaestriaArma && a.maestria
              ? `<span class="badge" style="font-size:0.6rem;background:#fff8e1;color:#e65100;border:1px solid #ffcc80;font-weight:700">Maestria: ${a.maestria}</span>`
              : '';
            return {
              nome: a.nome,
              detalhe: `${a.dano} | ${a.propriedades || '\u2014'}`,
              detalhe2: `Maestria: ${a.maestria || '\u2014'} | ${a.custo} | ${a.peso || '\u2014'}`,
              badge: badgeProficiencia(prof) + (maestriaBadgeAdd ? ' ' + maestriaBadgeAdd : ''),
              badgeCat: `<span class="badge badge-secondary">${a.categoria?.includes('Dist') ? 'Dist\u00e2ncia' : 'Corpo'}</span>`,
              prof,
              dados: a,
              tipo: 'arma'
            };
          });
          // Proficientes primeiro
          itens.sort((a, b) => (a.prof ? 0 : 1) - (b.prof ? 0 : 1));
          if (fArma === 'proficiente') itens = itens.filter(i => i.prof);
          else if (fArma === 'simples') itens = itens.filter(i => (i.dados.categoria || '').includes('Simples'));
          else if (fArma === 'marcial') itens = itens.filter(i => (i.dados.categoria || '').includes('Marciai'));
          break;
        case 'armaduras':
          itens = dados.armaduras.map(a => {
            const prof = temProficienciaArmadura(ctx.personagem, a);
            const extras = [];
            if (a.requisito_forca && a.requisito_forca !== '\u2014') extras.push(`For: ${a.requisito_forca}`);
            if (a.furtividade && a.furtividade !== '\u2014') extras.push(`Furt.: ${a.furtividade}`);
            const reqOk = atendeRequisitoForca(ctx.personagem, a);
            const avisoForca = reqOk ? '' : ' <span class="badge badge-warn">For. insuficiente</span>';
            return {
              nome: a.nome,
              detalhe: `CA: ${a.ca}${extras.length ? ' | ' + extras.join(' | ') : ''}`,
              detalhe2: `${a.custo} | ${a.peso || '\u2014'}`,
              badge: badgeProficiencia(prof) + avisoForca,
              badgeCat: `<span class="badge badge-secondary">${a.categoria}</span>`,
              prof,
              dados: a,
              tipo: a.nome === 'Escudo' ? 'escudo' : 'armadura'
            };
          });
          itens.sort((a, b) => (a.prof ? 0 : 1) - (b.prof ? 0 : 1));
          if (fArmadura === 'proficiente') itens = itens.filter(i => i.prof);
          else if (fArmadura === 'leve') itens = itens.filter(i => semAcento(i.dados.categoria || '').toLowerCase() === 'leve');
          else if (fArmadura === 'media') itens = itens.filter(i => semAcento(i.dados.categoria || '').toLowerCase() === 'media');
          else if (fArmadura === 'pesada') itens = itens.filter(i => semAcento(i.dados.categoria || '').toLowerCase() === 'pesada');
          // Escudo (categoria "Escudo" no JSON) nao bate com leve/media/pesada
          // -- os tres filtros de peso o excluem sozinhos, sem caso especial.
          // Ele so aparece em "todas" e "proficiente" (se o personagem tiver
          // proficiencia em escudos), que e o comportamento razoavel.
          break;
        case 'consumiveis':
          itens = consumiveis.map(i => ({
            nome: i.nome,
            detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
            detalhe2: i.descricao ? (i.descricao.length > 80 ? i.descricao.substring(0, 80) + '…' : i.descricao) : '',
            badge: '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32">Consumível</span>',
            badgeCat: '',
            dados: i,
            tipo: 'equipamento'
          }));
          break;
        case 'municao':
          itens = municao.map(i => ({
            nome: i.nome,
            detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
            badge: '', badgeCat: '',
            dados: i,
            tipo: 'equipamento'
          }));
          break;
        case 'equipamento':
          itens = listarOutrosEquip().map(i => ({
            nome: i.nome,
            detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
            badge: '', badgeCat: '',
            dados: i,
            tipo: 'equipamento'
          }));
          break;
        case 'ferramentas':
          itens = (dados.ferramentasLoja || []).map(i => ({
            nome: i.nome,
            detalhe: `${i.custo || '—'} | ${i.peso || '—'}`,
            badge: '<span class="badge" style="font-size:0.6rem;background:#e3f2fd;color:#1565c0">Ferramenta</span>',
            badgeCat: '',
            dados: i,
            tipo: 'equipamento'
          }));
          break;
      }
      // Na busca em Todos cada item leva o nome da categoria de origem.
      acumulado.push(...itens.map(i => (ehTodos ? { ...i, catRotulo: ROTULO_CATEGORIA[catItem] } : i)));
    }
    itens = acumulado;

    // Filtrar por texto: nome + os dois campos de detalhe (dano/propriedades/
    // maestria/custo/peso, conforme a categoria) + o badge de categoria
    // (badgeCat, ex.: "Distância"/"Corpo" nas armas, "Leve"/"Média"/"Pesada"
    // nas armaduras). Ate 2026-08-14 so casava nome+detalhe+detalhe2 -- os
    // seletores antigos do criador (mostrarSeletorArma/Armadura/Item,
    // apagados na Task 5) filtravam o card inteiro por `el.textContent`,
    // entao a paridade de busca so foi restaurada de verdade com o badge
    // incluso: buscar "distancia" ou "corpo" numa arma devolvia vazio antes
    // desta correcao (achado MENOR (a) da revisao final de branch). badgeCat
    // e HTML cru (`<span ...>Distância</span>`), mas semAcento so normaliza
    // acento/caixa -- o texto visivel continua substring do HTML, entao o
    // match funciona sem precisar extrair o texto das tags. semAcento nos
    // dois lados, como no resto do arquivo.
    if (filtroTexto) {
      // Palavras em qualquer ordem, sem "de/da/do" (mesmo critério dos itens mágicos).
      const termos = termosDaBusca(filtroTexto);
      itens = itens.filter(i => {
        const alvo = semAcento([i.nome, i.detalhe, i.detalhe2, i.badgeCat].filter(Boolean).join(' '));
        return termos.every(t => alvo.includes(t));
      });
    }

    // Linha de filtro: por peso/proficiencia em Armas, por
    // categoria/proficiencia em Armaduras (correcao da rodada 1 de revisao
    // da Task 5 -- mostrarSeletorArmadura, apagado do criador, tinha essa
    // linha e a unificacao original perdeu a capacidade). Nas demais
    // categorias, nenhuma linha, como antes.
    const filtrosLinhaHtml = cat === 'armas' ? `
      <div class="faixa-chips faixa-recolhivel">
        ${[['todas', 'Todas'], ['proficiente', 'Proficientes'], ['simples', 'Simples'], ['marcial', 'Marcial']]
          .map(([id, rotulo]) => `
            <button class="btn btn-sm btn-outline filtro-arma ${filtroArma === id ? 'active' : ''}" data-filtro-arma="${id}">${rotulo}</button>
          `).join('')}
      </div>` : cat === 'armaduras' ? `
      <div class="faixa-chips faixa-recolhivel">
        ${[['todas', 'Todas'], ['proficiente', 'Proficientes'], ['leve', 'Leve'], ['media', 'Média'], ['pesada', 'Pesada']]
          .map(([id, rotulo]) => `
            <button class="btn btn-sm btn-outline filtro-armadura ${filtroArmadura === id ? 'active' : ''}" data-filtro-armadura="${id}">${rotulo}</button>
          `).join('')}
      </div>` : '';

    // Em Todos a lista é limitada (itens da loja primeiro, depois mágicos):
    // uma busca curta casa centenas de itens e travaria o celular.
    const magicosEncontrados = ehTodos ? (magicosTodos || []) : [];
    const totalEncontrado = itens.length + magicosEncontrados.length;
    const magicosVisiveis = [];
    if (ehTodos) {
      itens = itens.slice(0, LIMITE_RESULTADOS_TODOS);
      magicosVisiveis.push(...magicosEncontrados.slice(0, LIMITE_RESULTADOS_TODOS - itens.length));
    }
    const avisoLimite = ehTodos && totalEncontrado > LIMITE_RESULTADOS_TODOS
      ? `<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.8rem">Mostrando ${LIMITE_RESULTADOS_TODOS} de ${totalEncontrado} resultados — refine a busca para ver os demais.</div>`
      : '';

    listaEl.innerHTML = filtrosLinhaHtml + (itens.length === 0 && magicosVisiveis.length === 0
      ? '<div style="color:var(--text-muted);text-align:center;padding:16px">Nenhum item encontrado</div>'
      : itens.map((it, i) => `
        <div class="inv-item ${it.prof === false ? 'item-sem-prof' : ''}" style="cursor:pointer" data-add-cat="${i}">
          <div style="flex:1">
            <div class="inv-item-nome">${escHtml(it.nome)} ${it.badge}${it.catRotulo ? ` <span style="font-size:0.65rem;font-weight:400;color:var(--text-muted)">${it.catRotulo}</span>` : ''}</div>
            <div class="inv-item-detalhe">${it.detalhe}</div>
            ${it.detalhe2 ? `<div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">${it.detalhe2}</div>` : ''}
          </div>
          ${it.badgeCat || ''}
        </div>
      `).join('') + htmlListaItensMagicos(magicosVisiveis, filtroTexto) + avisoLimite);

    // Itens mágicos da busca em Todos: mesmo modal de detalhe da categoria Itens Mágicos.
    listaEl.querySelectorAll('[data-item-magico]').forEach(el => el.addEventListener('click', () => {
      abrirItemMagico(magicosVisiveis[parseInt(el.dataset.itemMagico)], {
        catalogos: { armas: dados.armas, armaduras: dados.armaduras },
        equipamentoPHB: dados.equipAvent, personagem: ctx.personagem, aoAdicionar: ctx.aoAdicionar,
      });
    }));

    // Religar os cliques dos filtros de arma/armadura: a lista e remontada a
    // cada render, entao os listeners precisam ser refeitos junto. Atributos
    // DIFERENTES (data-filtro-arma vs data-filtro-armadura) de proposito:
    // `[data-filtro-arma]` precisa continuar contando 0 fora da categoria
    // Armas (itens-seletor-ficha.spec.mjs ja prova isso), e um unico
    // atributo compartilhado quebraria essa garantia.
    listaEl.querySelectorAll('[data-filtro-arma]').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroArma = btn.dataset.filtroArma;
        renderCategoria(cat, filtroTexto);
      });
    });
    listaEl.querySelectorAll('[data-filtro-armadura]').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroArmadura = btn.dataset.filtroArmadura;
        renderCategoria(cat, filtroTexto);
      });
    });

    // Eventos de seleção - mostrar descrição antes de adicionar
    listaEl.querySelectorAll('[data-add-cat]').forEach(el => {
      el.addEventListener('click', () => {
        const item = itens[parseInt(el.dataset.addCat)];
        if (!item) return;

        // Construir descrição completa do item
        let descCorpo = '';
        const d = item.dados || {};
        if (typeof ctx.htmlDetalhe === 'function') {
          // Detalhe completo injetado pela ficha (itens-seletor não importa de sheet/).
          descCorpo = ctx.htmlDetalhe({ ...item, quantidade: 1, equipado: false }, dados.propriedadesArmas || []);
        } else if (item.tipo === 'arma') {
          descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
          if (d.categoria) descCorpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
          if (d.dano) descCorpo += `<strong>Dano:</strong> ${d.dano}<br>`;
          if (d.maestria) descCorpo += `<strong>Maestria:</strong> ${d.maestria}<br>`;
          if (d.propriedades) descCorpo += `<strong>Propriedades:</strong> ${d.propriedades}<br>`;
          if (d.custo || d.peso) descCorpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
          descCorpo += `</div>`;
        } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
          descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
          if (d.categoria) descCorpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
          if (d.ca) descCorpo += `<strong>CA:</strong> ${d.ca}<br>`;
          if (d.custo || d.peso) descCorpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
          descCorpo += `</div>`;
        } else {
          if (d.custo || d.peso) descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
          if (d.descricao) descCorpo += `<div class="md-content" style="font-size:0.85rem">${mdParaHtml(d.descricao)}</div>`;
        }
        if (!descCorpo.trim()) descCorpo = '<div style="color:var(--text-muted)">Sem descrição disponível.</div>';

        const custoItemStr = item.dados?.custo || '';
        const custoParseado = comprarAtivo ? parseCusto(custoItemStr) : null;
        const labelBtnConfirmar = comprarAtivo ? 'Comprar e adicionar ao inventário' : 'Adicionar ao Inventário';
        let quantidadeSelecionada = 1;

        abrirModal(item.nome,
          descCorpo,
          `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
           <button class="btn btn-primary" id="btn-confirmar-add-item">${labelBtnConfirmar}</button>`
        );

        const subOverlays = document.querySelectorAll('.sub-modal-overlay');
        const subHeaderFechar = subOverlays[subOverlays.length - 1]?.querySelector('.modal-header .modal-fechar');

        if (subHeaderFechar) {
          subHeaderFechar.insertAdjacentHTML('beforebegin', `
            <div style="display:flex;align-items:center;gap:4px;margin-left:auto">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-qtd-item-menos" disabled style="width:26px;height:26px;padding:0;line-height:1;font-weight:700">−</button>
              <span id="valor-qtd-item" style="min-width:18px;text-align:center;font-weight:700;font-size:0.85rem">1</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-qtd-item-mais" style="width:26px;height:26px;padding:0;line-height:1;font-weight:700">+</button>
            </div>
          `);

          if (comprarAtivo) {
            subHeaderFechar.insertAdjacentHTML('beforebegin', `
              <span id="badge-custo-item" style="font-weight:700;font-size:0.85rem;color:var(--primary);white-space:nowrap"></span>
            `);
          }

          // Atualiza o número exibido, o estado do botão "-" e o badge de custo (se "Comprar" estiver ativo) conforme a quantidade selecionada muda
          const atualizarUiQtd = () => {
            const valorEl = document.getElementById('valor-qtd-item');
            if (valorEl) valorEl.textContent = quantidadeSelecionada;
            const menosEl = document.getElementById('btn-qtd-item-menos');
            if (menosEl) menosEl.disabled = quantidadeSelecionada <= 1;
            const badgeEl = document.getElementById('badge-custo-item');
            if (badgeEl) {
              badgeEl.textContent = custoParseado
                ? `💰 ${custoParseado.qtd * quantidadeSelecionada} ${custoParseado.tipo.toUpperCase()}`
                : (custoItemStr ? `💰 ${custoItemStr}` : '💰 Custo indefinido');
            }
          };
          atualizarUiQtd();

          document.getElementById('btn-qtd-item-menos')?.addEventListener('click', () => {
            if (quantidadeSelecionada > 1) {
              quantidadeSelecionada--;
              atualizarUiQtd();
            }
          });
          document.getElementById('btn-qtd-item-mais')?.addEventListener('click', () => {
            quantidadeSelecionada++;
            atualizarUiQtd();
          });
        }

        document.getElementById('btn-confirmar-add-item')?.addEventListener('click', (e) => {
          e.target.disabled = true;
          let sufixoToast = '';
          const prefixoQtd = quantidadeSelecionada > 1 ? `${quantidadeSelecionada}x ` : '';

          if (comprarAtivo) {
            if (!custoParseado) {
              sufixoToast = ' (custo indeterminado, sem cobrança)';
            } else {
              const custoTotalStr = `${custoParseado.qtd * quantidadeSelecionada} ${custoParseado.tipo.toUpperCase()}`;
              if (!podePagarCusto(ctx.personagem.moedas, custoTotalStr)) {
                toast(`Saldo insuficiente para comprar ${prefixoQtd}${item.nome}!`, 'error');
                e.target.disabled = false;
                return;
              }
              const resultadoPagamento = pagarCusto(ctx.personagem.moedas, custoTotalStr);
              ctx.personagem.moedas = resultadoPagamento.moedas;
              sufixoToast = ` por ${custoTotalStr}`;
            }
          }

          const novoItem = {
            nome: item.nome,
            tipo: item.tipo,
            quantidade: quantidadeSelecionada,
            equipado: false,
            // Restaurado o texto que os seletores antigos do criador
            // gravavam (correcao da rodada 1 de revisao da Task 5): arma com
            // dano + propriedades, e ARMADURA OU ESCUDO com CA -- o criador
            // tratava escudo junto de armadura (mostrarSeletorArmadura
            // atendia os dois), e a versao unificada tinha esquecido o
            // escudo, deixando a descricao vazia para ele.
            descricao: item.tipo === 'arma' ? `${item.dados.dano} - ${item.dados.propriedades || ''}`
              : (item.tipo === 'armadura' || item.tipo === 'escudo') ? `CA: ${item.dados.ca}`
              : '',
            dados: { ...item.dados }
          };

          // Verificar se já existe no inventário (agrupar)
          const existente = ctx.personagem.inventario.find(inv => inv.nome === item.nome && inv.tipo === item.tipo);
          if (existente && ['equipamento', 'generico'].includes(item.tipo)) {
            existente.quantidade = (existente.quantidade || 1) + quantidadeSelecionada;
          } else {
            inserirNoInicio(ctx.personagem.inventario, novoItem);
          }

          window.fecharModal();
          ctx.aoAdicionar();
          toast(`${prefixoQtd}${item.nome} adicionado${sufixoToast}!`, 'success');
        });
      });
    });
  }

  // Renderizar categoria inicial
  renderCategoria(catAtual, '');

  // Eventos de troca de categoria
  document.getElementById('sel-inv-cat')?.addEventListener('change', (e) => {
    catAtual = e.target.value;
    const termo = semAcento(document.getElementById('busca-inv-cat')?.value || '');
    renderCategoria(catAtual, termo);
  });

  // Busca por texto
  document.getElementById('busca-inv-cat')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    renderCategoria(catAtual, termo);
  });
  // Enter ("Buscar" no teclado do celular) fecha o teclado e devolve as faixas de chips.
  document.getElementById('busca-inv-cat')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
}
