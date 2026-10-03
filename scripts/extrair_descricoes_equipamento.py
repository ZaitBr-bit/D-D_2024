# Extrai do livro (Informacoes Separadas/Equipamento.md) as descricoes dos
# itens de aventura e os detalhes das ferramentas, e as grava nos JSON de
# dados/equipamento. So preenche o que esta vazio: descricao ja existente e
# preservada. Uso (da raiz do repositorio):
#   PYTHONIOENCODING=utf-8 python scripts/extrair_descricoes_equipamento.py
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
LIVRO = 'Informacoes Separadas/Equipamento.md'
AVENTURA = 'dados/equipamento/equipamento_aventura.json'
FERRAMENTAS = 'dados/equipamento/ferramentas.json'

# Nome no JSON -> nome do titulo no livro (quando diferem).
ALIAS = {
    'Cantil (cheio)': 'Cantil',
    'Garrafa de Vidro (1 litro)': 'Garrafa de Vidro',
    'Jarro (4 litros)': 'Jarro',
    'Pergaminho Mágico (1º Círculo)': 'Pergaminho Mágico',
    'Pergaminho Mágico (Truque)': 'Pergaminho Mágico',
    'Pote, Ferro': 'Pote de Ferro',
    'Roupas, Fantasia': 'Fantasia',
}

linhas = open(LIVRO, encoding='utf-8').read().split('\n')


def secao(inicio_titulo, fim_titulo):
    """Linhas entre dois titulos de nivel 1 do livro."""
    i = next(n for n, l in enumerate(linhas) if l.strip() == inicio_titulo)
    j = next(n for n, l in enumerate(linhas) if n > i and l.strip() == fim_titulo)
    return linhas[i + 1:j]


def blocos(trecho):
    """{titulo_sem_preco: [linhas]} para cada '#### Titulo (preco)'."""
    saida, atual = {}, None
    for l in trecho:
        m = re.match(r'#### (.+?)(?: \(.*\))?$', l)
        if m:
            atual = m.group(1).strip()
            saida[atual] = []
        elif atual is not None:
            saida[atual].append(l)
    return saida


def paragrafos(bloco):
    """Texto do bloco: paragrafos separados por linha em branco, sem tabelas."""
    texto, par = [], []
    for l in bloco + ['']:
        if l.strip().startswith('|'):
            continue
        if l.strip():
            par.append(l.strip())
        elif par:
            texto.append(' '.join(par))
            par = []
    return '\n\n'.join(texto)


def gravar(caminho, dados):
    with open(caminho, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
        f.write('\n')


# --- Equipamento de aventura ---
desc = {t: paragrafos(b) for t, b in blocos(secao('# Equipamento de Aventura', '# Montarias e Veículos')).items()}
dados = json.load(open(AVENTURA, encoding='utf-8'))
sem_par = []
for item in dados['itens']:
    if str(item.get('descricao') or '').strip():
        continue
    titulo = ALIAS.get(item['nome'], item['nome'])
    if desc.get(titulo):
        item['descricao'] = desc[titulo]
    else:
        sem_par.append(item['nome'])
gravar(AVENTURA, dados)
print('itens sem par no livro:', sem_par)

# --- Ferramentas ---
# 'Usar Objetor' aparece assim no livro local (Suprimentos de Pintor): erro de digitacao tolerado.
rotulos = {'Usar Objeto': 'usar_objeto', 'Usar Objetor': 'usar_objeto', 'Fabricação': 'fabricacao', 'Variantes': 'variantes'}
ferr = blocos(secao('# Ferramentas', '# Equipamento de Aventura'))
fj = json.load(open(FERRAMENTAS, encoding='utf-8'))
tabela = next(t for t in fj['tabelas'] if 'Ferramenta' in t['cabecalhos'])
faltam = []
for f in tabela['dados']:
    bloco = ferr.get(f['Ferramenta'])
    if bloco is None:
        faltam.append(f['Ferramenta'])
        continue
    det = {}
    for l in bloco:
        m = re.match(r'\*\*(Usar Objetor?|Fabricação|Variantes):\*\*\s*(.+)$', l.strip())
        if m:
            det[rotulos[m.group(1)]] = m.group(2).strip()
    f['detalhes'] = det
gravar(FERRAMENTAS, fj)
print('ferramentas sem bloco no livro:', faltam)
