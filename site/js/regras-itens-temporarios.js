// ============================================================
// Itens temporários: item do inventário com `origem.expira` some no
// evento indicado. Usado pela Magia de Funileiro e, depois, pelos itens
// replicados e elixires do Artífice.
// ============================================================

/** Remove do inventário os itens que expiram em `tipo`; devolve os nomes removidos. */
export function removerItensExpirados(p, tipo) {
  const removidos = [];
  p.inventario = (p.inventario || []).filter((i) => {
    if (i?.origem?.expira !== tipo) return true;
    removidos.push(i.nome);
    return false;
  });
  return removidos;
}
