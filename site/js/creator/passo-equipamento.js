// ============================================================
// Passo 5: equipamento inicial e inventario
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { getArmaduras, getArmas, getClasse, getEquipamentoAventura } from '../db.js';
import { DENOMINACOES, ICONE_MOEDA, adicionarMoeda, removerQuantidadeMoeda } from '../moedas.js';
import { abrirModal, fmtPeso, getCapacidadeCarga, getPesoTotalInventario, mdParaHtml, semAcento, toast } from '../utils.js';
import { ANTECEDENTES_ESCOLHAS, KITS_EXPANSAO } from './comum.js';
import { containerRef, dadosCache, personagem } from './wizard.js';

// ============================================================
// PASSO 5: EQUIPAMENTO
// ============================================================

// --- Funções de proficiência ---

/** Verifica se o personagem tem proficiência com uma arma específica */
function temProficienciaArma(arma) {
  const info = CLASSES_INFO[personagem.classe];
  if (!info) return false;
  const cat = (arma.categoria || '').toLowerCase();
  const extras = (personagem.proficiencias_extra || []).map(p => p.toLowerCase());

  // Proficiência completa na categoria
  if (info.armas.includes('Marcial') && cat.includes('marciai')) return true;
  if (info.armas.includes('Simples') && cat.includes('simples')) return true;

  // Proficiências extras (ex: Clérigo Protetor recebe "Armas Marciais")
  if (extras.includes('armas marciais') && cat.includes('marciai')) return true;
  if (extras.includes('armas simples') && cat.includes('simples')) return true;

  // Ladino: Marcial com Acuidade
  if (info.armas.some(a => a.includes('Acuidade'))) {
    if (cat.includes('marciai') && (arma.propriedades || '').toLowerCase().includes('acuidade')) return true;
  }
  // Monge: Marcial com Leve
  if (info.armas.some(a => a.includes('Leve'))) {
    if (cat.includes('marciai') && (arma.propriedades || '').toLowerCase().includes('leve')) return true;
  }

  return false;
}

/** Verifica se o personagem tem proficiência com uma armadura específica */
function temProficienciaArmadura(armadura) {
  const info = CLASSES_INFO[personagem.classe];
  if (!info) return false;
  const cat = (armadura.categoria || '').toLowerCase();
  const nome = (armadura.nome || '').toLowerCase();
  const extras = (personagem.proficiencias_extra || []).map(p => p.toLowerCase());

  // Escudo separado
  if (nome === 'escudo') return info.armaduras.includes('Escudo') || extras.includes('escudo');

  if (info.armaduras.includes('Pesada') && cat === 'pesada') return true;
  if (info.armaduras.includes('Média') && (cat === 'média' || cat === 'media')) return true;
  if (info.armaduras.includes('Leve') && cat === 'leve') return true;

  // Proficiências extras (Clérigo Protetor etc)
  if (extras.includes('armadura pesada') && cat === 'pesada') return true;
  if (extras.includes('armadura média') && (cat === 'média' || cat === 'media')) return true;

  return false;
}

/** Verifica se o personagem atende requisito de Força de uma armadura */
function atendeRequisitoForca(armadura) {
  if (!armadura.requisito_forca || armadura.requisito_forca === '—') return true;
  const match = armadura.requisito_forca.match(/For\.?\s*(\d+)/i);
  if (!match) return true;
  return (personagem.atributos?.forca || 10) >= parseInt(match[1]);
}

/** Retorna badge HTML de proficiência */
function badgeProficiencia(proficiente) {
  if (proficiente) {
    return '<span class="badge badge-prof">Proficiente</span>';
  }
  return '<span class="badge badge-no-prof">Sem Proficiência</span>';
}

// Função para parsear opções de equipamento (A, B, C, etc)
function parseEquipamentoOpcoes(texto) {
  if (!texto) return null;
  // Formato: "Escolha A ou B: (A) item1, item2, 10 PO; ou (B) 50 PO"
  // Ou: "Escolha A, B ou C: (A) ...; (B) ...; ou (C) ..."
  const match = texto.match(/Escolha ([A-Z])(?:,?\s*([A-Z]))?\s*ou\s*([A-Z]):/i);
  if (!match) return null;

  const opcoes = [];
  const letras = [match[1], match[2], match[3]].filter(Boolean);

  for (const letra of letras) {
    // Regex para extrair conteúdo de cada opção
    const regex = new RegExp(`\\(${letra}\\)\\s*([^;]+?)(?:;|$|ou \\([A-Z]\\))`, 'i');
    const m = texto.match(regex);
    if (m) {
      const conteudo = m[1].trim().replace(/;?\s*$/, '');
      // Extrair moeda se houver (qualquer uma das 5 denominacoes)
      const moedaMatch = conteudo.match(/(\d+)\s*(PC|PP|PE|PO|PL)$/i);
      const moedaQtd = moedaMatch ? parseInt(moedaMatch[1]) : 0;
      const moedaTipo = moedaMatch ? moedaMatch[2].toLowerCase() : 'po';
      // Extrair itens (tudo antes da moeda ou todo conteúdo se for só moeda)
      // Remove também a conjuncao " e" residual antes do valor (ex: "Kit de Artista e 19 PO" -> "Kit de Artista")
      let itensStr = moedaMatch ? conteudo.replace(/,?\s*e?\s*\d+\s*(PC|PP|PE|PO|PL)$/i, '').trim() : conteudo;
      // Se for só moeda (sem itens), marcar como opção de dinheiro
      const apenasOuro = !itensStr || itensStr.length < 3;
      opcoes.push({
        letra,
        conteudo: conteudo,
        itens: apenasOuro ? [] : itensStr.split(',').map(i => i.trim()).filter(Boolean),
        moedaTipo,
        moedaQtd,
        apenasOuro
      });
    }
  }

  return opcoes.length > 0 ? opcoes : null;
}

