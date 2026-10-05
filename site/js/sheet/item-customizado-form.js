// ============================================================
// Formulario do item customizado.
//
// O mesmo formulario servia dois modais (criar e editar), copiado, com a
// validacao duplicada -- cada campo novo tinha de ser escrito duas vezes,
// e a que faltasse sumia em silencio. Aqui ele e uma peca so; os modais
// de inventario.js montam o HTML e leem o resultado por estas funcoes.
// ============================================================
import { escHtml, fmtPeso, parsePeso } from '../utils.js';

// Formato aceito no campo Dano: 1d8, 2d6 Cortante, 1d4+2 Perfurante.
const REGEX_DANO = /^\d+d\d+(\s*[+\-]\s*\d+)?(\s+\w+)?$/i;

// As seis raridades do livro, na ordem crescente (Equipamento.md, capitulo
// de Itens Magicos). A setima opcao do seletor e a VAZIA: item que nao e
// magico nao tem raridade, e esse e o padrao de quem so quer anotar uma
// corda no inventario.
export const RARIDADES = ['Comum', 'Incomum', 'Rara', 'Muito Rara', 'Lendária', 'Artefato'];

// Categorias de arma reconhecidas pelo motor de proficiência/ataque
// (regras-equipamento.js/sheet/inventario.js) -- os mesmos quatro valores
// do catálogo (dados/equipamento/armas.json), para o item customizado
// entrar no MESMO cálculo de proficiência/modificador que a arma de
// catálogo usa, sem duplicar a regra (issue #82).
export const CATEGORIAS_ARMA = [
  'Armas Simples Corpo a Corpo', 'Armas Simples à Distância',
  'Armas Marciais Corpo a Corpo', 'Armas Marciais à Distância',
];

// Categorias de item que NÃO são arma (issue #100). Ficam em `dados.tipo_item`,
// separadas de `dados.categoria`: esta última decide proficiência e ataque
// de arma, e não pode receber valor que não seja de arma.
export const TIPOS_ITEM = ['Armadura', 'Consumível', 'Munição', 'Equipamento', 'Item Mágico', 'Ferramenta'];

// Tipos de armadura do livro; `Escudo` entra aqui porque a proficiência dele é separada (regras-equipamento.js).
export const TIPOS_ARMADURA = ['Leve', 'Média', 'Pesada', 'Escudo'];

/**
 * Separa o valor do select de categoria nos dois campos gravados no item:
 * categoria de arma -> `categoria`; tipo de item -> `tipo_item`; qualquer
 * outro valor (inclusive vazio) -> ambos vazios.
 * @param {string} valor
 * @returns {{categoria: string, tipo_item: string}}
 */
export function separarCategoria(valor) {
  if (CATEGORIAS_ARMA.includes(valor)) return { categoria: valor, tipo_item: '' };
  if (TIPOS_ITEM.includes(valor)) return { categoria: '', tipo_item: valor };
  return { categoria: '', tipo_item: '' };
}

// As maestrias de arma do catálogo (dados/equipamento/armas.json) --
// mesma lista, para o campo do item customizado oferecer só nomes que
// existem no livro.
export const MAESTRIAS_ARMA = ['Afligir', 'Derrubar', 'Drenar', 'Empurrar', 'Garantido', 'Lentidão', 'Trespassar', 'Ágil'];

/** As dez propriedades de arma do livro (Equipamento.md, "Propriedades"). */
export const PROPRIEDADES_ARMA = ['Acuidade', 'Alcance', 'Arremesso', 'Duas Mãos', 'Extensão', 'Leve', 'Munição', 'Pesada', 'Recarga', 'Versátil'];

/**
 * Descrição de uma propriedade: a personalizada do item vence; depois o
 * glossário do livro (ignora "(alcance 6/18)" no nome). Vazio se nenhuma.
 * @param {string} nome
 * @param {Array<{nome: string, descricao: string}>} [personalizadas] `dados.propriedades_personalizadas`
 * @param {Array<{nome: string, descricao: string}>} [glossario] `dados.propriedadesArmas`
 * @returns {string}
 */
