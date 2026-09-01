// ============================================================
// Passo 5: equipamento inicial e inventario
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { getClasse } from '../db.js';
import { DENOMINACOES, ICONE_MOEDA, adicionarMoeda, removerQuantidadeMoeda } from '../moedas.js';
import { abrirModal, escHtml, fmtPeso, getCapacidadeCarga, getPesoTotalInventario, mdParaHtml, semAcento, toast } from '../utils.js';
import { ANTECEDENTES_ESCOLHAS, KITS_EXPANSAO } from './comum.js';
import { containerRef, dadosCache, personagem } from './wizard.js';
import { temProficienciaArma, temProficienciaArmadura } from '../regras-equipamento.js';
import { abrirSeletorItens, carregarDadosEquipSheet } from '../itens-seletor.js';

// Preferencia do toggle "Comprar" DENTRO do criador. Deliberadamente uma
// variavel de modulo, e nao localStorage: guardar no localStorage faria o
// criador lembrar entre personagens, contra a decisao de nascer desligado;
// e resetar a cada abertura do modal obrigaria a religar o toggle a cada
// item, ja que o modal fecha depois de cada adicao. Assim comeca desligada
// em cada carga da pagina e sobrevive enquanto se compra.
let _comprarAtivoCriador = false;

// ============================================================
// PASSO 5: EQUIPAMENTO
// ============================================================

