// Estado reversível de alterações manuais da ficha.

export function clonar(valor) {
  return valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));
}

export function garantirEstadoEdicoes(personagem) {
  if (!personagem.edicoes || personagem.edicoes.versao !== 1) {
    personagem.edicoes = { versao: 1, campos: {} };
  }
  if (!personagem.edicoes.campos || typeof personagem.edicoes.campos !== 'object') {
    personagem.edicoes.campos = {};
  }
  return personagem.edicoes;
}

export function lerCaminho(objeto, caminho) {
  return caminho.split('.').reduce((atual, chave) => atual?.[chave], objeto);
}

export function escreverCaminho(objeto, caminho, valor) {
  const partes = caminho.split('.');
  const chaveFinal = partes.pop();
  const pai = partes.reduce((atual, chave) => (atual[chave] ??= {}), objeto);
  pai[chaveFinal] = valor;
}

export function aplicarEdicao(personagem, caminho, proposto, editadoEm = new Date().toISOString()) {
  const estado = garantirEstadoEdicoes(personagem);
  if (!estado.campos[caminho]) {
    estado.campos[caminho] = { original: clonar(lerCaminho(personagem, caminho)), editadoEm, origem: 'manual' };
  }
  escreverCaminho(personagem, caminho, clonar(proposto));
}

export function reverterEdicao(personagem, caminho) {
  const entrada = personagem?.edicoes?.campos?.[caminho];
  if (!entrada) return false;
  escreverCaminho(personagem, caminho, clonar(entrada.original));
  delete personagem.edicoes.campos[caminho];
  return true;
}

export function consolidarEdicoesAtributos(personagem) {
  const estado = garantirEstadoEdicoes(personagem);
  let temEdicao = false;

  for (const caminhoPai of ['atributos_base', 'atributos']) {
    const filhos = Object.entries(estado.campos)
      .filter(([caminho]) => caminho.startsWith(`${caminhoPai}.`));

    if (!estado.campos[caminhoPai] && filhos.length) {
      const original = clonar(lerCaminho(personagem, caminhoPai) || {});
      for (const [caminho, entrada] of filhos) {
        escreverCaminho(original, caminho.slice(caminhoPai.length + 1), clonar(entrada.original));
      }
      const datas = filhos.map(([, entrada]) => entrada.editadoEm).filter(Boolean).sort();
      estado.campos[caminhoPai] = {
        original,
        editadoEm: datas[0] || new Date().toISOString(),
        origem: 'manual'
      };
    }

    for (const [caminho] of filhos) delete estado.campos[caminho];

    const entradaGrupo = estado.campos[caminhoPai];
    if (entradaGrupo && JSON.stringify(entradaGrupo.original) === JSON.stringify(lerCaminho(personagem, caminhoPai))) {
      delete estado.campos[caminhoPai];
    } else if (entradaGrupo) {
      temEdicao = true;
    }
  }

  return temEdicao;
}

export function aplicarDeltaSistema(personagem, caminho, delta, teto = Infinity) {
  const atual = Number(lerCaminho(personagem, caminho) ?? 0);
  const aplicado = Math.max(0, Math.min(teto, atual + delta)) - atual;
  escreverCaminho(personagem, caminho, atual + aplicado);
  const campos = personagem?.edicoes?.campos;
  const caminhoEntrada = campos && (campos[caminho]
    ? caminho
    : Object.keys(campos)
      .filter(pai => caminho.startsWith(`${pai}.`))
      .sort((a, b) => b.length - a.length)[0]);
  const entrada = caminhoEntrada ? campos[caminhoEntrada] : null;
  if (entrada) {
    const caminhoRelativo = caminhoEntrada === caminho ? '' : caminho.slice(caminhoEntrada.length + 1);
    const original = caminhoRelativo ? lerCaminho(entrada.original, caminhoRelativo) : entrada.original;
    if (typeof original === 'number') {
      const atualizado = Math.max(0, Math.min(teto, original + aplicado));
      if (caminhoRelativo) escreverCaminho(entrada.original, caminhoRelativo, atualizado);
      else entrada.original = atualizado;
    }
  }
  return aplicado;
}

/**
 * Acumula o ajuste manual (edicao livre, sem regras) de atributos na entrada
 * de grupo `atributos` de `edicoes`. Recebe o delta de cada chave -- a
 * diferenca entre o valor digitado e o que estava na ficha antes -- e SOMA ao
 * que ja havia, para que dois ajustes seguidos de +1 virem +2. Chave que zera
 * sai do mapa; mapa vazio sai da entrada.
 * @param {object} personagem - Personagem com estado de edicoes ja criado.
 * @param {object} deltas - Mapa chave-de-atributo -> delta (pode ser negativo).
 * @returns {object} O mapa de ajustes manuais resultante ({} quando vazio).
 */
export function registrarAjusteManualAtributos(personagem, deltas) {
  const entrada = personagem?.edicoes?.campos?.atributos;
  if (!entrada) return {};
  const mapa = (entrada.manual && typeof entrada.manual === 'object') ? entrada.manual : {};
  for (const [chave, delta] of Object.entries(deltas || {})) {
    const acumulado = Number(mapa[chave] || 0) + Number(delta || 0);
    if (acumulado === 0) delete mapa[chave];
    else mapa[chave] = acumulado;
  }
  if (Object.keys(mapa).length) entrada.manual = mapa;
  else delete entrada.manual;
  return entrada.manual || {};
}

/**
 * Le o mapa de ajustes manuais de atributos de um personagem. Devolve sempre
 * um objeto -- vazio quando nao ha ajuste livre registrado --, para que quem
 * exibe nao precise se defender de undefined.
 * @param {object} personagem - Personagem a inspecionar.
 * @returns {object} Mapa chave-de-atributo -> delta manual acumulado.
 */
export function deltaManualAtributos(personagem) {
  const manual = personagem?.edicoes?.campos?.atributos?.manual;
  return (manual && typeof manual === 'object') ? manual : {};
}
