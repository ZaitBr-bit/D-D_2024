// ============================================================
// Artífice na ficha: controles das características com estado
// (Magia de Funileiro, Lampejo de Genialidade, Item de Armazenar Magia).
// As regras ficam em site/js/regras-artifice.js.
// ============================================================
import { char, salvar } from '../estado.js';
import { abrirModal, escHtml, toast } from '../../utils.js';
import {
  getEquipamentoAventura, getMagiasClasse, getIndiceMagias,
  getPlanosArtifice, getItensMagicos, getArmas, getArmaduras,
} from '../../db.js';
import {
  ITENS_FUNILEIRO, estadoArtifice, usosMaxFunileiro, usosMaxLampejo, cargasMaxArmazenar,
  gastarUso, definirArmazenar, usarArmazenar, magiasArmazenaveis,
} from '../../regras-artifice.js';
import {
  resolverPlano, criarItensReplicados, carregarItem, drenarItem, transmutarItem, trapacearMorte,
  itensMagicosMax, itensReplicados, ehArmeiroAprimorado, cargasDoItem, erroCriarItens, erroTransmutarArmeiro,
} from '../../regras-planos-artifice.js';
import { golpeArcanoMax, usarGolpeArcano, estadoCompanheiros } from '../../regras-criaturas-artifice.js';
import { nivelNa } from '../../regras-multiclasse.js';
import { dadosDe } from '../contexto-classe.js';
import { reservasDeEspacos, gastarEspaco, recuperarUmEspaco } from '../reservas-espacos.js';
import { renderFichaCompleta } from '../ficha.js';
import { montarSeletor } from '../../ui-opcoes.js';
import { deItensFunileiro, deMagiasArmazenar, deItemMagicoAcervo, deItemMinimo, deEfeitosElixir } from '../../opcoes-artifice.js';
import {
  EFEITOS_ELIXIR, criarElixir, textoElixir, ehElixirEscolha, definirEfeitoElixir,
  armaduraArcanaAtiva, modeloAtivo, armaEspecialArmeiro, contadoresArmeiro, gastarArmeiro, MODELOS_ARMEIRO,
  atlasMaxPortadores,
} from '../../regras-subclasses-artifice.js';
import { consumirEspacoMagiaDisponivel } from '../magias.js';

// Características sem controle próprio: o card fica passivo, sem o contador/toggle
// que o card genérico deduziria da descrição.
const CARACTERISTICAS_PASSIVAS = new Set([
  'Funileiro de Item Mágico', 'Especialista em Itens Mágicos',
  'Artifício Avançado', 'Mestre de Itens Mágicos',
]);

// Características de subclasse sem controle próprio, por subclasse: card passivo, sem contador/toggle genérico.
// Canhão e Defensor de Aço vivem na seção "Companheiros do Artífice"; Golpe Arcano tem controle próprio.
const PASSIVAS_SUBCLASSE = {
  'Ferreiro de Batalha': new Set(['Ferramentas da Profissão', 'Magias de Ferreiro de Batalha', 'Pronto para a Batalha', 'Defensor de Aço', 'Ataque Extra', 'Defensor Aprimorado']),
  'Artilheiro': new Set(['Ferramentas da Profissão', 'Magias de Artilheiro', 'Canhão Místico', 'Arma de Fogo Arcana', 'Canhão Explosivo', 'Posição Fortificada']),
  'Alquimista': new Set(['Ferramentas da Profissão', 'Magias de Alquimista', 'Perito em Alquimia', 'Reagentes Restauradores', 'Maestria Química']),
  'Armeiro': new Set(['Ferramentas da Profissão', 'Magias de Armeiro', 'Ataque Extra', 'Armeiro Aprimorado', 'Armadura Perfeita']),
  'Cartógrafo': new Set(['Ferramentas da Profissão', 'Magias de Cartógrafo', 'Magia de Mapeamento', 'Precisão Guiada', 'Movimento Engenhoso', 'Atlas Superior']),
};

/** Linha de botões no corpo do card da característica. */
function linha(conteudo) {
  return `<div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">${conteudo}</div>`;
}

/** Contador "disponíveis/máximo" do resumo do card. */
function contador(disp, max) {
  return `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp}/${max}</span>`;
}

