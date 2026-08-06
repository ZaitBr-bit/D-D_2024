#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verificador de integridade da quebra mecanica dos monolitos.

Prova que os modulos extraidos de site/js/pages/sheet.js e
site/js/pages/creator.js contem exatamente o mesmo codigo do baseline em
scripts/baseline/, byte a byte, e que nenhum simbolo ficou sem import.

Spec:  docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md
Plano: docs/superpowers/plans/2026-08-05-quebra-monolitos.md

Uso:
    python scripts/verificar_extracao.py autoteste
    python scripts/verificar_extracao.py sheet
    python scripts/verificar_extracao.py creator
    python scripts/verificar_extracao.py tudo
    python scripts/verificar_extracao.py mover sheet site/js/sheet/x.js nome1 nome2 ...
    python scripts/verificar_extracao.py extrair sheet nome1 nome2 ...

Sem dependencias externas: so a biblioteca padrao do Python 3.
"""

import difflib
import os
import re
import sys

# Raiz do repositorio (este arquivo mora em scripts/).
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Uma declaracao de topo comeca na coluna zero e assume uma destas formas.
RE_DECL = re.compile(
    r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)'
    r'|^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)'
    r'|^window\.([A-Za-z_$][\w$]*)\s*='
)

# Formas de import reconhecidas no preambulo dos modulos.
RE_IMPORT_CHAVES = re.compile(r'import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]', re.S)
RE_IMPORT_SIMPLES = re.compile(r'import\s+([A-Za-z_$][\w$]*)\s+from\s*[\'"]([^\'"]+)[\'"]')

# Configuracao por alvo: baseline, coordenador e pasta dos modulos extraidos.
ALVOS = {
    'sheet': {
        'baseline': 'scripts/baseline/sheet.js',
        'coordenador': 'site/js/pages/sheet.js',
        'pasta': 'site/js/sheet',
    },
    'creator': {
        'baseline': 'scripts/baseline/creator.js',
        'coordenador': 'site/js/pages/creator.js',
        'pasta': 'site/js/creator',
    },
}


def ler(caminho):
    """Le um arquivo preservando os finais de linha exatamente como estao."""
    with open(caminho, encoding='utf-8', newline='') as fh:
        return fh.read()


def particionar(texto):
    """Divide o texto em (preambulo, [(nome, bloco), ...]).

    Um bloco vai do seu comentario de cabecalho -- a corrida contigua de
    linhas de comentario e linhas em branco imediatamente acima da
    declaracao -- ate a linha anterior ao cabecalho do bloco seguinte.

    A concatenacao do preambulo com todos os blocos reproduz o texto byte a
    byte; isso e conferido por `provar_particionamento`.
    """
    linhas = texto.split('\n')

    inicios = []
    for i, linha in enumerate(linhas):
        m = RE_DECL.match(linha)
        if m:
            nome = m.group(1) or m.group(2) or m.group(3)
            inicios.append((i, nome))

    if not inicios:
        return texto, []

    def inicio_cabecalho(idx_decl, limite):
        """Sobe a partir da declaracao juntando comentarios e linhas vazias.

        O cabecalho do modulo e as linhas `import` ficam no preambulo
        porque `import` nao e comentario e interrompe a corrida. Enquanto um
        modulo recem-criado ainda nao tem imports, seu cabecalho e absorvido
        pelo primeiro bloco e a comparacao acusa diferenca -- e proposital:
        forca o passo de resolver imports antes de dar a extracao por boa.

        Comentario de bloco `/* ... */` e tratado como uma unidade: ao topar
        com a linha que FECHA o bloco, sobe ate a que o ABRE. Sem isso, um
        bloco cujas linhas internas nao comecem com `*` seria cortado ao
        meio, e as duas metades iriam para modulos diferentes -- cada metade
        continuaria byte a byte igual ao baseline, mas os dois arquivos
        ficariam sintaticamente quebrados. Foi exatamente o que aconteceu
        entre impressao.js e pdf.js, e so a execucao no navegador pegou.
        """
        i = idx_decl - 1
        while i > limite:
            s = linhas[i].strip()
            if s == '' or s.startswith('//'):
                i -= 1
                continue
            if s.endswith('*/'):
                j = i
                while j > limite and '/*' not in linhas[j]:
                    j -= 1
                if j <= limite:
                    break  # abertura fora da faixa: nao absorve
                if linhas[j].split('/*')[0].strip() != '':
                    break  # ha codigo antes do `/*`: nao e cabecalho
                i = j - 1
                continue
            if s.startswith('/*') or s.startswith('*'):
                i -= 1
                continue
            break
        return i + 1

    marcos = []
    limite = -1
    for idx, nome in inicios:
        marcos.append((inicio_cabecalho(idx, limite), nome))
        limite = idx

    blocos = []
    for k, (ini, nome) in enumerate(marcos):
        fim = marcos[k + 1][0] if k + 1 < len(marcos) else len(linhas)
        blocos.append((nome, '\n'.join(linhas[ini:fim])))

    preambulo = '\n'.join(linhas[:marcos[0][0]])
    return preambulo, blocos


def reconstruir(preambulo, blocos):
    """Remonta o texto a partir do preambulo e dos blocos."""
    partes = [b for _, b in blocos]
    if preambulo != '':
        partes = [preambulo] + partes
    return '\n'.join(partes)


def provar_particionamento(caminho):
    """Falha se o particionamento nao reproduzir o arquivo byte a byte."""
    texto = ler(caminho)
    pre, blocos = particionar(texto)
    if reconstruir(pre, blocos) != texto:
        raise AssertionError('particionamento perdeu bytes em ' + caminho)
    return len(blocos)


def normalizar_export(bloco):
    """Remove o `export ` acrescentado na linha da declaracao.

    E a unica diferenca permitida entre o bloco do baseline e o bloco
    extraido: o modulo novo precisa exportar o que outros usam.
    """
    linhas = bloco.split('\n')
    for i, linha in enumerate(linhas):
        if linha.startswith('export '):
            linhas[i] = linha[len('export '):]
            break
    return '\n'.join(linhas)


def arquivos_do_alvo(alvo):
    """Lista o coordenador e todos os modulos ja extraidos do alvo."""
    cfg = ALVOS[alvo]
    caminhos = [os.path.join(RAIZ, cfg['coordenador'])]
    pasta = os.path.join(RAIZ, cfg['pasta'])
    for dir_atual, _, nomes in os.walk(pasta):
        for nome in sorted(nomes):
            if nome.endswith('.js'):
                caminhos.append(os.path.join(dir_atual, nome))
    return caminhos


def rel(caminho):
    """Caminho relativo a raiz do repositorio, com barras normais."""
    return os.path.relpath(caminho, RAIZ).replace(os.sep, '/')


def importados_em(texto):
    """Nomes trazidos por `import` no texto, e o modulo de cada um."""
    origem = {}
    for chaves, caminho in RE_IMPORT_CHAVES.findall(texto):
        for parte in chaves.split(','):
            parte = parte.strip()
            if not parte:
                continue
            # Suporta `nome as apelido`.
            nome = parte.split(' as ')[-1].strip()
            if nome:
                origem[nome] = caminho
    for nome, caminho in RE_IMPORT_SIMPLES.findall(texto):
        origem[nome] = caminho
    return origem


def sem_linhas_de_comentario(texto):
    """Remove as linhas que sao INTEIRAMENTE comentario.

    Uma linha assim nunca contem codigo executavel, entao descarta-la nao
    pode gerar falso negativo. Comentarios de fim de linha (`x = 1; // nota`)
    ficam: ali o risco de perder uma chamada real e maior que o de um import
    a mais. E por isso que `// ...` dentro de string (uma URL, por exemplo)
    tambem sobrevive -- nunca comeca na coluna zero da linha.
    """
    saida = []
    for linha in texto.split('\n'):
        s = linha.strip()
        if s.startswith('//') or s.startswith('/*') or s.startswith('*'):
            continue
        saida.append(linha)
    return '\n'.join(saida)


# Operadores que GRAVAM num binding. Atribuir a um nome importado e erro de
# sintaxe em modulo ES -- o arquivo inteiro para de carregar.
_ATRIB = (r'=(?![=>])|\+=|-=|\*=|/=|%=|\*\*=|\|\|=|&&=|\?\?=|'
          r'\|=|&=|\^=|<<=|>>=|>>>=')


def padroes_de_gravacao(nome):
    """Padroes que detectam gravacao no binding `nome`.

    Cobre atribuicao simples e composta, pre e pos incremento e
    desestruturacao. O lookbehind `(?<![.\\w$])` evita casar `obj.char`,
    `meuChar` e `charAt`; o `(?![=>])` depois do `=` evita casar `==`, `===`
    e a seta de arrow function (`char => ...`).
    """
    n = re.escape(nome)
    return [
        (r'(?<![.\w$])' + n + r'\s*(?:' + _ATRIB + r')', 'atribuicao'),
        (r'(?<![.\w$])' + n + r'\s*(?:\+\+|--)', 'pos-incremento'),
        (r'(?:\+\+|--)\s*(?<![.\w$])' + n + r'(?![\w$])', 'pre-incremento'),
        (r'[{\[][^{}\[\]]*(?<![.\w$])' + n + r'[^{}\[\]]*[}\]]\s*=(?![=>])',
         'desestruturacao'),
    ]


def autoteste_gravacao():
    """Prova que `padroes_de_gravacao` acusa o que deve e so o que deve."""
    deve = [
        'char = getPersonagem(id);', 'char += 1;', 'char ||= {};',
        'char ??= {};', 'char++;', '++char;', '({ char } = dados);',
        '[char] = lista;', 'char=x;',
    ]
    nao_pode = [
        'if (!char) return;', 'char.nivel = 5;', 'const x = char === outro;',
        'const meuChar = 1;', 'obj.char = 2;', 'charAt = 3;',
        'if (char == null) {}', 'const f = char => char + 1;', 'usar(char);',
    ]
    padroes = padroes_de_gravacao('char')
    falhas = 0
    for linha in deve:
        if not any(re.search(p, linha) for p, _ in padroes):
            print('  FALSO NEGATIVO: %s' % linha)
            falhas += 1
    for linha in nao_pode:
        achou = [t for p, t in padroes if re.search(p, linha)]
        if achou:
            print('  FALSO POSITIVO: %s -> %s' % (linha, achou))
            falhas += 1
    print('detector de gravacao ......... %d casos positivos, %d negativos, '
          '%d falhas' % (len(deve), len(nao_pode), falhas))
    return falhas


def usados(texto, nomes):
    """Subconjunto de `nomes` que aparece no texto como identificador livre.

    Ignora ocorrencias precedidas por ponto (acesso a propriedade) e linhas
    inteiramente de comentario. Nao filtra strings de proposito: um falso
    positivo custa um import a mais, um falso negativo custa um
    ReferenceError em producao.
    """
    corpo = sem_linhas_de_comentario(texto)
    achados = set()
    for nome in nomes:
        if re.search(r'(?<![.\w$])' + re.escape(nome) + r'(?![\w$])', corpo):
            achados.add(nome)
    return achados


def caminho_relativo_entre(de_arquivo, para_arquivo):
    """Especificador de import de `de_arquivo` para `para_arquivo`."""
    destino = os.path.relpath(para_arquivo, os.path.dirname(de_arquivo))
    destino = destino.replace(os.sep, '/')
    if not destino.startswith('.'):
        destino = './' + destino
    return destino


def resolver_import_original(spec, arquivo_atual, coordenador):
    """Reescreve o especificador de um import do baseline para o modulo atual.

    O baseline vive em site/js/pages/; um modulo em site/js/sheet/classes/
    precisa de '../../utils.js' onde o baseline usava '../utils.js'.
    """
    if not spec.startswith('.'):
        return spec
    alvo = os.path.normpath(os.path.join(os.path.dirname(coordenador), spec))
    return caminho_relativo_entre(arquivo_atual, alvo)


def verificar(alvo):
    """Roda todas as checagens do alvo. Devolve a lista de erros."""
    cfg = ALVOS[alvo]
    caminho_baseline = os.path.join(RAIZ, cfg['baseline'])
    coordenador = os.path.join(RAIZ, cfg['coordenador'])

    erros = []
    avisos = []

    if not os.path.exists(caminho_baseline):
        print('  ! baseline ausente (%s): checagem de integridade pulada.'
              % cfg['baseline'])
        print('    recuperavel com: git show <commit-marco-1>:%s' % cfg['baseline'])
        baseline_blocos = {}
        preambulo_baseline = ''
    else:
        texto_baseline = ler(caminho_baseline)
        preambulo_baseline, lista = particionar(texto_baseline)
        baseline_blocos = dict(lista)
        print('  baseline .................. %d linhas, %d declaracoes'
              % (texto_baseline.count('\n') + 1, len(lista)))

    # --- Coleta dos modulos atuais -----------------------------------------
    caminhos = arquivos_do_alvo(alvo)
    onde = {}          # nome da declaracao -> caminho do arquivo
    blocos_atuais = {}  # nome -> bloco
    duplicados = []
    textos = {}
    preambulos = {}

    for caminho in caminhos:
        texto = ler(caminho)
        textos[caminho] = texto
        pre, lista = particionar(texto)
        preambulos[caminho] = pre
        for nome, bloco in lista:
            if nome in onde:
                duplicados.append((nome, rel(onde[nome]), rel(caminho)))
            onde[nome] = caminho
            blocos_atuais[nome] = bloco

    print('  modulos ................... %d arquivos' % len(caminhos))

    # --- 1. Presenca -------------------------------------------------------
    if baseline_blocos:
        ausentes = [n for n in baseline_blocos if n not in blocos_atuais]
        print('  declaracoes presentes ..... %d/%d'
              % (len(baseline_blocos) - len(ausentes), len(baseline_blocos)))
        for nome in ausentes:
            erros.append('declaracao ausente: `%s` existe no baseline e em nenhum modulo' % nome)

    for nome, a, b in duplicados:
        erros.append('declaracao duplicada: `%s` aparece em %s e em %s' % (nome, a, b))
    if duplicados:
        print('  duplicadas ................ %d' % len(duplicados))
    else:
        print('  duplicadas ................ 0')

    # --- 2. Integridade ----------------------------------------------------
    identicos = 0
    alterados = 0
    excecoes = 0
    pasta_excecoes = os.path.join(RAIZ, 'scripts', 'excecoes')
    for nome, bloco_base in baseline_blocos.items():
        if nome not in blocos_atuais:
            continue
        atual = normalizar_export(blocos_atuais[nome])
        esperado = bloco_base
        arquivo_excecao = os.path.join(pasta_excecoes, nome + '.js')
        eh_excecao = os.path.exists(arquivo_excecao)
        if eh_excecao:
            esperado = ler(arquivo_excecao)
        # `export ` na linha da declaracao e a unica diferenca permitida, e
        # pode existir dos dois lados: renderSheet e renderCreator ja sao
        # exportadas no baseline.
        esperado = normalizar_export(esperado)
        if atual == esperado:
            if eh_excecao:
                excecoes += 1
            else:
                identicos += 1
        else:
            alterados += 1
            diff = '\n'.join(list(difflib.unified_diff(
                esperado.split('\n'), atual.split('\n'),
                fromfile='baseline/' + nome, tofile=rel(onde[nome]) + '/' + nome,
                lineterm='', n=2))[:40])
            erros.append('corpo alterado: `%s` em %s\n%s' % (nome, rel(onde[nome]), diff))
    if baseline_blocos:
        print('  corpos byte-a-byte ........ %d identicos, %d alterados'
              % (identicos, alterados))
        print('  excecoes declaradas ....... %d' % excecoes)

    # --- 3. Simbolos -------------------------------------------------------
    nomes_conhecidos = set(baseline_blocos)
    imports_baseline = importados_em(preambulo_baseline)
    nomes_conhecidos |= set(imports_baseline)

    sem_import = []
    precisam_export = {}

    for caminho in caminhos:
        texto = textos[caminho]
        _, lista = particionar(texto)
        declarados = {n for n, _ in lista}
        importados = set(importados_em(preambulos[caminho]))
        # Um `import` pode aparecer depois do preambulo em modulos novos.
        importados |= set(importados_em(texto))
        for nome in sorted(usados(texto, nomes_conhecidos)):
            if nome in declarados or nome in importados:
                continue
            if nome in onde:
                destino = onde[nome]
                if destino == caminho:
                    continue
                spec = caminho_relativo_entre(caminho, destino)
                precisam_export.setdefault(rel(destino), set()).add(nome)
            elif nome in imports_baseline:
                spec = resolver_import_original(
                    imports_baseline[nome], caminho, coordenador)
            else:
                continue
            sem_import.append((rel(caminho), nome, spec))

    print('  simbolos sem import ....... %d' % len(sem_import))
    for arquivo, nome, spec in sem_import:
        erros.append('%s usa `%s` sem import\n    -> import { %s } from \'%s\';'
                     % (arquivo, nome, nome, spec))

    for arquivo, nomes in sorted(precisam_export.items()):
        faltando = []
        texto = ler(os.path.join(RAIZ, arquivo))
        for nome in sorted(nomes):
            if not re.search(r'^export\s+(?:async\s+)?(?:function|const|let|var)\s+'
                             + re.escape(nome) + r'\b', texto, re.M):
                faltando.append(nome)
        if faltando:
            avisos.append('%s precisa exportar: %s' % (arquivo, ', '.join(faltando)))

    for aviso in avisos:
        print('  ! ' + aviso)

    # --- 4. Imports que apontam para o nada -------------------------------
    # Um `import { x } from './y.js'` onde y.js nao existe, ou onde x nao e
    # exportado, so falha quando o navegador avalia o modulo -- ou seja, com
    # a tela em branco. Aqui falha antes.
    quebrados = 0
    for caminho in caminhos:
        for chaves, spec in RE_IMPORT_CHAVES.findall(textos[caminho]):
            if not spec.startswith('.'):
                continue
            destino = os.path.normpath(
                os.path.join(os.path.dirname(caminho), spec))
            if not os.path.exists(destino):
                quebrados += 1
                erros.append('%s importa de `%s`, que nao existe'
                             % (rel(caminho), spec))
                continue
            texto_destino = ler(destino)
            for parte in chaves.split(','):
                parte = parte.strip()
                if not parte:
                    continue
                origem_nome = parte.split(' as ')[0].strip()
                padrao = (r'^export\s+(?:async\s+)?(?:function|const|let|var)\s+'
                          + re.escape(origem_nome) + r'\b')
                if not re.search(padrao, texto_destino, re.M):
                    quebrados += 1
                    erros.append('%s importa `%s` de `%s`, que nao o exporta'
                                 % (rel(caminho), origem_nome, spec))
    print('  imports quebrados ......... %d' % quebrados)

    # --- 5. Atribuicao a binding importado --------------------------------
    # Gravar num binding importado e erro de SINTAXE em modulo ES: o arquivo
    # inteiro deixa de carregar e a tela fica em branco. E a unica falha
    # desta refatoracao que nao se manifesta como valor errado, entao tem de
    # ser pega estaticamente e nao por inspecao visual.
    gravacoes = 0
    for caminho in caminhos:
        importados = importados_em(textos[caminho])
        if not importados:
            continue
        linhas = sem_linhas_de_comentario(textos[caminho]).split('\n')
        for nome in sorted(importados):
            for padrao, tipo in padroes_de_gravacao(nome):
                for i, linha in enumerate(linhas, 1):
                    if re.search(padrao, linha):
                        gravacoes += 1
                        erros.append(
                            '%s:%d %s de `%s`, que e importado de %s\n    %s'
                            % (rel(caminho), i, tipo, nome, importados[nome],
                               linha.strip()[:110]))
    print('  gravacao em import ........ %d' % gravacoes)

    return erros


def autoteste():
    """Prova o particionador e o detector de gravacao antes de confiar neles."""
    ok = autoteste_gravacao() == 0
    for alvo in ('sheet', 'creator'):
        caminho = os.path.join(RAIZ, ALVOS[alvo]['baseline'])
        if not os.path.exists(caminho):
            print('%s ..... AUSENTE' % ALVOS[alvo]['baseline'])
            ok = False
            continue
        try:
            n = provar_particionamento(caminho)
            print('%s ..... %d blocos, reconstrucao byte a byte OK'
                  % (ALVOS[alvo]['baseline'], n))
        except AssertionError as e:
            print('%s ..... FALHOU: %s' % (ALVOS[alvo]['baseline'], e))
            ok = False
    return 0 if ok else 1


def escrever(caminho, texto):
    """Grava preservando os finais de linha exatamente como estao no texto."""
    with open(caminho, 'w', encoding='utf-8', newline='') as fh:
        fh.write(texto)


def mover(alvo, destino_rel, nomes):
    """Recorta blocos do coordenador e os cola no modulo de destino.

    Faz, num unico passo deterministico, os passos 1 e 3 do procedimento
    padrao de extracao: nenhum byte do bloco passa por copiar-e-colar
    manual, entao nenhum corpo de funcao pode ser alterado sem querer.

    Os blocos sao gravados no destino na mesma ordem em que aparecem no
    arquivo de origem.
    """
    cfg = ALVOS[alvo]
    origem = os.path.join(RAIZ, cfg['coordenador'])
    destino = os.path.join(RAIZ, destino_rel)

    texto = ler(origem)
    preambulo, lista = particionar(texto)
    mapa = dict(lista)
    pedidos_set = set(nomes)

    faltando = [n for n in nomes if n not in mapa]
    if faltando:
        sys.stderr.write('declaracoes inexistentes em %s: %s\n'
                         % (rel(origem), ', '.join(faltando)))
        return 1

    movidos = [(n, b) for n, b in lista if n in pedidos_set]
    restantes = [(n, b) for n, b in lista if n not in pedidos_set]

    # --- Grava o destino ---------------------------------------------------
    nl = '\r\n' if '\r\n' in texto else '\n'
    corpo = '\n'.join(b for _, b in movidos)
    if os.path.exists(destino):
        atual = ler(destino)
        if not atual.endswith('\n'):
            atual += nl
        escrever(destino, atual + corpo)
    else:
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        # SEM cabecalho de comentario. Um comentario no topo seria contiguo ao
        # comentario da primeira declaracao e os dois virariam um bloco so --
        # nao ha fronteira detectavel entre "cabecalho do arquivo" e
        # "cabecalho da funcao". Os imports entram na linha 0 e o cabecalho do
        # modulo e escrito acima deles depois, ja separado por codigo.
        escrever(destino, corpo)

    # --- Reescreve a origem sem os blocos movidos --------------------------
    escrever(origem, reconstruir(preambulo, restantes))

    print('movidos %d blocos de %s para %s'
          % (len(movidos), cfg['coordenador'], destino_rel))
    for nome, bloco in movidos:
        print('  - %-40s %5d linhas' % (nome, bloco.count('\n') + 1))
    return 0


def analisar_ligacoes(alvo):
    """Calcula, por arquivo, os imports que faltam e os exports necessarios.

    Devolve (faltando, exports):
      faltando: {caminho: {especificador: set(nomes)}}
      exports:  {caminho: set(nomes que outros modulos usam)}
    """
    cfg = ALVOS[alvo]
    coordenador = os.path.join(RAIZ, cfg['coordenador'])
    caminho_baseline = os.path.join(RAIZ, cfg['baseline'])

    if os.path.exists(caminho_baseline):
        pre_base, lista_base = particionar(ler(caminho_baseline))
    else:
        pre_base, lista_base = '', []
    imports_baseline = importados_em(pre_base)
    nomes_conhecidos = set(n for n, _ in lista_base) | set(imports_baseline)

    caminhos = arquivos_do_alvo(alvo)
    onde = {}
    textos = {}
    for caminho in caminhos:
        texto = ler(caminho)
        textos[caminho] = texto
        _, lista = particionar(texto)
        for nome, _ in lista:
            onde[nome] = caminho

    faltando = {}
    exports = {}
    for caminho in caminhos:
        texto = textos[caminho]
        _, lista = particionar(texto)
        declarados = {n for n, _ in lista}
        importados = set(importados_em(texto))
        for nome in sorted(usados(texto, nomes_conhecidos)):
            if nome in declarados or nome in importados:
                continue
            if nome in onde:
                destino = onde[nome]
                if destino == caminho:
                    continue
                spec = caminho_relativo_entre(caminho, destino)
                exports.setdefault(destino, set()).add(nome)
            elif nome in imports_baseline:
                spec = resolver_import_original(
                    imports_baseline[nome], caminho, coordenador)
            else:
                continue
            faltando.setdefault(caminho, {}).setdefault(spec, set()).add(nome)
    return faltando, exports


def posicao_de_insercao(linhas):
    """Indice da linha onde inserir novos `import`.

    Depois do ultimo import existente; se nao houver nenhum, depois do
    comentario de cabecalho do arquivo.
    """
    ultimo = -1
    dentro = False
    for i, linha in enumerate(linhas):
        if re.match(r'^import\b', linha):
            dentro = True
        if dentro and re.search(r'from\s*[\'"][^\'"]+[\'"]\s*;?\s*$', linha):
            ultimo = i
            dentro = False
    if ultimo >= 0:
        return ultimo + 1
    # Sem imports ainda: linha 0. Qualquer posicao adiante engoliria linhas em
    # branco ou comentarios que pertencem ao primeiro bloco, e a comparacao
    # com o baseline falharia -- com razao.
    return 0


RE_IMPORT_LINHA = re.compile(
    r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]\s*;?\s*$')


def limpar_imports_obsoletos(alvo):
    """Remove imports que apontam para onde o simbolo NAO esta mais.

    Um modulo extraido cedo importa de `../pages/sheet.js`; quando uma tarefa
    posterior move aquela declaracao para outro modulo, a linha antiga vira
    mentira. Aqui ela e removida, e a fase seguinte de `corrigir` reinsere o
    import apontando para o lugar certo.
    """
    caminhos = arquivos_do_alvo(alvo)
    onde = {}
    for caminho in caminhos:
        _, lista = particionar(ler(caminho))
        for nome, _ in lista:
            onde[nome] = caminho

    removidos = 0
    for caminho in caminhos:
        texto = ler(caminho)
        linhas = texto.split('\n')
        saida = []
        mudou = False
        for linha in linhas:
            m = RE_IMPORT_LINHA.match(linha.rstrip('\r'))
            if not m:
                saida.append(linha)
                continue
            spec = m.group(2)
            if not spec.startswith('.'):
                saida.append(linha)
                continue
            destino = os.path.normpath(
                os.path.join(os.path.dirname(caminho), spec))
            mantidos = []
            for parte in m.group(1).split(','):
                parte = parte.strip()
                if not parte:
                    continue
                nome = parte.split(' as ')[0].strip()
                real = onde.get(nome)
                if real is not None and os.path.normpath(real) != destino:
                    removidos += 1
                    mudou = True
                    continue
                mantidos.append(parte)
            if not mantidos:
                mudou = True
                continue  # linha inteira sai
            nova = 'import { %s } from \'%s\';' % (', '.join(mantidos), spec)
            if linha.endswith('\r'):
                nova += '\r'
            if nova != linha:
                mudou = True
            saida.append(nova)
        if mudou:
            escrever(caminho, '\n'.join(saida))
    if removidos:
        print('  %d import(s) obsoleto(s) removido(s)' % removidos)
    return removidos


def corrigir(alvo):
    """Aplica os imports que faltam e marca as declaracoes com `export`.

    E o passo 2 do procedimento padrao, feito pelo script: as linhas sao
    exatamente as que o relatorio imprimiria, entao nao ha julgamento humano
    -- e nenhum corpo de funcao e tocado.
    """
    limpar_imports_obsoletos(alvo)
    faltando, exports = analisar_ligacoes(alvo)

    # --- exports primeiro: mudam o texto que a checagem de import le -------
    total_exports = 0
    for caminho, nomes in sorted(exports.items()):
        texto = ler(caminho)
        nl = '\r\n' if '\r\n' in texto else '\n'
        linhas = texto.split('\n')
        mudou = False
        for nome in sorted(nomes):
            padrao = re.compile(
                r'^((?:async\s+)?function\s+' + re.escape(nome) + r'\b'
                r'|(?:const|let|var)\s+' + re.escape(nome) + r'\b)')
            for i, linha in enumerate(linhas):
                if padrao.match(linha):
                    linhas[i] = 'export ' + linha
                    total_exports += 1
                    mudou = True
                    break
        if mudou:
            escrever(caminho, '\n'.join(linhas))
            print('  export em %s: %s' % (rel(caminho), ', '.join(sorted(nomes))))

    # --- imports ------------------------------------------------------------
    total_imports = 0
    for caminho, por_spec in sorted(faltando.items()):
        texto = ler(caminho)
        nl = '\r\n' if '\r\n' in texto else '\n'
        linhas = texto.split('\n')
        pos = posicao_de_insercao(linhas)
        novas = []
        for spec in sorted(por_spec):
            nomes = ', '.join(sorted(por_spec[spec]))
            novas.append('import { %s } from \'%s\';%s'
                         % (nomes, spec, '\r' if nl == '\r\n' else ''))
            total_imports += 1
        linhas[pos:pos] = novas
        escrever(caminho, '\n'.join(linhas))
        print('  %d import(s) em %s' % (len(novas), rel(caminho)))

    print('aplicados: %d export(s), %d linha(s) de import'
          % (total_exports, total_imports))
    return 0


def podar(alvo):
    """Remove nomes importados que o arquivo nao usa mais.

    Depois de uma extracao, o coordenador continua com os imports do
    monolito inteiro. O teste de uso e o mesmo de `usados` -- deliberadamente
    conservador: se o nome aparece em qualquer lugar fora de linha de
    comentario e de linha de import, ele FICA. Errar para o lado de manter um
    import a mais e inofensivo; remover um usado quebra a pagina.
    """
    caminhos = arquivos_do_alvo(alvo)
    removidos = 0
    for caminho in caminhos:
        texto = ler(caminho)
        nl = '\r\n' if '\r\n' in texto else '\n'

        # Texto sem NENHUM import, para testar uso real.
        sem_imports = RE_IMPORT_CHAVES.sub('', texto)
        sem_imports = RE_IMPORT_SIMPLES.sub('', sem_imports)
        corpo = sem_linhas_de_comentario(sem_imports)

        def trocar(m):
            nonlocal removidos
            mantidos = []
            for parte in m.group(1).split(','):
                parte = parte.strip()
                if not parte:
                    continue
                local = parte.split(' as ')[-1].strip()
                if re.search(r'(?<![.\w$])' + re.escape(local) + r'(?![\w$])', corpo):
                    mantidos.append(parte)
                else:
                    removidos += 1
            if not mantidos:
                return '@@REMOVER_IMPORT@@'
            return 'import { %s } from \'%s\';' % (', '.join(mantidos), m.group(2))

        padrao = re.compile(
            r'import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]\s*;?', re.S)
        novo = padrao.sub(trocar, texto)
        linhas = [l for l in novo.split('\n')
                  if l.strip() != '@@REMOVER_IMPORT@@']
        novo = '\n'.join(linhas)
        if novo != texto:
            escrever(caminho, novo)
            print('  podado %s' % rel(caminho))
    print('nomes de import removidos: %d' % removidos)
    return 0


def excecao(alvo, nome):
    """Grava o bloco ATUAL de `nome` como excecao declarada.

    A partir dai o verificador compara esse bloco contra o arquivo gravado em
    scripts/excecoes/ em vez do baseline. Serve para as unicas duas funcoes
    que o plano autoriza editar: renderSheet e renderCreator, onde as
    atribuicoes de estado viram chamadas de setter.
    """
    for caminho in arquivos_do_alvo(alvo):
        _, lista = particionar(ler(caminho))
        for n, bloco in lista:
            if n == nome:
                pasta = os.path.join(RAIZ, 'scripts', 'excecoes')
                os.makedirs(pasta, exist_ok=True)
                destino = os.path.join(pasta, nome + '.js')
                escrever(destino, normalizar_export(bloco))
                print('excecao gravada: scripts/excecoes/%s.js (%d linhas, de %s)'
                      % (nome, bloco.count('\n') + 1, rel(caminho)))
                return 0
    sys.stderr.write('declaracao nao encontrada: %s\n' % nome)
    return 1


def extrair(alvo, nomes):
    """Imprime os blocos do baseline correspondentes aos nomes dados."""
    caminho = os.path.join(RAIZ, ALVOS[alvo]['baseline'])
    _, lista = particionar(ler(caminho))
    mapa = dict(lista)
    ordem = [n for n, _ in lista]
    faltando = [n for n in nomes if n not in mapa]
    if faltando:
        sys.stderr.write('declaracoes inexistentes no baseline: %s\n'
                         % ', '.join(faltando))
        return 1
    pedidos = [n for n in ordem if n in set(nomes)]
    dados = '\n'.join(mapa[n] for n in pedidos)
    sys.stdout.buffer.write(dados.encode('utf-8'))
    return 0


def main(argv):
    if len(argv) < 2:
        sys.stderr.write(__doc__)
        return 2

    comando = argv[1]

    if comando == 'autoteste':
        return autoteste()

    if comando == 'extrair':
        if len(argv) < 4 or argv[2] not in ALVOS:
            sys.stderr.write('uso: extrair <sheet|creator> nome1 nome2 ...\n')
            return 2
        return extrair(argv[2], argv[3:])

    if comando == 'podar':
        if len(argv) != 3 or argv[2] not in ALVOS:
            sys.stderr.write('uso: podar <sheet|creator>\n')
            return 2
        return podar(argv[2])

    if comando == 'corrigir':
        if len(argv) != 3 or argv[2] not in ALVOS:
            sys.stderr.write('uso: corrigir <sheet|creator>\n')
            return 2
        return corrigir(argv[2])

    if comando == 'excecao':
        if len(argv) != 4 or argv[2] not in ALVOS:
            sys.stderr.write('uso: excecao <sheet|creator> <nomeDaFuncao>\n')
            return 2
        return excecao(argv[2], argv[3])

    if comando == 'mover':
        if len(argv) < 5 or argv[2] not in ALVOS:
            sys.stderr.write('uso: mover <sheet|creator> <destino.js> nome1 nome2 ...\n')
            return 2
        return mover(argv[2], argv[3], argv[4:])

    alvos = ['sheet', 'creator'] if comando == 'tudo' else [comando]
    if any(a not in ALVOS for a in alvos):
        sys.stderr.write('alvo desconhecido: %s\n' % comando)
        return 2

    total = []
    for alvo in alvos:
        print('== %s ==' % alvo)
        total.extend(verificar(alvo))
        print('')

    if total:
        print('FALHOU: %d problema(s)\n' % len(total))
        for e in total:
            print('  X ' + e)
        return 1

    print('OK: extracao integra')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
