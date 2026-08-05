// ORÁCULO DE TESTE (Task 37): cópia fiel de `site/js/ficha-edicoes.js` no
// momento da remoção do runtime. O arquivo de produção foi apagado depois de
// provado inalcançável (grafo de imports estáticos+dinâmicos a partir de
// `site/js/app.js` + allowlist de globais `window.*` de
// `scripts/check-inline-handlers.mjs`); esta cópia existe apenas para
// `tests/contract/baseline-fixtures.test.js` continuar comparando a fixture
// `legacy-edicoes.json` com a execução real do código legado, como já é
// feito com `tests/helpers/legacy-db-source.js` e
// `tests/helpers/legacy-sheet-source.js`. Não é publicado nem importado por
// código de produção.
//
// Estado reversível de alterações manuais da ficha.
//
// `aplicarDeltaSistema` delega seu núcleo numérico (clamp entre 0 e um teto)
// a `domain/commands/hit-points.js#applyClampedDelta` (Task 17) — o mesmo
// cálculo usado pelos comandos de dano/cura sobre o personagem canônico v2 —
// em vez de reimplementar a fórmula aqui. As demais funções deste arquivo
// (edição/reversão genérica por path, `edicoes.campos`) continuam operando
// diretamente sobre o registro plano legado: são genéricas sobre QUALQUER
// path (não só `pv_max`), sem correspondente canônico modelado por esta
// tarefa (só `hp.maximum` tem override canônico — ver
// `domain/commands/edit-character.js`), então não há o que delegar sem
// reescrever `sheet.js`/`creator.js` (fora do escopo desta tarefa).

import { applyClampedDelta } from '../../site/js/domain/commands/hit-points.js';

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
  const { next, applied } = applyClampedDelta(atual, delta, teto);
  escreverCaminho(personagem, caminho, next);
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
      const atualizado = Math.max(0, Math.min(teto, original + applied));
      if (caminhoRelativo) escreverCaminho(entrada.original, caminhoRelativo, atualizado);
      else entrada.original = atualizado;
    }
  }
  return applied;
}
