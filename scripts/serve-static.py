#!/usr/bin/env python3
# ============================================================
# Servidor estatico de desenvolvimento (fallback sem Node).
#
# Equivale a `python -m http.server`, mas com os tipos MIME de modulo
# fixados no proprio processo. Motivo: no Windows o modulo `mimetypes` do
# Python consulta o registro (HKCU/HKLM\SOFTWARE\Classes\<ext>), onde
# `.mjs` costuma estar mapeado como `text/plain`. O navegador aplica
# "strict MIME type checking" a module scripts e recusa carregar
# `site/js/content/schemas/vendor/*.mjs`, derrubando o boot do app.
# Declarar o mapa aqui torna o servidor independente do registro da
# maquina — mesmo comportamento de scripts/serve-static.mjs.
# ============================================================
import argparse
import functools
import http.server
import socketserver

# Tipos garantidos independentemente do registro do sistema operacional.
TIPOS_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
}


class ManipuladorComMimeFixo(http.server.SimpleHTTPRequestHandler):
    """Serve arquivos estaticos aplicando TIPOS_MIME por extensao.

    Sobrescreve o `extensions_map` herdado para que a resposta nao dependa
    do registro do Windows nem de /etc/mime.types.
    """

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        **TIPOS_MIME,
    }


def main():
    """Le os argumentos de CLI e sobe o servidor estatico na raiz informada."""
    parser = argparse.ArgumentParser(description='Servidor estatico de desenvolvimento.')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--directory', default='.')
    args = parser.parse_args()

    handler = functools.partial(ManipuladorComMimeFixo, directory=args.directory)

    with socketserver.ThreadingTCPServer((args.host, args.port), handler) as httpd:
        httpd.allow_reuse_address = True
        print(f'[serve-static.py] Servindo {args.directory} em http://{args.host}:{args.port}/')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