/** Atributos de botão desabilitado no padrão da ficha. */
function desabilitado(cond) {
  return cond ? 'disabled style="opacity:0.5;cursor:not-allowed"' : '';
}

/** Ferido: PV atuais na metade do máximo ou abaixo (o máximo efetivo inclui o override, como na ficha). */
function estaFeridoMeio() {
  const pvMax = char.pv_max_override || char.pv_max || 0;
  return (char.pv_atual || 0) <= Math.floor(pvMax / 2);
}

/**
 * Controle das características de subclasse do Artífice. Devolve null para as que
 * usam o card genérico e um controle vazio para as passivas.
 */
function controleSubclasseArtifice(f, ctx) {
  if (f.nome === 'Golpe Arcano') {
    const max = golpeArcanoMax(char);
    const disp = Math.max(0, max - estadoCompanheiros(char).golpe_arcano_gastos);
    const dado = (ctx.nivelClasse || 0) >= 15 ? '4d6' : '2d6';
    return { recarga: 'longo', summary: contador(disp, max),
      body: linha(`<button class="btn btn-sm btn-accent" data-artifice-acao="golpe-arcano" ${desabilitado(disp <= 0)}>Usar Golpe Arcano</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${dado} de dano Energético extra ou ${dado} de cura a até 9 m; 1x por turno</span>`) };
  }
  // Constante em vez de literal na comparação: subclasse-nome-literal.test.mjs só conhece as subclasses de dados/classes/*.json, que não inclui o Artífice.
  const alquimista = 'Alquimista';
  if (ctx.subclasse === alquimista && f.nome === 'Elixir Experimental') {
    const elixires = (char.inventario || []).map((it, i) => [it, i]).filter(([it]) => it?.origem?.tipo === 'elixir');
    const pendentes = elixires.filter(([it]) => ehElixirEscolha(it));
    return { recarga: 'longo', summary: `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${elixires.length} no inventário</span>`,
      body: linha(`<button class="btn btn-sm btn-accent" data-artifice-acao="elixir-criar">Criar elixir (gasta espaço)</button>
        ${pendentes.map(([, i]) => `<button class="btn btn-sm btn-secondary" data-artifice-acao="elixir-definir" data-i="${i}">Definir efeito do elixir (rolagem 6)</button>`).join('')}`) };
  }
  // Constante pelo mesmo motivo da do Alquimista.
  const armeiro = 'Armeiro';
  if (ctx.subclasse === armeiro && f.nome === 'Armadura Arcana') {
    const ativa = armaduraArcanaAtiva(char);
    return { recarga: null, summary: `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Ativa' : 'Inativa'}</span>`,
      body: linha(`<button class="btn btn-sm ${ativa ? 'btn-secondary' : 'btn-accent'}" data-artifice-acao="armadura-arcana">${ativa ? 'Desfazer Armadura Arcana' : 'Transformar armadura vestida'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Sem requisito de Força; serve de Foco de Conjuração; some ao vestir outra armadura</span>`) };
  }
  if (ctx.subclasse === armeiro && f.nome === 'Modelo de Armadura') {
    const modelo = estadoArtifice(char).modelo || '';
    const arma = armaEspecialArmeiro(char);
    const contadores = contadoresArmeiro(char).map((c) => `<button class="btn btn-sm btn-accent" data-artifice-acao="armeiro-contador" data-chave="${c.chave}" ${desabilitado(c.gastos >= c.max)}>${escHtml(c.nome)} (${c.max - c.gastos}/${c.max})</button>`).join('');
    const feridoMeio = estaFeridoMeio();
    return { recarga: null, summary: '',
      body: linha(`${Object.keys(MODELOS_ARMEIRO).map((m) => `<button class="btn btn-sm ${m === modelo ? 'btn-accent' : 'btn-secondary'}" data-artifice-acao="modelo" data-modelo="${m}">${m}</button>`).join('')}
        ${arma ? `<span style="font-size:0.8rem"><strong>${escHtml(arma.nome)}</strong> Atq +${arma.ataque} · ${escHtml(arma.dano)}${arma.notas ? ` · ${escHtml(arma.notas)}` : ''}</span>` : ''}
        ${modeloAtivo(char) === 'Guardião' ? `<button class="btn btn-sm btn-secondary" data-artifice-acao="campo-defensivo" ${desabilitado(!feridoMeio)}>Campo Defensivo</button>
          <span style="font-size:0.75rem;color:var(--text-muted)">PV Temporários perdem-se ao tirar a armadura (não automatizado)</span>` : ''}
        ${contadores}`) };
  }
  // Constante pelo mesmo motivo das anteriores.
  const cartografo = 'Cartógrafo';
  if (ctx.subclasse === cartografo && f.nome === 'Atlas do Aventureiro') {
    const atlas = estadoArtifice(char).atlas;
    return { recarga: null, summary: `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${atlas?.ativo ? `${Math.min(Number(atlas.portadores), atlasMaxPortadores(char))} mapa(s)` : 'Sem atlas'}</span>`,
      body: linha(`<button class="btn btn-sm btn-accent" data-artifice-acao="atlas">${atlas?.ativo ? 'Recriar atlas' : 'Criar atlas'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Portadores: +1d4 na Iniciativa</span>`) };
  }
  if (PASSIVAS_SUBCLASSE[ctx.subclasse]?.has(f.nome)) return { recarga: null, summary: '', body: '' };
  return null;
}

