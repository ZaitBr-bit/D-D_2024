// ============================================================
// Regras puras de reconciliação nuvem x local (sem DOM, sem Firebase).
// A exclusão na nuvem é uma LÁPIDE no mesmo documento do personagem:
// { id, removido: true, removido_em, atualizado_em }. Sem ela, "criado neste
// aparelho" e "excluído em outro" são indistinguíveis e o personagem
// excluído é recriado no próximo merge.
// ============================================================

/** True se o documento da nuvem é uma lápide de exclusão. */
export function ehLapide(doc) {
  return Boolean(doc && doc.removido === true);
}

/** Instante (ms) de um carimbo ISO; ausente vale 0. */
function _t(valor) {
  return new Date(valor || 0).getTime();
}

/**
 * Decide qual versão de um personagem existente nos dois lados vence:
 * a de `atualizado_em` mais recente; empate fica com a nuvem.
 * @returns {object} o objeto que deve ficar.
 */
export function escolherNoMerge(local, cloud) {
  return _t(local.atualizado_em) > _t(cloud.atualizado_em) ? local : cloud;
}

/**
 * Reconcilia a lista local com os documentos da nuvem (personagens e lápides).
 * Lápide mais nova que a cópia local remove a local; cópia local editada
 * depois da exclusão vence a lápide e é reenviada.
 * @param {object} args
 * @param {object[]} args.locais Personagens guardados neste aparelho.
 * @param {object[]} args.nuvem Documentos da nuvem, lápides incluídas.
 * @param {Set<string>} args.idsPendentesRemocao Ids excluídos neste aparelho cuja remoção ainda não subiu.
 * @returns {{lista: object[], paraEnviarCloud: object[], idsRemovidosLocal: string[]}}
 */
export function reconciliar({ locais, nuvem, idsPendentesRemocao }) {
  const mapaNuvem = new Map(nuvem.map(d => [d.id, d]));
  const mapaLocal = new Map(locais.map(p => [p.id, p]));
  const lista = [];
  const paraEnviarCloud = [];
  const idsRemovidosLocal = [];

  for (const id of new Set([...mapaNuvem.keys(), ...mapaLocal.keys()])) {
    const cloud = mapaNuvem.get(id);
    const local = mapaLocal.get(id);

    if (ehLapide(cloud)) {
      if (!local) continue;
      if (_t(local.atualizado_em) > _t(cloud.removido_em)) {
        lista.push(local);
        paraEnviarCloud.push(local);
      } else {
        idsRemovidosLocal.push(id);
      }
    } else if (!local) {
      if (!idsPendentesRemocao.has(id)) lista.push(cloud);
    } else if (!cloud) {
      lista.push(local);
      paraEnviarCloud.push(local);
    } else {
      const vencedor = escolherNoMerge(local, cloud);
      lista.push(vencedor);
      if (vencedor === local) paraEnviarCloud.push(local);
    }
  }
  return { lista, paraEnviarCloud, idsRemovidosLocal };
}

/**
 * Decide o que fazer ao abrir uma ficha, dado o documento da nuvem dela.
 * @param {object} local Cópia local.
 * @param {object|null} docNuvem Documento da nuvem (personagem, lápide) ou null.
 * @returns {'manter'|'usar-nuvem'|'remover'}
 */
export function decidirAoAbrir(local, docNuvem) {
  if (!docNuvem) return 'manter';
  if (ehLapide(docNuvem)) return _t(local.atualizado_em) > _t(docNuvem.removido_em) ? 'manter' : 'remover';
  return _t(docNuvem.atualizado_em) > _t(local.atualizado_em) ? 'usar-nuvem' : 'manter';
}
