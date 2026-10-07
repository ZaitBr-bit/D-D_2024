// ============================================================
// Monta dados/monstros/criaturas.json: as Feras do Manual dos Monstros (2026,
// Apêndice A: Feras Diversas) que o druida pode assumir na Forma Selvagem.
//
// Fonte: "Monsters Manual D&D 5.5e (2026)" (PDF, em inglês), páginas 295-303 do
// livro. Entram as Feras de ND até 6 (o teto de um Druida de nível 20 do
// Círculo da Lua: nível ÷ 3). Ficam de fora a Lula Monstruosa (ND 12), o
// Mosassauro (ND 11) e o Espinossauro (ND 9), que nenhum druida alcança.
//
// A tradução segue os termos de dados/apendices/criaturas.json (Imobilizado =
// Grappled, Contido = Restrained, Caído = Prone, Sismiconsciência =
// Tremorsense). Medidas: 5 pés = 1,5 m.
//
// Uso: node scripts/monstros/montar_criaturas.mjs   (grava dados/monstros/criaturas.json)
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FONTE = 'monstros';

/** Ataque corpo a corpo: bônus, alcance em metros, dano e texto extra. */
const cc = (bonus, alcance, dano, extra = '') =>
  `*Jogada de Ataque Corpo a Corpo:* +${bonus} para acertar, alcance ${alcance} m. ${dano ? `*Dano:* ${dano}` : '*Acerto:*'}${extra ? ` ${extra}` : ''}`;

const AGARRAR = (cd, tam = 'Médio') => `Se o alvo for ${tam} ou menor, ele tem a condição Imobilizado (CD ${cd} para escapar).`;

const TRACO_ESCALADA = ['Escalada de Aranha', 'A criatura pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.'];
const traco = (nome, descricao) => [nome, descricao];
const TEIA_DESTRUIDA = 'até que a teia seja destruída (CA 10; PV 5; Vulnerabilidade a dano Ígneo; Imunidade a dano Venenoso e Psíquico)';

/**
 * Cada criatura: [valor, mod, sg] por atributo na ordem For, Des, Con, Int, Sab, Car.
 * `pagina` é a página do livro (índice do apêndice).
 */
