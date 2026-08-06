// Servidor estatico minimo para os testes de paridade.
// Uso: node servidor.mjs <raiz> <porta>
// Serve <raiz> na porta dada, com os MIME types que o app precisa.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const raiz = process.argv[2];
const porta = Number(process.argv[3]);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    // Impede escapar da raiz.
    const alvo = join(raiz, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    const info = await stat(alvo);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: caminho + '/' });
      res.end();
      return;
    }
    const dados = await readFile(alvo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('nao encontrado: ' + req.url);
  }
}).listen(porta, '127.0.0.1', () => {
  console.log('servindo ' + raiz + ' em http://127.0.0.1:' + porta + '/');
});
