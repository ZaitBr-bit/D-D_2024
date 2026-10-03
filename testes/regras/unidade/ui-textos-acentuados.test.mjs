// ============================================================
// Issue #99 -- textos exibidos na UI sem acento/Ç (rótulos fixos escritos
// quando o campo não aceitava esses caracteres). A varredura olha só o que
// o jogador lê: nós de texto HTML, title/placeholder/aria-label, toast() e
// propriedades label/rotulo/titulo/texto/msg/erro/dica.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { RAIZ } from './harness.mjs';

// Palavras que em português sempre levam acento. Ficam de fora as ambíguas
// (ate/até, ja/já, sera/será, historia/história, numero/número, bonus/bônus
// no latim do jogo): essas dependem de leitura humana.
const PALAVRAS = [
  'percepcao', 'intuicao', 'investigacao', 'visao', 'condicao', 'condicoes', 'descricao',
  'preco', 'nao', 'sao', 'voce', 'acao', 'acoes', 'reacao', 'reacoes', 'concentracao',
  'inspiracao', 'caracteristica', 'caracteristicas', 'proficiencia', 'proficiencias', 'atencao',
  'configuracao', 'selecao', 'informacao', 'observacao', 'opcao', 'opcoes', 'duracao', 'conjuracao',
  'invocacao', 'magica', 'magico', 'tambem', 'alem', 'apos', 'pagina', 'habilitacao',
  'espaco', 'espacos', 'minimo', 'maximo', 'rapido', 'experiencia', 'exaustao',
  'possivel', 'invalido', 'obrigatorio', 'ultimo', 'proximo', 'codigo', 'atualizacao',
  'sincronizacao', 'circulo', 'circulos', 'disponivel', 'indisponivel',
  'nivel', 'niveis', 'pericia', 'pericias', 'traco', 'tracos', 'artesao', 'invisivel', 'astucia',
  'forca', 'constituicao', 'inteligencia', 'pre-requisito', 'invocacoes', 'sintonizacao', 'agil', 'bonus', 'habil', 'versatil', 'distribuicao', 'especie', 'especies',
];
const RE_PALAVRA = new RegExp(`\\b(${PALAVRAS.join('|')})\\b`, 'i');

// Exceções legítimas: [arquivo, trecho exato do texto] -- uma por linha, com o motivo.
const EXCECOES = [];

const CONTEXTOS = [
  />([^<>{}`]*?)</g,
  />([^<>{}`]+)\$\{/g,   // texto antes de uma interpolação: <h2>Condicoes${...}</h2>
  /(?:title|placeholder|aria-label|alt)="([^"]+)"/g,
  /toast\(\s*[`'"]([^`'"]+)/g,
  /\b(?:label|rotulo|titulo|texto|msg|erro|dica)\s*:\s*[`'"]([^`'"]+)/g,
];

function arquivosJs(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { if (nome !== 'vendor') arquivosJs(p, saida); }
    else if (nome.endsWith('.js') && nome !== 'versao.js') saida.push(p);
  }
  return saida;
}

test('nenhum texto exibido usa palavra sem acento da lista', () => {
  const achados = [];
  for (const arq of arquivosJs(resolve(RAIZ, 'site/js'))) {
    const rel = arq.slice(RAIZ.length + 1).replaceAll('\\', '/');
    readFileSync(arq, 'utf-8').split(/\r?\n/).forEach((linha, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
      for (const re of CONTEXTOS) {
        re.lastIndex = 0;
        for (const m of linha.matchAll(re)) {
          // Interpolações ${...} são código, não texto; trechos com operadores vêm de `>` de comparação.
          const texto = m[1].replace(/\$\{[^}]*\}/g, '');
          if (/&&|\|\||\?\.|\$\{/.test(texto) || /^\s*[\w$]+(\.\w+)+\s*$/.test(texto)) continue;
          if (RE_PALAVRA.test(texto) && !EXCECOES.some(([a, t]) => a === rel && texto.includes(t))) {
            achados.push(`${rel}:${i + 1} -> ${texto.trim().slice(0, 90)}`);
          }
        }
      }
    });
  }
  assert.deepEqual(achados, [],
    'texto exibido sem acento (corrija ou, se for legítimo, registre em EXCECOES com o motivo)');
});
