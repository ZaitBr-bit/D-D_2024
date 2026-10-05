// ============================================================
// Itens que recuperam espaço de magia (Pérola do Poder): lista os espaços
// gastos elegíveis e restaura o escolhido gastando o uso do item.
//
// Regra pura, sem DOM: as reservas de espaço entram por parâmetro (o chamador
// passa `reservasDeEspacos()`) e a função que escreve em `espacos_magia`
// também (o chamador passa `recuperarUmEspaco`), o que permite testar sem
// navegador.
// ============================================================

import { itemAtivo } from './regras-itens-magicos.js';
import { gastarUso, recursosDoItem } from './regras-recursos-itens.js';

// Valor de `efeito` do uso que dispara a recuperação de espaço de magia.
export const EFEITO_RECUPERAR_ESPACO = 'recuperar_espaco_magia';

/** Posição da fonte na ordenação: conjuração antes de pacto. */
const ORDEM_FONTE = { conjuracao: 0, pacto: 1 };

/**
 * Espaços de magia gastos que o item pode recuperar: reservas com `usados > 0`
 * e círculo até `circuloMax` (ausente, null ou undefined = sem limite de
 * círculo), ordenadas por círculo e, no mesmo círculo, conjuração antes de
 * pacto. O espaço de Pacto do Bruxo conta como espaço de magia e leva ", Pacto"
 * dentro do único par de parênteses do rótulo. `reservas` vem de
 * `reservasDeEspacos()`. Devolve [{ fonte, circulo, usados, total, rotulo }].
 */
export function espacosRecuperaveis(reservas, circuloMax) {
  if (!Array.isArray(reservas)) return [];
  const semTeto = circuloMax === undefined || circuloMax === null;
  if (!semTeto && !Number.isInteger(circuloMax)) return [];
  return reservas
    .filter(r => r && r.usados > 0 && (semTeto || r.circulo <= circuloMax) && Object.hasOwn(ORDEM_FONTE, r.fonte))
    .sort((a, b) => a.circulo - b.circulo || ORDEM_FONTE[a.fonte] - ORDEM_FONTE[b.fonte])
    .map(r => ({
      fonte: r.fonte,
      circulo: r.circulo,
      usados: r.usados,
      total: r.total,
      rotulo: `${r.circulo}º círculo${r.fonte === 'pacto' ? ', Pacto' : ''} (gasto ${r.usados} de ${r.total})`,
    }));
}

/**
 * Texto de "nenhum espaço gasto": cita o círculo só quando o uso tem limite
 * (`circulo_max` numérico). Usado pela regra e pela tela.
 */
export function mensagemSemEspaco(circuloMax) {
  return circuloMax === undefined || circuloMax === null
    ? 'Nenhum espaço de magia gasto'
    : `Nenhum espaço de magia gasto de ${circuloMax}º círculo ou inferior`;
}

/** Uso do item pelo nome; null quando não existe. */
function usoDoItem(item, nome) {
  return (recursosDoItem(item)?.usos || []).find(u => u.nome === nome) || null;
}

/**
 * Restaura um espaço de magia pelo uso do item e gasta o uso. Atômica: todas
 * as validações vêm antes de qualquer escrita; em falha devolve
 * { ok:false, erro } sem gastar o uso e sem restaurar espaço.
 *
 * Valida: item ativo (equipado e, se exige, sintonizado), uso existente com
 * `efeito` de recuperar espaço, uso disponível e a opção escolhida entre as
 * elegíveis. `opcoes.reservas` são as reservas atuais e `opcoes.recuperar` é a
 * função que devolve um espaço (`recuperarUmEspaco(personagem, fonte, circulo)`).
 * Devolve { ok:true, circulo, fonte } em sucesso.
 */
export function restaurarEspacoPorItem(personagem, item, nomeDoUso, escolha, opcoes = {}) {
  const { reservas = [], recuperar } = opcoes;
  if (typeof recuperar !== 'function') return { ok: false, erro: 'Função de recuperação ausente.' };
  if (!itemAtivo(item)) return { ok: false, erro: 'Equipe e sintonize o item para usar.' };
  const uso = usoDoItem(item, nomeDoUso);
  if (!uso || uso.efeito !== EFEITO_RECUPERAR_ESPACO) return { ok: false, erro: 'O item não tem esse uso de recuperar espaço de magia.' };
  if ((item.estado_recursos?.usos?.[nomeDoUso] || 0) >= uso.max) return { ok: false, erro: 'O uso já foi gasto.' };
  const lista = espacosRecuperaveis(reservas, uso.circulo_max);
  if (!lista.length) return { ok: false, erro: `${mensagemSemEspaco(uso.circulo_max)}.` };
  const circulo = Number(escolha?.circulo);
  const opcao = lista.find(o => o.fonte === escolha?.fonte && o.circulo === circulo);
  if (!opcao) return { ok: false, erro: 'Espaço de magia fora das opções.' };
  if (!recuperar(personagem, opcao.fonte, opcao.circulo)) return { ok: false, erro: 'Não foi possível restaurar o espaço de magia.' };
  // O uso foi validado como disponível acima: o gasto não falha.
  gastarUso(item, nomeDoUso);
  return { ok: true, circulo: opcao.circulo, fonte: opcao.fonte };
}
