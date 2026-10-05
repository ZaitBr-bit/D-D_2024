#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ferramentas de PDF do capítulo 7 (Tesouros) do Livro do Mestre 2024.

  python scripts/livro-do-mestre/pdf_capitulo7.py renderizar <pag_ini> <pag_fim> <pasta_saida>
  python scripts/livro-do-mestre/pdf_capitulo7.py oraculo

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
PDF = os.path.join(RAIZ, "Informacoes Separadas",
                   "_OceanofPDF.com_2024_Dungeon_Masters_Guide_-_Wizards_of_the_Coast.pdf")
SAIDA_ORACULO = os.path.join(RAIZ, "scripts", "livro-do-mestre", "oraculo_ocr_capitulo7.json")
FAIXA = (217, 335)

# Linha de tipo de item: "Wondrous Item, Rare (Requires Attunement)", "Weapon (Any), Rarity Varies".
RE_TIPO = re.compile(r"^\s*(Wondrous Item|Weapon|Armor|Potion|Ring|Rod|Scroll|Staff|Wand)\b.*"
                     r"\b(Common|Uncommon|Rare|Legendary|Artifact|Varies)\b", re.I)
RE_DADO = re.compile(r"\b(\d+)d(\d+)\b")
RE_CD = re.compile(r"\bDC\s?(\d{1,2})\b")


def renderizar(ini, fim, saida):
    """Grava as páginas ini..fim do PDF como JPEG de 100 dpi em `saida` (pNNN.jpg)."""
    os.makedirs(saida, exist_ok=True)
    doc = pymupdf.open(PDF)
    for n in range(ini, fim + 1):
        doc[n - 1].get_pixmap(dpi=100).save(os.path.join(saida, f"p{n:03d}.jpg"), jpg_quality=80)
    print(f"{fim - ini + 1} página(s) em {saida}")


def oraculo():
    """Lê a camada OCR de cada página do capítulo e grava linhas de tipo, dados e CDs por página."""
    doc = pymupdf.open(PDF)
    paginas = {}
    for n in range(FAIXA[0], FAIXA[1] + 1):
        texto = doc[n - 1].get_text()
        paginas[str(n)] = {
            "linhas_tipo": [l.strip() for l in texto.splitlines() if RE_TIPO.search(l)],
            "dados": sorted({f"{a}d{b}" for a, b in RE_DADO.findall(texto)}),
            "cds": sorted({int(c) for c in RE_CD.findall(texto)}),
        }
    with open(SAIDA_ORACULO, "w", encoding="utf-8") as f:
        json.dump({"fonte": "camada OCR do PDF, gerada por pdf_capitulo7.py oraculo",
                   "faixa_pdf": list(FAIXA), "paginas": paginas}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    total = sum(len(p["linhas_tipo"]) for p in paginas.values())
    print(f"oráculo: {len(paginas)} páginas, {total} linhas de tipo")


if __name__ == "__main__":
    if sys.argv[1:2] == ["renderizar"]:
        renderizar(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
    elif sys.argv[1:2] == ["oraculo"]:
        oraculo()
    else:
        print(__doc__)
        sys.exit(2)
