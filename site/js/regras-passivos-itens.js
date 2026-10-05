// ============================================================
// Passivos de itens mágicos (4C): resistências, imunidades, imunidades a
// condição, velocidades extras, deslocamento mínimo, sentidos e vantagens.
//
// Regra pura, sem DOM. Lê efeitosAtivos (item equipado, sintonizado quando
// exige e não destruído) -- spec 2026-10-04-itens-magicos-4c.
// ============================================================
import { efeitosAtivos, efeitosAtivosDoItem } from './regras-itens-magicos.js';

export const TIPOS_DANO = ['Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Energético', 'Gélido', 'Ígneo', 'Necrótico', 'Perfurante', 'Psíquico', 'Radiante', 'Trovejante', 'Venenoso'];
export const ROTULO_SENTIDO = { visao_no_escuro: 'Visão no Escuro', visao_verdadeira: 'Visão Verdadeira', visao_as_cegas: 'Visão às Cegas' };
export const ROTULO_MODO = { voo: 'Voo', natacao: 'Natação', escalada: 'Escalada' };

/** Opções do efeito de resistência com escolha do item; null quando o item não tem escolha. */
export function opcoesDeEscolha(item) {
  const ef = (item?.dados?.efeitos || []).find(e => e.alvo === 'resistencia' && Array.isArray(e.escolha));
  return ef ? ef.escolha : null;
}

/** Defesas vindas de itens ativos, sem repetir tipo/condição (vale a primeira origem, na ordem do inventário). */
export function defesasDeItens(personagem) {
  const out = { resistencias: [], imunidades: [], imunidadesCondicao: [], escolhasPendentes: [] };
  const inv = personagem?.inventario || [];
  const empurrar = (lista, chave, valor, origem) => {
    if (!lista.some(x => x[chave] === valor)) lista.push({ [chave]: valor, origem });
  };
  // Percorre o inventário em ordem: a "primeira origem" é a do item que vem
  // antes, seja o efeito fixo ou de escolha. Os efeitos de cada item são
  // avaliados contra o personagem completo (a `condicao` de armadura/escudo
  // depende do resto do inventário).
  inv.forEach((item, idx) => {
    let escolhaTratada = false;
    for (const ef of efeitosAtivosDoItem(personagem, item)) {
      if (ef.alvo === 'resistencia' && ef.tipo_dano) empurrar(out.resistencias, 'tipo', ef.tipo_dano, ef.origem);
      else if (ef.alvo === 'imunidade' && ef.tipo_dano) empurrar(out.imunidades, 'tipo', ef.tipo_dano, ef.origem);
      else if (ef.alvo === 'imunidade_condicao') empurrar(out.imunidadesCondicao, 'condicao', ef.condicao, ef.origem);
      else if (ef.alvo === 'resistencia' && Array.isArray(ef.escolha) && !escolhaTratada) {
        // Uma escolha por item (a primeira declarada, como opcoesDeEscolha).
        escolhaTratada = true;
        const escolhido = item.escolhas?.resistencia;
        if (ef.escolha.includes(escolhido)) empurrar(out.resistencias, 'tipo', escolhido, item.nome);
        else out.escolhasPendentes.push({ idx, origem: item.nome, opcoes: ef.escolha });
      }
    }
  });
  return out;
}

/** Velocidades extras de itens ativos (fixa em metros ou igual ao Deslocamento); modo desconhecido é ignorado. */
export function velocidadesDeItens(personagem) {
  return efeitosAtivos(personagem).filter(ef => ef.alvo === 'deslocamento' && Object.hasOwn(ROTULO_MODO, ef.modo)).map(ef => ({
    modo: ef.modo,
    ...(ef.igual_deslocamento ? { igual: true } : { metros: ef.metros }),
    ...(ef.pairar ? { pairar: true } : {}),
    origem: ef.origem,
  }));
}

/** Maior deslocamento mínimo dado por item ativo; 0 quando não há. */
export function deslocamentoMinimoDeItens(personagem) {
  return efeitosAtivos(personagem).filter(ef => ef.alvo === 'deslocamento_minimo').reduce((m, ef) => Math.max(m, ef.metros || 0), 0);
}

/**
 * Sentidos de itens ativos. Visão no Escuro: maior entre a base (espécie) e
 * cada item; item com `soma_se_tiver` e base > 0 dá base + soma; só aparece
 * quando supera a base. Outros sentidos: maior alcance entre os itens.
 */
export function sentidosDeItens(personagem, visaoNoEscuroBase = 0) {
  const base = Number(visaoNoEscuroBase) || 0;
  const melhor = {};
  for (const ef of efeitosAtivos(personagem)) {
    if (ef.alvo !== 'sentido') continue;
    let metros = ef.metros;
    if (ef.sentido === 'visao_no_escuro') metros = base > 0 && ef.soma_se_tiver ? base + ef.soma_se_tiver : Math.max(base, ef.metros);
    if (!melhor[ef.sentido] || metros > melhor[ef.sentido].metros) melhor[ef.sentido] = { sentido: ef.sentido, metros, origem: ef.origem };
  }
  return Object.values(melhor).filter(s => s.sentido !== 'visao_no_escuro' || s.metros > base);
}

/** Vantagens de itens ativos por destino; `contexto` só aparece quando o efeito tem. */
export function vantagensDeItens(personagem) {
  const out = { pericias: [], salvaguardas: [], iniciativa: [] };
  for (const ef of efeitosAtivos(personagem)) {
    if (ef.alvo !== 'vantagem') continue;
    const ctx = ef.contexto ? { contexto: ef.contexto } : {};
    if (ef.em === 'pericia') out.pericias.push({ pericia: ef.pericia, origem: ef.origem, ...ctx });
    else if (ef.em === 'salvaguarda') out.salvaguardas.push({ ...(ef.atributo ? { atributo: ef.atributo } : {}), origem: ef.origem, ...ctx });
    else if (ef.em === 'iniciativa' && !out.iniciativa.includes(ef.origem)) out.iniciativa.push(ef.origem);
  }
  return out;
}
