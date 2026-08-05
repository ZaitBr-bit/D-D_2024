export function validarAtributosEditados(personagem, baseProposta, regras) {
  const cfg = personagem.configuracao_criacao?.atributos;
  if (!cfg?.metodo || !cfg.valoresBase) return { ok: false, erro: 'Informe o método de criação antes de editar atributos.' };
  const valores = Object.values(baseProposta);
  if (valores.length !== 6 || valores.some(v => !Number.isInteger(v))) return { ok: false, erro: 'Distribua os seis atributos com valores inteiros.' };
  const assinatura = lista => lista.slice().sort((a, b) => a - b).join(',');
  if (cfg.metodo === 'standard' && assinatura(valores) !== assinatura(regras.STANDARD_ARRAY)) return { ok: false, erro: 'Use cada valor do Conjunto Padrão uma vez.' };
  if (cfg.metodo === 'pointbuy') {
    const custo = valores.reduce((total, valor) => total + (regras.POINT_BUY_CUSTOS[valor] ?? Infinity), 0);
    if (custo !== regras.POINT_BUY_TOTAL) return { ok: false, erro: 'A Compra de Pontos deve usar exatamente 27 pontos.' };
  }
  if (cfg.metodo === 'rolagem' && assinatura(valores) !== assinatura(Object.values(cfg.rolagens || {}))) return { ok: false, erro: 'Use apenas os resultados da rolagem original.' };
  if (cfg.metodo === 'manual' && assinatura(valores) !== assinatura(Object.values(cfg.valoresBase))) return { ok: false, erro: 'Redistribua somente os valores originais.' };
  if (Object.entries(baseProposta).some(([chave, valor]) => valor + (personagem.bonus_antecedente?.[chave] || 0) > 20)) return { ok: false, erro: 'Nenhum atributo pode ultrapassar 20.' };
  return { ok: true };
}

export function validarListaUnica(lista, opcoesPermitidas, limite, descricao) {
  if (!Array.isArray(lista) || new Set(lista).size !== lista.length) return { ok: false, erro: `${descricao} não pode conter itens repetidos.` };
  if (limite !== null && lista.length > limite) return { ok: false, erro: `Limite de ${limite} ${descricao.toLowerCase()} excedido.` };
  if (lista.some(item => !opcoesPermitidas.has(item))) return { ok: false, erro: `${descricao} contém opção indisponível.` };
  return { ok: true };
}
