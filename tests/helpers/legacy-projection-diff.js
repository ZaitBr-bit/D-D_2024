// Helper de testes: comparação campo a campo entre o resultado de um export de
// `site/js/db.js` e a projeção equivalente do catálogo.
//
// ## Por que a contagem por instância importa
//
// A saída é um `Map<caminhoNormalizado, quantidadeDeInstâncias>`, não um
// conjunto de caminhos. Índices de array são normalizados (`armas[3].dano` ->
// `armas[].dano`) para a lista de lacunas ficar legível, MAS a quantidade de
// instâncias divergentes é contada e comparada. Sem a contagem, uma lacuna
// declarada para UMA arma (um typo do legado em 1 de 38) viraria licença para
// qualquer número de divergências futuras naquele mesmo campo — o teste
// continuaria verde se `dano` quebrasse nas 38 armas.
//
// ## Elementos excedentes
//
// Quando os arrays têm tamanhos diferentes, além de registrar `.length` o
// diff percorre os elementos que existem nos dois lados E registra uma
// entrada por elemento excedente/faltante. Sem isso, uma lacuna de `.length`
// funcionaria como isenção cega para todo o conteúdo além do array mais curto.

/**
 * Normaliza um caminho de campo, trocando índices de array por `[]`.
 * @param {string} caminho
 * @returns {string}
 */
export function normalizarCaminho(caminho) {
  return caminho.replace(/\[\d+\]/g, '[]');
}

/**
 * Classifica um valor para comparação (distingue array e null de object).
 * @param {*} valor
 * @returns {string}
 */
function tipoDe(valor) {
  if (Array.isArray(valor)) return 'array';
  if (valor === null) return 'null';
  return typeof valor;
}

/**
 * Compara `esperado` (db.js) com `atual` (projeção) e devolve
 * `Map<caminhoNormalizado, quantidadeDeInstânciasDivergentes>`.
 *
 * @param {*} esperado
 * @param {*} atual
 * @param {string} [caminho]
 * @param {Map<string, number>} [destino]
 * @returns {Map<string, number>}
 */
export function diferencasPorCaminho(esperado, atual, caminho = '', destino = new Map()) {
  /** Registra uma instância divergente no caminho informado. */
  const anotar = (bruto) => {
    const chave = normalizarCaminho(bruto) || '(raiz)';
    destino.set(chave, (destino.get(chave) ?? 0) + 1);
  };

  if (esperado === atual) {
    return destino;
  }

  const tipoEsperado = tipoDe(esperado);
  const tipoAtual = tipoDe(atual);
  if (tipoEsperado !== tipoAtual) {
    anotar(caminho);
    return destino;
  }

  if (tipoEsperado === 'array') {
    if (esperado.length !== atual.length) {
      anotar(`${caminho}.length`);
    }
    const comuns = Math.min(esperado.length, atual.length);
    for (let indice = 0; indice < comuns; indice += 1) {
      diferencasPorCaminho(esperado[indice], atual[indice], `${caminho}[${indice}]`, destino);
    }
    // Elementos além do array mais curto: uma entrada POR elemento, para que a
    // lacuna de `.length` não isente o conteúdo excedente.
    const sufixo = esperado.length > atual.length ? 'elemento ausente na projeção' : 'elemento extra na projeção';
    for (let indice = comuns; indice < Math.max(esperado.length, atual.length); indice += 1) {
      anotar(`${caminho}[${indice}] (${sufixo})`);
    }
    return destino;
  }

  if (tipoEsperado === 'object') {
    const chaves = new Set([...Object.keys(esperado), ...Object.keys(atual)]);
    for (const chave of chaves) {
      const sub = caminho === '' ? chave : `${caminho}.${chave}`;
      if (!Object.prototype.hasOwnProperty.call(esperado, chave)) {
        anotar(`${sub} (extra na projeção)`);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(atual, chave)) {
        anotar(`${sub} (ausente na projeção)`);
        continue;
      }
      diferencasPorCaminho(esperado[chave], atual[chave], sub, destino);
    }
    return destino;
  }

  anotar(caminho);
  return destino;
}

