#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auditoria de itens duplicados entre o catálogo de itens mágicos
(dados/livro-do-mestre/capitulo7/itens_magicos.json) e os itens comuns
(dados/equipamento/*.json).

Classifica em: A) mesmo nome exato; B) variante/item do acervo que reaproveita
um registro do livro (campo `livro_jogador`); C) nome comum contido no nome
mágico (informativo: costuma ser base e versão encantada, não duplicata).
Para cada item de A lista onde o nome aparece no código (site/js) e nas
classes (dados/classes). Só lê arquivos; escreve apenas
docs/AUDITORIA-ITENS-DUPLICADOS.md e preserva, a partir da linha `## D.`, o
texto escrito à mão que já existir nesse arquivo.
"""
import json
import re
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / 'docs' / 'AUDITORIA-ITENS-DUPLICADOS.md'


def norm(texto):
    """Minúsculo, sem acento e com espaços colapsados, para comparar nomes."""
    base = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', base.lower()).strip()


def carregar(rel):
    """Lê um JSON de dados/ (UTF-8)."""
    return json.loads((RAIZ / rel).read_text(encoding='utf-8'))


def registros_com_nome(obj):
    """Percorre um JSON e devolve todo dict que tem a chave `nome` (texto)."""
    achados = []
    if isinstance(obj, dict):
        if isinstance(obj.get('nome'), str):
            achados.append(obj)
        for v in obj.values():
            achados.extend(registros_com_nome(v))
    elif isinstance(obj, list):
        for v in obj:
            achados.extend(registros_com_nome(v))
    return achados


def itens_comuns():
    """{nome normalizado: [(arquivo, nome original)]} dos catálogos comuns."""
    comuns = {}
    for arquivo in ('equipamento_aventura', 'armas', 'armaduras', 'ferramentas', 'montarias_veiculos'):
        for r in registros_com_nome(carregar(f'dados/equipamento/{arquivo}.json')):
            comuns.setdefault(norm(r['nome']), []).append((arquivo, r['nome']))
    return comuns


def nomes_magicos():
    """{nome normalizado: (nome original, ref livro_jogador ou None)} de itens e variantes."""
    out = {}
    for item in carregar('dados/livro-do-mestre/capitulo7/itens_magicos.json')['itens']:
        out[norm(item['nome'])] = (item['nome'], item.get('livro_jogador'))
        for v in item.get('variantes', []):
            out[norm(v['nome'])] = (v['nome'], v.get('livro_jogador'))
    return out


def usos(nome):
    """Arquivos de código e de classes que citam o nome entre aspas (máximo 10); testes ficam de fora."""
    alvo = re.compile(r"""["'`]""" + re.escape(nome) + r"""["'`]""")
    pastas = [('site/js', '*.js'), ('dados/classes', '*.json')]
    achados = []
    for pasta, padrao in pastas:
        for caminho in sorted((RAIZ / pasta).rglob(padrao)):
            if 'node_modules' in caminho.parts:
                continue
            if alvo.search(caminho.read_text(encoding='utf-8', errors='ignore')):
                achados.append(str(caminho.relative_to(RAIZ)).replace('\\', '/'))
    return achados[:10]


def secao_manual():
    """Texto do arquivo de saída a partir da linha `## D.` (escrito à mão); '' se não houver."""
    if not SAIDA.exists():
        return ''
    linhas = SAIDA.read_text(encoding='utf-8').split('\n')
    for i, linha in enumerate(linhas):
        if linha.startswith('## D.'):
            return '\n'.join(linhas[i:]).rstrip('\n') + '\n'
    return ''


def main():
    """Gera o relatório das seções A, B e C, preserva a seção D e imprime o resumo no terminal."""
    manual = secao_manual()
    comuns = itens_comuns()
    magicos = nomes_magicos()
    a = []  # mesmo nome exato
    b = []  # reaproveita registro do livro
    c = []  # contido (informativo)
    for chave, (nome, ref) in sorted(magicos.items()):
        if chave in comuns:
            a.append((nome, comuns[chave]))
        if ref:
            b.append((nome, ref))
        elif chave not in comuns:
            for cc, fontes in comuns.items():
                if len(cc) >= 6 and cc != chave and (cc in chave or chave in cc):
                    c.append((nome, fontes[0][1]))
                    break
    linhas = ['# Auditoria de itens duplicados (comum x mágico)', '',
              'Gerado por `scripts/auditar_itens_duplicados.py`. Não editar a mão as seções A, B e C; a seção D (análise de impacto) é escrita à mão e o script a preserva ao regerar o arquivo.', '',
              '## A. Mesmo nome exato', '']
    for nome, fontes in a:
        linhas.append(f'- **{nome}** — também em: ' + ', '.join(f'`{arq}`' for arq, _ in fontes))
        for u in usos(nome):
            linhas.append(f'  - citado em `{u}`')
    linhas += ['', '## B. Reaproveita registro do livro (`livro_jogador`)', '']
    for nome, ref in b:
        linhas.append(f'- **{nome}** → `{ref["arquivo"]}` / "{ref["nome"]}"')
    linhas += ['', '## C. Nome comum contido no nome mágico (informativo)', '']
    for nome, comum in c:
        linhas.append(f'- {nome} ~ {comum}')
    texto = '\n'.join(linhas) + '\n'
    if manual:
        texto += '\n' + manual
    SAIDA.write_text(texto, encoding='utf-8')
    print('A:', [n for n, _ in a])
    print('B:', [n for n, _ in b])
    print('C:', len(c), 'pares informativos')


if __name__ == '__main__':
    main()
