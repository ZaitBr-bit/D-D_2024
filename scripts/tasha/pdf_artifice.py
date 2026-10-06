#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ferramentas de PDF do Artífice (Eberron: Forge of the Artificer, capítulo 1 e Apêndice).

  python scripts/tasha/pdf_artifice.py texto <pag_ini> <pag_fim> <arquivo_saida>
  python scripts/tasha/pdf_artifice.py renderizar <pag_ini> <pag_fim> <pasta_saida>
  python scripts/tasha/pdf_artifice.py oraculo

Requer PyMuPDF. Quando ele não está no Python global, PYMUPDF_PATH aponta
para a pasta onde foi instalado com `pip install --target`.
"""
import json
import os
import re
import sys

if os.environ.get("PYMUPDF_PATH"):
    sys.path.insert(0, os.environ["PYMUPDF_PATH"])
import pymupdf  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDF = os.path.join(RAIZ, "Informacoes Separadas", "Eberron Forge of the Artificer D&D 5.5e.pdf")
SAIDA_ORACULO = os.path.join(RAIZ, "scripts", "tasha", "oraculo_artifice.json")

# Cabeçalho/rodapé da impressão do navegador, repetidos em toda página.
RE_RUIDO = re.compile(r"^(\S+, \d{1,2}:\d{2} [AP]M|Eberron: Forge of the Artificer|https://www\.dndbeyond\.com/\S*|\d+/162)$")
ESCOLAS = {"Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"}
SUBCLASSES = ["Alchemist", "Armorer", "Artillerist", "Battle Smith", "Cartographer"]
RE_VALOR = re.compile(r"^(\d{1,2}|[—–-])$")


def linhas(doc, ini, fim):
    """Linhas não vazias das páginas ini..fim (numeração do PDF), sem o ruído de impressão."""
    out = []
    for n in range(ini, fim + 1):
        for bruta in doc[n - 1].get_text().splitlines():
            s = bruta.strip()
            if s and not RE_RUIDO.match(s):
                out.append(s)
    return out


CORRECOES_OCR = {"Heat Meta!": "Heat Metal"}


def nome_magia(s):
    """Nome de magia como o glossário o grafa: apóstrofo reto e correção dos erros de OCR conhecidos."""
    s = s.replace("’", "'").strip()
    return CORRECOES_OCR.get(s, s)


def valor(token):
    """Converte célula numérica da tabela: inteiro, ou None para traço."""
    return int(token) if token.isdigit() else None


def tabela_classe(ls):
    """As 20 linhas da tabela Artificer Features: PB e as 9 colunas numéricas de cada nível."""
    linhas_tab = []
    esperado = 1
    k = 0
    while k < len(ls) - 1 and esperado <= 20:
        if ls[k] == str(esperado) and re.fullmatch(r"\+\d", ls[k + 1]):
            pb = int(ls[k + 1][1:])
            j = k + 2
            # Coluna "Class Features" sem característica (níveis 13 e 17) vem como traço logo após o PB;
            # nas demais linhas ela é texto, nunca valor numérico.
            if j < len(ls) and RE_VALOR.match(ls[j]):
                j += 1
            vals = []
            while len(vals) < 9 and j < len(ls):
                if RE_VALOR.match(ls[j]):
                    vals.append(valor(ls[j]))
                j += 1
            linhas_tab.append({"nivel": esperado, "pb": pb, "planos": vals[0], "itens": vals[1], "truques": vals[2],
                               "preparadas": vals[3], "espacos": vals[4:9]})
            esperado += 1
            k = j
            continue
        k += 1
    if len(linhas_tab) != 20:
        raise SystemExit(f"tabela da classe: {len(linhas_tab)} linhas lidas, esperado 20")
    return linhas_tab


def lista_magias(ls):
    """Lista de magias do Artífice por círculo: nome, escola e coluna Special (maiúscula)."""
    por_circulo = {str(c): [] for c in range(6)}
    atual = None
    for k, s in enumerate(ls):
        if s.startswith("CANTRIPS"):
            atual = "0"
        m = re.match(r"^LEVEL (\d) ARTIFICER SPELLS", s)
        if m:
            atual = m.group(1)
        if atual is not None and s in ESCOLAS and 0 < k < len(ls) - 1:
            nome = nome_magia(ls[k - 1].rstrip("*"))
            especial = ls[k + 1].upper().replace(" ", "")
            por_circulo[atual].append({"nome": nome, "escola": s, "especial": "" if especial in ("-", "—") else especial})
    return por_circulo


def planos(ls):
    """Tabelas Magic Item Plans por nível mínimo: nome (como o OCR leu) e sintonização."""
    por_nivel = {}
    atual = None
    for k, s in enumerate(ls):
        m = re.match(r"^MAGIC ITEM PLANS \(ARTIFICER LEVEL (\d+)\+\)", s)
        if m:
            atual = m.group(1)
            por_nivel[atual] = []
            continue
        if atual and k + 1 < len(ls) and ls[k + 1] in ("Yes", "No", "Varies") and s not in ("Magic Item Plan", "Attunement"):
            por_nivel[atual].append({"nome_en": s, "sintonizacao": ls[k + 1]})
    return por_nivel


def magias_subclasse(ls):
    """Tabelas '<Subclasse> Spells': para cada nível (3/5/9/13/17), os nomes em inglês."""
    out = {}
    for k in range(len(ls) - 2):
        m = re.match(r"^(ALCHEMIST|ARMORER|ARTILLERIST|BATTLE SMITH|CARTOGRAPHER) SPELLS$", ls[k])
        if not m or ls[k + 1] != "Artificer Level" or ls[k + 2] != "Spells":
            continue
        nome = next(s for s in SUBCLASSES if s.upper() == m.group(1))
        tabela = {}
        for r in range(5):
            nivel = ls[k + 3 + 2 * r]
            tabela[nivel] = [nome_magia(x) for x in ls[k + 4 + 2 * r].split(",")]
        out[nome] = tabela
    if sorted(out) != sorted(SUBCLASSES):
        raise SystemExit(f"magias de subclasse: lidas {sorted(out)}")
    return out


def oraculo():
    """Gera scripts/tasha/oraculo_artifice.json a partir da camada de texto do PDF."""
    doc = pymupdf.open(PDF)
    dados = {
        "tabela_classe": tabela_classe(linhas(doc, 12, 13)),
        "magias_en": lista_magias(linhas(doc, 17, 19)),
        "planos": planos(linhas(doc, 14, 15)),
        "magias_subclasse_en": magias_subclasse(linhas(doc, 20, 28)),
    }
    with open(SAIDA_ORACULO, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
        f.write("\n")
    contagem = {c: len(v) for c, v in dados["magias_en"].items()}
    print(f"magias por círculo: {contagem}")
    print(f"planos por nível: { {n: len(v) for n, v in dados['planos'].items()} }")


def texto(ini, fim, saida):
    """Grava o texto das páginas ini..fim, separado por cabeçalho '==== PDF N', para consulta na tradução."""
    doc = pymupdf.open(PDF)
    with open(saida, "w", encoding="utf-8") as f:
        for n in range(ini, fim + 1):
            f.write(f"\n==== PDF {n}\n")
            f.write(doc[n - 1].get_text())


def renderizar(ini, fim, saida):
    """Grava as páginas ini..fim como JPEG de 100 dpi em `saida` (pNNN.jpg), para conferência visual de tabelas."""
    os.makedirs(saida, exist_ok=True)
    doc = pymupdf.open(PDF)
    for n in range(ini, fim + 1):
        doc[n - 1].get_pixmap(dpi=100).save(os.path.join(saida, f"p{n:03d}.jpg"), jpg_quality=80)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "oraculo":
        oraculo()
    elif cmd == "texto" and len(sys.argv) == 5:
        texto(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
    elif cmd == "renderizar" and len(sys.argv) == 5:
        renderizar(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
    else:
        print(__doc__)
        sys.exit(2)
