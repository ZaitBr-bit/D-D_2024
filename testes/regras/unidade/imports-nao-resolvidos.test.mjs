// ============================================================
// Nome do projeto usado sem estar importado.
//
// Este motor nasceu de um bug real (2026-08-16): `sheet/grimorio.js`
// deixou de importar `getMagiaPreparadas` de `utils.js` numa refatoração,
// mas uma função mais abaixo do arquivo continuou chamando o nome. Nada
// pegou:
//   - `checar_esm.mjs` só confere que o arquivo FAZ PARSE como módulo, e
//     identificador livre é erro de execução, não de sintaxe;
//   - os testes de unidade importam os módulos, mas importar não executa
//     a função onde o nome aparece;
//   - o spec de navegador do fluxo afetado só afirmava que o BOTÃO
//     aparecia -- nunca clicou nele.
// O usuário encontrou como `ReferenceError` no console, ao clicar.
//
// A checagem é fechada de propósito: só considera nomes que ALGUM módulo
// de `site/js/` exporta. Não é um linter de escopo -- é "este arquivo usa
// um nome do projeto que ele não trouxe de lugar nenhum".
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { RAIZ } from './harness.mjs';

const BASE = join(RAIZ, 'site', 'js');

/** Todos os .js de site/js, menos vendor (código de terceiros). */
function listarArquivos(dir) {
  const fora = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== 'vendor') fora.push(...listarArquivos(caminho));
    } else if (entrada.name.endsWith('.js')) {
      fora.push(caminho);
    }
  }
  return fora;
}

const ARQUIVOS = listarArquivos(BASE).map(caminho => ({
  rel: relative(BASE, caminho).split(sep).join('/'),
  texto: readFileSync(caminho, 'utf-8'),
}));

/** Remove comentários e strings: só o código executável interessa. */
function semComentariosEStrings(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

/** Nomes que cada módulo do projeto exporta. */
function nomesExportados(texto) {
  const nomes = new Set();
  for (const m of texto.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) nomes.add(m[1]);
  for (const m of texto.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) nomes.add(m[1]);
  for (const m of texto.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const parte of m[1].split(',')) {
      const nome = parte.split(/\s+as\s+/).pop().trim();
      if (nome) nomes.add(nome);
    }
  }
  return nomes;
}

const EXPORTADOS = new Set();
for (const arquivo of ARQUIVOS) {
  for (const nome of nomesExportados(semComentariosEStrings(arquivo.texto))) EXPORTADOS.add(nome);
}

// Nomes publicados de propósito em `window` (app.js: `window.navegar`,
// utils.js: `window.fecharModal`) são globais de verdade em runtime:
// chamá-los sem import é o uso pretendido, e o HTML inline (`onclick=
// "fecharModal()"`) depende disso. Descobertos por varredura, não por
// lista fixa -- um global novo entra sozinho, e um que deixe de ser
// publicado volta a ser cobrado.
const GLOBAIS = new Set();
for (const arquivo of ARQUIVOS) {
  const codigo = semComentariosEStrings(arquivo.texto);
  for (const m of codigo.matchAll(/(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) {
    GLOBAIS.add(m[1]);
  }
}

/** Nomes que o arquivo importa, declara ou recebe como parâmetro nomeado. */
function nomesDisponiveis(codigo) {
  const nomes = new Set();
  for (const m of codigo.matchAll(/import\s+([\s\S]*?)\s+from\s+/g)) {
    const clausula = m[1];
    for (const parte of clausula.replace(/[{}]/g, ',').split(',')) {
      const nome = parte.split(/\s+as\s+/).pop().replace('*', '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nome)) nomes.add(nome);
    }
  }
  for (const m of codigo.matchAll(/(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) nomes.add(m[1]);
  for (const m of codigo.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) nomes.add(m[1]);
  // Desestruturação e parâmetros: qualquer nome que apareça entre { } ou
  // ( ) de uma declaração conta como possivelmente local. Aqui a regra é
  // deliberadamente generosa -- o motor só quer o caso "não veio de lugar
  // nenhum", e um falso NEGATIVO é preferível a acusar código correto.
  for (const m of codigo.matchAll(/(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) {
    for (const parte of m[1].split(',')) {
      const nome = parte.split(':').pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nome)) nomes.add(nome);
    }
  }
  for (const m of codigo.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const parte of m[1].split(',')) {
      const nome = parte.split('=')[0].replace(/[{}[\]]/g, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nome)) nomes.add(nome);
    }
  }
  return nomes;
}

test('nenhum arquivo de site/js chama um nome do projeto sem importá-lo', () => {
  assert.ok(EXPORTADOS.size > 100,
    `só ${EXPORTADOS.size} nomes exportados encontrados -- a varredura não está lendo os módulos`);

  const faltando = [];
  for (const arquivo of ARQUIVOS) {
    const codigo = semComentariosEStrings(arquivo.texto);
    const disponiveis = nomesDisponiveis(codigo);
    const usados = new Set();
    // Só CHAMADAS (`nome(`), e nunca precedidas de ponto (`obj.nome(`) --
    // método de objeto não tem nada a ver com import.
    for (const m of codigo.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) usados.add(m[2]);
    for (const nome of usados) {
      if (!EXPORTADOS.has(nome)) continue;
      if (disponiveis.has(nome) || GLOBAIS.has(nome)) continue;
      faltando.push(`${arquivo.rel}: ${nome}()`);
    }
  }

  assert.deepEqual(faltando, [],
    'nome exportado por outro módulo do projeto é chamado sem import ' +
    '(ReferenceError na hora em que a função rodar):\n  ' + faltando.join('\n  '));
});
