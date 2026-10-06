// ============================================================
// Cálculo de ataque e dano de uma arma do inventário. Usado pela linha do
// inventário e pela seção Ataques, para os dois mostrarem o mesmo número.
// ============================================================
import { atributoEfetivo } from '../regras-atributos.js';
import { bonusProficiencia, calcMod } from '../utils.js';
import { modAtaqueArmaArtifice } from '../regras-artifice.js';
import { efeitosDaArma } from '../regras-itens-magicos.js';
import { ATRIBUTOS_MODIFICADOR, atributoPadraoArma, atributoExplicito, danoBaseEmpunhado, danoVersatil } from '../regras-ataque.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { sheetTemProfArma } from './condicoes.js';
import { char, passivosTalentosCache } from './estado.js';

/**
 * Atributo que a arma usa quando o jogador não escolheu nenhum: o padrão da arma, ou
 * Inteligência quando o Ferreiro de Batalha (arma mágica) sobrepõe o padrão.
 * @returns {string} id do atributo (ex.: 'forca', 'inteligencia')
 */
export function atributoPadraoEfetivoArma(item) {
  const padrao = atributoPadraoArma(char, item);
  const art = modAtaqueArmaArtifice(char, item, calcMod(atributoEfetivo(char, padrao)));
  return art.usouInt ? 'inteligencia' : padrao;
}

/**
 * Calcula bônus de ataque e dano exibido de uma arma (catálogo ou personalizada com categoria).
 * O atributo vem de `dados.atributo` quando escolhido; o Ferreiro de Batalha só sobrepõe o padrão.
 * O dano usa o dado versátil quando `dados.empunhadura === 'duas'`.
 * @returns {{modAtq:number, usaForcaNoAtaque:boolean, isDistancia:boolean, props:string,
 *   passivos:object, bonusAtq:number, magiaArma:object, danoExibicao:string, temDano:boolean,
 *   atributo:string}}  (atributo = id do atributo do modificador realmente usado)
 */
export function calcularAtaqueItem(item) {
  const prof = bonusProficiencia(char.nivel);
  const props = (item.dados.propriedades || '').toLowerCase();
  const cat = (item.dados.categoria || '').toLowerCase();
  const isDistancia = cat.includes('dist');

  const atributo = atributoExplicito(item) || atributoPadraoEfetivoArma(item);
  const modAtq = calcMod(atributoEfetivo(char, atributo));
  const usaForcaNoAtaque = atributo === 'forca';

  const temProf = sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
  // Bônus mágico da própria arma (acervo ou customizado), sintonizada quando exige: entra no ataque e no dano.
  const magiaArma = efeitosDaArma(item);
  const passivos = passivosTalentosCache || {};
  let bonusAtq = modAtq + (temProf ? prof : 0) + magiaArma.ataque;
  if (isDistancia) bonusAtq += passivos.bonusAtaqueDistancia || 0;

  // Dano sobre o dado da empunhadura atual.
  const danoBase = danoBaseEmpunhado(item);
  let danoExibicao = danoBase;
  let temDano = false;
  const matchDano = danoBase.match(/^(\d+d\d+)(\s*[+\-]\s*\d+)?(.*)$/i);
  if (matchDano) {
    temDano = true;
    const [, dado, modExistente, resto] = matchDano;
    const sufixo = resto || '';
    const estadoFuria = getEstadoFuria();
    const bonusFuria = estadoFuria?.ativa && usaForcaNoAtaque ? (estadoFuria.dano || 0) : 0;
    const ehArremesso = props.includes('arremesso');
    // Duas mãos (propriedade ou empunhadura versátil escolhida) e Pesada não recebem o bônus de uma mão.
    // A empunhadura "duas" só vale em arma versátil; em outra arma o valor residual é ignorado.
    const empunhadoComDuas = !!danoVersatil(item) && item.dados.empunhadura === 'duas';
    const usaUmaMao = !props.includes('duas mãos') && !props.includes('pesada') && !empunhadoComDuas;
    let bonusDanoTalento = 0;
    if (usaUmaMao && !isDistancia) bonusDanoTalento += passivos.bonusDanoUmaMao || 0;
    if (ehArremesso) bonusDanoTalento += passivos.bonusDanoArremesso || 0;

    if (modExistente) {
      const modBase = parseInt(String(modExistente).replace(/\s+/g, '')) || 0;
      const modFinal = modBase + bonusFuria + bonusDanoTalento + magiaArma.dano;
      danoExibicao = `${dado}${modFinal >= 0 ? `+${modFinal}` : modFinal}${sufixo}`.replace(/\s+/g, ' ').trim();
    } else {
      const total = modAtq + bonusFuria + magiaArma.dano + bonusDanoTalento;
      danoExibicao = total !== 0
        ? `${dado}${total >= 0 ? `+${total}` : total}${sufixo}`.replace(/\s+/g, ' ').trim()
        : danoBase;
    }
  }
  return { modAtq, usaForcaNoAtaque, isDistancia, props, passivos, bonusAtq, magiaArma, danoExibicao, temDano, atributo };
}

/**
 * Selo com a sigla do atributo do modificador da arma (FOR, DES, INT...), com o nome completo no título.
 * Recebe o resultado de calcularAtaqueItem; devolve string vazia se o atributo não for reconhecido.
 */
export function htmlSeloAtributoArma(calc) {
  const a = ATRIBUTOS_MODIFICADOR.find(x => x.id === calc?.atributo);
  if (!a) return '';
  return `<span class="badge badge-secondary" data-selo-atributo="${a.id}" title="Atributo do modificador: ${a.nome}" style="font-size:0.65rem">${a.sigla}</span>`;
}