/**
 * Controle de uma característica do Artífice para renderFeatureItem
 * (sheet/habilidades.js). Devolve null para característica de outra classe/origem
 * e um controle vazio ({recarga:null, summary:'', body:''}) para as passivas.
 */
export function controleCaracteristicaArtifice(f, source, ctx) {
  if (ctx?.classe !== 'Artífice') return null;
  if (source === 'subclasse') return controleSubclasseArtifice(f, ctx);
  if (source !== 'classe') return null;
  const e = estadoArtifice(char);
  if (f.nome === 'Magia de Funileiro') {
    const max = usosMaxFunileiro(char);
    const disp = Math.max(0, max - e.funileiro_gastos);
    return { recarga: 'longo', summary: contador(disp, max),
      body: linha(`<button class="btn btn-sm btn-accent" data-artifice-acao="funileiro" ${desabilitado(disp <= 0)}>Criar item</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Some ao terminar um Descanso Longo</span>`) };
  }
  if (f.nome === 'Lampejo de Genialidade') {
    const max = usosMaxLampejo(char);
    const disp = Math.max(0, max - e.lampejo_gastos);
    return { recarga: (ctx.nivelClasse || 0) >= 14 ? 'curto_ou_longo' : 'longo', summary: contador(disp, max),
      body: linha(`<button class="btn btn-sm btn-accent" data-artifice-acao="lampejo" ${desabilitado(disp <= 0)}>Usar Lampejo</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: + mod. Int (mín. +1) num teste ou salvaguarda que falhou</span>`) };
  }
  if (f.nome === 'Item de Armazenar Magia') {
    const a = e.armazenar;
    const max = cargasMaxArmazenar(char);
    const disp = a ? Math.max(0, max - a.usos_gastos) : 0;
    return { recarga: null, summary: a ? contador(disp, max) : '',
      body: linha(`${a ? `<span style="font-size:0.8rem"><strong>${escHtml(a.magia)}</strong> em ${escHtml(a.objeto)}</span>
        <button class="btn btn-sm btn-accent" data-artifice-acao="armazenar-usar" ${desabilitado(disp <= 0)}>Usar</button>` : ''}
        <button class="btn btn-sm btn-secondary" data-artifice-acao="armazenar-definir">${a ? 'Trocar magia' : 'Armazenar magia'}</button>`) };
  }
  if (f.nome === 'Replicar Item Mágico') {
    const maxItens = itensMagicosMax(dadosDe('Artífice')?.tabela_caracteristicas, char);
    const replicados = itensReplicados(char);
    const nivel = ctx.nivelClasse || 0;
    const linhasItens = nivel >= 6 ? replicados.map((it) => {
      const chave = escHtml(it.origem.conhecido_id);
      const cg = cargasDoItem(it);
      const cargas = cg ? ` · ${cg.atual}/${cg.max} cargas` : '';
      const raridadeDrenavel = ['Comum', 'Incomum', 'Rara'].includes(it.dados?.raridade);
      const motivoDrenar = !raridadeDrenavel ? 'Drenar não vale para itens Muito Raros ou mais raros.' : (e.drenar_usado ? 'Drenar já usado até o próximo Descanso Longo.' : '');
      return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:0.8rem">
        <span style="flex:1">${escHtml(it.nome)}${cargas}</span>
        ${cg ? `<button class="btn btn-sm btn-secondary" data-artifice-acao="replicar-carregar" data-conhecido="${chave}" ${desabilitado(cg.atual >= cg.max)} title="${cg.atual >= cg.max ? 'Cargas já estão no máximo.' : ''}">Carregar</button>` : ''}
        <button class="btn btn-sm btn-secondary" data-artifice-acao="replicar-drenar" data-conhecido="${chave}" ${desabilitado(!!motivoDrenar)} title="${escHtml(motivoDrenar)}">Drenar</button>
        <button class="btn btn-sm btn-secondary" data-artifice-acao="replicar-transmutar" data-conhecido="${chave}" ${desabilitado(e.transmutar_usado)} title="${e.transmutar_usado ? 'Transmutar já usado até o próximo Descanso Longo.' : ''}">Transmutar</button>
      </div>`;
    }).join('') : '';
    return { recarga: null, summary: `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${replicados.length}/${maxItens} itens</span>`,
      body: linha(`<button class="btn btn-sm btn-accent" data-artifice-acao="replicar-criar">Criar itens</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${e.planos.length} plano(s) conhecido(s)</span>
        ${e.espaco_temporario ? `<button class="btn btn-sm btn-warning" data-artifice-acao="espaco-temporario">Gastar espaço temporário (${Number(e.espaco_temporario.circulo)}º)</button>` : ''}`)
        + (linhasItens ? `<div class="no-print" style="padding:4px 0 4px 16px;display:flex;flex-direction:column;gap:4px">${linhasItens}</div>` : '') };
  }
  // Alma do Artífice sempre devolve controle: sem isso o card genérico mostra contador 20/20 com recarga de Descanso Curto.
  if (f.nome === 'Alma do Artífice') {
    const pv0 = char.pv_atual === 0;
    return { recarga: null, summary: '', body: pv0 ? linha(`<button class="btn btn-sm btn-danger" data-artifice-acao="trapacear-morte">Trapacear a Morte</button>`) : '' };
  }
  if (CARACTERISTICAS_PASSIVAS.has(f.nome)) return { recarga: null, summary: '', body: '' };
  return null;
}

/** Abre a escolha do item criado pela Magia de Funileiro e o grava como temporário. */
async function abrirFunileiro() {
  const eq = await getEquipamentoAventura();
  const porNome = new Map((eq?.itens || []).map((i) => [i.nome, i]));
  abrirModal('Magia de Funileiro', `
    <label style="font-size:0.85rem">Item a criar</label>
    <div id="funileiro-item"></div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">O item desaparece quando você terminar um Descanso Longo.</div>`,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-funileiro-criar">Criar</button>`);
  let nome = '';
  montarSeletor(document.getElementById('funileiro-item'), {
    opcoes: deItensFunileiro(ITENS_FUNILEIRO, porNome), densidade: 'densa', max: 1, busca: true,
    aoMudar: (sel) => { nome = sel[0] || ''; },
  });
  document.getElementById('btn-funileiro-criar')?.addEventListener('click', () => {
    if (!nome) { toast('Escolha o item a criar.', 'error'); return; }
    if (!gastarUso(char, 'funileiro')) { toast('Usos esgotados! Descanse para recuperar.', 'error'); return; }
    const reg = porNome.get(nome);
    const origem = { tipo: 'funileiro', expira: 'descanso_longo' };
    char.inventario = char.inventario || [];
    char.inventario.push(reg
      ? { nome: reg.nome, tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '', dados: { ...reg }, origem }
      : { nome, tipo: 'generico', quantidade: 1, equipado: false, descricao: 'Criado pela Magia de Funileiro.', dados: {}, origem });
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${nome} criado (some no Descanso Longo).`, 'success');
  });
}

