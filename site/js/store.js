// ============================================================
// Persistencia de personagens no localStorage + Firestore (se logado)
// ============================================================
import { gerarId, normalizarGrimorioMago } from './utils.js';
import { enfileirarSync, enfileirarRemocao } from './sync.js';
import { criarCarteiraVazia, normalizarCarteira, definirTaxas, resetarTaxas } from './moedas.js';

const STORAGE_KEY = 'dnd_personagens';
const BACKUP_KEY = 'dnd_personagens_backup';
const TAXAS_MOEDA_KEY = 'dnd_taxas_moeda';
const COMPRAR_ATIVO_KEY = 'dnd_comprar_ativo_padrao';

/** Preferencia global do usuario (todos os personagens): togle "Comprar" do seletor de itens vem marcado por padrao */
export function carregarComprarAtivoPadrao() {
  return localStorage.getItem(COMPRAR_ATIVO_KEY) === '1';
}

/** Salva a preferencia global do togle "Comprar" */
export function salvarComprarAtivoPadrao(ativo) {
  localStorage.setItem(COMPRAR_ATIVO_KEY, ativo ? '1' : '0');
}

/** Carrega taxas de conversao de moeda customizadas (se houver) e aplica no motor de moedas */
export function carregarTaxasMoeda() {
  try {
    const raw = localStorage.getItem(TAXAS_MOEDA_KEY);
    if (raw) definirTaxas(JSON.parse(raw));
  } catch {
    // ignora taxas corrompidas, mantem o padrao
  }
}

/** Salva e aplica taxas de conversao customizadas. Retorna { sucesso, erro? } */
export function salvarTaxasMoeda(taxas) {
  const resultado = definirTaxas(taxas);
  if (resultado.sucesso) {
    localStorage.setItem(TAXAS_MOEDA_KEY, JSON.stringify(resultado.taxas));
  }
  return resultado;
}

/** Restaura as taxas de conversao padrao e remove a customizacao salva */
export function resetarTaxasMoeda() {
  const taxas = resetarTaxas();
  localStorage.removeItem(TAXAS_MOEDA_KEY);
  return taxas;
}

/** Retorna todos os personagens salvos */
export function listarPersonagens() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY);
    const lista = dados ? JSON.parse(dados) : [];
    let grimorioAlterado = false;
    const personagens = lista.map(p => {
      const personagem = migrarEdicoesLegado(migrarMoedasLegado(p));
      if (normalizarGrimorioMago(personagem).alterado) grimorioAlterado = true;
      return personagem;
    });
    if (grimorioAlterado) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(personagens));
      } catch {
        // A ficha já carregada continua disponível se a persistência falhar.
      }
    }
    return personagens;
  } catch {
    return [];
  }
}

/** Busca um personagem por ID */
export function getPersonagem(id) {
  return listarPersonagens().find(p => p.id === id) || null;
}

/** Salva ou atualiza um personagem */
export function salvarPersonagem(personagem) {
  const lista = listarPersonagens();
  const idx = lista.findIndex(p => p.id === personagem.id);
  personagem.atualizado_em = new Date().toISOString();

  if (idx >= 0) {
    lista[idx] = personagem;
  } else {
    if (!personagem.id) personagem.id = gerarId();
    if (!personagem.criado_em) personagem.criado_em = new Date().toISOString();
    lista.push(personagem);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));

  // Enfileirar sync na nuvem (processa se logado e online, aguarda caso contrário)
  enfileirarSync(personagem);

  return personagem;
}

/** Remove um personagem por ID */
export function removerPersonagem(id) {
  const lista = listarPersonagens().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));

  // Enfileirar remoção na nuvem (processa se logado e online, aguarda caso contrário)
  enfileirarRemocao(id);
}

/** Duplica um personagem */
export function duplicarPersonagem(id) {
  const original = getPersonagem(id);
  if (!original) return null;
  const copia = JSON.parse(JSON.stringify(original));
  copia.id = gerarId();
  copia.nome = `${copia.nome} (cópia)`;
  copia.criado_em = new Date().toISOString();
  copia.atualizado_em = new Date().toISOString();
  const lista = listarPersonagens();
  lista.push(copia);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));

  // Enfileirar sync na nuvem
  enfileirarSync(copia);

  return copia;
}

/** Exporta todos os personagens como JSON string */
export function exportarTodos() {
  return JSON.stringify(listarPersonagens(), null, 2);
}

/** Exporta um único personagem (por id) como JSON string, no mesmo formato (array) usado por exportarTodos/importarPersonagens */
export function exportarPersonagem(id) {
  const p = getPersonagem(id);
  if (!p) return null;
  return JSON.stringify([p], null, 2);
}