const CRIATURAS = [
  {
    nome: 'Urso das Cavernas', nome_en: 'Cave Bear', pagina: 295, tamanho: 'Grande',
    ca: '13', iniciativa: '+2 (12)', pv: '66 (7d10 + 28)', deslocamento: '12 m, Escalada 9 m',
    atributos: [[20, '+5', '+5'], [14, '+2', '+2'], [18, '+4', '+4'], [2, '-4', '-4'], [13, '+1', '+1'], [7, '-2', '-2']],
    pericias: 'Percepção +5', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 15', nd: '3 (XP 700; BP +2)',
    tracos: [],
    acoes: [
      ['Ataques Múltiplos', 'O urso realiza três ataques de Rasgar.'],
      ['Rasgar', cc(7, '1,5', '10 (1d10 + 5) Cortante.')],
    ],
  },
  {
    nome: 'Urso Atroz', nome_en: 'Dire Bear', pagina: 295, tamanho: 'Enorme',
    ca: '14', iniciativa: '+2 (12)', pv: '105 (10d12 + 50)', deslocamento: '12 m, Escalada 9 m',
    atributos: [[23, '+6', '+6'], [14, '+2', '+2'], [21, '+5', '+5'], [2, '-4', '-4'], [14, '+2', '+2'], [7, '-2', '-2']],
    pericias: 'Percepção +8', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 18', nd: '5 (XP 1.800; BP +3)',
    tracos: [],
    acoes: [
      ['Ataques Múltiplos', 'O urso realiza três ataques de Rasgar.'],
      ['Rasgar', cc(9, '3', '13 (2d6 + 6) Cortante.')],
    ],
    acoes_bonus: [
      ['Rugido Intimidador', '*Salvaguarda de Sabedoria:* CD 16, cada inimigo em uma Emanação de 18 metros com origem no urso. *Falha:* O alvo tem a condição Amedrontado até o fim do próximo turno do urso. *Sucesso:* O alvo fica imune ao Rugido Intimidador deste urso por 24 horas.'],
    ],
  },
  {
    nome: 'Rato Atroz', nome_en: 'Dire Rat', pagina: 296, tamanho: 'Média',
    ca: '14', iniciativa: '+3 (13)', pv: '16 (3d8 + 3)', deslocamento: '9 m, Escalada 6 m',
    atributos: [[11, '+0', '+0'], [16, '+3', '+3'], [13, '+1', '+1'], [2, '-4', '-4'], [12, '+1', '+1'], [4, '-3', '-3']],
    pericias: 'Percepção +3', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 13', nd: '1/4 (XP 50; BP +2)',
    tracos: [
      traco('Tática de Matilha', 'O rato tem Vantagem em uma jogada de ataque contra uma criatura se pelo menos um aliado do rato estiver a até 1,5 metro da criatura e o aliado não tiver a condição Incapacitado.'),
    ],
    acoes: [['Mordida', cc(5, '1,5', '6 (1d6 + 3) Perfurante.')]],
  },
  {
    nome: 'Formiga-Soldado Gigante', nome_en: 'Giant Army Ant', pagina: 296, tamanho: 'Pequena',
    ca: '13', iniciativa: '+0 (10)', pv: '11 (2d6 + 4)', deslocamento: '9 m, Escalada 9 m',
    atributos: [[12, '+1', '+1'], [10, '+0', '+0'], [14, '+2', '+2'], [2, '-4', '-4'], [12, '+1', '+1'], [3, '-4', '-4']],
    pericias: 'Percepção +5', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 15', nd: '1/4 (XP 50; BP +2)',
    tracos: [
      traco('Tática de Matilha', 'A formiga tem Vantagem em uma jogada de ataque contra uma criatura se pelo menos um aliado da formiga estiver a até 1,5 metro da criatura e o aliado não tiver a condição Incapacitado.'),
      traco(...TRACO_ESCALADA),
    ],
    acoes: [
      ['Mordida', cc(3, '1,5', '4 (1d6 + 1) Perfurante.')],
      ['Ferrão', cc(3, '1,5', '2 Perfurante, e o alvo tem a condição Envenenado até o fim do próximo turno da formiga.')],
    ],
  },
  {
    nome: 'Percevejo-Assassino Gigante', nome_en: 'Giant Assassin Bug', pagina: 296, tamanho: 'Média',
    ca: '14', iniciativa: '+2 (12)', pv: '16 (3d8 + 3)', deslocamento: '9 m, Escalada 6 m',
    atributos: [[10, '+0', '+0'], [14, '+2', '+2'], [12, '+1', '+1'], [2, '-4', '-4'], [12, '+1', '+1'], [3, '-4', '-4']],
    pericias: 'Furtividade +4', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 11', nd: '1/2 (XP 100; BP +2)',
    tracos: [traco(...TRACO_ESCALADA)],
    acoes: [
      ['Probóscide', cc(4, '1,5', '5 (1d6 + 2) Perfurante, o percevejo se prende ao alvo, e o alvo fica sujeito ao seguinte efeito. *Salvaguarda de Constituição:* CD 11. *Falha:* O alvo tem a condição Envenenado e repete a salvaguarda ao final de cada um de seus turnos, encerrando o efeito sobre si com um sucesso. Após 1 minuto, ele é bem-sucedido automaticamente. Enquanto Envenenado, o alvo tem a condição Paralisado. Enquanto estiver preso, o percevejo não pode realizar ataques de Probóscide, e o alvo sofre 5 (2d4) de dano Necrótico no início de cada turno do percevejo. O percevejo pode se soltar gastando 1,5 metro de seu deslocamento. O alvo ou uma criatura a até 1,5 metro dele pode soltar o percevejo com uma ação.')],
    ],
  },
  {
    nome: 'Sanguessuga Gigante', nome_en: 'Giant Leech', pagina: 297, tamanho: 'Grande',
    ca: '11', iniciativa: '-1 (9)', pv: '45 (6d10 + 12)', deslocamento: '6 m, Natação 9 m',
    atributos: [[16, '+3', '+3'], [8, '-1', '-1'], [14, '+2', '+2'], [1, '-5', '-5'], [8, '-1', '-1'], [3, '-4', '-4']],
    pericias: '', sentidos: 'Visão às Cegas 9 m, Sismiconsciência 18 m, Percepção Passiva 9', nd: '1 (XP 200; BP +2)',
    tracos: [],
    acoes: [
      ['Mordida', cc(5, '1,5', '7 (1d8 + 3) Perfurante, e a sanguessuga se prende ao alvo. Enquanto estiver presa, a sanguessuga não pode realizar ataques de Mordida, o alvo tem a condição Imobilizado (CD 13 para escapar) e sofre 7 (1d8 + 3) de dano Necrótico no início de cada turno da sanguessuga. A sanguessuga pode se soltar gastando 1,5 metro de seu deslocamento.')],
    ],
  },
  {
    nome: 'Mosca-Ladra Gigante', nome_en: 'Giant Robber Fly', pagina: 298, tamanho: 'Média',
    ca: '13', iniciativa: '+4 (14)', pv: '22 (4d8 + 4)', deslocamento: '3 m, Voo 18 m',
    atributos: [[10, '+0', '+0'], [18, '+4', '+4'], [12, '+1', '+1'], [2, '-4', '-4'], [14, '+2', '+2'], [3, '-4', '-4']],
    pericias: 'Percepção +6, Furtividade +8', sentidos: 'Percepção Passiva 16', nd: '1 (XP 200; BP +2)',
    tracos: [],
    acoes: [
      ['Probóscide', cc(6, '1,5', '7 (1d6 + 4) Perfurante, a mosca se prende ao alvo, e o alvo fica sujeito ao seguinte efeito. *Salvaguarda de Constituição:* CD 11. *Falha:* O alvo tem a condição Envenenado e repete a salvaguarda ao final de cada um de seus turnos, encerrando o efeito sobre si com um sucesso. Após 1 minuto, ele é bem-sucedido automaticamente. Enquanto Envenenado, o alvo tem a condição Paralisado. Enquanto estiver presa, a mosca não pode realizar ataques de Probóscide, e o alvo sofre 7 (2d6) de dano Necrótico no início de cada turno da mosca. A mosca pode se soltar gastando 1,5 metro de seu deslocamento. O alvo ou uma criatura a até 1,5 metro dele pode soltar a mosca com uma ação.')],
    ],
  },
  {
    nome: 'Besouro-Tigre Gigante', nome_en: 'Giant Tiger Beetle', pagina: 299, tamanho: 'Média',
    ca: '15', iniciativa: '+3 (13)', pv: '22 (4d8 + 4)', deslocamento: '12 m',
    atributos: [[14, '+2', '+2'], [17, '+3', '+3'], [12, '+1', '+1'], [2, '-4', '-4'], [12, '+1', '+1'], [3, '-4', '-4']],
    pericias: 'Furtividade +5', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 11', nd: '1 (XP 200; BP +2)',
    tracos: [],
    acoes: [['Mordida', cc(5, '1,5', '8 (2d4 + 3) Perfurante.', AGARRAR(12))]],
    acoes_bonus: [['Pés Leves', 'O besouro realiza a ação Correr ou Desengajar.']],
  },
  {
    nome: 'Sapo-Boi Gigante', nome_en: 'Giant Bullfrog', pagina: 297, tamanho: 'Grande',
    ca: '14', iniciativa: '+1 (11)', pv: '68 (8d10 + 24)', deslocamento: '9 m, Natação 9 m',
    atributos: [[16, '+3', '+3'], [13, '+1', '+1'], [16, '+3', '+3'], [2, '-4', '-4'], [10, '+0', '+0'], [3, '-4', '-4']],
    pericias: 'Percepção +2, Furtividade +5', sentidos: 'Visão no Escuro 9 m, Percepção Passiva 12', nd: '2 (XP 450; BP +2)',
    tracos: [
      traco('Anfíbio', 'O sapo pode respirar ar e água.'),
      traco('Salto Parado', 'O Salto em Distância do sapo é de até 9 metros e o Salto em Altura é de até 4,5 metros, com ou sem corrida.'),
    ],
    acoes: [
      ['Mordida', cc(5, '1,5', '12 (2d8 + 3) Perfurante.', AGARRAR(13))],
      ['Engolir', 'O sapo engole um alvo Médio ou menor que ele esteja imobilizando. Enquanto engolido, o alvo não tem a condição Imobilizado, mas tem as condições Cego e Contido, e tem Cobertura Total contra ataques e outros efeitos fora do sapo. Enquanto estiver engolindo o alvo, o sapo não pode usar Mordida nem Língua, e se o sapo morrer, o alvo engolido deixa de ter a condição Contido e pode escapar do cadáver gastando 1,5 metro de deslocamento, saindo com a condição Caído. Ao final do próximo turno do sapo, o alvo engolido sofre 9 (2d8) de dano Ácido. Se esse dano não o matar, o sapo o regurgita, fazendo-o sair Caído.'],
    ],
    acoes_bonus: [
      ['Língua', cc(5, '4,5', '', 'Se o alvo for uma criatura Média ou menor, o sapo puxa o alvo 3 metros em linha reta em sua direção.')],
    ],
  },
  {
    nome: 'Cecília Gigante', nome_en: 'Giant Caecilia', pagina: 297, tamanho: 'Grande',
    ca: '12', iniciativa: '-1 (9)', pv: '51 (6d10 + 18)', deslocamento: '6 m, Escavação 3 m, Natação 6 m',
    atributos: [[16, '+3', '+3'], [9, '-1', '-1'], [16, '+3', '+3'], [1, '-5', '-5'], [8, '-1', '-1'], [3, '-4', '-4']],
    pericias: '', sentidos: 'Visão às Cegas 9 m, Sismiconsciência 18 m, Percepção Passiva 9', nd: '2 (XP 450; BP +2)',
    tracos: [traco('Anfíbia', 'A cecília pode respirar ar e água.')],
    acoes: [
      ['Mordida', cc(5, '1,5', '13 (3d6 + 3) Perfurante mais 7 (2d6) Venenoso.', AGARRAR(13))],
    ],
    acoes_bonus: [
      ['Engolir', '*Salvaguarda de Força:* CD 13, uma criatura Média ou menor Imobilizada pela cecília (ela pode ter até duas criaturas engolidas por vez). *Falha:* O alvo é engolido pela cecília, e a condição Imobilizado termina. Uma criatura engolida tem as condições Cego e Contido, tem Cobertura Total contra ataques e outros efeitos fora da cecília e sofre 10 (3d6) de dano Ácido no início de cada turno da cecília. Se a cecília sofrer 10 de dano ou mais em um único turno de uma criatura dentro dela, ela deve ser bem-sucedida em uma salvaguarda de Constituição CD 13 ao final desse turno ou regurgita todas as criaturas engolidas, cada uma caindo em um espaço a até 1,5 metro da cecília e tendo a condição Caído. Se a cecília morrer, qualquer criatura engolida deixa de ter a condição Contido e pode escapar do cadáver gastando 1,5 metro de deslocamento, saindo Caída.'],
    ],
  },
  {
    nome: 'Louva-a-Deus Gigante', nome_en: 'Giant Praying Mantis', pagina: 298, tamanho: 'Grande',
    ca: '13', iniciativa: '+2 (12)', pv: '52 (7d10 + 14)', deslocamento: '9 m, Escalada 9 m, Voo 9 m',
    atributos: [[18, '+4', '+4'], [15, '+2', '+2'], [14, '+2', '+2'], [2, '-4', '-4'], [13, '+1', '+1'], [3, '-4', '-4']],
    pericias: 'Percepção +3, Furtividade +6', sentidos: 'Percepção Passiva 13', nd: '2 (XP 450; BP +2)',
    tracos: [traco('Escalada de Aranha', 'O louva-a-deus pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.')],
    acoes: [
      ['Garras', cc(6, '4,5', '9 (2d4 + 4) Perfurante.', 'Se o alvo for uma criatura Média ou menor, ele tem a condição Imobilizado (CD 14 para escapar). Enquanto Imobilizado, o alvo tem a condição Contido.')],
    ],
    acoes_bonus: [
      ['Mordida', '*Salvaguarda de Destreza:* CD 14, uma criatura Imobilizada pelo louva-a-deus. *Falha:* 15 (2d10 + 4) Perfurante. *Sucesso:* Metade do dano.'],
    ],
  },
  {
    nome: 'Lesma Gigante', nome_en: 'Giant Slug', pagina: 298, tamanho: 'Grande',
    ca: '12', iniciativa: '-2 (8)', pv: '85 (9d10 + 36)', deslocamento: '6 m, Escalada 6 m',
    atributos: [[18, '+4', '+4'], [6, '-2', '-2'], [18, '+4', '+4'], [1, '-5', '-5'], [8, '-1', '-1'], [3, '-4', '-4']],
    pericias: 'Percepção +3, Sobrevivência +3', sentidos: 'Visão às Cegas 9 m, Percepção Passiva 13', nd: '3 (XP 700; BP +2)',
    tracos: [traco('Escalada de Aranha', 'A lesma pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.')],
    acoes: [
      ['Raspar', cc(6, '1,5', '14 (3d6 + 4) Cortante mais 10 (3d6) Ácido.', AGARRAR(14))],
    ],
    acoes_bonus: [
      ['Engolir', '*Salvaguarda de Força:* CD 14, uma criatura Média ou menor Imobilizada pela lesma (ela pode ter até duas criaturas engolidas por vez). *Falha:* O alvo é engolido pela lesma, e a condição Imobilizado termina. Uma criatura engolida tem as condições Cego e Contido, tem Cobertura Total contra ataques e outros efeitos fora da lesma e sofre 14 (4d6) de dano Ácido no início de cada turno da lesma. Se a lesma sofrer 15 de dano ou mais em um único turno de uma criatura dentro dela, ela deve ser bem-sucedida em uma salvaguarda de Constituição CD 14 ao final desse turno ou regurgita todas as criaturas engolidas, cada uma caindo em um espaço a até 1,5 metro da lesma e tendo a condição Caído. Se a lesma morrer, qualquer criatura engolida deixa de ter a condição Contido e pode escapar do cadáver gastando 1,5 metro de deslocamento, saindo Caída.'],
    ],
  },
  {
    nome: 'Naja-Cuspideira Gigante', nome_en: 'Giant Spitting Cobra', pagina: 299, tamanho: 'Grande',
    ca: '15', iniciativa: '+4 (14)', pv: '51 (6d10 + 18)', deslocamento: '12 m, Natação 12 m',
    atributos: [[14, '+2', '+2'], [18, '+4', '+4'], [16, '+3', '+3'], [2, '-4', '-4'], [14, '+2', '+2'], [3, '-4', '-4']],
    pericias: 'Percepção +6, Furtividade +8', sentidos: 'Visão às Cegas 3 m, Percepção Passiva 16', nd: '2 (XP 450; BP +2)',
    tracos: [],
    acoes: [
      ['Mordida', cc(6, '3', '9 (2d4 + 4) Perfurante mais 9 (2d8) Venenoso.')],
      ['Cuspir Veneno', '*Jogada de Ataque à Distância:* +6 para acertar, alcance 6/18 m. *Dano:* 9 (2d8) Venenoso, e o alvo tem a condição Envenenado até o fim do próximo turno da naja. Enquanto Envenenada, a criatura tem a condição Cego.'],
    ],
  },
  {
    nome: 'Tarântula Gigante', nome_en: 'Giant Tarantula', pagina: 299, tamanho: 'Grande',
    ca: '14', iniciativa: '+2 (12)', pv: '59 (7d10 + 21)', deslocamento: '9 m, Escalada 9 m',
    atributos: [[16, '+3', '+3'], [14, '+2', '+2'], [16, '+3', '+3'], [2, '-4', '-4'], [14, '+2', '+2'], [4, '-3', '-3']],
    pericias: 'Percepção +6, Furtividade +6', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 16', nd: '2 (XP 450; BP +2)',
    tracos: [
      traco('Escalada de Aranha', 'A tarântula pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.'),
      traco('Andar na Teia', 'A tarântula ignora restrições de movimento causadas por teias e sabe a localização de qualquer outra criatura em contato com a mesma teia.'),
    ],
    acoes: [
      ['Mordida', cc(5, '3', '10 (2d6 + 3) Perfurante mais 7 (2d6) Venenoso.', 'Se o alvo for uma criatura, ele fica sujeito ao seguinte efeito. *Salvaguarda de Constituição:* CD 13. *Falha:* O alvo tem a condição Envenenado até o fim do próximo turno da tarântula. Enquanto Envenenado, o alvo tem a condição Paralisado.')],
      ['Pelos Urticantes (Recarrega após um Descanso Longo)', 'A tarântula lança os pelos farpados de seu abdômen. *Salvaguarda de Constituição:* CD 13, cada criatura em uma Emanação de 6 metros com origem na tarântula. *Falha:* A criatura tem a condição Envenenado e repete a salvaguarda ao final de cada um de seus turnos, encerrando o efeito sobre si com um sucesso. Após 1 minuto, ela é bem-sucedida automaticamente.'],
    ],
  },
  {
    nome: 'Verme-Veludo Gigante', nome_en: 'Giant Velvet Worm', pagina: 300, tamanho: 'Grande',
    ca: '13', iniciativa: '+1 (11)', pv: '85 (10d10 + 30)', deslocamento: '9 m, Escalada 6 m',
    atributos: [[17, '+3', '+3'], [12, '+1', '+1'], [16, '+3', '+3'], [1, '-5', '-5'], [14, '+2', '+2'], [3, '-4', '-4']],
    pericias: 'Percepção +6, Sobrevivência +6', sentidos: 'Visão às Cegas 9 m, Visão no Escuro 18 m, Percepção Passiva 16', nd: '3 (XP 700; BP +2)',
    tracos: [traco('Escalada de Aranha', 'O verme pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.')],
    acoes: [
      ['Ataques Múltiplos', 'O verme realiza dois ataques de Mordida. Ele pode substituir um ataque por um uso de Jato de Teia, se disponível.'],
      ['Mordida', cc(5, '1,5', '10 (2d6 + 3) Perfurante mais 10 (3d6) Ácido.')],
      ['Jato de Teia (Recarga 5–6)', `*Salvaguarda de Destreza:* CD 13, cada criatura em um Cone de 9 metros. *Falha:* O alvo tem a condição Contido ${TEIA_DESTRUIDA}.`],
    ],
  },
  {
    nome: 'Carcaju Gigante', nome_en: 'Giant Wolverine', pagina: 300, tamanho: 'Grande',
    ca: '14', iniciativa: '+2 (12)', pv: '57 (6d10 + 24)', deslocamento: '9 m',
    atributos: [[18, '+4', '+4'], [14, '+2', '+2'], [19, '+4', '+4'], [2, '-4', '-4'], [14, '+2', '+2'], [7, '-2', '-2']],
    pericias: 'Percepção +6', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 16', nd: '2 (XP 450; BP +2)',
    tracos: [
      traco('Fúria Sangrenta', 'O carcaju tem Vantagem em jogadas de ataque corpo a corpo enquanto estiver Sangrando.'),
      traco('Resistência Implacável (Recarrega após um Descanso Longo)', 'Quando o carcaju é reduzido a 0 Pontos de Vida, mas não morto de imediato, ele pode cair para 1 Ponto de Vida.'),
    ],
    acoes: [
      ['Ataques Múltiplos', 'O carcaju realiza dois ataques de Rasgar.'],
      ['Rasgar', cc(6, '1,5', '11 (2d6 + 4) Cortante.')],
    ],
  },
  {
    nome: 'Hatori', nome_en: 'Hatori', pagina: 301, tamanho: 'Enorme',
    ca: '15', iniciativa: '+2 (12)', pv: '126 (12d12 + 48)', deslocamento: '9 m, Escavação 4,5 m',
    atributos: [[22, '+6', '+6'], [9, '-1', '-1'], [18, '+4', '+4'], [2, '-4', '-4'], [14, '+2', '+2'], [4, '-3', '-3']],
    pericias: 'Furtividade +5', sentidos: 'Sismiconsciência 9 m, Percepção Passiva 12', nd: '6 (XP 2.300; BP +3)',
    tracos: [],
    acoes: [
      ['Ataques Múltiplos', 'O hatori realiza um ataque de Mordida e um ataque de Cauda.'],
      ['Mordida', cc(9, '1,5', '22 (3d10 + 6) Perfurante.', 'Se o alvo for uma criatura Grande ou menor, ele tem a condição Imobilizado (CD 16 para escapar). Enquanto Imobilizado, o alvo tem a condição Contido e não pode ser alvo da Cauda do hatori.')],
      ['Cauda', cc(9, '3', '19 (3d8 + 6) Contundente.', 'Se o alvo for uma criatura Grande ou menor, ele tem a condição Caído.')],
    ],
    acoes_bonus: [
      ['Engolir', '*Salvaguarda de Força:* CD 17, uma criatura Média ou menor Imobilizada pelo hatori (ele pode ter até seis criaturas engolidas por vez). *Falha:* O alvo é engolido, e a condição Imobilizado termina. Uma criatura engolida tem as condições Cego e Contido, tem Cobertura Total contra ataques e outros efeitos fora do hatori e sofre 14 (4d6) de dano Ácido no início de cada turno do hatori. Se o hatori sofrer 20 de dano ou mais em um único turno de uma criatura dentro dele, ele deve ser bem-sucedido em uma salvaguarda de Constituição CD 16 ao final desse turno ou regurgita todas as criaturas engolidas, cada uma caindo em um espaço a até 1,5 metro do hatori e tendo a condição Caído. Se o hatori morrer, qualquer criatura engolida deixa de ter a condição Contido e pode escapar do cadáver gastando 4,5 metros de deslocamento, saindo Caída.'],
    ],
  },
  {
    nome: 'Polvo Monstruoso', nome_en: 'Monstrous Octopus', pagina: 301, tamanho: 'Enorme',
    ca: '12', iniciativa: '+1 (11)', pv: '104 (11d12 + 33)', deslocamento: '1,5 m, Natação 24 m',
    atributos: [[21, '+5', '+5'], [13, '+1', '+1'], [17, '+3', '+3'], [6, '-2', '-2'], [12, '+1', '+1'], [4, '-3', '-3']],
    pericias: 'Percepção +3, Furtividade +5', sentidos: 'Visão no Escuro 36 m, Percepção Passiva 13', nd: '3 (XP 700; BP +2)',
    tracos: [traco('Respirar na Água', 'O polvo só pode respirar debaixo d\'água.')],
    acoes: [
      ['Tentáculos', cc(7, '4,5', '15 (3d6 + 5) Contundente.', 'Se o alvo for uma criatura Grande ou menor, ele tem a condição Imobilizado (CD 15 para escapar) por todos os oito tentáculos. Enquanto Imobilizado, o alvo tem a condição Contido.')],
    ],
    reacoes: [
      ['Nuvem de Tinta (1/Dia)', '*Gatilho:* O polvo sofre dano enquanto está debaixo d\'água. *Resposta:* O polvo libera tinta que preenche um Cubo de 4,5 metros de lado centrado em si, e o polvo se desloca até o seu Deslocamento de Natação. O Cubo fica Totalmente Obscurecido por 1 minuto ou até que uma corrente forte ou efeito semelhante disperse a tinta.'],
    ],
  },
  {
    nome: 'Centopeia Monstruosa', nome_en: 'Monstrous Centipede', pagina: 301, tamanho: 'Grande',
    ca: '15', iniciativa: '+3 (13)', pv: '42 (5d10 + 15)', deslocamento: '12 m, Escalada 12 m',
    atributos: [[10, '+0', '+0'], [16, '+3', '+3'], [16, '+3', '+3'], [1, '-5', '-5'], [8, '-1', '-1'], [3, '-4', '-4']],
    pericias: '', sentidos: 'Visão às Cegas 9 m, Percepção Passiva 9', nd: '2 (XP 450; BP +2)',
    tracos: [],
    acoes: [['Mordida', cc(5, '1,5', '10 (2d6 + 3) Perfurante mais 10 (3d6) Venenoso, e o alvo tem a condição Envenenado até o início do próximo turno da centopeia.')]],
  },
  {
    nome: 'Escorpião Monstruoso', nome_en: 'Monstrous Scorpion', pagina: 302, tamanho: 'Enorme',
    ca: '16', iniciativa: '+1 (11)', pv: '105 (10d12 + 40)', deslocamento: '12 m, Natação 12 m',
    atributos: [[20, '+5', '+5'], [13, '+1', '+1'], [19, '+4', '+4'], [1, '-5', '-5'], [9, '-1', '-1'], [3, '-4', '-4']],
    pericias: '', sentidos: 'Visão às Cegas 18 m, Percepção Passiva 9', nd: '6 (XP 2.300; BP +3)',
    tracos: [],
    acoes: [
      ['Ataques Múltiplos', 'O escorpião realiza dois ataques de Garra e um ataque de Ferrão.'],
      ['Garra', cc(8, '1,5', '12 (2d6 + 5) Contundente.', 'Se o alvo for uma criatura Enorme ou menor, ele tem a condição Imobilizado (CD 15 para escapar) por uma de duas garras.')],
      ['Ferrão', cc(8, '1,5', '14 (2d8 + 5) Perfurante mais 16 (3d10) Venenoso.')],
    ],
  },
  {
    nome: 'Aranha Monstruosa', nome_en: 'Monstrous Spider', pagina: 302, tamanho: 'Enorme',
    ca: '15', iniciativa: '+3 (13)', pv: '85 (9d12 + 27)', deslocamento: '9 m, Escalada 9 m',
    atributos: [[18, '+4', '+4'], [16, '+3', '+3'], [16, '+3', '+3'], [2, '-4', '-4'], [12, '+1', '+1'], [4, '-3', '-3']],
    pericias: 'Percepção +5, Furtividade +7', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 15', nd: '4 (XP 1.100; BP +2)',
    tracos: [
      traco('Escalada de Aranha', 'A aranha pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.'),
      traco('Andar na Teia', 'A aranha ignora restrições de movimento causadas por teias e sabe a localização de qualquer outra criatura em contato com a mesma teia.'),
    ],
    acoes: [
      ['Ataques Múltiplos', 'A aranha realiza dois ataques de Mordida. Ela pode substituir um ataque por um uso de Teia.'],
      ['Mordida', cc(6, '3', '13 (2d8 + 4) Perfurante mais 10 (3d6) Venenoso, e o alvo tem a condição Envenenado até o fim do próximo turno da aranha.')],
      ['Teia (Recarga 5–6)', `*Salvaguarda de Destreza:* CD 13, uma criatura que a aranha possa ver a até 18 metros. *Falha:* O alvo tem a condição Contido ${TEIA_DESTRUIDA}.`],
    ],
  },
  {
    nome: 'Tarântula Monstruosa', nome_en: 'Monstrous Tarantula', pagina: 303, tamanho: 'Enorme',
    ca: '15', iniciativa: '+2 (12)', pv: '138 (12d12 + 60)', deslocamento: '9 m, Escalada 9 m',
    atributos: [[20, '+5', '+5'], [14, '+2', '+2'], [20, '+5', '+5'], [2, '-4', '-4'], [14, '+2', '+2'], [4, '-3', '-3']],
    pericias: 'Percepção +8, Furtividade +8', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 18', nd: '6 (XP 2.300; BP +3)',
    tracos: [
      traco('Escalada de Aranha', 'A tarântula pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.'),
      traco('Andar na Teia', 'A tarântula ignora restrições de movimento causadas por teias e sabe a localização de qualquer outra criatura em contato com a mesma teia.'),
    ],
    acoes: [
      ['Ataques Múltiplos', 'A aranha realiza dois ataques de Mordida. Ela pode substituir um ataque por um uso de Pelos Urticantes, se disponível.'],
      ['Mordida', cc(8, '3', '15 (3d6 + 5) Perfurante mais 10 (3d6) Venenoso.', 'Se o alvo for uma criatura, ele fica sujeito ao seguinte efeito. *Salvaguarda de Constituição:* CD 16. *Falha:* O alvo tem a condição Envenenado até o fim do próximo turno da tarântula. Enquanto Envenenado, o alvo tem a condição Paralisado.')],
      ['Pelos Urticantes (Recarrega após um Descanso Longo)', 'A tarântula lança os pelos farpados de seu abdômen. *Salvaguarda de Constituição:* CD 16, cada criatura em uma Emanação de 9 metros com origem na tarântula. *Falha:* A criatura tem a condição Envenenado e repete a salvaguarda ao final de cada um de seus turnos, encerrando o efeito sobre si com um sucesso. Após 1 minuto, ela é bem-sucedida automaticamente.'],
    ],
  },
  {
    nome: 'Aranha-Espada', nome_en: 'Sword Spider', pagina: 303, tamanho: 'Grande',
    ca: '14', iniciativa: '+5 (15)', pv: '76 (9d10 + 27)', deslocamento: '12 m, Escalada 9 m',
    atributos: [[19, '+4', '+4'], [14, '+2', '+2'], [16, '+3', '+3'], [2, '-4', '-4'], [12, '+1', '+1'], [4, '-3', '-3']],
    pericias: 'Percepção +7, Furtividade +8', sentidos: 'Visão no Escuro 18 m, Percepção Passiva 17', nd: '5 (XP 1.800; BP +3)',
    tracos: [
      traco('Escalada de Aranha', 'A aranha pode escalar superfícies difíceis, inclusive ao longo de tetos, sem precisar realizar um teste de atributo.'),
      traco('Andar na Teia', 'A aranha ignora restrições de movimento causadas por teias e sabe a localização de qualquer outra criatura em contato com a mesma teia.'),
    ],
    acoes: [
      ['Ataques Múltiplos', 'A aranha realiza dois ataques de Pata Dianteira e um ataque de Mordida.'],
      ['Pata Dianteira', cc(7, '3', '11 (2d6 + 4) Cortante.')],
      ['Mordida', cc(7, '1,5', '11 (2d6 + 4) Perfurante mais 10 (3d6) Venenoso, e o alvo tem a condição Envenenado até o fim do próximo turno da aranha.')],
      ['Salto Mortal', 'A aranha gasta 1,5 metro de deslocamento para saltar até um espaço a até 4,5 metros que contenha uma ou mais criaturas Grandes ou menores. *Salvaguarda de Destreza:* CD 15, cada criatura no espaço de destino da aranha. *Falha:* 32 (8d6 + 4) Perfurante. *Sucesso:* Metade do dano.'],
    ],
    reacoes: [
      ['Aparar', '*Gatilho:* A aranha é atingida por uma jogada de ataque corpo a corpo. *Resposta:* A aranha soma 3 à sua CA contra esse ataque, possivelmente fazendo-o errar.'],
    ],
  },
];