// Função para parsear opções de equipamento (A, B, C, etc)
// Exportada para o oráculo `equipamento-inicial-acervo.test.mjs` varrer o
// pacote inicial de todas as classes e antecedentes com o MESMO parser que
// o criador usa.
export function parseEquipamentoOpcoes(texto) {
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

// Instrumentos oferecidos no dropdown do PASSO DA CLASSE (Bardo).
//
// EXPORTADA porque era uma const local dentro de renderStepEquipamento e,
// por isso, invisivel para a varredura de equipamento-inicial-acervo.test.mjs
// -- que media as outras duas listas de instrumento do app
// (INSTRUMENTOS_MUSICAIS e ANTECEDENTES_ESCOLHAS['Artista']) e nao esta.
// As TRES divergem entre si e do livro: esta nao usa acento nenhum
// ('Alaude', 'Oboe') e escreve 'Flauta de Pa' onde o livro traz 'Flauta de
// Pan' e o antecedente traz 'Flauta de Pã'. Nenhum instrumento tem entrada
// propria no acervo (o livro so os lista na prosa "**Variantes:**"), entao
// hoje todos caem no ramo generico -- divida declarada no oraculo.
export const INSTRUMENTOS_PASSO_CLASSE = [
  'Alaude', 'Corne', 'Flauta', 'Flauta de Pa', 'Gaita de Foles',
  'Harpa', 'Lira', 'Oboe', 'Tambor', 'Violino'
];

// Conectivos que a camada do LIVRO usa e a do DADO omite: o pacote inicial
// do antecedente diz "Roupas de Viagem", a tabela de Equipamento de
// Aventura grava "Roupas, Viagem" (convencao de indice, substantivo
// primeiro). "e"/"ou" NAO entram nesta lista: sao parte do nome em
// "Roldana e Polias" e "Estojo, Mapa ou Pergaminho".
const CONECTIVOS_NOME_ITEM = new Set(['de', 'da', 'do', 'das', 'dos']);

/** Reduz uma palavra ao singular (ex: "Roupas" -> "roupa", "Grilhões" -> "grilhao") */
function singularizarPalavra(palavra) {
  if (/oes$/.test(palavra)) return palavra.replace(/oes$/, 'ao');
  if (/s$/.test(palavra)) return palavra.replace(/s$/, '');
  return palavra;
}

/**
 * Chave de casamento de um nome de item entre a camada do livro (pacote
 * inicial de classes e antecedentes) e a do dado (o acervo).
 *
 * Aplicada aos DOIS lados, ela absorve as tres divergencias de escrita que
 * existem entre as camadas -- acento, a virgula da convencao de indice e o
 * conectivo, e o plural. TODAS as palavras restantes continuam na chave, de
 * proposito: e isso que impede "Roupas Finas" de casar com "Roupas de
 * Viagem" ou "Balde de Ferro" com "Balde". Reduzir o nome ao primeiro
 * substantivo casaria itens diferentes, que e um defeito pior que o que
 * esta funcao conserta (issue #43).
 */
function chaveNomeItem(nome) {
  return semAcento(String(nome || ''))
    .replace(/[,;.]/g, ' ')
    .split(/\s+/)
    .filter(palavra => palavra && !CONECTIVOS_NOME_ITEM.has(palavra))
    .map(singularizarPalavra)
    .filter(Boolean)
    .join(' ');
}

/** Remove o qualificador entre parenteses no fim do nome ("Foco Arcano (orbe)" -> "Foco Arcano") */
function semQualificador(nome) {
  return String(nome || '').replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/**
 * Resolve "Categoria (Forma)" para a VARIANTE nomeada da categoria.
 *
 * "Foco Arcano" e "Foco Druidico" entram na tabela de equipamento com peso
 * "Varia" -- que `parsePeso` le como 0 kg. O peso de verdade e por forma,
 * numa tabela propria do livro: Cajado 2 kg, Orbe 1,5 kg, Cristal 0,5 kg,
 * Ramo de visco "—". Os pacotes de classe pedem a forma por extenso ("Foco
 * Arcano (Cajado)" no Mago, "(orbe)" no Bruxo, "(cristal)" no Feiticeiro),
 * entao da para entregar a variante certa em vez da entrada generica.
 * Sem isto, "foco arcano cajado" -- citado por escrito na issue #43 --
 * continuaria pesando zero mesmo depois do conserto do casamento.
 *
 * A forma casa por chave exata ou, se nao houver, por PREFIXO com resultado
 * UNICO dentro da propria categoria -- o livro chama o cajado druidico de
 * "Cajado de madeira (tambem um Bastao)" e a Druida pede so "Cajado". O
 * prefixo so e aceito quando uma unica variante da categoria comeca por
 * ele; com duas, nao ha como saber qual, e nenhuma e devolvida.
 */
function acharVarianteDeFoco(focos, nomeItem) {
  if (!Array.isArray(focos) || focos.length === 0) return null;
  const comQualificador = String(nomeItem || '').match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (!comQualificador) return null;
  const chaveCategoria = chaveNomeItem(comQualificador[1]);
  const chaveForma = chaveNomeItem(comQualificador[2]);
  if (!chaveCategoria || !chaveForma) return null;

  const daCategoria = focos.filter(f => chaveNomeItem(f.categoria) === chaveCategoria);
  if (daCategoria.length === 0) return null;

  // O nome da variante tambem pode trazer parenteses ("Cajado (tambem um
  // Bastao)") -- o que interessa e a parte antes deles.
  const chaveDe = (f) => chaveNomeItem(semQualificador(f.nome));
  const exata = daCategoria.find(f => chaveDe(f) === chaveForma);
  if (exata) return exata;

  const porPrefixo = daCategoria.filter(f => chaveDe(f).startsWith(`${chaveForma} `));
  return porPrefixo.length === 1 ? porPrefixo[0] : null;
}

/** Todas as chaves de nome do acervo inteiro, para guardar a regra de apelido abaixo */
function chavesDoAcervo(acervo) {
  const chaves = new Set();
  for (const lista of [acervo.armas, acervo.armaduras, acervo.equipAvent,
                       acervo.municao, acervo.ferramentas, acervo.focos]) {
    for (const entrada of lista || []) chaves.add(chaveNomeItem(entrada?.nome || ''));
  }
  return chaves;
}

/**
 * Indice de APELIDOS da convencao de virgula do acervo.
 *
 * A tabela de Equipamento de Aventura guarda "Roupas, Fantasia"
 * (substantivo primeiro, para ordenar por "Roupas"), mas o LIVRO chama o
 * mesmo item de "Fantasia" -- e assim ele aparece no pacote do Charlatao e
 * do Artista. O apelido e o nome sem o primeiro substantivo.
 *
 * DOIS guardas, porque a regra e a mais perigosa das tres -- e a unica que
 * DESCARTA uma palavra, enquanto `chaveNomeItem` preserva todas:
 *   1. um apelido que JA E o nome de outro item do acervo nao vale.
 *      "Balas, Funda" apelidaria "funda", que e a arma Funda. Hoje a ordem
 *      das buscas ja evitaria o estrago sozinha (armas e consultada antes
 *      da lista de equipamento/municao, e "Funda" casa exato la), mas essa
 *      protecao e acidental: some se alguem trocar a ordem, ou se um
 *      componente de KITS_EXPANSAO passar a chamar "Funda" -- o ramo de
 *      kit consulta `equipAvent` direto, sem passar por armas. O guarda
 *      torna a regra segura independente da ordem;
 *   2. um apelido disputado por duas entradas nao vale para nenhuma.
 */
function indiceApelidos(lista, chavesProibidas) {
  const apelidos = new Map();
  const disputados = new Set();
  for (const entrada of lista) {
    const nome = entrada?.nome || '';
    if (!nome.includes(',')) continue;
    const palavras = chaveNomeItem(nome).split(' ');
    if (palavras.length < 2) continue;
    const apelido = palavras.slice(1).join(' ');
    if (!apelido || chavesProibidas.has(apelido)) continue;
    if (apelidos.has(apelido)) { disputados.add(apelido); continue; }
    apelidos.set(apelido, entrada);
  }
  for (const apelido of disputados) apelidos.delete(apelido);
  return apelidos;
}

/**
 * Acha na lista do acervo a entrada cujo nome casa com `nome` (ou com um
 * dos nomes `alternativos`).
 *
 * Tres tentativas, da mais exigente para a mais frouxa, e a ordem importa:
 *   1. o nome COMPLETO -- senao "Cantil (cheio)", que existe assim no
 *      acervo, perderia o proprio par para a tentativa 2;
 *   2. sem o qualificador entre parenteses ("Foco Arcano (orbe)");
 *   3. o apelido da convencao de virgula ("Fantasia" -> "Roupas,
 *      Fantasia"), so quando `chavesProibidas` e informado.
 */
function acharPorNome(lista, nome, alternativas = [], chavesProibidas = null) {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const candidatos = [nome, ...alternativas].filter(Boolean);
  const tentativas = [
    candidatos,
    candidatos.map(semQualificador).filter((n, i) => n && n !== candidatos[i])
  ];
  for (const grupo of tentativas) {
    if (grupo.length === 0) continue;
    const chaves = new Set(grupo.map(chaveNomeItem));
    const achado = lista.find(e => chaves.has(chaveNomeItem(e.nome || '')));
    if (achado) return achado;
  }
  if (chavesProibidas) {
    const apelidos = indiceApelidos(lista, chavesProibidas);
    if (apelidos.size > 0) {
      for (const candidato of candidatos) {
        const achado = apelidos.get(chaveNomeItem(candidato));
        if (achado) return achado;
      }
    }
  }
  return null;
}

/**
 * Monta as entradas de inventário de uma opção de equipamento inicial.
 *
 * PURA de propósito: não toca `personagem`, `dadosCache` nem o DOM. O
 * acervo e as escolhas já resolvidas do jogador entram por parâmetro, e é
 * isso que permite ao oráculo `equipamento-inicial-acervo.test.mjs` varrer
 * o pacote inicial das 12 classes e de todos os antecedentes chamando a
 * MESMA função que o criador chama -- em vez de reimplementar o casamento
 * dentro do teste, que só provaria que o teste concorda consigo mesmo.
 *
 * `acervo`: { armas, armaduras, equipAvent, municao, ferramentas }.
 * `escolhas`: { instrumento, escolhasAntecedente }.
 */
export function montarItensEquipamentoInicial(opcao, tipoOrigem, nomeOrigem, acervo = {}, escolhas = {}) {
  const montados = [];
  if (!opcao || opcao.apenasOuro) return montados;

  // Calculado uma vez: guarda a regra de apelido de `acharPorNome` contra
  // entregar um item quando o apelido e o nome real de OUTRO item.
  const chavesProibidas = chavesDoAcervo(acervo);

  // Processar cada item da opção
  for (let itemStr of opcao.itens || []) {
    // Resolver itens com "à sua escolha" - substituir por escolha do jogador se disponivel
    if (/à sua escolha/i.test(itemStr)) {
      // Para instrumentos musicais, usar o instrumento escolhido (do antecedente Artista ou escolha da classe)
      if (/instrumento musical/i.test(itemStr)) {
        // Sem escolha feita, cai no "Instrumento Musical" generico do acervo
        itemStr = escolhas.instrumento || 'Instrumento Musical';
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
      const escolhida = antEscolha ? escolhas.escolhasAntecedente?.[antEscolha.campo] : null;
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
        const equipComp = acharPorNome(acervo.equipAvent, comp.nome, [], chavesProibidas);
        if (equipComp) {
          montados.push({
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
          montados.push({
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

    // Variante nomeada de foco ("Foco Arcano (Cajado)"): tem de ser tentada
    // ANTES das buscas por nome, senao `semQualificador` casaria com a
    // entrada generica "Foco Arcano" e o item voltaria a pesar "Varia".
    const foco = acharVarianteDeFoco(acervo.focos, nomeItem);
    if (foco) {
      montados.push({
        nome: `${foco.categoria} (${semQualificador(foco.nome)})`,
        tipo: 'equipamento',
        quantidade,
        equipado: false,
        dados: { custo: foco.custo, peso: foco.peso, tipo_uso: '', descricao: '' },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Tentar encontrar nos dados de armas
    const arma = acharPorNome(acervo.armas, nomeItem, [], chavesProibidas);
    if (arma) {
      montados.push({
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

    // Tentar encontrar nas armaduras (o acervo grava "Couro"; o pacote da
    // classe diz "Armadura de Couro" -- daí o nome alternativo sem prefixo)
    const armadura = acharPorNome(acervo.armaduras, nomeItem, [nomeItem.replace(/^Armadura de /i, '')], chavesProibidas);
    if (armadura) {
      montados.push({
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

    // Tentar encontrar em equipamento de aventura, na municao E nas ferramentas.
    // `municao` e lista SEPARADA de proposito -- fundi-las faria a categoria
    // "Equipamento" do seletor listar as flechas duas vezes --, mas para
    // resolver o nome do pacote inicial as duas valem igual: "20 Flechas" do
    // Guardiao e do Ladino so casa na de municao. `ferramentas` entrou pelo
    // mesmo motivo (issue #43): "Ferramentas de Ladrao" do pacote do Ladino so
    // tem peso na tabela de ferramentas.
    const baseItens = [
      ...(acervo.equipAvent || []),
      ...(acervo.municao || []),
      ...(acervo.ferramentas || [])
    ];
    const equip = acharPorNome(baseItens, nomeItem, [], chavesProibidas);
    if (equip) {
      montados.push({
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
    montados.push({
      nome: nomeItem,
      tipo: 'generico',
      quantidade,
      equipado: false,
      dados: {},
      origemTipo: tipoOrigem,
      origemNome: nomeOrigem
    });
  }

  return montados;
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

  personagem.inventario.push(
    ...montarItensEquipamentoInicial(opcao, tipoOrigem, nomeOrigem, dadosCache, {
      instrumento: personagem.instrumento_classe_escolhido || personagem.instrumento_escolhido,
      escolhasAntecedente: personagem.escolhas_antecedente
    })
  );

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

  // Carregador compartilhado com a ficha (itens-seletor.js). Antes de
  // 2026-08-13 este passo montava o cache a mao e descartava a chave
  // `municao` do JSON -- por isso municao era inalcancavel pelo botao
  // "+ Item" do criador (nao dava para comprar/adicionar municao na
  // criacao). Disponibilizar dadosCache.municao aqui tambem foi o que
  // permitiu `adicionarItensEquipamentoInicial` (abaixo) passar a consultar
  // essa lista -- as "20 Flechas" do pacote da classe (Guardiao, Ladino)
  // agora resolvem com peso e custo em vez de cair no ramo generico.
  const dadosEquip = await carregarDadosEquipSheet();
  dadosCache.armas = dadosEquip.armas;
  dadosCache.armaduras = dadosEquip.armaduras;
  dadosCache.equipAvent = dadosEquip.equipAvent;
  dadosCache.municao = dadosEquip.municao;
  // Ferramentas: a unica lista com o peso de "Ferramentas de Ladrao",
  // "Kit de Herbalismo" e afins (issue #43). Sem ela na cache, esses itens
  // do pacote inicial entram no inventario sem peso nenhum.
  dadosCache.ferramentas = dadosEquip.ferramentas;
  // Variantes de foco: sem elas na cache, "Foco Arcano (Cajado)" do pacote
  // do Mago casa com a entrada generica e volta a pesar "Varia" (0 kg).
  dadosCache.focos = dadosEquip.focos;
  // propriedadesArmas continua sendo cacheada aqui (fora do bloco do brief):
  // mostrarDetalheItem (abaixo) le dadosCache.propriedadesArmas de forma
  // sincrona para mostrar a descricao das propriedades da arma no popup de
  // detalhes; sem isso o popup perderia essa secao silenciosamente.
  dadosCache.propriedadesArmas = dadosEquip.propriedadesArmas;

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
            <div class="opcao-card ${escolhaAtual === op.letra ? 'selecionada' : ''}"
                 data-equip-tipo="${tipoOrigem}" data-equip-letra="${op.letra}"
                 style="flex:1;min-width:200px;cursor:pointer">
              <div class="opcao-nome" style="font-size:0.9rem;font-weight:600">Opção ${op.letra}</div>
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
          ${INSTRUMENTOS_PASSO_CLASSE.map(i => `<option value="${i}" ${personagem.instrumento_classe_escolhido === i ? 'selected' : ''}>${i}</option>`).join('')}
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

  document.getElementById('btn-add-item')?.addEventListener('click', () => abrirSeletorItens({
    personagem,
    lerComprarAtivo: () => _comprarAtivoCriador,
    salvarComprarAtivo: (ativo) => { _comprarAtivoCriador = ativo; },
    aoAdicionar: () => {
      const wizContent = document.getElementById('wizard-content');
      // renderStepEquipamento e async e a promise era descartada aqui
      // (achado MENOR (b) da revisao final de branch): se ela rejeitasse, a
      // rejeicao ficava sem handler DEPOIS do toast de sucesso do proprio
      // seletor -- o jogador via "adicionado!" com a lista do passo
      // desatualizada e nenhum aviso do erro real. O .catch cobre esse caso
      // sem mudar o caminho feliz (que continua sincrono aos olhos de quem
      // chama).
      if (wizContent) {
        renderStepEquipamento(wizContent).catch((err) => {
          console.error('Falha ao atualizar o passo de equipamento apos adicionar item:', err);
          toast('Item adicionado, mas a lista do passo nao atualizou -- recarregue a pagina.', 'error');
        });
      }
    },
  }));
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
    const prof = temProficienciaArma(personagem, { categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
    profBadge = prof ? '<span class="badge badge-prof-sm">Prof</span>' : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
  }
  if ((item.tipo === 'armadura' || item.tipo === 'escudo') && item.dados?.categoria) {
    const prof = temProficienciaArmadura(personagem, { categoria: item.dados.categoria, nome: item.nome });
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
        <div class="inv-item-nome">${escHtml(item.nome)} ${profBadge} ${tipoBadge}</div>
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${item.dados?.dano || ''} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'customizado' ? escHtml(item.descricao || '') : ''}
          ${item.tipo === 'generico' ? escHtml(item.descricao || '') : ''}
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
        <p>Deseja realmente remover <strong>${escHtml(item.nome)}</strong>${item.quantidade > 1 ? ` (x${item.quantidade})` : ''} do inventário?</p>
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
        <div style="font-size:0.65rem;color:var(--text-muted)">soma na CA quando equipado</div>
      </div>
      <div class="col">
        <label class="form-label">CA Base</label>
        <input type="number" class="form-input" id="custom-ca-base" placeholder="—" min="0" step="1">
        <div style="font-size:0.65rem;color:var(--text-muted)">define a CA (ex.: 20). Não soma Destreza</div>
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
        // Mesmo campo, mesma semantica e mesmo nome do formulario da FICHA
        // (sheet/inventario.js): o criador e a ficha ja divergiram uma vez
        // neste item (os tetos de bonus so existiam num dos dois).
        ca_base: (document.getElementById('custom-ca-base')?.value || '').trim(),
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