export function descricaoDePropriedade(nome, personalizadas = [], glossario = []) {
  const base = String(nome || '').replace(/\s*\(.*\)/, '').trim();
  const custom = (personalizadas || []).find(p => p?.nome === base);
  if (custom?.descricao) return custom.descricao;
  return (glossario || []).find(p => p?.nome === base)?.descricao || '';
}

/**
 * Valida os campos que tem regra, sem tocar no DOM.
 * @param {{nome?: string, dano?: string}} bruto
 * @returns {string[]} mensagens de erro; vazio quando esta tudo certo.
 */
export function validarItemCustomizado(bruto) {
  const erros = [];
  if (!bruto?.nome) erros.push('Informe um nome para o item.');
  if (bruto?.dano && !REGEX_DANO.test(bruto.dano)) {
    erros.push('Dano deve seguir o formato de dados: 1d8, 2d6 Cortante, 1d4+2 Perfurante');
  }
  return erros;
}
// SEM teto para bonus de CA e de ataque. Item customizado e o campo
// livre da mesa -- e o item da mesa nao cabe na faixa do item magico do
// livro (-5..+5 e -5..+10, o que estava aqui). Pior: a validacao barrava
// o item INTEIRO, entao uma armadura "CA 20" nao era gravada de forma
// nenhuma. O criador de personagem (creator/passo-equipamento.js) nunca
// teve esses limites: duas telas respondendo diferente para o mesmo
// campo. O `parseInt` que garante numero inteiro fica em
// `lerFormularioItemCustomizado`, na leitura de ic-ca e ic-atq.

/**
 * Quais seções do formulário já têm dado (issue #101): a edição abre só
 * essas; a criação (item vazio) nasce toda recolhida.
 * @param {object} d `item.dados`
 * @returns {{categoria: boolean, atributos: boolean, raridade: boolean}}
 */
export function secoesComValor(d = {}) {
  const numero = (v) => (parseInt(v) || 0) !== 0;
  const texto = (v) => String(v ?? '').trim() !== '';
  return {
    categoria: texto(d.categoria) || texto(d.tipo_item) || texto(d.propriedades) || texto(d.maestria),
    atributos: numero(d.bonus_ca) || texto(d.ca_base) || texto(d.dano) || numero(d.bonus_ataque)
      || numero(d.bonus_ataque_magia) || numero(d.bonus_cd_magia) || texto(d.peso),
    raridade: texto(d.raridade) || Boolean(d.requer_sintonizacao),
  };
}

/**
 * HTML dos campos do formulario. Sem item, vem vazio (criacao); com item,
 * vem preenchido (edicao).
 * @param {object|null} [item] Item do inventario a editar.
 * @returns {string} HTML pronto para o corpo do modal.
 */