const ROTULOS_ATRIBUTO = ['For', 'Des', 'Con', 'Int', 'Sab', 'Car'];
const FEMININO_ENORME = { Minúscula: 'Minúscula', Pequena: 'Pequena', Média: 'Média', Grande: 'Grande', Enorme: 'Enorme', Imensa: 'Imensa' };

/** Seção de texto (Traços, Ações…) no formato dos blocos de dados/apendices/criaturas.json. */
function secao(titulo, itens) {
  if (!itens?.length) return '';
  return `\n\n### ${titulo}\n\n${itens.map(([n, d]) => `**${n}.** ${d}`).join('\n\n')}`;
}

/** Texto completo (Markdown) de uma criatura, igual ao do apêndice de criaturas. */
function textoCompleto(c) {
  const tipo = `Fera ${FEMININO_ENORME[c.tamanho]}, Sem Alinhamento`;
  const linhaAtr = (i) => ROTULOS_ATRIBUTO.slice(i, i + 3).map((r, k) => {
    const [v, m, s] = c.atributos[i + k];
    return `**${r}** | ${v} | ${m} | ${s}`;
  }).join(' | ');
  return [
    `## ${c.nome}`,
    `*${tipo}*`,
    `**CA** ${c.ca}`,
    `**Iniciativa** ${c.iniciativa}`,
    `**PV** ${c.pv}`,
    `**Deslocamento** ${c.deslocamento}`,
    `|         |    | **Mod** | **SG** |         |    | **Mod** | **SG** |         |    | **Mod** | **SG** |\n|---------|---|---------|--------|---------|----|---------|--------|---------|----|---------|--------|\n| ${linhaAtr(0)} |\n| ${linhaAtr(3)} |`,
    ...(c.pericias ? [`**Perícias** ${c.pericias}`] : []),
    `**Sentidos** ${c.sentidos}`,
    '**Idiomas** —',
    `**ND** ${c.nd}`,
  ].join('\n\n')
    + secao('Traços', c.tracos)
    + secao('Ações', c.acoes)
    + secao('Ações Bônus', c.acoes_bonus)
    + secao('Reações', c.reacoes);
}