// Função para adicionar itens de equipamento ao inventário
function adicionarItensEquipamentoInicial(opcao, tipoOrigem, nomeOrigem) {
  // Limpar itens anteriores dessa origem
  personagem.inventario = personagem.inventario.filter(item =>
    !(item.origemTipo === tipoOrigem && item.origemNome === nomeOrigem)
  );

  if (opcao.apenasOuro) {
    // Opção de apenas dinheiro - adicionar à carteira
    personagem.moedas = adicionarMoeda(personagem.moedas, opcao.moedaTipo, opcao.moedaQtd);
    return;
  }

  // Processar cada item da opção
  for (let itemStr of opcao.itens) {
    // Resolver itens com "à sua escolha" - substituir por escolha do jogador se disponivel
    if (/à sua escolha/i.test(itemStr)) {
      // Para instrumentos musicais, usar o instrumento escolhido (do antecedente Artista ou escolha da classe)
      if (/instrumento musical/i.test(itemStr)) {
        const instrEscolhido = personagem.instrumento_classe_escolhido || personagem.instrumento_escolhido;
        if (instrEscolhido) {
          itemStr = instrEscolhido;
        } else {
          // Fallback: adicionar como "Instrumento Musical" generico
          itemStr = 'Instrumento Musical';
        }
      } else {
        // Outros itens "à sua escolha" - remover sufixo
        itemStr = itemStr.replace(/\s*à sua escolha/i, '').trim();
      }
    } else if (/\((?:a mesma|o mesmo)\s+que\s+acima\)/i.test(itemStr)) {
      // Pacote de equipamento do antecedente referenciando a própria ferramenta/
      // instrumento/kit escolhido na seção "Ferramentas" do antecedente (ex.:
      // Artesão: "Ferramentas de Artesão (a mesma que acima)"). Resolver para a
      // escolha real do jogador (personagem.escolhas_antecedente, o mesmo campo
      // que o popup do antecedente grava) em vez de deixar o marcador de texto
      // virar item genérico no inventário. Só o pacote do ANTECEDENTE usa esse
      // marcador -- tipoOrigem é 'antecedente' nesse caso.
      const antEscolha = tipoOrigem === 'antecedente' ? ANTECEDENTES_ESCOLHAS[nomeOrigem] : null;
      const escolhida = antEscolha ? personagem.escolhas_antecedente?.[antEscolha.campo] : null;
      itemStr = escolhida || itemStr.replace(/\s*\((?:a mesma|o mesmo)\s+que\s+acima\)/i, '').trim();
    }

    // Verificar se tem quantidade (ex: "2 Adagas", "20 Flechas")
    const qtyMatch = itemStr.match(/^(\d+)\s+(.+)$/);
    // Verificar formato "Nome (X unidades)" (ex: "Óleo (3 frascos)", "Pergaminho (10 folhas)")
    const qtyParenMatch = !qtyMatch ? itemStr.match(/^(.+?)\s*\((\d+)\s+\w+\)$/) : null;
    const quantidade = qtyMatch ? parseInt(qtyMatch[1]) : (qtyParenMatch ? parseInt(qtyParenMatch[2]) : 1);
    const nomeItem = qtyMatch ? qtyMatch[2] : (qtyParenMatch ? qtyParenMatch[1].trim() : itemStr);

    // Expandir kits que sao colecoes de itens (ex: Kit de Sacerdote -> seus itens individuais)
    const kitConteudo = KITS_EXPANSAO[nomeItem];
    if (kitConteudo) {
      for (const comp of kitConteudo) {
        const equipComp = dadosCache.equipAvent?.find(e =>
          semAcento(e.nome).toLowerCase() === semAcento(comp.nome).toLowerCase()
        );
        if (equipComp) {
          personagem.inventario.push({
            nome: equipComp.nome,
            tipo: 'equipamento',
            quantidade: comp.qtd,
            equipado: false,
            dados: { custo: equipComp.custo, peso: equipComp.peso, tipo_uso: equipComp.tipo_uso || '', descricao: equipComp.descricao || '' },
            origemTipo: tipoOrigem,
            origemNome: nomeOrigem
          });
        } else {
          // Fallback: item nao encontrado no banco, adicionar como generico
          personagem.inventario.push({
            nome: comp.nome,
            tipo: 'generico',
            quantidade: comp.qtd,
            equipado: false,
            dados: {},
            origemTipo: tipoOrigem,
            origemNome: nomeOrigem
          });
        }
      }
      continue;
    }

    // Singularizar nome para busca (ex: "Adagas" -> "Adaga", "Flechas" -> "Flecha")
    const nomeSingular = nomeItem
      .replace(/([ãõ])es$/i, '$1o')  // ex: não usado aqui, mas seguro
      .replace(/ões$/i, 'ão')
      .replace(/s$/i, '');

    // Tentar encontrar nos dados de armas (tenta plural original e depois singular)
    const arma = dadosCache.armas?.find(a => {
      const nomeArma = semAcento(a.nome).toLowerCase();
      return nomeArma === semAcento(nomeItem).toLowerCase() || nomeArma === semAcento(nomeSingular).toLowerCase();
    });
    if (arma) {
      personagem.inventario.push({
        nome: arma.nome,
        tipo: 'arma',
        quantidade,
        equipado: false,
        dados: { dano: arma.dano, propriedades: arma.propriedades, tipo_arma: arma.tipo, categoria: arma.categoria, maestria: arma.maestria, peso: arma.peso, custo: arma.custo },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Tentar encontrar nas armaduras (tenta plural, singular e sem prefixo "Armadura de")
    const nomeItemSemPrefixo = nomeItem.replace(/^Armadura de /i, '');
    const nomeSingularSemPrefixo = nomeSingular.replace(/^Armadura de /i, '');
    const armadura = dadosCache.armaduras?.find(a => {
      const nomeArm = semAcento(a.nome).toLowerCase();
      return nomeArm === semAcento(nomeItem).toLowerCase()
        || nomeArm === semAcento(nomeSingular).toLowerCase()
        || nomeArm === semAcento(nomeItemSemPrefixo).toLowerCase()
        || nomeArm === semAcento(nomeSingularSemPrefixo).toLowerCase();
    });
    if (armadura) {
      personagem.inventario.push({
        nome: armadura.nome,
        tipo: 'armadura',
        quantidade,
        equipado: false,
        dados: { ca: armadura.ca, categoria: armadura.categoria, requisito_forca: armadura.requisito_forca, furtividade: armadura.furtividade, peso: armadura.peso, custo: armadura.custo },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Tentar encontrar em equipamento de aventura (tenta plural e singular)
    const equip = dadosCache.equipAvent?.find(e => {
      const nomeEquip = semAcento(e.nome).toLowerCase();
      return nomeEquip === semAcento(nomeItem).toLowerCase() || nomeEquip === semAcento(nomeSingular).toLowerCase();
    });
    if (equip) {
      personagem.inventario.push({
        nome: equip.nome,
        tipo: 'equipamento',
        quantidade,
        equipado: false,
        dados: { custo: equip.custo, peso: equip.peso, tipo_uso: equip.tipo_uso || '', descricao: equip.descricao || '' },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Item não encontrado - adicionar como item genérico
    personagem.inventario.push({
      nome: nomeItem,
      tipo: 'generico',
      quantidade,
      equipado: false,
      dados: {},
      origemTipo: tipoOrigem,
      origemNome: nomeOrigem
    });
  }

  // Adicionar moeda da opção (se houver)
  if (opcao.moedaQtd > 0 && !opcao.apenasOuro) {
    personagem.moedas = adicionarMoeda(personagem.moedas, opcao.moedaTipo, opcao.moedaQtd);
  }
}

export async function renderStepEquipamento(el) {
  const info = CLASSES_INFO[personagem.classe];
  const classeData = dadosCache.classeData || await getClasse(personagem.classe);

  // Equipamento inicial da classe (chave "Equipamento Inicial" em tracos_basicos)
  let equipClasse = classeData?.tracos_basicos?.['Equipamento Inicial'] || '';

  // Equipamento do antecedente
  const antecedente = dadosCache.antecedentes?.find(a => a.nome === personagem.antecedente);
  const equipAntecedente = antecedente?.equipamento?.replace(/\*/g, '') || '';

  // Carregar armas e armaduras disponíveis
  const [armasData, armadurasData, equipAventData] = await Promise.all([
    getArmas(),
    getArmaduras(),
    getEquipamentoAventura()
  ]);
  dadosCache.armas = armasData?.armas || [];
  dadosCache.propriedadesArmas = armasData?.propriedades || [];
  dadosCache.armaduras = armadurasData?.armaduras || [];
  dadosCache.equipAvent = equipAventData?.itens || [];

  // Parsear opções de equipamento
  const opcoesClasse = parseEquipamentoOpcoes(equipClasse);
  const opcoesAntecedente = parseEquipamentoOpcoes(equipAntecedente);

  // Inicializar escolhas se necessário
  if (!personagem.escolha_equip_classe && opcoesClasse) personagem.escolha_equip_classe = null;
  if (!personagem.escolha_equip_antecedente && opcoesAntecedente) personagem.escolha_equip_antecedente = null;

  // Função para renderizar card de seleção de equipamento
  const renderCardEquip = (titulo, texto, opcoes, tipoOrigem, nomeOrigem, escolhaAtual) => {
    if (!opcoes) {
      return `
        <div class="card mb-2" style="border-left:3px solid ${tipoOrigem === 'classe' ? 'var(--primary)' : 'var(--accent)'}">
          <div class="card-header"><h3>${titulo}</h3></div>
          <div style="font-size:0.85rem;padding:8px 0">${texto.replace(/\*/g, '')}</div>
        </div>`;
    }

    return `
      <div class="card mb-2" style="border-left:3px solid ${tipoOrigem === 'classe' ? 'var(--primary)' : 'var(--accent)'}">
        <div class="card-header"><h3>${titulo}</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">
          ${opcoes.map(op => `
            <div class="selection-card ${escolhaAtual === op.letra ? 'selected' : ''}"
                 data-equip-tipo="${tipoOrigem}" data-equip-letra="${op.letra}"
                 style="flex:1;min-width:200px;cursor:pointer">
              <div class="card-nome" style="font-size:0.9rem;font-weight:600">Opção ${op.letra}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
                ${op.apenasOuro ? `<strong>${op.moedaQtd} ${op.moedaTipo.toUpperCase()}</strong> (apenas dinheiro)` : op.conteudo}
              </div>
            </div>
          `).join('')}
        </div>
        ${!escolhaAtual ? '<div class="info-box warning" style="font-size:0.8rem">Selecione uma opção acima para adicionar ao inventário</div>' : ''}
      </div>`;
  };

  // Verificar se o equipamento da classe requer escolha de instrumento musical
  const classeTemInstrumento = /instrumento musical à sua escolha/i.test(equipClasse);
  const instrumentosDisponiveis = ['Alaude', 'Corne', 'Flauta', 'Flauta de Pa', 'Gaita de Foles', 'Harpa', 'Lira', 'Oboe', 'Tambor', 'Violino'];

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Equipamento</h3>

    ${equipClasse ? renderCardEquip(
      `Equipamento Inicial da Classe (${personagem.classe})`,
      equipClasse,
      opcoesClasse,
      'classe',
      personagem.classe,
      personagem.escolha_equip_classe
    ) : ''}

    ${classeTemInstrumento ? `
    <div class="card mb-2" style="border-left:3px solid var(--primary)">
      <div class="card-header"><h3>Instrumento Musical (Classe)</h3></div>
      <div style="padding:4px 0">
        <select class="form-input" id="select-instrumento-classe" style="max-width:280px">
          <option value="">-- Escolha um instrumento --</option>
          ${instrumentosDisponiveis.map(i => `<option value="${i}" ${personagem.instrumento_classe_escolhido === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>
    </div>` : ''}

    ${equipAntecedente ? renderCardEquip(
      `Equipamento do Antecedente (${personagem.antecedente})`,
      equipAntecedente,
      opcoesAntecedente,
      'antecedente',
      personagem.antecedente,
      personagem.escolha_equip_antecedente
    ) : ''}

    <div class="card mb-2" style="border-left:3px solid var(--primary)">
      <label class="form-check" style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="cfg-sobrecarga-creator" ${personagem.config?.sobrecarga_afeta_deslocamento ? 'checked' : ''}>
        <span>Sobrecarga de peso reduz o Deslocamento</span>
      </label>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
        Opcional. Se ligado, carregar peso acima da capacidade máxima limita o Deslocamento a 1,5 m.
        Pode ser alterado depois no setor Inventário da ficha.
      </div>
    </div>

    <div class="card mb-2">
      <div class="card-header"><h3>Inventário</h3>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-accent" id="btn-add-arma">+ Arma</button>
          <button class="btn btn-sm btn-accent" id="btn-add-armadura">+ Armadura</button>
          <button class="btn btn-sm btn-accent" id="btn-add-item">+ Item</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-custom">+ Custom</button>
        </div>
      </div>
      <div id="lista-inventario">
        ${renderListaInventario()}
      </div>
    </div>

    <div class="card mb-2">
      <div class="card-header"><h3>Carteira</h3></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding:4px 0">
        ${DENOMINACOES.map(tipo => `
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">${ICONE_MOEDA[tipo]} ${tipo.toUpperCase()}</label>
            <input type="number" class="form-input" id="input-moeda-${tipo}" value="${personagem.moedas[tipo] || 0}" min="0" style="max-width:90px">
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Toggle de sobrecarga de peso
  const _cfgSobrecarga = document.getElementById('cfg-sobrecarga-creator');
  if (_cfgSobrecarga) {
    _cfgSobrecarga.addEventListener('change', () => {
      if (!personagem.config) personagem.config = {};
      personagem.config.sobrecarga_afeta_deslocamento = _cfgSobrecarga.checked;
    });
  }

  // Eventos de seleção de equipamento
  el.querySelectorAll('[data-equip-tipo]').forEach(card => {
    card.addEventListener('click', () => {
      const tipo = card.dataset.equipTipo;
      const letra = card.dataset.equipLetra;
      const opcoes = tipo === 'classe' ? opcoesClasse : opcoesAntecedente;
      const opcao = opcoes?.find(o => o.letra === letra);
      const nomeOrigem = tipo === 'classe' ? personagem.classe : personagem.antecedente;

      if (opcao) {
        // Remover moeda da escolha anterior, se houver (com conversao automatica)
        const escolhaAnterior = tipo === 'classe' ? personagem.escolha_equip_classe : personagem.escolha_equip_antecedente;
        if (escolhaAnterior) {
          const opAnterior = opcoes.find(o => o.letra === escolhaAnterior);
          if (opAnterior && opAnterior.moedaQtd > 0) {
            const resultado = removerQuantidadeMoeda(personagem.moedas, opAnterior.moedaTipo, opAnterior.moedaQtd);
            if (resultado.sucesso) {
              personagem.moedas = resultado.moedas;
            }
          }
        }

        // Atualizar escolha
        if (tipo === 'classe') personagem.escolha_equip_classe = letra;
        else personagem.escolha_equip_antecedente = letra;

        // Adicionar itens da nova escolha
        adicionarItensEquipamentoInicial(opcao, tipo, nomeOrigem);

        // Re-renderizar
        renderStepEquipamento(el);
      }
    });
  });

  // Eventos
  DENOMINACOES.forEach(tipo => {
    document.getElementById(`input-moeda-${tipo}`)?.addEventListener('input', (e) => {
      personagem.moedas[tipo] = Math.max(0, parseInt(e.target.value) || 0);
    });
  });

  // Evento de escolha de instrumento musical da classe
  document.getElementById('select-instrumento-classe')?.addEventListener('change', (e) => {
    personagem.instrumento_classe_escolhido = e.target.value || null;
    // Re-adicionar itens da opcao de classe selecionada para atualizar o instrumento
    if (personagem.escolha_equip_classe && opcoesClasse) {
      const opcao = opcoesClasse.find(o => o.letra === personagem.escolha_equip_classe);
      if (opcao) {
        adicionarItensEquipamentoInicial(opcao, 'classe', personagem.classe);
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) listaEl.innerHTML = renderListaInventario();
        setupEventosInventario(el);
      }
    }
  });

  document.getElementById('btn-add-arma')?.addEventListener('click', () => mostrarSeletorArma());
  document.getElementById('btn-add-armadura')?.addEventListener('click', () => mostrarSeletorArmadura());
  document.getElementById('btn-add-item')?.addEventListener('click', () => mostrarSeletorItem());
  document.getElementById('btn-add-custom')?.addEventListener('click', () => mostrarFormCustomItem());

  // Eventos de remover item
  setupEventosInventario(el);
}

/** Renderiza a lista completa do inventário com equipados primeiro */
function renderListaInventario() {
  // Barra de peso (atual / máximo) — recalculada a cada re-render da lista.
  const _pesoAtual = getPesoTotalInventario(personagem.inventario || []);
  const _cap = getCapacidadeCarga(personagem.atributos?.forca || 0, personagem.tamanho || 'Médio');
  const _barraPeso = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-light);margin-bottom:6px;font-size:0.8rem;color:var(--text-muted)"><span>Peso: <strong>${fmtPeso(_pesoAtual)}</strong> / ${fmtPeso(_cap)} kg</span></div>`;

  if (personagem.inventario.length === 0) {
    return _barraPeso + '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:12px">Nenhum item adicionado</div>';
  }

  // Criar array de índices originais, separar equipados e não equipados
  const equipados = [];
  const naoEquipados = [];
  personagem.inventario.forEach((item, idx) => {
    if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  let html = _barraPeso;

  if (equipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Equipados</span></div>';
    html += equipados.map(idx => renderItemInventario(personagem.inventario[idx], idx)).join('');
  }

  if (naoEquipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Mochila</span></div>';
    html += naoEquipados.map(idx => renderItemInventario(personagem.inventario[idx], idx)).join('');
  }

  return html;
}

function renderItemInventario(item, idx) {
  // Verificar proficiência para armas e armaduras
  let profBadge = '';
  if (item.tipo === 'arma' && item.dados?.categoria) {
    const prof = temProficienciaArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
    profBadge = prof ? '<span class="badge badge-prof-sm">Prof</span>' : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
  }
  if ((item.tipo === 'armadura' || item.tipo === 'escudo') && item.dados?.categoria) {
    const prof = temProficienciaArmadura({ categoria: item.dados.categoria, nome: item.nome });
    profBadge = prof ? '<span class="badge badge-prof-sm">Prof</span>' : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
  }

  // Badge de tipo de uso (consumivel, equipamento)
  let tipoBadge = '';
  const tipoUso = item.dados?.tipo_uso || '';
  if (tipoUso === 'consumivel') {
    tipoBadge = '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">Consumível</span>';
  }

  // Descricao curta para equipamentos
  const descCurta = item.dados?.descricao || item.descricao || '';
  const descPreview = descCurta && item.tipo === 'equipamento'
    ? `<div class="inv-item-detalhe" style="font-size:0.7rem;color:var(--text-muted);margin-top:1px">${descCurta.length > 80 ? descCurta.substring(0, 80) + '...' : descCurta}</div>`
    : '';

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''}" data-idx="${idx}" draggable="true">
      <div class="inv-drag-handle" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;cursor:pointer" data-info-inv="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">${item.nome} ${profBadge} ${tipoBadge}</div>
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${item.dados?.dano || ''} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'customizado' ? `${item.descricao || ''}` : ''}
          ${item.tipo === 'generico' ? `${item.descricao || ''}` : ''}
        </div>
        ${descPreview}
      </div>
      <div class="inv-item-acoes" style="align-items:center">
        <div class="inv-qty-control" style="display:flex;align-items:center;gap:2px">
          <button class="btn btn-sm btn-icon" data-qty-minus-inv="${idx}" style="font-size:0.7rem;padding:1px 5px">−</button>
          <span style="min-width:20px;text-align:center;font-size:0.8rem;font-weight:700">${item.quantidade ?? 1}</span>
          <button class="btn btn-sm btn-icon" data-qty-plus-inv="${idx}" style="font-size:0.7rem;padding:1px 5px">+</button>
        </div>
        <label class="form-check inv-equip-label" title="Equipar/Desequipar">
          <input type="checkbox" data-equip-idx="${idx}" ${item.equipado ? 'checked' : ''}> Eq.
        </label>
        <button class="btn btn-sm btn-danger btn-icon" data-remover-idx="${idx}">&times;</button>
      </div>
    </div>
  `;
}

function setupEventosInventario(containerEl) {
  // Remover item (com confirmação)
  containerEl.querySelectorAll('[data-remover-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.removerIdx);
      const item = personagem.inventario[idx];
      if (!item) return;
      abrirModal('Remover Item', `
        <p>Deseja realmente remover <strong>${item.nome}</strong>${item.quantidade > 1 ? ` (x${item.quantidade})` : ''} do inventário?</p>
      `, `
        <button class="btn btn-danger" id="btn-confirmar-rem-inv">Remover</button>
        <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      `);
      document.getElementById('btn-confirmar-rem-inv')?.addEventListener('click', () => {
        personagem.inventario.splice(idx, 1);
        fecharModal();
        renderStepEquipamento(containerRef.querySelector('#wizard-content') || containerRef);
      });
    });
  });

  // Equipar/desequipar item (re-renderiza para reorganizar)
  containerEl.querySelectorAll('[data-equip-idx]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.equipIdx);
      if (personagem.inventario[idx]) {
        personagem.inventario[idx].equipado = cb.checked;
        // Re-renderizar inventário para reorganizar
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) {
          listaEl.innerHTML = renderListaInventario();
          setupEventosInventario(containerEl);
        }
      }
    });
  });

  // Quantidade +/-
  containerEl.querySelectorAll('[data-qty-plus-inv]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyPlusInv);
      if (personagem.inventario[idx]) {
        personagem.inventario[idx].quantidade = (personagem.inventario[idx].quantidade ?? 1) + 1;
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) { listaEl.innerHTML = renderListaInventario(); setupEventosInventario(containerEl); }
      }
    });
  });
  containerEl.querySelectorAll('[data-qty-minus-inv]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyMinusInv);
      if (personagem.inventario[idx]) {
        const novaQtd = Math.max(0, (personagem.inventario[idx].quantidade ?? 1) - 1);
        if (novaQtd <= 0) {
          personagem.inventario.splice(idx, 1);
        } else {
          personagem.inventario[idx].quantidade = novaQtd;
        }
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) { listaEl.innerHTML = renderListaInventario(); setupEventosInventario(containerEl); }
      }
    });
  });

  // Ver detalhes do item ao clicar
  containerEl.querySelectorAll('[data-info-inv]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button')) return;
      const idx = parseInt(el.dataset.infoInv);
      const item = personagem.inventario[idx];
      if (item) mostrarDetalheItem(item);
    });
  });

  // Drag and drop para reordenar
  setupDragDropInventario(containerEl);
}

/** Configura drag-and-drop no inventário */
function setupDragDropInventario(containerEl) {
  const listaEl = document.getElementById('lista-inventario');
  if (!listaEl) return;

  let dragIdx = null;

  listaEl.querySelectorAll('.inv-item[draggable]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      dragIdx = parseInt(el.dataset.idx);
      el.classList.add('inv-item-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('inv-item-dragging');
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      dragIdx = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('inv-item-dragover');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('inv-item-dragover');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropIdx = parseInt(el.dataset.idx);
      if (dragIdx !== null && dragIdx !== dropIdx) {
        // Mover item na posição
        const [item] = personagem.inventario.splice(dragIdx, 1);
        personagem.inventario.splice(dropIdx, 0, item);

        listaEl.innerHTML = renderListaInventario();
        setupEventosInventario(containerEl);
      }
    });
  });
}

function mostrarSeletorArma() {
  const armas = dadosCache.armas || [];
  // Ordenar: proficientes primeiro
  const armasOrdenadas = [...armas].sort((a, b) => {
    const pa = temProficienciaArma(a) ? 0 : 1;
    const pb = temProficienciaArma(b) ? 0 : 1;
    return pa - pb;
  });
  const html = `
    <div class="search-box"><input type="text" id="busca-arma" placeholder="Buscar arma..." class="form-input"></div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline filtro-arma active" data-filtro="todas">Todas</button>
      <button class="btn btn-sm btn-outline filtro-arma" data-filtro="proficiente">Proficientes</button>
      <button class="btn btn-sm btn-outline filtro-arma" data-filtro="simples">Simples</button>
      <button class="btn btn-sm btn-outline filtro-arma" data-filtro="marcial">Marcial</button>
    </div>
    <div id="lista-armas" style="min-height:35dvh;max-height:50dvh;overflow-y:auto">
      ${armasOrdenadas.map((a, i) => {
        const prof = temProficienciaArma(a);
        const tipoCateg = a.categoria?.includes('Simples') ? 'simples' : 'marcial';
        const subCateg = a.categoria?.includes('Distância') ? 'Distância' : 'Corpo';
        return `
        <div class="inv-item ${prof ? 'item-proficiente' : 'item-sem-prof'}" style="cursor:pointer" data-arma-nome="${a.nome}" data-prof="${prof}" data-tipo="${tipoCateg}">
          <div style="flex:1">
            <div class="inv-item-nome">${a.nome} ${badgeProficiencia(prof)}</div>
            <div class="inv-item-detalhe">${a.dano} | ${a.propriedades || '—'}</div>
            <div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">Maestria: ${a.maestria || '—'} | ${a.custo} | ${a.peso || '—'}</div>
          </div>
          <span class="badge badge-secondary">${subCateg}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  abrirModal('Adicionar Arma', html);

  // Filtros de categoria
  let filtroAtual = 'todas';
  document.querySelectorAll('.filtro-arma').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-arma').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aplicarFiltrosArma();
    });
  });

  function aplicarFiltrosArma() {
    const termo = semAcento(document.getElementById('busca-arma')?.value || '');
    document.querySelectorAll('#lista-armas [data-arma-nome]').forEach(el => {
      const matchTexto = !termo || semAcento(el.textContent).includes(termo);
      const matchFiltro = filtroAtual === 'todas'
        || (filtroAtual === 'proficiente' && el.dataset.prof === 'true')
        || (filtroAtual === el.dataset.tipo);
      el.style.display = (matchTexto && matchFiltro) ? '' : 'none';
    });
  }

  // Busca por texto
  document.getElementById('busca-arma')?.addEventListener('input', () => aplicarFiltrosArma());

  // Seleção
  document.querySelectorAll('#lista-armas [data-arma-nome]').forEach(el => {
    el.addEventListener('click', () => {
      const arma = armasOrdenadas.find(a => a.nome === el.dataset.armaNome);
      if (!arma) return;
      personagem.inventario.push({
        nome: arma.nome, tipo: 'arma', quantidade: 1, equipado: false,
        descricao: `${arma.dano} - ${arma.propriedades}`,
        dados: { dano: arma.dano, propriedades: arma.propriedades, maestria: arma.maestria, peso: arma.peso, custo: arma.custo, categoria: arma.categoria }
      });
      window.fecharModal();
      const wizContent = document.getElementById('wizard-content');
      if (wizContent) renderStepEquipamento(wizContent);
    });
  });
}

function mostrarSeletorArmadura() {
  const armaduras = dadosCache.armaduras || [];
  // Ordenar: proficientes primeiro
  const armadurasOrdenadas = [...armaduras].sort((a, b) => {
    const pa = temProficienciaArmadura(a) ? 0 : 1;
    const pb = temProficienciaArmadura(b) ? 0 : 1;
    return pa - pb;
  });
  const html = `
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline filtro-armadura active" data-filtro="todas">Todas</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="proficiente">Proficientes</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="leve">Leve</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="média">Média</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="pesada">Pesada</button>
    </div>
    <div id="lista-armaduras" style="min-height:35dvh;max-height:50dvh;overflow-y:auto">
      ${armadurasOrdenadas.map((a, i) => {
        const prof = temProficienciaArmadura(a);
        const reqOk = atendeRequisitoForca(a);
        const cat = (a.categoria || '').toLowerCase();
        return `
        <div class="inv-item ${prof ? 'item-proficiente' : 'item-sem-prof'}" style="cursor:pointer" data-arm-nome="${a.nome}" data-prof="${prof}" data-cat="${cat}">
          <div style="flex:1">
            <div class="inv-item-nome">${a.nome} ${badgeProficiencia(prof)} ${!reqOk ? '<span class="badge badge-warn">For. insuficiente</span>' : ''}</div>
            <div class="inv-item-detalhe">CA: ${a.ca} | For: ${a.requisito_forca || '—'} | ${a.custo}${a.furtividade && a.furtividade !== '—' ? ' | <em>' + a.furtividade + '</em>' : ''}</div>
            <div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">Peso: ${a.peso || '—'}</div>
          </div>
          <span class="badge badge-secondary">${a.categoria}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  abrirModal('Adicionar Armadura', html);

  // Filtros
  document.querySelectorAll('.filtro-armadura').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro-armadura').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filtro = btn.dataset.filtro;
      document.querySelectorAll('#lista-armaduras [data-arm-nome]').forEach(el => {
        const matchFiltro = filtro === 'todas'
          || (filtro === 'proficiente' && el.dataset.prof === 'true')
          || el.dataset.cat === filtro;
        el.style.display = matchFiltro ? '' : 'none';
      });
    });
  });

  document.querySelectorAll('#lista-armaduras [data-arm-nome]').forEach(el => {
    el.addEventListener('click', () => {
      const arm = armadurasOrdenadas.find(a => a.nome === el.dataset.armNome);
      if (!arm) return;
      personagem.inventario.push({
        nome: arm.nome, tipo: arm.nome === 'Escudo' ? 'escudo' : 'armadura',
        quantidade: 1, equipado: false,
        descricao: `CA: ${arm.ca}`,
        dados: { ca: arm.ca, categoria: arm.categoria, requisito_forca: arm.requisito_forca, furtividade: arm.furtividade, peso: arm.peso, custo: arm.custo }
      });
      window.fecharModal();
      const wizContent = document.getElementById('wizard-content');
      if (wizContent) renderStepEquipamento(wizContent);
    });
  });
}

function mostrarSeletorItem() {
  const itens = dadosCache.equipAvent || [];
  const html = `
    <div class="search-box"><input type="text" id="busca-item" placeholder="Buscar item..." class="form-input"></div>
    <div id="lista-itens" style="min-height:35dvh;max-height:50dvh;overflow-y:auto">
      ${itens.map((it, i) => `
        <div class="inv-item" style="cursor:pointer" data-item-idx="${i}">
          <div>
            <div class="inv-item-nome">${it.nome}</div>
            <div class="inv-item-detalhe">${it.peso || ''} | ${it.custo || ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  abrirModal('Adicionar Item', html);

  document.getElementById('busca-item')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    document.querySelectorAll('#lista-itens [data-item-idx]').forEach(el => {
      el.style.display = semAcento(el.textContent).includes(termo) ? '' : 'none';
    });
  });

  document.querySelectorAll('#lista-itens [data-item-idx]').forEach(el => {
    el.addEventListener('click', () => {
      const item = itens[parseInt(el.dataset.itemIdx)];
      personagem.inventario.push({
        nome: item.nome, tipo: 'equipamento', quantidade: 1, equipado: false,
        descricao: '', dados: { peso: item.peso, custo: item.custo }
      });
      window.fecharModal();
      const wizContent = document.getElementById('wizard-content');
      if (wizContent) renderStepEquipamento(wizContent);
    });
  });
}

function mostrarFormCustomItem() {
  const html = `
    <div class="form-group">
      <label class="form-label">Nome do Item</label>
      <input type="text" class="form-input" id="custom-nome" placeholder="Ex: Espada do Destino">
    </div>
    <div class="form-group">
      <label class="form-label">Descricao</label>
      <textarea class="form-textarea" id="custom-desc" placeholder="Descricao do item..."></textarea>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label">Bonus CA</label>
        <input type="number" class="form-input" id="custom-ca" value="0">
      </div>
      <div class="col">
        <label class="form-label">Dano</label>
        <input type="text" class="form-input" id="custom-dano" placeholder="Ex: 1d8+2 Cortante">
      </div>
      <div class="col">
        <label class="form-label">Bonus Ataque</label>
        <input type="number" class="form-input" id="custom-ataque" value="0">
      </div>
    </div>
    <div class="form-group" style="margin-top:8px">
      <label class="form-label">Peso (opcional)</label>
      <input type="number" class="form-input" id="custom-peso" placeholder="0" min="0" step="0.1" style="max-width:140px">
      <div style="font-size:0.65rem;color:var(--text-muted)">em kg (ex: 0,5)</div>
    </div>
  `;

  abrirModal('Item Customizado', html,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-custom">Adicionar</button>'
  );

  document.getElementById('btn-salvar-custom')?.addEventListener('click', () => {
    const nome = document.getElementById('custom-nome')?.value?.trim();
    if (!nome) { toast('Informe um nome', 'error'); return; }

    const _pesoRaw = document.getElementById('custom-peso')?.value?.trim() || '';
    const _pesoNum = _pesoRaw ? parseFloat(_pesoRaw.replace(',', '.')) : 0;
    personagem.inventario.push({
      nome: nome,
      tipo: 'customizado',
      quantidade: 1,
      equipado: false,
      descricao: document.getElementById('custom-desc')?.value || '',
      dados: {
        bonus_ca: document.getElementById('custom-ca')?.value || '0',
        dano: document.getElementById('custom-dano')?.value || '',
        bonus_ataque: document.getElementById('custom-ataque')?.value || '0',
        peso: (_pesoNum > 0 ? `${fmtPeso(_pesoNum)} kg` : '')
      }
    });
    window.fecharModal();
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepEquipamento(wizContent);
  });
}

// Mostra popup com detalhes completos de um item do inventário
function mostrarDetalheItem(item) {
  if (!item) return;
  let corpo = '';

  if (item.tipo === 'arma') {
    const d = item.dados || {};
    corpo += `<div class="row" style="font-size:0.85rem;gap:8px;margin-bottom:10px">`;
    if (d.categoria) corpo += `<div class="col"><strong>Categoria:</strong> ${d.categoria}</div>`;
    if (d.dano) corpo += `<div class="col"><strong>Dano:</strong> ${d.dano}</div>`;
    corpo += `</div>`;

    if (d.maestria) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Maestria:</strong> ${d.maestria}</div>`;
    if (d.custo || d.peso) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;

    // Mostrar descrições das propriedades
    if (d.propriedades) {
      const propsNomes = d.propriedades.split(',').map(p => p.trim().replace(/\s*\(.*\)/, ''));
      const propsDescs = (dadosCache.propriedadesArmas || []);
      const propsComDesc = propsNomes
        .map(nome => {
          const prop = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(nome).toLowerCase());
          return prop ? { nome: prop.nome, descricao: prop.descricao } : null;
        })
        .filter(Boolean);

      if (propsComDesc.length > 0) {
        corpo += `<div class="section-divider mt-1"><span>Propriedades</span></div>`;
        corpo += propsComDesc.map(p => `
          <details style="margin-bottom:4px">
            <summary style="font-weight:600;cursor:pointer;font-size:0.85rem">${p.nome}</summary>
            <div class="md-content" style="padding:4px 0;font-size:0.8rem">${mdParaHtml(p.descricao)}</div>
          </details>
        `).join('');
      }

      // Mostrar descrição da maestria
      if (d.maestria) {
        const maestriaDesc = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(d.maestria).toLowerCase());
        if (maestriaDesc) {
          corpo += `<div class="section-divider mt-1"><span>Maestria: ${d.maestria}</span></div>`;
          corpo += `<div class="md-content" style="font-size:0.8rem">${mdParaHtml(maestriaDesc.descricao)}</div>`;
        }
      }
    }
  } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
    const d = item.dados || {};
    corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
    if (d.categoria) corpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
    if (d.ca) corpo += `<strong>Classe de Armadura:</strong> ${d.ca}<br>`;
    if (d.requisito_forca && d.requisito_forca !== '—') corpo += `<strong>Requisito de Força:</strong> ${d.requisito_forca}<br>`;
    if (d.furtividade && d.furtividade !== '—') corpo += `<strong>Furtividade:</strong> ${d.furtividade}<br>`;
    if (d.custo || d.peso) corpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
    corpo += `</div>`;
  } else {
    const d = item.dados || {};
    if (d.custo || d.peso) {
      corpo += `<div style="font-size:0.85rem"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
    }
    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  }

  if (!corpo.trim()) corpo = '<div style="color:var(--text-muted)">Sem informações adicionais disponíveis.</div>';

  abrirModal(item.nome, corpo);
}