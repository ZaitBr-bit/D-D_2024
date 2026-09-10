// ============================================================
// Issue #55 -- o marcador de dado nao pode chegar ao PDF.
//
// mdParaHtml embrulha "1d6" em 🎲 para o CSS destacar na tela. A fonte
// Helvetica do PDF (WinAnsi) nao codifica emoji, e o sanitizador troca
// cada caractere fora de Latin-1 por '?' -- o jogador via
// "sofre ?1d6? pontos de dano Psíquico".
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();

test('mdParaHtml marca o dado com MARCADOR_DADO', () => {
  const html = utils.mdParaHtml('sofre 1d6 pontos de dano Psíquico');
  assert.ok(html.includes(`${utils.MARCADOR_DADO}1d6${utils.MARCADOR_DADO}`),
    'mdParaHtml deveria embrulhar o dado no marcador');
});

test('removerMarcadoresDado devolve o texto sem nenhum marcador', () => {
  const html = utils.mdParaHtml('sofre 1d6 pontos e depois 2d8 de dano');
  const limpo = utils.removerMarcadoresDado(html);
  assert.ok(!limpo.includes(utils.MARCADOR_DADO),
    'nenhum marcador pode sobrar');
  assert.ok(limpo.includes('1d6') && limpo.includes('2d8'),
    'os dados em si continuam no texto');
});

test('texto sanitizado para o PDF nao tem interrogacao no lugar do dado', () => {
  // Reproduz o sanitizador do PDF: tudo fora de Latin-1 vira '?'.
  const paraLatin1 = (t) => [...t].map(ch => ch.codePointAt(0) <= 0xFF ? ch : '?').join('');
  const html = utils.mdParaHtml('sofre 1d6 pontos de dano Psíquico');
  const comoVaiParaOPdf = paraLatin1(utils.removerMarcadoresDado(html));
  assert.ok(!comoVaiParaOPdf.includes('?1d6?'),
    'o dado nao pode chegar ao PDF cercado de interrogacao');
  assert.ok(comoVaiParaOPdf.includes('1d6'), 'o dado continua legivel');
});

test('removerMarcadoresDado aceita nulo e vazio sem quebrar', () => {
  assert.equal(utils.removerMarcadoresDado(null), '');
  assert.equal(utils.removerMarcadoresDado(''), '');
});