const paraObjetos = (lista) => (lista || []).map(([nome, descricao]) => ({ nome, descricao }));

const criaturas = CRIATURAS.map((c) => ({
  nome: c.nome,
  nome_en: c.nome_en,
  fonte: FONTE,
  pagina: c.pagina,
  tipo_tamanho: `Fera ${FEMININO_ENORME[c.tamanho]}, Sem Alinhamento`,
  ca: c.ca,
  iniciativa: c.iniciativa,
  pv: c.pv,
  deslocamento: c.deslocamento,
  atributos: Object.fromEntries(ROTULOS_ATRIBUTO.map((r, i) => [r, { valor: String(c.atributos[i][0]), modificador: c.atributos[i][1], salvaguarda: c.atributos[i][2] }])),
  pericias: c.pericias,
  sentidos: c.sentidos,
  idiomas: '—',
  nd: c.nd,
  tracos: paraObjetos(c.tracos),
  acoes: paraObjetos(c.acoes),
  acoes_bonus: paraObjetos(c.acoes_bonus),
  reacoes: paraObjetos(c.reacoes),
  texto_completo: textoCompleto(c),
}));

const saida = resolve(RAIZ, 'dados', 'monstros', 'criaturas.json');
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, `${JSON.stringify({ total: criaturas.length, criaturas }, null, 2)}\n`);
console.log(`${criaturas.length} criaturas gravadas em ${saida}`);
