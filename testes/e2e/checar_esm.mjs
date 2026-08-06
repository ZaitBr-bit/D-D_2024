// Verifica cada modulo como ESM DE VERDADE.
// `node --check arquivo.js` usa deteccao de tipo e pode ser leniente; copiar
// para .mjs forca o parser de modulo, que e o mesmo contrato do navegador.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const RAIZ = process.argv[2];
const BASE = join(RAIZ, 'site', 'js');
const TMP = join(tmpdir(), 'checar-esm');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

function listar(dir) {
  const fora = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') fora.push(...listar(p)); }
    else if (e.name.endsWith('.js')) fora.push(p);
  }
  return fora;
}

const arquivos = listar(BASE);
let falhas = 0;
for (const arq of arquivos) {
  const destino = join(TMP, relative(BASE, arq).replace(/[\\/]/g, '__') + '.mjs');
  writeFileSync(destino, readFileSync(arq));
  try {
    execFileSync(process.execPath, ['--check', destino], { stdio: 'pipe' });
  } catch (e) {
    falhas++;
    const saida = (e.stderr?.toString() || '').split('\n').slice(0, 6).join('\n');
    console.log('\n### FALHA: ' + relative(RAIZ, arq));
    console.log(saida.replace(new RegExp(TMP.replace(/\\/g, '\\\\'), 'g'), '<tmp>'));
  }
}
console.log(`\narquivos: ${arquivos.length}, falhas: ${falhas}`);
process.exit(falhas ? 1 : 0);
