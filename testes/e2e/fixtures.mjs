// Personagens semeados ricos, montados a partir do livro de regras em `dados/`.
//
// Os nomes de magia e de item NAO sao inventados: uma magia inexistente
// renderizaria vazio nos dois sites e o teste passaria medindo nada.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');

/** Magias de um circulo (0 = truques), opcionalmente filtradas por classe. */
export function magiasDoCirculo(circulo, quantas, classe = null) {
  const arquivo = circulo === 0 ? 'truques.json' : `circulo_${circulo}.json`;
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/magias', arquivo), 'utf-8'));
  const lista = Array.isArray(d) ? d : (d.magias || []);
  const filtradas = classe
    ? lista.filter((m) => Array.isArray(m.classes) && m.classes.includes(classe))
    : lista;
  const nomes = filtradas.map((m) => m.nome).filter(Boolean);
  // Truques (circulo 0) sao legitimamente vazios para meio-conjuradores como
  // Guardiao e Paladino -- exigir tres ali seria inventar regra. Ja um
  // circulo >= 1 vazio significa que o filtro por classe esta errado.
  if (nomes.length === 0 && circulo > 0) {
    throw new Error(
      `circulo ${circulo}: nenhuma magia para ${classe ?? 'qualquer classe'}`);
  }
  return nomes.slice(0, quantas);
}

/**
 * Conjurador com truques, magias preparadas e espacos coerentes com o nivel.
 *
 * As magias sao filtradas pela lista da propria classe, senao a ficha as
 * ignoraria e o teste compararia duas secoes vazias.
 */
export function conjuradorPreparado(classe, nivel = 5) {
  const truques = magiasDoCirculo(0, 3, classe);
  const primeiro = magiasDoCirculo(1, 4, classe);
  const segundo = nivel >= 3 ? magiasDoCirculo(2, 3, classe) : [];

  const espacos = { 1: { total: 4, usados: 0 } };
  if (nivel >= 3) espacos[2] = { total: 3, usados: 0 };
  if (nivel >= 5) espacos[3] = { total: 2, usados: 0 };

  return {
    nome: `${classe} conjurando`,
    classe,
    especie: 'Humano',
    antecedente: 'Sábio',
    nivel,
    atributos: { forca: 10, destreza: 14, constituicao: 14,
                 inteligencia: 17, sabedoria: 15, carisma: 13 },
    // Nao existe campo separado de truques no schema: a ficha le tudo de
    // `magias_preparadas` (11 usos em sheet/magias.js contra 1 de
    // `magias_conhecidas`).
    magias_conhecidas: [...truques, ...primeiro, ...segundo],
    magias_preparadas: [...truques, ...primeiro, ...segundo],
    // O grimorio guarda OBJETOS `{nome, circulo}`, nao strings -- e assim que
    // creator/passo-magias.js o preenche (linha 570). Com strings, o render
    // faz `magia.circulo` e `a.nome.localeCompare(...)` sobre undefined e a
    // ficha inteira lanca.
    grimorio: classe === 'Mago'
      ? [...primeiro.map((nome) => ({ nome, circulo: 1 })),
         ...segundo.map((nome) => ({ nome, circulo: 2 }))]
      : [],
    espacos_magia: espacos,
  };
}

/** Personagem com itens equipados, na mochila e moedas para comprar. */
export function comInventario() {
  return {
    nome: 'Mercador', classe: 'Ladino', especie: 'Pequenino',
    antecedente: 'Criminoso', nivel: 4,
    atributos: { forca: 10, destreza: 17, constituicao: 14,
                 inteligencia: 13, sabedoria: 12, carisma: 14 },
    // Campos conforme sheet/inventario.js: `quantidade` (nao `qtd`), `tipo`
    // e `dados`. Um item com o formato errado simplesmente nao renderiza.
    inventario: [
      { nome: 'Adaga', tipo: 'arma', quantidade: 2, equipado: true,
        dados: { peso: '0,5 kg', dano: '1d4', tipo_dano: 'perfurante' } },
      { nome: 'Corda de Cânhamo', tipo: 'item', quantidade: 1, equipado: false,
        dados: { peso: '5 kg' } },
      { nome: 'Rações', tipo: 'item', quantidade: 5, equipado: false,
        dados: { peso: '1 kg' } },
    ],
    moedas: { po: 50, pp: 20, pc: 100, pe: 0, pl: 0 },
  };
}