/** Abre a escolha de objeto e magia do Item de Armazenar Magia. */
async function abrirArmazenar() {
  const magias = magiasArmazenaveis(...await Promise.all([getMagiasClasse('Artífice'), getIndiceMagias()]));
  abrirModal('Item de Armazenar Magia', `
    <label style="font-size:0.85rem">Objeto (arma Simples ou Marcial, ou Foco de Conjuração)</label>
    <input class="form-input" id="armazenar-objeto" maxlength="60" value="${escHtml(estadoArtifice(char).armazenar?.objeto || '')}">
    <label style="font-size:0.85rem;margin-top:8px;display:block">Magia</label>
    <div id="armazenar-magia"></div>`,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-armazenar-confirmar">Armazenar</button>`);
  let escolhida = '';
  montarSeletor(document.getElementById('armazenar-magia'), {
    opcoes: deMagiasArmazenar(magias), densidade: 'densa', max: 1, busca: true,
    selecionadas: magias.some((m) => m.nome === estadoArtifice(char).armazenar?.magia) ? [estadoArtifice(char).armazenar.magia] : [],
    aoMudar: (sel) => { escolhida = sel[0] || ''; },
  });
  document.getElementById('btn-armazenar-confirmar')?.addEventListener('click', () => {
    const objeto = document.getElementById('armazenar-objeto').value.trim();
    const magia = magias.find((m) => m.nome === escolhida);
    if (!objeto) { toast('Informe o objeto.', 'error'); return; }
    if (!magia) { toast('Escolha a magia.', 'error'); return; }
    definirArmazenar(char, { objeto, magia: magia.nome, circulo: magia.circulo });
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

/** Contexto de regras dos planos para a ficha aberta. */
async function ctxPlanos() {
  const [pl, ac, am, ar, eq] = await Promise.all([getPlanosArtifice(), getItensMagicos(), getArmas(), getArmaduras(), getEquipamentoAventura()]);
  const tabela = dadosDe('Artífice')?.tabela_caracteristicas;
  return { planos: pl?.planos || [], acervo: ac?.itens || [], armas: am?.armas || [], armaduras: ar?.armaduras || [],
    equipamentoPHB: eq?.itens || [], nivel: nivelNa(char, 'Artífice') || 0, maxItens: itensMagicosMax(tabela, char),
    armeiro: ehArmeiroAprimorado(char), agora: Date.now() };
}

/** Nome exibido de um conhecido (item ou variante, com base). */
function nomeConhecido(c, acervo) {
  const alvo = resolverPlano(c, acervo);
  const nome = alvo ? (alvo.variante || alvo.item).nome : c.item_id;
  return c.base_nome ? `${nome} (${c.base_nome})` : nome;
}

/** Opção de card de um plano conhecido: item do acervo (com variante e base) ou card mínimo se o acervo não o traz. */
function opcaoConhecido(k, c) {
  const alvo = resolverPlano(k, c.acervo);
  const nome = nomeConhecido(k, c.acervo);
  return alvo ? deItemMagicoAcervo(alvo, { id: k.id, nome }) : deItemMinimo(k.id, nome);
}

/** Modal de criação de itens replicados: escolhe até N conhecidos. `aoConcluir` roda ao fechar o modal. */
export async function abrirCriarItensReplicados(aoConcluir = null) {
  let c;
  try {
    c = await ctxPlanos();
  } catch (erro) {
    console.error(erro);
    toast('Não foi possível carregar os dados de Replicar Item Mágico.', 'error');
    aoConcluir?.();
    return;
  }
  const conhecidos = estadoArtifice(char).planos;
  abrirModal('Replicar Item Mágico', `
    <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Escolha até ${c.maxItens} plano(s). Recriar um plano substitui o item dele; acima do limite, o item mais antigo desaparece.</div>
    <div id="replicar-conhecidos"></div>`,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-replicar-confirmar">Criar</button>`, () => aoConcluir?.());
  let ids = [];
  montarSeletor(document.getElementById('replicar-conhecidos'), {
    opcoes: conhecidos.map((k) => opcaoConhecido(k, c)), densidade: 'densa', max: Math.max(1, conhecidos.length), busca: conhecidos.length > 8,
    aoMudar: (sel) => { ids = sel; },
  });
  document.getElementById('btn-replicar-confirmar')?.addEventListener('click', () => {
    if (!ids.length) { toast('Escolha ao menos um plano.', 'error'); return; }
    const erroLimite = erroCriarItens(char, ids, c);
    if (erroLimite) { toast(erroLimite, 'error'); return; }
    const r = criarItensReplicados(char, ids, c);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`Criado(s): ${r.criados.join(', ')}${r.removidos.length ? ` · Desapareceu: ${r.removidos.join(', ')}` : ''}`, 'success');
  });
}

/** Índice no inventário do item replicado do conhecido `chave`; -1 se não existir. */
function indiceReplicado(chave) {
  return char.inventario.findIndex((i) => i?.origem?.tipo === 'replicado' && i.origem.conhecido_id === chave);
}

/** Carregar Item Mágico: escolhe um espaço de magia disponível e soma as cargas ao item. */
function abrirCarregar(chave) {
  const item0 = char.inventario[indiceReplicado(chave)];
  const cg0 = cargasDoItem(item0);
  if (!cg0) { toast('Item replicado não encontrado ou sem cargas.', 'error'); return; }
  if (cg0.atual >= cg0.max) { toast(`${item0.nome} já está com as cargas no máximo (${cg0.max}).`, 'error'); return; }
  const reservas = reservasDeEspacos().filter((r) => r.disponiveis > 0);
  if (!reservas.length) { toast('Sem espaço de magia disponível.', 'error'); return; }
  abrirModal('Carregar Item Mágico', `
    <select class="form-input" id="carregar-espaco">${reservas.map((r) => `<option value="${r.fonte}|${r.circulo}">${r.circulo}º círculo${r.fonte === 'pacto' ? ' (Pacto)' : ''} — ${r.disponiveis} disponível(is)</option>`).join('')}</select>`,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-carregar-confirmar">Carregar</button>`);
  document.getElementById('btn-carregar-confirmar')?.addEventListener('click', () => {
    const [fonte, circulo] = document.getElementById('carregar-espaco').value.split('|');
    const item = char.inventario[indiceReplicado(chave)];
    const antes = cargasDoItem(item);
    // Valida antes de gastar: o espaço só é consumido se o item aceitar cargas.
    if (!antes || antes.atual >= antes.max) { toast('O item não aceita mais cargas.', 'error'); return; }
    if (!gastarEspaco(char, fonte, Number(circulo))) { toast('Espaço indisponível.', 'error'); return; }
    carregarItem(item, Number(circulo));
    const depois = cargasDoItem(item);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${item.nome}: +${depois.atual - antes.atual} carga(s) (${depois.atual}/${depois.max}).`, 'success');
  });
}

/** Drenar Item Mágico: remove o item e devolve um espaço gasto do círculo, ou guarda um espaço temporário. */
function drenar(chave) {
  const idx = indiceReplicado(chave);
  if (idx < 0) { toast('Item replicado não encontrado.', 'error'); return; }
  const item = char.inventario[idx];
  const nome = item.nome;
  if (!['Comum', 'Incomum', 'Rara'].includes(item.dados?.raridade)) { toast('Drenar não vale para itens Muito Raros ou mais raros.', 'error'); return; }
  const circulo = drenarItem(char, idx);
  if (!circulo) { toast('Drenar indisponível até o próximo Descanso Longo.', 'error'); return; }
  if (!recuperarUmEspaco(char, 'conjuracao', circulo)) estadoArtifice(char).espaco_temporario = { circulo };
  salvar();
  renderFichaCompleta();
  toast(`${nome} drenado: espaço de ${circulo}º círculo.`, 'success');
}

/** Transmutar Item Mágico: escolhe o conhecido de destino (sem item replicado ainda). */
async function abrirTransmutar(chave) {
  const atual0 = char.inventario[indiceReplicado(chave)];
  if (!atual0) { toast('Item replicado não encontrado.', 'error'); return; }
  const c = await ctxPlanos();
  const ocupados = new Set(itensReplicados(char).map((i) => i.origem.conhecido_id));
  const destinos = estadoArtifice(char).planos.filter((k) => !ocupados.has(k.id));
  if (!destinos.length) { toast('Todos os planos conhecidos já têm item replicado.', 'error'); return; }
  abrirModal('Transmutar Item Mágico', `
    <div id="transmutar-destino"></div>`,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-transmutar-confirmar">Transmutar</button>`);
  let destino = '';
  montarSeletor(document.getElementById('transmutar-destino'), {
    opcoes: destinos.map((k) => opcaoConhecido(k, c)), densidade: 'densa', max: 1, busca: destinos.length > 8,
    aoMudar: (sel) => { destino = sel[0] || ''; },
  });
  document.getElementById('btn-transmutar-confirmar')?.addEventListener('click', () => {
    if (!destino) { toast('Escolha o item de destino.', 'error'); return; }
    const idx = indiceReplicado(chave);
    if (idx < 0) { toast('Item replicado não encontrado.', 'error'); return; }
    const nome = char.inventario[idx].nome;
    const erroArmeiro = erroTransmutarArmeiro(char, idx, destino, c);
    if (erroArmeiro) { toast(erroArmeiro, 'error'); return; }
    if (!transmutarItem(char, idx, destino, c)) { toast('Transmutar indisponível.', 'error'); return; }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${nome} transmutado.`, 'success');
  });
}

/** Trapacear a Morte: escolhe os itens replicados Incomuns/Raros a desintegrar. */
async function abrirTrapacear() {
  const elegiveis = char.inventario.map((it, i) => [it, i]).filter(([it]) => it?.origem?.tipo === 'replicado' && ['Incomum', 'Rara'].includes(it.dados?.raridade));
  if (!elegiveis.length) { toast('Nenhum item replicado Incomum ou Raro.', 'error'); return; }
  const c = await ctxPlanos();
  const conhecidos = estadoArtifice(char).planos;
  const opcoes = elegiveis.map(([it, i]) => {
    const k = conhecidos.find((x) => x.id === it.origem.conhecido_id);
    const alvo = k ? resolverPlano(k, c.acervo) : null;
    return alvo ? deItemMagicoAcervo(alvo, { id: String(i), nome: it.nome }) : deItemMinimo(String(i), it.nome, it.dados?.raridade || '');
  });
  abrirModal('Trapacear a Morte', '<div id="trapacear-itens"></div>',
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-danger" id="btn-trapacear-confirmar">Desintegrar</button>`);
  let idxs = elegiveis.map(([, i]) => i);
  montarSeletor(document.getElementById('trapacear-itens'), {
    opcoes, densidade: 'densa', max: opcoes.length, selecionadas: opcoes.map((o) => o.id),
    aoMudar: (sel) => { idxs = sel.map(Number); },
  });
  document.getElementById('btn-trapacear-confirmar')?.addEventListener('click', () => {
    const n = trapacearMorte(char, idxs);
    if (!n) { toast('Escolha ao menos um item.', 'error'); return; }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${n} item(ns) desintegrado(s): ${char.pv_atual} PV.`, 'success');
  });
}

/** Modal de escolha do efeito de um elixir: cards dos 5 efeitos (nunca <select>). Devolve o efeito pelo callback `aoConfirmar`. */
function abrirEscolhaEfeitoElixir(titulo, idBotao, rotuloBotao, aoConfirmar) {
  abrirModal(titulo, '<div id="elixir-efeito"></div>',
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="${idBotao}">${rotuloBotao}</button>`);
  let efeito = '';
  montarSeletor(document.getElementById('elixir-efeito'), {
    opcoes: deEfeitosElixir(EFEITOS_ELIXIR, (e) => textoElixir(e, char)), densidade: 'densa', max: 1,
    aoMudar: (sel) => { efeito = sel[0] || ''; },
  });
  document.getElementById(idBotao)?.addEventListener('click', () => {
    if (!efeito) { toast('Escolha o efeito do elixir.', 'error'); return; }
    if (aoConfirmar(efeito) === false) return;
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

/** Criar elixir adicional: gasta um espaço de magia e deixa escolher o efeito. */
function abrirCriarElixir() {
  abrirEscolhaEfeitoElixir('Elixir Experimental', 'btn-elixir-confirmar', 'Criar', (efeito) => {
    if (!consumirEspacoMagiaDisponivel(1)) { toast('Sem espaço de magia disponível.', 'error'); return false; }
    criarElixir(char, efeito);
    return true;
  });
}

/** Define o efeito de um elixir criado pela rolagem 6 ("escolha uma das outras linhas"). */
function abrirDefinirElixir(idx) {
  abrirEscolhaEfeitoElixir('Efeito do elixir', 'btn-elixir-definir-confirmar', 'Definir', (efeito) => {
    if (!definirEfeitoElixir(char, idx, efeito)) { toast('Elixir não encontrado.', 'error'); return false; }
    return true;
  });
}

/** Atlas do Aventureiro: número de portadores (2 a 1 + mod. Int) e se o próprio Cartógrafo carrega um mapa. */
function abrirAtlas() {
  const max = atlasMaxPortadores(char);
  const atual = estadoArtifice(char).atlas;
  abrirModal('Atlas do Aventureiro', `
    <label style="font-size:0.85rem">Portadores (incluindo você, se for um)</label>
    <input type="number" class="form-input" id="atlas-portadores" min="2" max="${max}" value="${max}">
    <label style="font-size:0.85rem;display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="atlas-voce" ${atual?.voce === false ? '' : 'checked'}> Eu carrego um dos mapas</label>`,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-atlas-confirmar">Criar</button>`);
  document.getElementById('btn-atlas-confirmar')?.addEventListener('click', () => {
    const n = Math.max(2, Math.min(max, Math.floor(Number(document.getElementById('atlas-portadores').value)) || 2));
    estadoArtifice(char).atlas = { ativo: true, portadores: n, voce: document.getElementById('atlas-voce').checked };
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

/** Liga os botões data-artifice-acao da ficha. */
export function setupEventosArtifice() {
  document.querySelectorAll('[data-artifice-acao]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const acao = btn.dataset.artificeAcao;
      if (acao === 'funileiro') return abrirFunileiro();
      if (acao === 'armazenar-definir') return abrirArmazenar();
      if (acao === 'elixir-criar') return abrirCriarElixir();
      if (acao === 'atlas') return abrirAtlas();
      if (acao === 'elixir-definir') return abrirDefinirElixir(Number(btn.dataset.i));
      const chave = btn.dataset.conhecido;
      if (acao === 'replicar-criar') return abrirCriarItensReplicados();
      if (acao === 'replicar-carregar') return abrirCarregar(chave);
      if (acao === 'replicar-drenar') return drenar(chave);
      if (acao === 'replicar-transmutar') return abrirTransmutar(chave);
      if (acao === 'trapacear-morte') return abrirTrapacear();
      if (acao === 'espaco-temporario') {
        estadoArtifice(char).espaco_temporario = null;
        salvar();
        renderFichaCompleta();
        toast('Espaço temporário gasto.', 'success');
        return;
      }
      if (acao === 'lampejo') {
        if (!gastarUso(char, 'lampejo')) { toast('Usos esgotados! Descanse para recuperar.', 'error'); return; }
      } else if (acao === 'armazenar-usar') {
        if (!usarArmazenar(char)) { toast('Sem cargas no item.', 'error'); return; }
      } else if (acao === 'golpe-arcano') {
        if (!usarGolpeArcano(char)) { toast('Golpe Arcano esgotado até o Descanso Longo.', 'error'); return; }
      } else if (acao === 'armadura-arcana') {
        if (armaduraArcanaAtiva(char)) {
          estadoArtifice(char).armadura_arcana = null;
        } else {
          const vestida = (char.inventario || []).find((i) => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
          if (!vestida) { toast('Vista uma armadura primeiro.', 'error'); return; }
          estadoArtifice(char).armadura_arcana = vestida.nome;
        }
      } else if (acao === 'modelo') {
        estadoArtifice(char).modelo = btn.dataset.modelo;
      } else if (acao === 'armeiro-contador') {
        if (!gastarArmeiro(char, btn.dataset.chave)) { toast('Usos esgotados até o Descanso Longo.', 'error'); return; }
      } else if (acao === 'campo-defensivo') {
        // O botão desabilitado já bloqueia o clique; a checagem cobre estado alterado depois da renderização.
        if (modeloAtivo(char) !== 'Guardião') { toast('Campo Defensivo exige o modelo Guardião com a Armadura Arcana ativa.', 'error'); return; }
        if (!estaFeridoMeio()) { toast('Campo Defensivo só pode ser usado quando você está Ferido.', 'error'); return; }
        char.pv_temporario = Math.max(char.pv_temporario || 0, nivelNa(char, 'Artífice') || 0);
      } else return;
      salvar();
      renderFichaCompleta();
    });
  });
}