/** Substitui toda a lista local (usado apos sincronizacao com nuvem) */
export function atualizarListaLocal(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/**
 * Faz backup dos personagens locais antes de trocar para a nuvem.
 * So cria backup se ainda nao existir (preserva estado original pre-login).
 */
export function backupPersonagensLocais() {
  if (localStorage.getItem(BACKUP_KEY)) return;
  const atual = localStorage.getItem(STORAGE_KEY) || '[]';
  localStorage.setItem(BACKUP_KEY, atual);
}

/**
 * Restaura personagens locais do backup (feito antes do login).
 * Remove o backup apos restaurar.
 */
export function restaurarPersonagensLocais() {
  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup) {
    localStorage.setItem(STORAGE_KEY, backup);
  }
  localStorage.removeItem(BACKUP_KEY);
}

/**
 * Migra um personagem salvo no formato antigo (campo unico `po`) para a
 * carteira multi-moeda `moedas`. Preserva o valor antigo como PO (nao redistribui),
 * evitando reshuffle de saldo em personagens ja existentes. Idempotente.
 */
export function migrarMoedasLegado(p) {
  if (!p || typeof p !== 'object') return p;
  const base = p.moedas && typeof p.moedas === 'object' ? p.moedas : { po: p.po };
  p.moedas = normalizarCarteira(base);
  delete p.po;
  return p;
}

/** Adiciona metadados de edição sem alterar campos existentes da ficha. */
export function migrarEdicoesLegado(p) {
  if (!p || typeof p !== 'object') return p;
  if (!p.edicoes || p.edicoes.versao !== 1) p.edicoes = { versao: 1, campos: {} };
  if (!p.edicoes.campos || typeof p.edicoes.campos !== 'object') p.edicoes.campos = {};
  if (!p.configuracao_criacao || typeof p.configuracao_criacao !== 'object') p.configuracao_criacao = {};
  if (!p.configuracao_criacao.atributos) {
    p.configuracao_criacao.atributos = { metodo: null, valoresBase: null, rolagens: null };
  }
  return p;
}

/**
 * Valida que um objeto tem a estrutura minima de personagem.
 * Campos exigidos: id (string nao vazia), nome (string nao vazia), atributos (objeto), e nivel
 * num de dois formatos: o escalar legado `nivel` (numero inteiro 1-20) OU `classes[]` (array nao
 * vazio de entradas cada uma com `nivel` inteiro >= 1, cuja SOMA tem de ser um inteiro entre 1 e 20).
 * @param {object} p - Objeto a validar.
 * @returns {boolean} true se o objeto e um personagem valido.
 */
export function _validarPersonagem(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  if (typeof p.id !== 'string' || !p.id.trim()) return false;
  if (typeof p.nome !== 'string' || !p.nome.trim()) return false;
  // Nível: aceita o escalar legado OU a soma de classes[]. A validação
  // roda no import, ANTES de qualquer migração, então precisa entender
  // os dois formatos -- senão a ficha é descartada em silêncio.
  const temClassesArray = Array.isArray(p.classes) && p.classes.length > 0;
  // A soma sozinha não basta: esta função é a ÚNICA fronteira do app com
  // dado que não veio dos nossos caminhos de produção (importarPersonagens
  // lê um JSON escolhido pelo usuário num seletor de arquivo -- export
  // editado à mão, arquivo de outra ferramenta, backup truncado). Duas
  // entradas -- uma inflada e uma negativa que a compensa -- podem somar
  // dentro de 1..20 e passar pela checagem de soma (25 + -20 = 5) mesmo
  // sendo estrutura inválida; sem esta guarda por entrada, a ficha
  // corrompida entra em localStorage e o sintoma só aparece bem depois,
  // longe daqui (ex.: nivelNa devolvendo 25 e alimentando um find() que
  // retorna undefined numa tabela de características de 20 linhas). Não
  // precisa de teto por entrada: com toda entrada >= 1, o teto de 20 da
  // soma abaixo já limita cada uma.
  // `c?.nivel`, não `c.nivel`: uma entrada NÃO-OBJETO (null, undefined,
  // string, número -- saída comum de serializador ou de arquivo editado à
  // mão) não pode fazer `.nivel` LANÇAR. Um TypeError aqui sobe até o
  // try/catch de importarPersonagens e aborta o import do ARQUIVO INTEIRO,
  // inclusive as fichas boas do mesmo arquivo -- pior que a rejeição que a
  // guarda deveria produzir. `c?.nivel` sobre uma entrada não-objeto vale
  // `undefined`, e `Number.isInteger(undefined)` é `false`: a ficha é
  // rejeitada, não abortada.
  // `c?.classe`, mesma cautela do `c?.nivel` acima: entrada não-objeto não
  // pode lançar. Toda entrada precisa de uma classe (string não vazia) --
  // sem esta guarda, `classes:[{nivel:3, ordem:0}]` passava na validação e
  // a migração sobrescrevia `char.classe` com `''`, apagando a identidade
  // da ficha (achado da revisão final, mais grave que o buraco numérico
  // acima: aquele era dano hipotético adiante, este destrói a ficha na hora).
  if (temClassesArray && p.classes.some(
    (c) => !Number.isInteger(c?.nivel) || c.nivel < 1
        || typeof c?.classe !== 'string' || !c.classe.trim())) return false;
  const nivelSomado = temClassesArray
    ? p.classes.reduce((s, c) => s + (Number(c.nivel) || 0), 0)
    : p.nivel;
  // `Number.isInteger` (em vez do antigo `Number.isFinite`) fecha a
  // assimetria com a guarda por entrada acima: o JSDoc sempre disse
  // "numero inteiro", mas o ramo do escalar legado aceitava fracionário
  // (ex.: 2.5). `Number.isInteger` já implica finito e numérico, então
  // cobre sozinho o que `typeof` + `isFinite` faziam juntos.
  if (typeof nivelSomado !== 'number' || !Number.isInteger(nivelSomado)
      || nivelSomado < 1 || nivelSomado > 20) return false;
  if (!p.atributos || typeof p.atributos !== 'object' || Array.isArray(p.atributos)) return false;
  return true;
}

