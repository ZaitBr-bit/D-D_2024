// ============================================================
// Ordem Divina (Clérigo) / Ordem Primal (Druida) -- Classes.md, nível 1.
//
// Extraído de creator/comum.js (issue #59): o criador oferece esta
// escolha há muito tempo, mas o motor de subida de nível (levelup.js)
// nunca a oferecia quando Clérigo/Druida entram como classe NOVA num
// multiclasse -- o jogador ficava sem Ordem nenhuma (sem o bônus de
// truque do Taumaturgo/Xamã, sem a proficiência extra do Protetor).
//
// Módulo PURO de propósito (sem DOM, sem import de creator/wizard.js):
// creator/comum.js e site/js/levelup-flow.js precisam da MESMA definição,
// e levelup-flow.js roda dentro da FICHA -- importar de dentro de
// creator/comum.js puxaria creator/wizard.js junto (import circular:
// comum.js -> wizard.js -> comum.js), que tem efeito colateral de estado
// do criador que a ficha não deveria carregar.
// ============================================================

export const ORDEM_CLASSE = {
  'Clérigo': {
    chave: 'ordem_divina',
    titulo: 'Ordem Divina',
    descricao: 'Escolha seu papel sagrado. Isso afeta suas proficiências e habilidades.',
    maxEscolhas: 1,
    opcoes: [
      { nome: 'Protetor', descricao: 'Proficiência com armas Marciais e Armadura Pesada', efeito: { armaduras: ['Pesada'], armas: ['Marcial'] } },
      { nome: 'Taumaturgo', descricao: '+1 truque de Clérigo e bônus em Arcanismo/Religião', efeito: { truques_extra: 1 } }
    ]
  },
  'Druida': {
    chave: 'ordem_primal',
    titulo: 'Ordem Primal',
    descricao: 'Escolha sua ordem primal. Isso afeta proficiências e conjuração.',
    maxEscolhas: 1,
    opcoes: [
      { nome: 'Protetor', descricao: 'Proficiência com armas Marciais e Armadura Média', efeito: { armaduras: ['Média'], armas: ['Marcial'] } },
      { nome: 'Xamã', descricao: '+1 truque de Druida e bônus em Arcanismo/Natureza', efeito: { truques_extra: 1 } }
    ]
  }
};
