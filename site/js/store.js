// ============================================================
// Persistencia de personagens no localStorage + Firestore (se logado)
// ============================================================
import { gerarId } from './utils.js';
import { getUsuario, salvarPersonagemCloud, removerPersonagemCloud } from './auth.js';

const STORAGE_KEY = 'dnd_personagens';
const BACKUP_KEY = 'dnd_personagens_backup';

/** Retorna todos os personagens salvos */
export function listarPersonagens() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY);
    return dados ? JSON.parse(dados) : [];
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

  // Sincronizar com Firestore em background se logado
  if (getUsuario()) {
    salvarPersonagemCloud(personagem).catch(err =>
      console.warn('Erro ao salvar na nuvem:', err.message)
    );
  }

  return personagem;
}

/** Remove um personagem por ID */
export function removerPersonagem(id) {
  const lista = listarPersonagens().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));

  // Remover da nuvem em background se logado
  if (getUsuario()) {
    removerPersonagemCloud(id).catch(err =>
      console.warn('Erro ao remover da nuvem:', err.message)
    );
  }
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

  // Salvar copia na nuvem em background
  if (getUsuario()) {
    salvarPersonagemCloud(copia).catch(err =>
      console.warn('Erro ao duplicar na nuvem:', err.message)
    );
  }

  return copia;
}

/** Exporta todos os personagens como JSON string */
export function exportarTodos() {
  return JSON.stringify(listarPersonagens(), null, 2);
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

/** Importa personagens de um JSON string (merge com existentes) */
export function importarPersonagens(jsonStr) {
  try {
    const importados = JSON.parse(jsonStr);
    if (!Array.isArray(importados)) throw new Error('Formato inválido');
    const lista = listarPersonagens();
    let countNovos = 0;
    for (const p of importados) {
      if (!lista.find(e => e.id === p.id)) {
        lista.push(p);
        countNovos++;
        // Enviar para nuvem em background
        if (getUsuario()) {
          salvarPersonagemCloud(p).catch(() => {});
        }
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
    po: 0,
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
    condicoes: [],
    resistencias: [],
    vulnerabilidades: [],
    imunidades: [],
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };
}