/** Importa personagens de um JSON string (merge com existentes) */
export function importarPersonagens(jsonStr) {
  try {
    const importados = JSON.parse(jsonStr);
    if (!Array.isArray(importados)) throw new Error('Formato inválido');
    const lista = listarPersonagens();
    let countNovos = 0;
    for (let i = 0; i < importados.length; i++) {
      const p = importados[i];
      migrarMoedasLegado(p);
      if (!_validarPersonagem(p)) {
        console.warn('importarPersonagens: personagem ignorado (estrutura invalida)', p?.id ?? `indice ${i}`);
        continue;
      }
      if (!lista.find(e => e.id === p.id)) {
        lista.push(p);
        countNovos++;
        // Enfileirar sync na nuvem
        enfileirarSync(p);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    return countNovos;
  } catch (err) {
    console.error('Erro ao importar:', err);
    return -1;
  }
}

/** Cria template de personagem vazio */
export function criarPersonagemVazio() {
  return {
    id: gerarId(),
    nome: '',
    imagem: '',
    nivel: 1,
    xp: 0,
    exaustao: 0,
    classe: '',
    subclasse: '',
    especie: '',
    antecedente: '',
    alinhamento: '',
    ordem_divina: '',
    ordem_primal: '',
    tracos_escolhidos: [],
    extras_classe: {},
    escolhas_classe: {},
    escolhas_antecedente: {},
    proficiencias_extra: [],
    atributos: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10
    },
    configuracao_criacao: {
      atributos: { metodo: null, valoresBase: null, rolagens: null }
    },
    edicoes: { versao: 1, campos: {} },
    atributos_base: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10
    },
    bonus_antecedente: {},
    pv_max: 0,
    pv_atual: 0,
    pv_temporario: 0,
    dados_vida_total: 1,
    dados_vida_usados: 0,
    pericias_proficientes: [],
    pericias_expertise: [],
    salvaguardas_proficientes: [],
    inventario: [],
    escolha_equip_classe: null,
    escolha_equip_antecedente: null,
    moedas: criarCarteiraVazia(),
    magias_conhecidas: [],
    magias_preparadas: [],
    grimorio: [],
    espacos_magia: {},
    talentos: [],
    itens_customizados: [],
    magias_customizadas: [],
    efeitos_magicos: [],
    usos_habilidades: {},
    aparencia: '',
    personalidade: '',
    ideais: '',
    lacos: '',
    defeitos: '',
    historia_personagem: '',
    notas: '',
    idiomas: ['Comum'],
    tamanho: '',
    config: { sobrecarga_afeta_deslocamento: false },
    condicoes: [],
    resistencias: [],
    vulnerabilidades: [],
    imunidades: [],
    proficiencias_ferramentas: [],
    proficiencias_instrumentos: [],
    talentos_flags: {},
    talentos_parametros: {},
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };
}