export function htmlFormularioItemCustomizado(item = null) {
  const d = item?.dados || {};
  const attr = (v) => String(v ?? '').replace(/"/g, '&quot;');
  const num = (v) => (parseInt(v) || '') === '' ? '' : String(parseInt(v));
  // Chips das propriedades: a string "A, B" de `d.propriedades` (formato
  // antigo, continua valendo) + a descrição das personalizadas.
  const personalizadas = Array.isArray(d.propriedades_personalizadas) ? d.propriedades_personalizadas : [];
  const chips = String(d.propriedades || '').split(',').map(p => p.trim()).filter(Boolean).map(nome => {
    const custom = personalizadas.find(p => p?.nome === nome);
    return `<span class="badge badge-secondary" data-ic-prop data-nome="${escHtml(nome)}"${custom?.descricao ? ` data-desc="${escHtml(custom.descricao)}"` : ''}>${escHtml(nome)} <button type="button" class="btn-icon" data-ic-prop-remover title="Remover" style="border:none;background:none;cursor:pointer">&times;</button></span>`;
  }).join('');
  // Issue #101: seções recolhíveis. Na criação nascem fechadas; na edição,
  // abre a que já tem dado (secoesComValor).
  const aberta = secoesComValor(d);
  const abre = (id) => (aberta[id] ? ' open' : '');
  return `
    <div class="form-group"><label class="form-label" for="ic-nome">Nome</label><input type="text" class="form-input" id="ic-nome" value="${attr(item?.nome || '')}"></div>
    <div class="form-group"><label class="form-label" for="ic-desc">Descrição</label><textarea class="form-textarea" id="ic-desc" rows="2">${escHtml(item?.descricao || '')}</textarea></div>

    <details class="ic-secao" data-ic-secao="categoria"${abre('categoria')}>
      <summary>Categoria</summary>
      <div class="form-group">
        <label class="form-label" for="ic-categoria">Categoria (opcional)</label>
        <select class="form-input" id="ic-categoria">
          <option value=""${!d.categoria && !d.tipo_item ? ' selected' : ''}>—</option>
          <optgroup label="Arma">
            ${CATEGORIAS_ARMA.map(c => `<option value="${c}"${d.categoria === c ? ' selected' : ''}>${c}</option>`).join('')}
          </optgroup>
          <optgroup label="Outros">
            ${TIPOS_ITEM.map(t => `<option value="${t}"${d.tipo_item === t ? ' selected' : ''}>${t}</option>`).join('')}
          </optgroup>
        </select>
        <div style="font-size:0.65rem;color:var(--text-muted)">categoria de arma define proficiência e o modificador de ataque (Força/Destreza), como uma arma de catálogo</div>
      </div>
      <div id="ic-armadura-campos" style="display:${d.tipo_item === 'Armadura' ? 'block' : 'none'};margin-bottom:8px">
        <div class="row gap-1">
          <div class="col">
            <label class="form-label" for="ic-tipo-armadura">Tipo de armadura</label>
            <select class="form-input" id="ic-tipo-armadura">
              <option value=""${!d.tipo_armadura ? ' selected' : ''}>—</option>
              ${TIPOS_ARMADURA.map(t => `<option value="${t}"${d.tipo_armadura === t ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
            <div style="font-size:0.65rem;color:var(--text-muted)">define se a ficha mostra a proficiência</div>
          </div>
          <div class="col">
            <label class="form-label" for="ic-req-forca">Requisito de Força</label>
            <input type="number" class="form-input" id="ic-req-forca" min="0" step="1" value="${parseInt(String(d.requisito_forca || '').replace(/\D/g, '')) || ''}" placeholder="—">
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="ic-desv-furtividade"${d.furtividade === 'Desvantagem' ? ' checked' : ''}> Desvantagem em Furtividade
        </label>
      </div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">Propriedades (opcional)</label>
          <input type="hidden" id="ic-propriedades" value="${escHtml(d.propriedades || '')}">
          <div id="ic-props-lista" style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0">${chips}</div>
          <button type="button" class="btn btn-sm btn-secondary" id="ic-prop-add">+ Adicionar propriedade</button>
          <div id="ic-prop-painel" style="display:none;margin-top:6px">
            <select class="form-input" id="ic-prop-select">
              ${PROPRIEDADES_ARMA.map(p => `<option value="${p}">${p}</option>`).join('')}
              <option value="__personalizada__">Personalizada…</option>
            </select>
            <div id="ic-prop-custom" style="display:none;margin-top:6px">
              <input type="text" class="form-input" id="ic-prop-nome" placeholder="Nome da propriedade">
              <textarea class="form-textarea" id="ic-prop-desc" rows="2" placeholder="Descrição da propriedade" style="margin-top:6px"></textarea>
            </div>
            <button type="button" class="btn btn-sm btn-primary" id="ic-prop-confirmar" style="margin-top:6px">Adicionar</button>
          </div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-maestria">Maestria (opcional)</label>
          <select class="form-input" id="ic-maestria">
            <option value=""${!d.maestria ? ' selected' : ''}>—</option>
            ${MAESTRIAS_ARMA.map(m => `<option value="${m}"${d.maestria === m ? ' selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
      </div>
    </details>

    <details class="ic-secao" data-ic-secao="atributos"${abre('atributos')}>
      <summary>Atributos</summary>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label" for="ic-ca">Bônus CA</label>
          <input type="number" class="form-input" id="ic-ca" value="${num(d.bonus_ca)}" placeholder="0" step="1">
          <div style="font-size:0.65rem;color:var(--text-muted)">soma na CA quando equipado</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-ca-base">CA Base</label>
          <input type="number" class="form-input" id="ic-ca-base" value="${num(d.ca_base)}" placeholder="—" min="0" step="1">
          <div style="font-size:0.65rem;color:var(--text-muted)">define a CA (ex.: 20). Não soma Destreza</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-dano">Dano</label>
          <input type="text" class="form-input" id="ic-dano" value="${attr(d.dano || '')}" placeholder="1d8 Cortante">
          <div style="font-size:0.65rem;color:var(--text-muted)">Ex: 2d6 Cortante</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-atq">Bônus Atq</label>
          <input type="number" class="form-input" id="ic-atq" value="${num(d.bonus_ataque)}" placeholder="0" step="1">
          <div style="font-size:0.65rem;color:var(--text-muted)">soma na jogada de ataque</div>
        </div>
      </div>
      <div class="row gap-1" style="margin-top:8px">
        <div class="col">
          <label class="form-label" for="ic-atq-magia">Bônus Ataque de Magia</label>
          <input type="number" class="form-input" id="ic-atq-magia" value="${num(d.bonus_ataque_magia)}" placeholder="0" step="1">
          <div style="font-size:0.65rem;color:var(--text-muted)">soma na jogada de ataque de magia quando equipado (e sintonizado, se exigir)</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-cd-magia">Bônus CD de Magia</label>
          <input type="number" class="form-input" id="ic-cd-magia" value="${num(d.bonus_cd_magia)}" placeholder="0" step="1">
          <div style="font-size:0.65rem;color:var(--text-muted)">soma na CD de magia quando equipado (e sintonizado, se exigir)</div>
        </div>
      </div>
      <div class="form-group" style="margin-top:8px">
        <label class="form-label" for="ic-peso">Peso (opcional)</label>
        <input type="number" class="form-input" id="ic-peso" value="${parsePeso(d.peso) || ''}" placeholder="0" min="0" step="0.1" style="max-width:140px">
        <div style="font-size:0.65rem;color:var(--text-muted)">em kg (ex: 0,5)</div>
      </div>
    </details>

    <details class="ic-secao" data-ic-secao="raridade"${abre('raridade')}>
      <summary>Raridade e sintonização</summary>
      <div class="form-group">
        <label class="form-label" for="ic-raridade">Raridade</label>
        <select class="form-input" id="ic-raridade">
          <option value=""${!d.raridade ? ' selected' : ''}>—</option>
          ${RARIDADES.map(r => `<option value="${r}"${d.raridade === r ? ' selected' : ''}>${r}</option>`).join('')}
        </select>
        <div style="font-size:0.65rem;color:var(--text-muted)">vazio = item não mágico</div>
      </div>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="ic-sintonizacao"${d.requer_sintonizacao ? ' checked' : ''}>
          Requer sintonização
        </label>
        <div style="font-size:0.65rem;color:var(--text-muted)">você pode estar sintonizado a no máximo 3 itens</div>
      </div>
    </details>

    <div class="form-group" style="margin-top:8px">
      <label class="form-label" for="ic-preco">Preço</label>
      <input type="text" class="form-input" id="ic-preco" value="${attr(d.preco || '')}" placeholder="150 PO">
      <div style="font-size:0.65rem;color:var(--text-muted)">texto livre (ex.: 150 PO)</div>
    </div>
    <div id="ic-erros" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
  `;
}

/**
 * Lê os chips de propriedade do formulário aberto: a string "A, B" (todos os
 * nomes) e a lista das personalizadas (as que carregam descrição).
 * @returns {{propriedades: string, propriedades_personalizadas: Array<{nome: string, descricao: string}>}}
 */
export function lerPropriedadesDoFormulario() {
  const chips = [...document.querySelectorAll('#ic-props-lista [data-ic-prop]')];
  return {
    propriedades: chips.map(c => c.dataset.nome).join(', '),
    propriedades_personalizadas: chips
      .filter(c => c.dataset.desc)
      .map(c => ({ nome: c.dataset.nome, descricao: c.dataset.desc })),
  };
}

/** Cria o elemento-chip de uma propriedade (nome e, se personalizada, descrição). */
function criarChipPropriedade(nome, descricao = '') {
  const chip = document.createElement('span');
  chip.className = 'badge badge-secondary';
  chip.setAttribute('data-ic-prop', '');
  chip.dataset.nome = nome;
  if (descricao) chip.dataset.desc = descricao;
  chip.append(`${nome} `);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'btn-icon';
  x.setAttribute('data-ic-prop-remover', '');
  x.title = 'Remover';
  x.style.cssText = 'border:none;background:none;cursor:pointer';
  x.innerHTML = '&times;';
  chip.append(x);
  return chip;
}

/**
 * Liga os controles de propriedade do formulário aberto (botão
 * "+ Adicionar propriedade", seletor padrão/personalizada, remoção de chip).
 * Chamar logo depois de abrir o modal.
 */
export function ligarEventosFormularioItemCustomizado() {
  // Campos de armadura só aparecem quando a categoria é Armadura.
  const selCategoria = document.getElementById('ic-categoria');
  const camposArmadura = document.getElementById('ic-armadura-campos');
  selCategoria?.addEventListener('change', () => {
    if (camposArmadura) camposArmadura.style.display = selCategoria.value === 'Armadura' ? 'block' : 'none';
  });
  const lista = document.getElementById('ic-props-lista');
  const painel = document.getElementById('ic-prop-painel');
  const select = document.getElementById('ic-prop-select');
  const custom = document.getElementById('ic-prop-custom');
  const erro = (msg) => {
    const el = document.getElementById('ic-erros');
    if (!el) return;
    el.style.display = msg ? 'block' : 'none';
    el.textContent = msg || '';
  };
  const sincronizarOculto = () => {
    const oculto = document.getElementById('ic-propriedades');
    if (oculto) oculto.value = lerPropriedadesDoFormulario().propriedades;
  };
  document.getElementById('ic-prop-add')?.addEventListener('click', () => {
    if (painel) painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
  });
  select?.addEventListener('change', () => {
    if (custom) custom.style.display = select.value === '__personalizada__' ? 'block' : 'none';
  });
  document.getElementById('ic-prop-confirmar')?.addEventListener('click', () => {
    const ehCustom = select?.value === '__personalizada__';
    const nome = ehCustom ? (document.getElementById('ic-prop-nome')?.value || '').trim() : select?.value;
    const descricao = ehCustom ? (document.getElementById('ic-prop-desc')?.value || '').trim() : '';
    if (!nome) { erro('Informe o nome da propriedade.'); return; }
    if ([...document.querySelectorAll('#ic-props-lista [data-ic-prop]')].some(c => c.dataset.nome === nome)) {
      erro(`A propriedade "${nome}" já foi adicionada.`);
      return;
    }
    erro('');
    lista?.append(criarChipPropriedade(nome, descricao));
    if (ehCustom) {
      document.getElementById('ic-prop-nome').value = '';
      document.getElementById('ic-prop-desc').value = '';
    }
    // Fecha o painel e volta o seletor ao padrão: o próximo "+ Adicionar" abre limpo.
    if (painel) painel.style.display = 'none';
    if (select) select.selectedIndex = 0;
    if (custom) custom.style.display = 'none';
    sincronizarOculto();
  });
  lista?.addEventListener('click', (e) => {
    const x = e.target.closest('[data-ic-prop-remover]');
    if (!x) return;
    x.closest('[data-ic-prop]')?.remove();
    sincronizarOculto();
  });
}

/**
 * Le os campos do formulario aberto e valida. Quando ha erro, escreve na
 * caixa #ic-erros e devolve ok:false -- quem chama so precisa desistir.
 * @returns {{ok: boolean, erros: string[], valores: object}}
 */
export function lerFormularioItemCustomizado() {
  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const nome = val('ic-nome');
  const descricao = val('ic-desc');
  const dano = val('ic-dano');
  const ca = parseInt(document.getElementById('ic-ca')?.value) || 0;
  const atq = parseInt(document.getElementById('ic-atq')?.value) || 0;
  const { categoria, tipo_item } = separarCategoria(val('ic-categoria'));
  const { propriedades, propriedades_personalizadas } = lerPropriedadesDoFormulario();
  const maestria = val('ic-maestria');
  const atqMagia = parseInt(document.getElementById('ic-atq-magia')?.value) || 0;
  const cdMagia = parseInt(document.getElementById('ic-cd-magia')?.value) || 0;
  // Campo VAZIO grava vazio, e nao 0: "sem CA base" e diferente de "CA base
  // zero", e so o vazio deixa o item fora da conta do piso.
  const caBaseRaw = val('ic-ca-base');
  const caBase = caBaseRaw === '' ? '' : String(parseInt(caBaseRaw) || 0);
  const pesoRaw = val('ic-peso');
  const pesoNum = pesoRaw ? parseFloat(pesoRaw.replace(',', '.')) : 0;
  // Campos de armadura valem só com a categoria Armadura; outra categoria grava vazio (a edição precisa poder limpar).
  const ehArmadura = tipo_item === 'Armadura';
  const reqForca = parseInt(document.getElementById('ic-req-forca')?.value) || 0;

  const erros = validarItemCustomizado({ nome, dano });
  const errosEl = document.getElementById('ic-erros');
  if (erros.length > 0) {
    if (errosEl) { errosEl.style.display = 'block'; errosEl.innerHTML = erros.join('<br>'); }
    // O erro pode estar num campo de seção recolhida: abre a seção Atributos (onde fica o Dano).
    document.querySelector('[data-ic-secao="atributos"]')?.setAttribute('open', '');
    return { ok: false, erros, valores: null };
  }
  if (errosEl) errosEl.style.display = 'none';

  return {
    ok: true,
    erros: [],
    valores: {
      nome,
      descricao,
      dados: {
        bonus_ca: String(ca),
        ca_base: caBase,
        dano,
        bonus_ataque: String(atq),
        categoria,
        tipo_item,
        tipo_armadura: ehArmadura ? val('ic-tipo-armadura') : '',
        requisito_forca: ehArmadura && reqForca > 0 ? `For ${reqForca}` : '',
        furtividade: ehArmadura && document.getElementById('ic-desv-furtividade')?.checked ? 'Desvantagem' : '',
        propriedades,
        // Sempre grava (inclusive []): a edição faz merge e precisa poder apagar.
        propriedades_personalizadas,
        maestria,
        bonus_ataque_magia: String(atqMagia),
        bonus_cd_magia: String(cdMagia),
        peso: pesoNum > 0 ? `${fmtPeso(pesoNum)} kg` : '',
        raridade: val('ic-raridade'),
        preco: val('ic-preco'),
        requer_sintonizacao: !!document.getElementById('ic-sintonizacao')?.checked,
      },
    },
  };
}