/**
 * Classifica um valor "vazio" (as quatro sentinelas que a Task 22b exige
 * comparar explicitamente), ou devolve `null` se o valor não for vazio.
 * @param {*} valor
 * @returns {string | null}
 */
function sentinelaDe(valor) {
  if (valor === null) return 'null';
  if (valor === undefined) return 'undefined';
  if (Array.isArray(valor) && valor.length === 0) return 'array-vazio';
  if (valor === '') return 'string-vazia';
  if (typeof valor === 'object' && !Array.isArray(valor) && Object.keys(valor).length === 0) {
    return 'objeto-vazio';
  }
  return null;
}

/**
 * Mapeia TODO caminho cujo valor é uma sentinela vazia
 * (`null` / `undefined` / `[]` / `""` / `{}`), com os índices de array
 * normalizados para `[]`.
 *
 * ## Por que isto existe além do diff campo a campo
 *
 * `diferencasPorCaminho` já distingue essas quatro formas de vazio (compara
 * tipo antes de valor e usa `hasOwnProperty` para "ausente"), então uma
 * divergência de default JÁ reprovaria por lá. Esta função é uma segunda
 * medida, INDEPENDENTE e nomeada, exigida pelo brief da Task 22b: ela produz
 * o retrato dos defaults de cada lado, para que a comparação de defaults seja
 * uma afirmação explícita do teste e não uma consequência implícita do
 * mecanismo de diff. Um caminho AUSENTE num dos lados simplesmente não aparece
 * no mapa daquele lado — a comparação dos dois mapas é o que revela isso.
 *
 * @param {*} valor
 * @param {string} [caminho]
 * @param {Record<string, string[]>} [destino]
 * @returns {Record<string, string[]>} caminho -> lista ordenada de sentinelas
 *   observadas naquele caminho (mais de uma quando o caminho é um array cujos
 *   elementos têm vazios de tipos diferentes).
 */
export function coletarSentinelas(valor, caminho = '', destino = {}) {
  /** Registra uma sentinela no caminho informado, sem repetir. */
  const anotar = (bruto, especie) => {
    const chave = normalizarCaminho(bruto) || '(raiz)';
    const lista = destino[chave] ?? (destino[chave] = []);
    if (!lista.includes(especie)) {
      lista.push(especie);
      lista.sort();
    }
  };

  const especie = sentinelaDe(valor);
  if (especie !== null) {
    anotar(caminho, especie);
    return destino;
  }
  if (Array.isArray(valor)) {
    for (let indice = 0; indice < valor.length; indice += 1) {
      coletarSentinelas(valor[indice], `${caminho}[${indice}]`, destino);
    }
    return destino;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const chave of Object.keys(valor)) {
      coletarSentinelas(valor[chave], caminho === '' ? chave : `${caminho}.${chave}`, destino);
    }
  }
  return destino;
}

/**
 * Soma as contagens de `origem` dentro de `acumulado` (união entre chamadas da
 * mesma operação).
 * @param {Map<string, number>} acumulado
 * @param {Map<string, number>} origem
 * @returns {Map<string, number>}
 */
export function acumularDiferencas(acumulado, origem) {
  for (const [caminho, quantidade] of origem) {
    acumulado.set(caminho, (acumulado.get(caminho) ?? 0) + quantidade);
  }
  return acumulado;
}

/**
 * Converte um `Map` de contagens em objeto simples com chaves ordenadas, para
 * comparação com `assert.deepEqual`.
 * @param {Map<string, number>} contagens
 * @returns {Record<string, number>}
 */
export function ordenarContagens(contagens) {
  const saida = {};
  for (const caminho of [...contagens.keys()].sort()) {
    saida[caminho] = contagens.get(caminho);
  }
  return saida;
}
