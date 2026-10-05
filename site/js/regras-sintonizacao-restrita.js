// ============================================================
// Sintonização restrita: quem pode se sintonizar com o item.
//
// O acervo traz o requisito em texto (`requisito_sintonizacao`, por exemplo
// "por um Bardo, Clérigo ou Druida"). Este módulo lê o texto numa estrutura
// e confere contra a ficha. Texto que não se reduz a classe, espécie,
// Conjurador ou item sintonizado (ex.: "por uma Criatura Escolhida pela
// Arma") fica não verificável e vale como atendido.
// ============================================================
import { temClasse } from './regras-multiclasse.js';
import { conjuraPorAlgumaClasse } from './regras-multiclasse-conjuracao.js';
import { CLASSES_INFO } from './dados-classes.js';

// Classes da ficha (fonte única: CLASSES_INFO).
const CLASSES = Object.keys(CLASSES_INFO);
// Espécies de dados/origens/especies.json. O módulo é síncrono e a ficha só carrega o JSON
// de forma assíncrona; o teste sintonizacao-restrita.test.mjs confere esta lista contra o JSON.
export const ESPECIES = ['Aasimar', 'Anão', 'Draconato', 'Elfo', 'Gnomo', 'Golias', 'Humano', 'Orc', 'Pequenino', 'Tiferino', 'Kenku'];

// Itens do acervo (`dados.magico_id`) que cada nome citado em "Criatura Sintonizada com um <item>" aceita.
const IDS_DO_ITEM_EXIGIDO = {
  'Cinturão dos Anões': ['cinturao-dos-anoes'],
};

/** Se o item do inventário é o exigido pelo requisito: por `magico_id` quando há; sem ele, pelo nome. */
function ehItemExigido(item, nome) {
  const ids = IDS_DO_ITEM_EXIGIDO[nome];
  if (item?.dados?.magico_id && ids) return ids.includes(item.dados.magico_id);
  return item?.nome === nome;
}

/** Nome da lista que casa o texto sem diferenciar caixa; null quando nenhum casa. */
function nomeDaLista(lista, texto) {
  const t = texto.toLocaleLowerCase('pt-BR');
  return lista.find(n => n.toLocaleLowerCase('pt-BR') === t) || null;
}

/**
 * Lê o texto do requisito de sintonização.
 * Devolve { classes, especies, conjurador, itens, verificavel }. Texto vazio
 * ou com parte não reconhecida resulta em `verificavel: false`.
 */
export function lerRequisito(texto) {
  const out = { classes: [], especies: [], conjurador: false, itens: [], verificavel: true };
  const limpo = String(texto ?? '').trim();
  if (!limpo) return { ...out, verificavel: false };
  const partes = limpo.replace(/^por\s+/i, '').split(/\s*,\s*|\s+ou\s+(?:por\s+)?/i);
  for (const parte of partes) {
    const termo = parte.trim().replace(/^(um|uma)\s+/i, '');
    const classe = nomeDaLista(CLASSES, termo);
    const especie = nomeDaLista(ESPECIES, termo);
    const item = /^criatura\s+sintonizada\s+com\s+(?:um|uma)\s+(.+)$/i.exec(termo);
    if (classe) out.classes.push(classe);
    else if (especie) out.especies.push(especie);
    else if (/^conjurador$/i.test(termo)) out.conjurador = true;
    else if (item) out.itens.push(item[1].trim());
    else out.verificavel = false;
  }
  return out;
}

/**
 * Se o personagem atende o requisito lido por `lerRequisito`: atender
 * qualquer uma das condições basta. Requisito não verificável atende.
 * Conjurador conta pela conjuração de classe; o item exigido conta quando
 * está sintonizado e não destruído.
 */
export function atendeRequisito(personagem, requisito) {
  if (!requisito || !requisito.verificavel) return true;
  if ((requisito.classes || []).some(c => temClasse(personagem, c))) return true;
  if ((requisito.especies || []).includes(personagem?.especie)) return true;
  if (requisito.conjurador && conjuraPorAlgumaClasse(personagem)) return true;
  return (requisito.itens || []).some(nome =>
    (personagem?.inventario || []).some(i => ehItemExigido(i, nome) && i.sintonizado === true && !i.destruido));
}
