// ============================================================
// Gera dados/equipamento/componentes_materiais.json: os componentes materiais
// com custo em PO das magias (Livro do Jogador + expansões), um item por
// material e custo mínimo, com as magias que o usam e se elas o consomem.
// Uso: node scripts/magias/montar_componentes_materiais.mjs
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));

// Magias com mais de um material, custo por unidade ou texto que o padrão simples não separa.
const MANUAIS = {
  'Arca Secreta de Leomund': [
    { nome: 'Baú de materiais raros (1 m × 60 cm × 60 cm)', custo: 5000, consome: false },
    { nome: 'Réplica minúscula do baú, dos mesmos materiais', custo: 50, consome: false },
  ],
  'Clone': [
    { nome: 'Diamante', custo: 1000, consome: true },
    { nome: 'Recipiente vedável do tamanho da criatura clonada', custo: 2000, consome: false },
  ],
  'Lendas e Histórias': [
    { nome: 'Incenso', custo: 250, consome: true },
    { nome: 'Tira de marfim', custo: 50, consome: false, obs: 'quatro tiras por conjuração' },
  ],
  'Projeção Astral': [
    { nome: 'Zircão', custo: 1000, consome: true, obs: 'um por alvo' },
    { nome: 'Barra de prata', custo: 100, consome: true, obs: 'uma por alvo' },
  ],
  'Vínculo de Proteção': [
    { nome: 'Anel de platina', custo: 50, consome: false, obs: 'um par: você e o alvo usam um cada' },
  ],
  'Criar Mortos-Vivos': [
    { nome: 'Pedra de ônix preto', custo: 150, consome: false, obs: 'uma por cadáver' },
  ],
  'Clarividência': [
    { nome: 'Foco de clarividência (chifre adornado com joias ou olho de vidro)', custo: 100, consome: false },
  ],
  'Vidência': [
    { nome: 'Foco de vidência (bola de cristal, espelho ou fonte cheia de água)', custo: 1000, consome: false },
  ],
  'Convocar Elemental': [
    { nome: 'Frasco incrustado de ouro com ar, uma pedra, cinzas e água', custo: 400, consome: false },
  ],
  'Servo Homúnculo': [
    { nome: 'Gema', custo: 100, consome: false },
  ],
};

// Nomes do livro que são o mesmo material (ou o item do Equipamento) escritos de outro jeito.
const SINONIMOS = {
  'Pote de Água Benta': 'Água Benta',
  'Incenso queimando': 'Incenso',
  'Pitada de poeira de diamante': 'Poeira de diamante',
  'Diamantes': 'Diamante',
  'Pó de jade': 'Poeira de jade',
  'Conjunto de ferramentas de adivinhação — como cartas ou runas —': 'Ferramentas de adivinhação (cartas ou runas)',
  'Varetas, ossos, cartas ou símbolos semelhantes especialmente marcados': 'Varetas, ossos, cartas ou símbolos marcados',
};

/** Texto do material entre os parênteses de "M (...)". */
function textoMaterial(componentes) {
  const i = String(componentes || '').indexOf('M (');
  if (i < 0) return '';
  return componentes.slice(i + 3).replace(/\)\s*$/, '');
}

/** "um diamante em pó" -> "Diamante em pó". */
function nomeDoMaterial(texto) {
  const limpo = texto.trim().replace(/^(um|uma|uns|umas|o|a|os|as)\s+/i, '');
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/** Material único "X no valor de N ou mais PO[, que a magia consome]"; null se não casa. */
function materialSimples(texto) {
  const m = texto.match(/^(.*?)\s+no valor de\s+([\d.]+)\s+ou mais PO(.*)$/);
  if (!m) return null;
  return { nome: nomeDoMaterial(m[1]), custo: Number(m[2].replace(/\./g, '')), consome: /que a magia consome/.test(m[3]) };
}

/** "1000" -> "1.000 PO", no formato do equipamento. */
const custoTexto = (n) => `${n.toLocaleString('pt-BR')} PO`;

const indice = ler('dados/magias/_indice.json').magias;
const expansoes = [
  ...ler('dados/tasha/artifice/magias.json').magias,
  ...ler('dados/arcana-unleashed/magias.json').magias,
];
const magias = [...indice, ...expansoes.filter((m) => !indice.some((x) => x.nome === m.nome))];
const equipamento = ler('dados/equipamento/equipamento_aventura.json').itens;

const porChave = new Map();
const semPadrao = [];
for (const magia of magias) {
  const texto = textoMaterial(magia.componentes);
  if (!/PO/.test(texto)) continue;
  const partes = MANUAIS[magia.nome] || (materialSimples(texto) ? [materialSimples(texto)] : null);
  if (!partes) { semPadrao.push(`${magia.nome}: ${texto}`); continue; }
  for (const parte of partes) {
    parte.nome = SINONIMOS[parte.nome] || parte.nome;
    const chave = `${parte.nome.toLowerCase()}|${parte.custo}`;
    if (!porChave.has(chave)) porChave.set(chave, { nome: parte.nome, custo: parte.custo, magias: [] });
    porChave.get(chave).magias.push({ nome: magia.nome, circulo: magia.circulo, consome: parte.consome, ...(parte.obs ? { obs: parte.obs } : {}) });
  }
}
if (semPadrao.length) {
  console.error('Material com custo sem regra (acrescente em MANUAIS):\n' + semPadrao.join('\n'));
  process.exit(1);
}

// Material com mais de um custo (Diamante de 50 a 25.000 PO) leva o custo no nome: no inventário
// cada um é um item diferente.
const custosPorNome = new Map();
for (const m of porChave.values()) custosPorNome.set(m.nome, (custosPorNome.get(m.nome) || 0) + 1);

const itens = [...porChave.values()].map((m) => {
  // Material que a loja já vende em Equipamento (Tinta, Aljava, Água Benta...): mesmo nome e peso;
  // o custo do Equipamento só vale quando é um valor (Símbolo Sagrado diz "Varia").
  const doEquip = custosPorNome.get(m.nome) > 1 ? null : equipamento.find((e) => e.nome.toLowerCase() === m.nome.toLowerCase());
  const custoEquip = /d/.test(doEquip?.custo || '') ? doEquip.custo : '';
  const uso = m.magias
    .map((x) => `${x.nome} (${x.circulo}º círculo${x.consome ? ', consumido' : ''}${x.obs ? `, ${x.obs}` : ''})`).join('; ');
  return {
    nome: doEquip?.nome || (custosPorNome.get(m.nome) > 1 ? `${m.nome} (${custoTexto(m.custo)})` : m.nome),
    custo: custoEquip || custoTexto(m.custo),
    peso: doEquip?.peso || '',
    descricao: `Componente material de magia, custo mínimo ${custoTexto(m.custo)}. Usado em: ${uso}.`,
    consumido: m.magias.some((x) => x.consome),
    usado_em: m.magias,
  };
}).sort((a, b) => (parseInt(a.custo.replace(/\D/g, ''), 10) - parseInt(b.custo.replace(/\D/g, ''), 10)) || a.nome.localeCompare(b.nome, 'pt-BR'));

writeFileSync(resolve(RAIZ, 'dados/equipamento/componentes_materiais.json'), JSON.stringify({
  observacao: 'Gerado por scripts/magias/montar_componentes_materiais.mjs a partir dos componentes das magias. Custo = mínimo exigido pela magia ("ou mais PO").',
  total_itens: itens.length,
  itens,
}, null, 2) + '\n');
console.log(`${itens.length} materiais gravados`);
