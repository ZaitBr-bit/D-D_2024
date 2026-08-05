#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair dados estruturados do arquivo MD do Livro do Jogador D&D 5.5
e gerar arquivos JSON organizados por capítulo/seção.
"""

import json
import os
import re
import sys

# Caminho do arquivo fonte
MD_FILE = os.path.join(os.path.dirname(__file__), "D&D 5.5 - Livro do Jogador (2024) 5.3.7.md")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "dados")

def ler_arquivo():
    """Lê o arquivo MD e retorna as linhas."""
    with open(MD_FILE, "r", encoding="utf-8") as f:
        return f.readlines()

def salvar_json(caminho_relativo, dados):
    """Salva dados em JSON no diretório de saída."""
    caminho = os.path.join(OUTPUT_DIR, caminho_relativo)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    print(f"  Salvo: {caminho_relativo}")

def limpar_texto(texto):
    """Remove formatação markdown básica de um texto."""
    texto = texto.strip()
    # Remove negrito e itálico
    texto = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', texto)
    texto = re.sub(r'\*\*(.+?)\*\*', r'\1', texto)
    texto = re.sub(r'\*(.+?)\*', r'\1', texto)
    return texto

def extrair_bloco(linhas, inicio, fim):
    """Extrai o texto entre duas linhas (exclusivo no fim)."""
    return "".join(linhas[inicio:fim]).strip()

def encontrar_secoes_h1(linhas):
    """Encontra todas as seções de nível 1 (# Título)."""
    secoes = []
    for i, linha in enumerate(linhas):
        if linha.startswith("# ") and not linha.startswith("## "):
            secoes.append((i, linha.strip()[2:].strip()))
    return secoes

def encontrar_secoes_h2(linhas, inicio, fim):
    """Encontra todas as seções de nível 2 (## Título) num intervalo."""
    secoes = []
    for i in range(inicio, min(fim, len(linhas))):
        if linhas[i].startswith("## ") and not linhas[i].startswith("### "):
            secoes.append((i, linhas[i].strip()[3:].strip()))
    return secoes

def encontrar_secoes_h3(linhas, inicio, fim):
    """Encontra todas as seções de nível 3 (### Título) num intervalo."""
    secoes = []
    for i in range(inicio, min(fim, len(linhas))):
        if linhas[i].startswith("### ") and not linhas[i].startswith("#### "):
            secoes.append((i, linhas[i].strip()[4:].strip()))
    return secoes

def parse_tabela_md(linhas, inicio_busca, fim_busca):
    """
    Encontra a primeira tabela markdown a partir de inicio_busca
    e retorna lista de dicionários com os dados.
    """
    i = inicio_busca
    while i < fim_busca:
        if linhas[i].strip().startswith("|"):
            # Encontrou início da tabela
            # Primeira linha = cabeçalhos
            cabecalho_line = linhas[i].strip()
            cabecalhos = [c.strip().replace("**", "").strip() for c in cabecalho_line.split("|") if c.strip()]
            
            # Pula separador
            i += 1
            if i < fim_busca and re.match(r'\|[\s\-:]+\|', linhas[i].strip()):
                i += 1
            
            # Lê as linhas de dados
            dados = []
            while i < fim_busca and linhas[i].strip().startswith("|"):
                valores = [c.strip() for c in linhas[i].strip().split("|") if c.strip()]
                if len(valores) >= len(cabecalhos):
                    registro = {}
                    for j, cab in enumerate(cabecalhos):
                        if j < len(valores):
                            registro[cab] = limpar_texto(valores[j])
                    dados.append(registro)
                elif valores:
                    # Linhas de categoria/cabeçalho de grupo (ex.: "Armas Simples")
                    registro = {}
                    for j, cab in enumerate(cabecalhos):
                        if j < len(valores):
                            registro[cab] = limpar_texto(valores[j])
                        else:
                            registro[cab] = ""
                    dados.append(registro)
                i += 1
            return cabecalhos, dados
        i += 1
    return [], []

def parse_todas_tabelas_md(linhas, inicio_busca, fim_busca):
    """Encontra TODAS as tabelas markdown num intervalo."""
    tabelas = []
    i = inicio_busca
    while i < fim_busca:
        if linhas[i].strip().startswith("|"):
            cabecalho_line = linhas[i].strip()
            cabecalhos = [c.strip().replace("**", "").strip() for c in cabecalho_line.split("|") if c.strip()]
            i += 1
            if i < fim_busca and re.match(r'\|[\s\-:]+\|', linhas[i].strip()):
                i += 1
            dados = []
            while i < fim_busca and linhas[i].strip().startswith("|"):
                valores = [c.strip() for c in linhas[i].strip().split("|") if c.strip()]
                if valores:
                    registro = {}
                    for j, cab in enumerate(cabecalhos):
                        if j < len(valores):
                            registro[cab] = limpar_texto(valores[j])
                        else:
                            registro[cab] = ""
                    dados.append(registro)
                i += 1
            tabelas.append({"cabecalhos": cabecalhos, "dados": dados})
            continue
        i += 1
    return tabelas

# ============================================================================
# EXTRATOR DE MAGIAS
# ============================================================================

def extrair_magias(linhas):
    """Extrai todas as magias da seção de descrições de magias."""
    print("Processando magias...")
    
    # Encontrar início da seção de descrições de magias
    inicio_magias = None
    fim_magias = None
    for i, l in enumerate(linhas):
        if l.strip() == "# Descrições da Magias":
            inicio_magias = i
        # Apêndice A marca o fim das magias
        if "Apêndice A - O Multiverso" in l and inicio_magias is not None:
            fim_magias = i
            break
    
    if inicio_magias is None:
        print("  ERRO: Seção de magias não encontrada!")
        return
    
    if fim_magias is None:
        fim_magias = len(linhas)
    
    # Encontrar cada magia (são seções ## )
    magias_h2 = encontrar_secoes_h2(linhas, inicio_magias, fim_magias)
    
    # Padrão para extrair círculo e escola da primeira linha da descrição
    # Exemplos:
    #   *2º Círculo, Encantamento (Bardo, Clérigo)*
    #   *Truque de Necromancia (Clérigo, Druida)*
    #   *3° Círculo, Necromancia (Clérigo, Mago)*
    padrao_circulo = re.compile(
        r'\*(\d+)[ºo°]\s*Círculo,\s*(\w+(?:\s+\w+)?)\s*\(([^)]+)\)\*',
        re.IGNORECASE
    )
    padrao_truque = re.compile(
        r'\*Truque\s+de\s+(\w+(?:\s+\w+)?)\s*\(([^)]+)\)\*',
        re.IGNORECASE
    )
    
    todas_magias = []
    
    for idx, (pos, nome) in enumerate(magias_h2):
        # Limite = próxima magia ou fim da seção
        if idx + 1 < len(magias_h2):
            fim = magias_h2[idx + 1][0]
        else:
            fim = fim_magias
        
        magia = {
            "nome": nome,
            "circulo": -1,
            "escola": "",
            "classes": [],
            "tempo_conjuracao": "",
            "alcance": "",
            "componentes": "",
            "duracao": "",
            "descricao": "",
            "circulo_superior": ""
        }
        
        # Procurar metadados nas linhas seguintes
        bloco_linhas = linhas[pos+1:fim]
        desc_linhas = []
        metadados_encontrados = False
        circulo_superior_linhas = []
        em_circulo_superior = False
        
        for j, bl in enumerate(bloco_linhas):
            stripped = bl.strip()
            
            # Tentar parsear círculo/escola
            if not metadados_encontrados:
                m_circulo = padrao_circulo.search(stripped)
                m_truque = padrao_truque.search(stripped)
                
                if m_circulo:
                    magia["circulo"] = int(m_circulo.group(1))
                    magia["escola"] = m_circulo.group(2).strip()
                    magia["classes"] = [c.strip() for c in m_circulo.group(3).split(",")]
                    metadados_encontrados = True
                    continue
                elif m_truque:
                    magia["circulo"] = 0
                    magia["escola"] = m_truque.group(1).strip()
                    magia["classes"] = [c.strip() for c in m_truque.group(2).split(",")]
                    metadados_encontrados = True
                    continue
            
            # Parsear campos de metadados
            if stripped.startswith("**Tempo de Conjuração:**"):
                magia["tempo_conjuracao"] = stripped.replace("**Tempo de Conjuração:**", "").strip()
                continue
            elif stripped.startswith("**Alcance:**"):
                magia["alcance"] = stripped.replace("**Alcance:**", "").strip()
                continue
            elif stripped.startswith("**Componentes:**"):
                magia["componentes"] = stripped.replace("**Componentes:**", "").strip()
                continue
            elif stripped.startswith("**Duração:**"):
                magia["duracao"] = stripped.replace("**Duração:**", "").strip()
                continue
            
            # Detectar seção "Usando um Espaço" ou "Aprimoramento"
            if "Usando um Espaço de Magia de Círculo Superior" in stripped or "Aprimoramento de Truque" in stripped:
                em_circulo_superior = True
                circulo_superior_linhas.append(stripped)
                continue
            
            if em_circulo_superior:
                circulo_superior_linhas.append(stripped)
            elif stripped:
                desc_linhas.append(stripped)
        
        magia["descricao"] = "\n".join(desc_linhas)
        magia["circulo_superior"] = "\n".join(circulo_superior_linhas)
        
        # Limpar texto markdown da descrição
        magia["descricao"] = limpar_texto(magia["descricao"])
        magia["circulo_superior"] = limpar_texto(magia["circulo_superior"])
        
        if magia["circulo"] >= 0:
            todas_magias.append(magia)
    
    # Organizar por círculo
    magias_por_circulo = {}
    for m in todas_magias:
        circulo = m["circulo"]
        if circulo not in magias_por_circulo:
            magias_por_circulo[circulo] = []
        magias_por_circulo[circulo].append(m)
    
    # Salvar por círculo
    for circulo, magias_lista in sorted(magias_por_circulo.items()):
        if circulo == 0:
            nome_arquivo = "truques.json"
        else:
            nome_arquivo = f"circulo_{circulo}.json"
        
        salvar_json(
            f"magias/{nome_arquivo}",
            {
                "circulo": circulo,
                "nome_circulo": "Truques" if circulo == 0 else f"{circulo}º Círculo",
                "total_magias": len(magias_lista),
                "magias": sorted(magias_lista, key=lambda x: x["nome"])
            }
        )
    
    # Também salvar um índice completo
    indice_magias = []
    for m in sorted(todas_magias, key=lambda x: x["nome"]):
        indice_magias.append({
            "nome": m["nome"],
            "circulo": m["circulo"],
            "escola": m["escola"],
            "classes": m["classes"],
            "tempo_conjuracao": m["tempo_conjuracao"],
            "alcance": m["alcance"],
            "componentes": m["componentes"],
            "duracao": m["duracao"]
        })
    
    salvar_json("magias/_indice.json", {
        "total_magias": len(indice_magias),
        "magias": indice_magias
    })
    
    # Salvar magias por classe
    magias_por_classe = {}
    for m in todas_magias:
        for classe in m["classes"]:
            classe_norm = classe.strip()
            if classe_norm not in magias_por_classe:
                magias_por_classe[classe_norm] = []
            magias_por_classe[classe_norm].append({
                "nome": m["nome"],
                "circulo": m["circulo"],
                "escola": m["escola"]
            })
    
    for classe, lista in sorted(magias_por_classe.items()):
        nome_arq = classe.lower().replace(" ", "_")
        nome_arq = nome_arq.replace("ã", "a").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
        salvar_json(
            f"magias/por_classe/{nome_arq}.json",
            {
                "classe": classe,
                "total_magias": len(lista),
                "magias": sorted(lista, key=lambda x: (x["circulo"], x["nome"]))
            }
        )
    
    print(f"  Total: {len(todas_magias)} magias extraídas")
    return todas_magias

# ============================================================================
# EXTRATOR DE CLASSES
# ============================================================================

def extrair_classes(linhas):
    """Extrai dados das 12 classes."""
    print("Processando classes...")
    
    # Mapeamento de classes com suas posições aproximadas
    # As classes aparecem como seções sem # consistente, 
    # então buscar por padrões conhecidos
    
    classes_config = [
        {"nome": "Bárbaro", "busca_inicio": "Bárbaro\n", "busca_sub": "# Subclasses de Bárbaro"},
        {"nome": "Bardo", "busca_inicio": "Traços Básicos de Bardo", "busca_sub": "# Subclasses de Bardo"},
        {"nome": "Bruxo", "busca_inicio": "Traços Básicos de Bruxo", "busca_sub": "# Subclasses de Bruxo"},
        {"nome": "Clérigo", "busca_inicio": "Traços Básicos de Clérigo", "busca_sub": "# Subclasses de Clérigo"},
        {"nome": "Druida", "busca_inicio": "# Druida", "busca_sub": "Subclasses de Druida"},
        {"nome": "Feiticeiro", "busca_inicio": "Traços Básicos de Feiticeiro", "busca_sub": "# Subclasses de Feiticeiro"},
        {"nome": "Guardião", "busca_inicio": "Traços Básicos de Guardião", "busca_sub": "# Subclasses de Guardião"},
        {"nome": "Guerreiro", "busca_inicio": "# Guerreiro", "busca_sub": "# Subclasses de Guerreiro"},
        {"nome": "Ladino", "busca_inicio": "Traços Básicos de Ladino", "busca_sub": "# Subclasses de Ladino"},
        {"nome": "Mago", "busca_inicio": "Traços Básicos de Mago", "busca_sub": "# Subclasses de Mago"},
        {"nome": "Monge", "busca_inicio": "Traços Básicos de Monge", "busca_sub": "# Subclasses de Monge"},
        {"nome": "Paladino", "busca_inicio": "Traços Básicos de Paladino", "busca_sub": "# Subclasses de Paladino" if False else "Subclasses de Paladino"},
    ]
    
    texto_completo = "".join(linhas)
    
    for config in classes_config:
        nome_classe = config["nome"]
        nome_arquivo = nome_classe.lower().replace("á", "a").replace("ã", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
        
        # Encontrar posição inicial da classe
        inicio_classe = None
        fim_classe = None
        
        # Buscar "Traços Básicos de {Classe}" para encontrar início
        padrao_tracos = f"Traços Básicos de {nome_classe}"
        for i, l in enumerate(linhas):
            if padrao_tracos in l:
                # Voltar um pouco para pegar o contexto
                inicio_classe = max(0, i - 10)
                break
        
        if inicio_classe is None:
            # Tentar busca alternativa
            for i, l in enumerate(linhas):
                if l.strip() == f"# {nome_classe}" or l.strip().startswith(f"{nome_classe}\n"):
                    inicio_classe = i
                    break
        
        if inicio_classe is None:
            print(f"  AVISO: Classe {nome_classe} não encontrada")
            continue
        
        # Encontrar subclasses
        inicio_subclasses = None
        for i in range(inicio_classe, len(linhas)):
            if f"Subclasses de {nome_classe}" in linhas[i]:
                inicio_subclasses = i
                break
        
        # Encontrar fim (próxima classe ou seção)
        # Buscar a lista de magias da classe (se existir)
        inicio_lista_magias = None
        fim_lista_magias = None
        for i in range(inicio_classe, min(inicio_classe + 2000, len(linhas))):
            if linhas[i].strip().startswith(f"## Lista de Magias de {nome_classe}"):
                inicio_lista_magias = i
            # Parar se encontrar outra classe
            if i > inicio_classe + 50:
                for outra in classes_config:
                    if outra["nome"] != nome_classe:
                        if f"Traços Básicos de {outra['nome']}" in linhas[i]:
                            fim_classe = i
                            break
                        if linhas[i].strip() == f"# {outra['nome']}":
                            fim_classe = i
                            break
                        # Buscar "NomeClasse\n" como início de seção de classe
                        if linhas[i].strip() == outra["nome"] and i > inicio_classe + 100:
                            fim_classe = i
                            break
                if fim_classe:
                    break
        
        if fim_classe is None:
            # Se for a última classe, limite é o capítulo 4
            for i in range(inicio_classe, len(linhas)):
                if "# Componentes de Origem" in linhas[i] or "Capítulo 4" in linhas[i]:
                    fim_classe = i
                    break
            if fim_classe is None:
                fim_classe = min(inicio_classe + 1500, len(linhas))
        
        # Extrair dados estruturados
        classe_dados = {
            "nome": nome_classe,
            "tracos_basicos": {},
            "tabela_caracteristicas": [],
            "caracteristicas": [],
            "subclasses": [],
            "lista_magias": {},
            "texto_completo": ""
        }
        
        # Extrair tabela de traços básicos
        for i in range(inicio_classe, min(inicio_classe + 30, len(linhas))):
            if "Traços Básicos" in linhas[i]:
                _, tracos_dados = parse_tabela_md(linhas, i + 1, i + 30)
                for t in tracos_dados:
                    for k, v in t.items():
                        chave = k.strip().replace("**", "")
                        classe_dados["tracos_basicos"][chave] = v
                break
        
        # Extrair tabela de características por nível
        for i in range(inicio_classe, min(fim_classe, len(linhas))):
            if f"Características de {nome_classe}" in linhas[i] and linhas[i].strip().startswith("|"):
                _, tab_dados = parse_tabela_md(linhas, i, i + 30)
                classe_dados["tabela_caracteristicas"] = tab_dados
                break
            elif f"Características de {nome_classe}" in linhas[i]:
                # Tabela na próxima linha
                _, tab_dados = parse_tabela_md(linhas, i + 1, i + 50)
                classe_dados["tabela_caracteristicas"] = tab_dados
                break
        
        # Extrair características individuais (### Nível X: Nome)
        padrao_nivel = re.compile(r'###\s+Nível\s+(\d+):\s+(.+)')
        for i in range(inicio_classe, min(fim_classe, len(linhas))):
            m = padrao_nivel.match(linhas[i].strip())
            if m:
                nivel = int(m.group(1))
                nome_caract = m.group(2).strip()
                
                # Encontrar o fim desta característica
                fim_caract = min(fim_classe, len(linhas))
                for j in range(i + 1, min(fim_classe, len(linhas))):
                    if linhas[j].strip().startswith("### ") or linhas[j].strip().startswith("## "):
                        fim_caract = j
                        break
                
                desc = []
                for j in range(i + 1, fim_caract):
                    if linhas[j].strip():
                        desc.append(linhas[j].strip())
                
                classe_dados["caracteristicas"].append({
                    "nivel": nivel,
                    "nome": nome_caract,
                    "descricao": "\n".join(desc)
                })
        
        # Extrair subclasses
        if inicio_subclasses:
            sub_h2 = encontrar_secoes_h2(linhas, inicio_subclasses, fim_classe)
            for s_idx, (s_pos, s_nome) in enumerate(sub_h2):
                if s_nome.startswith("Lista de Magias"):
                    continue
                
                s_fim = sub_h2[s_idx + 1][0] if s_idx + 1 < len(sub_h2) else fim_classe
                
                subclasse = {
                    "nome": s_nome,
                    "caracteristicas": []
                }
                
                # Extrair características da subclasse
                for i in range(s_pos, s_fim):
                    m = padrao_nivel.match(linhas[i].strip())
                    if m:
                        nivel = int(m.group(1))
                        nome_caract = m.group(2).strip()
                        
                        fim_caract = s_fim
                        for j in range(i + 1, s_fim):
                            if linhas[j].strip().startswith("### "):
                                fim_caract = j
                                break
                        
                        desc = []
                        for j in range(i + 1, fim_caract):
                            if linhas[j].strip():
                                desc.append(linhas[j].strip())
                        
                        subclasse["caracteristicas"].append({
                            "nivel": nivel,
                            "nome": nome_caract,
                            "descricao": "\n".join(desc)
                        })
                
                classe_dados["subclasses"].append(subclasse)
        
        # Extrair lista de magias da classe (se conjuradora)
        if inicio_lista_magias:
            lista_fim = fim_classe
            # Encontrar fim da lista de magias
            for i in range(inicio_lista_magias + 2, min(fim_classe, len(linhas))):
                if linhas[i].strip().startswith("# ") or (linhas[i].strip().startswith("## ") and "Lista de Magias" not in linhas[i]):
                    lista_fim = i
                    break
            
            # Parsear as tabelas de magias por círculo
            tabelas = parse_todas_tabelas_md(linhas, inicio_lista_magias, lista_fim)
            
            circulo_atual = "Truques"
            for i in range(inicio_lista_magias, lista_fim):
                stripped = linhas[i].strip()
                # Detectar título do círculo
                m_circ = re.search(r'Magias de .+ de (\d+)º Círculo', stripped)
                m_truque = re.search(r'Truques', stripped)
                if m_circ:
                    circulo_atual = f"{m_circ.group(1)}º Círculo"
                elif m_truque and "0 Círculo" in stripped:
                    circulo_atual = "Truques"
            
            for tab in tabelas:
                nomes = [d.get("Magia", "") for d in tab["dados"] if d.get("Magia")]
                if nomes:
                    # Determinar o círculo baseado no contexto
                    classe_dados["lista_magias"][circulo_atual] = classe_dados["lista_magias"].get(circulo_atual, []) + nomes
        
        # Guardar texto completo como referência
        classe_dados["texto_completo"] = "".join(linhas[inicio_classe:fim_classe]).strip()
        
        salvar_json(f"classes/{nome_arquivo}.json", classe_dados)
    
    print("  Classes processadas com sucesso")

# ============================================================================
# EXTRATOR DE LISTAS DE MAGIAS POR CLASSE (mais preciso)
# ============================================================================

def extrair_listas_magias_classe(linhas):
    """Extrai as tabelas de lista de magias de cada classe conjuradora."""
    print("Processando listas de magias por classe...")
    
    # Encontrar todas as linhas "## Lista de Magias de X" (formato padrão)
    classes_encontradas = set()
    for i, l in enumerate(linhas):
        m = re.match(r'^## Lista de Magias de (.+)', l.strip())
        if m:
            nome_classe = m.group(1).strip()
            classes_encontradas.add(nome_classe)
            _processar_lista_magias_classe(linhas, i, nome_classe)
    
    # Também buscar listas de magias sem o cabeçalho ## (ex: Druida)
    # Procurar por "Truques (Magias de {Classe} de Círculo 0)"
    classes_conjuradoras = ["Bardo", "Bruxo", "Clérigo", "Druida", "Feiticeiro", "Guardião", "Mago", "Paladino"]
    for classe in classes_conjuradoras:
        if classe in classes_encontradas:
            continue
        for i, l in enumerate(linhas):
            if f"Magias de {classe} de" in l.strip() and "Círculo 0" in l.strip():
                print(f"  Encontrada lista de magias de {classe} (formato alternativo) na linha {i+1}")
                _processar_lista_magias_classe_alt(linhas, i, classe)
                break


def _processar_lista_magias_classe(linhas, inicio, nome_classe):
    """Processa lista de magias com formato ## Lista de Magias de X"""
    nome_arq = nome_classe.lower().replace("á", "a").replace("ã", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    
    # Encontrar fim da lista
    fim = len(linhas)
    for j in range(inicio + 2, len(linhas)):
        if (linhas[j].strip().startswith("## ") and "Lista de Magias" not in linhas[j]) or linhas[j].strip().startswith("# "):
            fim = j
            break
    
    lista_completa = _parsear_tabelas_magias_circulo(linhas, inicio, fim, nome_classe)
    
    salvar_json(
        f"classes/magias_{nome_arq}.json",
        {
            "classe": nome_classe,
            "lista_magias": lista_completa
        }
    )
    print(f"  Lista de magias de {nome_classe}: {sum(len(v) for v in lista_completa.values())} magias")


def _processar_lista_magias_classe_alt(linhas, inicio, nome_classe):
    """Processa lista de magias no formato alternativo (sem cabeçalho ##)"""
    nome_arq = nome_classe.lower().replace("á", "a").replace("ã", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    
    # Encontrar fim: próxima seção # ou ## que não é tabela de magias
    fim = len(linhas)
    # Procurar até encontrar uma linha que indique nova seção
    for j in range(inicio + 2, min(inicio + 500, len(linhas))):
        stripped = linhas[j].strip()
        if stripped.startswith("# ") or (stripped.startswith("## ") and f"Magias de {nome_classe}" not in stripped):
            fim = j
            break
    
    lista_completa = _parsear_tabelas_magias_circulo(linhas, inicio, fim, nome_classe)
    
    salvar_json(
        f"classes/magias_{nome_arq}.json",
        {
            "classe": nome_classe,
            "lista_magias": lista_completa
        }
    )
    print(f"  Lista de magias de {nome_classe}: {sum(len(v) for v in lista_completa.values())} magias")


def _parsear_tabelas_magias_circulo(linhas, inicio, fim, nome_classe):
    """Parseia tabelas de magias organizadas por círculo num intervalo de linhas."""
    lista_completa = {}
    
    # Encontrar posições dos cabeçalhos de círculo
    pos_circulos = []
    for j in range(inicio, fim):
        stripped = linhas[j].strip()
        m_truque = re.search(r'Truques.*(?:0 Círculo|Círculo 0)', stripped)
        m_circ = re.search(r'Magias de .+ de (\d+)º Círculo', stripped)
        if m_truque:
            pos_circulos.append((j, 0))
        elif m_circ:
            pos_circulos.append((j, int(m_circ.group(1))))
    
    # Para cada círculo, parsear a tabela que vem logo após
    for c_idx, (c_pos, circulo_num) in enumerate(pos_circulos):
        c_fim = pos_circulos[c_idx + 1][0] if c_idx + 1 < len(pos_circulos) else fim
        _, tab_dados = parse_tabela_md(linhas, c_pos, c_fim)
        
        nomes_magias = []
        for d in tab_dados:
            nome_magia = d.get("Magia", "").strip()
            if nome_magia:
                nome_magia = re.sub(r'^\*|\*$', '', nome_magia).strip()
                escola = d.get("Escola", "").strip()
                especial = d.get("Especial", "").strip()
                nomes_magias.append({
                    "nome": nome_magia,
                    "escola": escola,
                    "especial": especial
                })
        
        nome_circ = "Truques" if circulo_num == 0 else f"{circulo_num}º Círculo"
        lista_completa[nome_circ] = nomes_magias
    
    return lista_completa


# ============================================================================
# EXTRATOR DE TALENTOS (FEATS)
# ============================================================================

def extrair_talentos(linhas):
    """Extrai talentos do capítulo 5."""
    print("Processando talentos...")
    
    # Encontrar início dos talentos
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if l.strip() == "# Descrições dos Talentos":
            inicio = i
        if inicio and "Capítulo 6" in l:
            fim = i
            break
    
    if inicio is None:
        print("  ERRO: Seção de talentos não encontrada")
        return
    if fim is None:
        fim = len(linhas)
    
    # Cada talento é uma seção ###
    talentos_h3 = encontrar_secoes_h3(linhas, inicio, fim)
    
    # Padrão para extrair categoria e pré-requisito
    padrao_cat = re.compile(r'\*Talento\s+([\w\s]+?)(?:\s*\(Pré-requisito:\s*(.+?)\))?\*')
    padrao_dadiva = re.compile(r'\*Talento\s+Dádiva Épica\s*(?:\(Pré-requisito:\s*(.+?)\))?\*')
    
    talentos = []
    
    for idx, (pos, nome) in enumerate(talentos_h3):
        fim_talento = talentos_h3[idx + 1][0] if idx + 1 < len(talentos_h3) else fim
        
        talento = {
            "nome": nome,
            "categoria": "",
            "prerequisito": "",
            "beneficios": [],
            "descricao": ""
        }
        
        desc_linhas = []
        for j in range(pos + 1, fim_talento):
            stripped = linhas[j].strip()
            if not stripped:
                continue
            
            # Tentar extrair categoria
            if stripped.startswith("*Talento"):
                m = padrao_cat.search(stripped)
                if m:
                    talento["categoria"] = m.group(1).strip()
                    if m.group(2):
                        talento["prerequisito"] = m.group(2).strip()
                    continue
                m2 = padrao_dadiva.search(stripped)
                if m2:
                    talento["categoria"] = "Dádiva Épica"
                    if m2.group(1):
                        talento["prerequisito"] = m2.group(1).strip()
                    continue
            
            # Extrair benefícios (linhas com ** no início)
            m_ben = re.match(r'\*\*(.+?)\.\*\*\s*(.*)', stripped)
            if m_ben:
                talento["beneficios"].append({
                    "nome": m_ben.group(1).strip(),
                    "descricao": m_ben.group(2).strip()
                })
                continue
            
            desc_linhas.append(stripped)
        
        talento["descricao"] = "\n".join(desc_linhas)
        talentos.append(talento)
    
    # Salvar talentos por categoria
    por_categoria = {}
    for t in talentos:
        cat = t["categoria"] if t["categoria"] else "Sem Categoria"
        if cat not in por_categoria:
            por_categoria[cat] = []
        por_categoria[cat].append(t)
    
    salvar_json("talentos/talentos.json", {
        "total": len(talentos),
        "por_categoria": por_categoria,
        "todos": sorted(talentos, key=lambda x: x["nome"])
    })
    
    print(f"  Total: {len(talentos)} talentos extraídos")


# ============================================================================
# EXTRATOR DE ORIGENS (Antecedentes + Espécies)
# ============================================================================

def extrair_antecedentes(linhas):
    """Extrai antecedentes (backgrounds)."""
    print("Processando antecedentes...")
    
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if l.strip() == "# Descrições dos Antecedentes":
            inicio = i
        if inicio and l.strip() == "# Descrições das Espécies":
            fim = i
            break
    
    if inicio is None:
        return
    if fim is None:
        fim = len(linhas)
    
    antecedentes_h2 = encontrar_secoes_h2(linhas, inicio, fim)
    antecedentes = []
    
    for idx, (pos, nome) in enumerate(antecedentes_h2):
        fim_ant = antecedentes_h2[idx + 1][0] if idx + 1 < len(antecedentes_h2) else fim
        
        antecedente = {
            "nome": nome,
            "valores_atributo": "",
            "talento": "",
            "pericias": "",
            "ferramentas": "",
            "equipamento": "",
            "descricao": ""
        }
        
        desc = []
        for j in range(pos + 1, fim_ant):
            stripped = linhas[j].strip()
            if stripped.startswith("**Valores de Atributo:**"):
                antecedente["valores_atributo"] = stripped.replace("**Valores de Atributo:**", "").strip()
            elif stripped.startswith("**Talento:**"):
                antecedente["talento"] = stripped.replace("**Talento:**", "").strip()
            elif stripped.startswith("**Proficiências em Perícias:**") or stripped.startswith("**Proficiência em Perícias:**"):
                antecedente["pericias"] = re.sub(r'\*\*Proficiências? em Perícias?:\*\*', '', stripped).strip()
            elif stripped.startswith("**Proficiência com Ferramentas:**"):
                antecedente["ferramentas"] = stripped.replace("**Proficiência com Ferramentas:**", "").strip()
            elif stripped.startswith("**Equipamento:**"):
                antecedente["equipamento"] = stripped.replace("**Equipamento:**", "").strip()
            elif stripped:
                desc.append(stripped)
        
        antecedente["descricao"] = "\n".join(desc)
        antecedentes.append(antecedente)
    
    salvar_json("origens/antecedentes.json", {
        "total": len(antecedentes),
        "antecedentes": antecedentes
    })
    print(f"  {len(antecedentes)} antecedentes extraídos")


def extrair_especies(linhas):
    """Extrai espécies (species/races)."""
    print("Processando espécies...")
    
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if l.strip() == "# Descrições das Espécies":
            inicio = i
        if inicio and "Capítulo 5" in l:
            fim = i
            break
    
    if inicio is None:
        return
    if fim is None:
        fim = len(linhas)
    
    especies_h2 = encontrar_secoes_h2(linhas, inicio, fim)
    especies = []
    
    for idx, (pos, nome) in enumerate(especies_h2):
        fim_esp = especies_h2[idx + 1][0] if idx + 1 < len(especies_h2) else fim
        
        especie = {
            "nome": nome,
            "tracos": [],
            "descricao": "",
            "texto_completo": ""
        }
        
        # Encontrar "Traços de {nome}"
        tracos_h3 = encontrar_secoes_h3(linhas, pos, fim_esp)
        
        desc_linhas = []
        for j in range(pos + 1, fim_esp):
            stripped = linhas[j].strip()
            if stripped.startswith("### "):
                # É um traço  
                continue
            
            # Detectar traços específicos como "**Nome do Traço.**"
            m_traco = re.match(r'\*\*(.+?)\.\*\*\s*(.*)', stripped)
            if m_traco:
                especie["tracos"].append({
                    "nome": m_traco.group(1).strip(),
                    "descricao": m_traco.group(2).strip()
                })
                continue
            
            if stripped:
                desc_linhas.append(stripped)
        
        especie["descricao"] = "\n".join(desc_linhas[:3])  # Primeiras linhas de flavor
        especie["texto_completo"] = "".join(linhas[pos:fim_esp]).strip()
        especies.append(especie)
    
    salvar_json("origens/especies.json", {
        "total": len(especies),
        "especies": especies
    })
    print(f"  {len(especies)} espécies extraídas")


# ============================================================================
# EXTRATOR DE EQUIPAMENTO
# ============================================================================

def extrair_armas(linhas):
    """Extrai tabela de armas."""
    print("Processando armas...")
    
    for i, l in enumerate(linhas):
        if l.strip() == "# Armas":
            # Parsear a tabela principal
            _, dados = parse_tabela_md(linhas, i + 1, i + 100)
            
            armas = []
            categoria_atual = ""
            for d in dados:
                nome = d.get("Nome", "").strip()
                if not nome:
                    continue
                
                # Detectar categorias
                if nome.startswith("Armas Simples") or nome.startswith("Armas Marciais"):
                    categoria_atual = nome
                    continue
                
                arma = {
                    "nome": nome,
                    "categoria": categoria_atual,
                    "dano": d.get("Dano", ""),
                    "propriedades": d.get("Propriedades", ""),
                    "maestria": d.get("Maestria", ""),
                    "peso": d.get("Peso", ""),
                    "custo": d.get("Custo", "")
                }
                armas.append(arma)
            
            # Extrair propriedades de armas
            propriedades = []
            inicio_prop = None
            for j in range(i, min(i + 500, len(linhas))):
                if linhas[j].strip() == "## Propriedades":
                    inicio_prop = j
                if linhas[j].strip() == "## Propriedades de Maestria":
                    # Extrair propriedades de maestria também
                    pass
            
            # Extrair propriedades (### seções)
            if inicio_prop:
                prop_h3 = encontrar_secoes_h3(linhas, inicio_prop, min(inicio_prop + 200, len(linhas)))
                for p_idx, (p_pos, p_nome) in enumerate(prop_h3):
                    p_fim = prop_h3[p_idx + 1][0] if p_idx + 1 < len(prop_h3) else inicio_prop + 200
                    desc = []
                    for k in range(p_pos + 1, p_fim):
                        if linhas[k].strip():
                            desc.append(linhas[k].strip())
                    propriedades.append({
                        "nome": p_nome,
                        "descricao": "\n".join(desc)
                    })
            
            salvar_json("equipamento/armas.json", {
                "total": len(armas),
                "armas": armas,
                "propriedades": propriedades
            })
            print(f"  {len(armas)} armas extraídas")
            return


def extrair_armaduras(linhas):
    """Extrai tabela de armaduras."""
    print("Processando armaduras...")
    
    for i, l in enumerate(linhas):
        if l.strip() == "# Armaduras":
            _, dados = parse_tabela_md(linhas, i + 1, i + 50)
            
            armaduras = []
            categoria_atual = ""
            for d in dados:
                nome = d.get("Armadura", d.get("Nome", "")).strip()
                if not nome:
                    continue
                if "Armadura Leve" in nome or "Armadura Média" in nome or "Armadura Pesada" in nome or "Escudo" in nome:
                    if "Leve" in nome:
                        categoria_atual = "Leve"
                    elif "Média" in nome:
                        categoria_atual = "Média"
                    elif "Pesada" in nome:
                        categoria_atual = "Pesada"
                    elif nome == "Escudo":
                        categoria_atual = "Escudo"
                    # Pode ter dados ou não
                    ca = d.get("CA", d.get("Classe de Armadura (CA)", d.get("Classe de Armadura", ""))).strip()
                    if ca and ca != "—":
                        armadura = {
                            "nome": nome,
                            "categoria": categoria_atual,
                            "ca": ca,
                            "requisito_forca": d.get("Força", d.get("Requisito de Força", "")),
                            "furtividade": d.get("Furtividade", ""),
                            "peso": d.get("Peso", ""),
                            "custo": d.get("Custo", "")
                        }
                        armaduras.append(armadura)
                    continue
                
                armadura = {
                    "nome": nome,
                    "categoria": categoria_atual,
                    "ca": d.get("CA", d.get("Classe de Armadura (CA)", d.get("Classe de Armadura", ""))),
                    "requisito_forca": d.get("Força", d.get("Requisito de Força", "")),
                    "furtividade": d.get("Furtividade", ""),
                    "peso": d.get("Peso", ""),
                    "custo": d.get("Custo", "")
                }
                armaduras.append(armadura)
            
            salvar_json("equipamento/armaduras.json", {
                "total": len(armaduras),
                "armaduras": armaduras
            })
            print(f"  {len(armaduras)} armaduras extraídas")
            return


def extrair_equipamento_aventura(linhas):
    """Extrai itens de equipamento de aventura."""
    print("Processando equipamento de aventura...")
    
    for i, l in enumerate(linhas):
        if l.strip() == "# Equipamento de Aventura":
            # Encontrar fim da seção
            fim_equip = i + 500
            for j in range(i + 1, len(linhas)):
                if linhas[j].strip() == "# Montarias e Veículos":
                    fim_equip = j
                    break
            
            # Parsear TODAS as tabelas da seção
            todas_tab = parse_todas_tabelas_md(linhas, i, fim_equip)
            
            # Separar tabelas por tipo
            tabela_municao = None
            tabela_equipamento = []
            
            for tab in todas_tab:
                cabs = tab["cabecalhos"]
                if "Item" in cabs:
                    tabela_equipamento.extend(tab["dados"])
                elif "Tipo" in cabs and "Quantidade" in cabs:
                    tabela_municao = tab["dados"]
            
            itens = []
            for d in tabela_equipamento:
                nome = d.get("Item", "").strip()
                if nome:
                    itens.append({
                        "nome": nome,
                        "peso": d.get("Peso", ""),
                        "custo": d.get("Custo", "")
                    })
            
            municao = []
            if tabela_municao:
                for d in tabela_municao:
                    municao.append({
                        "tipo": d.get("Tipo", ""),
                        "quantidade": d.get("Quantidade", ""),
                        "armazenamento": d.get("Armazenamento", ""),
                        "peso": d.get("Peso", ""),
                        "custo": d.get("Custo", "")
                    })
            
            # Também extrair descrições de itens
            descricoes = {}
            for j in range(i, fim_equip):
                stripped = linhas[j].strip()
                m = re.match(r'\*\*(.+?)\.\*\*\s*(.*)', stripped)
                if m and not stripped.startswith("|"):
                    descricoes[m.group(1).strip()] = m.group(2).strip()
            
            salvar_json("equipamento/equipamento_aventura.json", {
                "total_itens": len(itens),
                "itens": itens,
                "municao": municao,
                "descricoes": descricoes
            })
            print(f"  {len(itens)} itens de aventura + {len(municao)} tipos de munição extraídos")
            return


def extrair_ferramentas(linhas):
    """Extrai ferramentas."""
    print("Processando ferramentas...")
    
    for i, l in enumerate(linhas):
        if l.strip() == "# Ferramentas":
            # Encontrar fim
            fim = i + 500
            for j in range(i + 1, len(linhas)):
                if linhas[j].strip() == "# Equipamento de Aventura":
                    fim = j
                    break
            
            # Parsear todas as tabelas de ferramentas
            tabelas = parse_todas_tabelas_md(linhas, i, fim)
            
            # Também extrair textos descritivos
            texto = "".join(linhas[i:fim]).strip()
            
            salvar_json("equipamento/ferramentas.json", {
                "tabelas": tabelas,
                "texto_completo": texto
            })
            print("  Ferramentas extraídas")
            return


def extrair_servicos(linhas):
    """Extrai tabelas de serviços e montarias."""
    print("Processando serviços e montarias...")
    
    for i, l in enumerate(linhas):
        if l.strip() == "# Montarias e Veículos":
            fim = len(linhas)
            for j in range(i + 1, len(linhas)):
                if linhas[j].strip() == "# Itens Mágicos" or linhas[j].strip() == "# Serviços":
                    fim = j
                    break
            
            tabelas = parse_todas_tabelas_md(linhas, i, fim)
            salvar_json("equipamento/montarias_veiculos.json", {
                "tabelas": tabelas,
                "texto_completo": "".join(linhas[i:fim]).strip()
            })
    
    for i, l in enumerate(linhas):
        if l.strip() == "# Serviços":
            fim = len(linhas)
            for j in range(i + 1, len(linhas)):
                if linhas[j].strip().startswith("# ") and j > i:
                    fim = j
                    break
            
            tabelas = parse_todas_tabelas_md(linhas, i, fim)
            salvar_json("equipamento/servicos.json", {
                "tabelas": tabelas,
                "texto_completo": "".join(linhas[i:fim]).strip()
            })
    
    print("  Serviços e montarias extraídos")


# ============================================================================
# EXTRATOR DE CRIATURAS (Apêndice B)
# ============================================================================

def extrair_criaturas(linhas):
    """Extrai blocos de estatísticas de criaturas."""
    print("Processando criaturas...")
    
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if l.strip() == "# Blocos de Estatísticas de Criaturas":
            inicio = i
        if inicio and "Apêndice C" in l:
            fim = i
            break
    
    if inicio is None:
        return
    if fim is None:
        fim = len(linhas)
    
    criaturas_h2 = encontrar_secoes_h2(linhas, inicio, fim)
    criaturas = []
    
    for idx, (pos, nome) in enumerate(criaturas_h2):
        fim_crit = criaturas_h2[idx + 1][0] if idx + 1 < len(criaturas_h2) else fim
        
        criatura = {
            "nome": nome,
            "tipo_tamanho": "",
            "ca": "",
            "iniciativa": "",
            "pv": "",
            "deslocamento": "",
            "atributos": {},
            "pericias": "",
            "sentidos": "",
            "idiomas": "",
            "nd": "",
            "tracos": [],
            "acoes": [],
            "texto_completo": ""
        }
        
        secao_atual = "info"
        
        for j in range(pos + 1, fim_crit):
            stripped = linhas[j].strip()
            
            if not stripped:
                continue
            
            # Tipo e tamanho (primeira linha após nome)
            if stripped.startswith("*Fera") or stripped.startswith("*Monstruosidade") or stripped.startswith("*Morto") or stripped.startswith("*Celestial") or stripped.startswith("*Elemental") or stripped.startswith("*Constructo") or stripped.startswith("*Ínfero") or stripped.startswith("*Feérico") or stripped.startswith("*Humanoide") or stripped.startswith("*Aberração") or stripped.startswith("*Dragão") or stripped.startswith("*Planta"):
                criatura["tipo_tamanho"] = stripped.strip("*").strip()
                continue
            
            if stripped.startswith("**CA**"):
                criatura["ca"] = stripped.replace("**CA**", "").strip()
            elif stripped.startswith("**Iniciativa**"):
                criatura["iniciativa"] = stripped.replace("**Iniciativa**", "").strip()
            elif stripped.startswith("**PV**"):
                criatura["pv"] = stripped.replace("**PV**", "").strip()
            elif stripped.startswith("**Deslocamento**"):
                criatura["deslocamento"] = stripped.replace("**Deslocamento**", "").strip()
            elif stripped.startswith("**Perícias**"):
                criatura["pericias"] = stripped.replace("**Perícias**", "").strip()
            elif stripped.startswith("**Sentidos**"):
                criatura["sentidos"] = stripped.replace("**Sentidos**", "").strip()
            elif stripped.startswith("**Idiomas**"):
                criatura["idiomas"] = stripped.replace("**Idiomas**", "").strip()
            elif stripped.startswith("**ND**"):
                criatura["nd"] = stripped.replace("**ND**", "").strip()
            
            # Detectar seções Ações/Traços
            if stripped == "### Ações" or stripped == "### Ações":
                secao_atual = "acoes"
                continue
            elif stripped == "### Traços":
                secao_atual = "tracos"
                continue
            elif stripped == "### Reações":
                secao_atual = "reacoes"
                continue
            
            # Parsear ações/traços (linhas com **Nome.** Desc)
            m_acao = re.match(r'\*\*(.+?)\.\*\*\s*(.*)', stripped)
            if m_acao and secao_atual in ("acoes", "tracos", "reacoes"):
                item = {
                    "nome": m_acao.group(1).strip(),
                    "descricao": m_acao.group(2).strip()
                }
                if secao_atual == "acoes":
                    criatura["acoes"].append(item)
                elif secao_atual == "tracos":
                    criatura["tracos"].append(item)
            
            # Parsear tabela de atributos
            if stripped.startswith("|") and "For" in stripped:
                # Parsear atributos da linha
                partes = [p.strip() for p in stripped.split("|") if p.strip()]
                # Formato: For, valor, Mod, SG, Des, valor, Mod, SG, Con, valor, Mod, SG
                for k in range(0, len(partes), 4):
                    if k + 3 < len(partes):
                        nome_atr = partes[k].replace("**", "").strip()
                        valor = partes[k+1].strip()
                        mod = partes[k+2].strip()
                        sg = partes[k+3].strip()
                        if nome_atr in ("For", "Des", "Con", "Int", "Sab", "Car"):
                            criatura["atributos"][nome_atr] = {
                                "valor": valor,
                                "modificador": mod,
                                "salvaguarda": sg
                            }
        
        criatura["texto_completo"] = "".join(linhas[pos:fim_crit]).strip()
        criaturas.append(criatura)
    
    salvar_json("apendices/criaturas.json", {
        "total": len(criaturas),
        "criaturas": criaturas
    })
    print(f"  {len(criaturas)} criaturas extraídas")


# ============================================================================
# EXTRATOR DE GLOSSÁRIO
# ============================================================================

def extrair_glossario(linhas):
    """Extrai termos do glossário de regras."""
    print("Processando glossário...")
    
    inicio = None
    for i, l in enumerate(linhas):
        if "Apêndice C: Glossário de Regras" in l:
            inicio = i
            break
    
    if inicio is None:
        return
    
    fim = len(linhas)
    
    # Encontrar seção de definições
    inicio_def = None
    for i in range(inicio, fim):
        if linhas[i].strip() == "## Definições de Regras":
            inicio_def = i
            break
    
    if inicio_def is None:
        inicio_def = inicio
    
    # Cada termo é uma seção ###
    termos_h3 = encontrar_secoes_h3(linhas, inicio_def, fim)
    
    termos = []
    for idx, (pos, nome) in enumerate(termos_h3):
        fim_termo = termos_h3[idx + 1][0] if idx + 1 < len(termos_h3) else fim
        
        desc = []
        for j in range(pos + 1, fim_termo):
            if linhas[j].strip():
                desc.append(linhas[j].strip())
        
        termos.append({
            "nome": nome,
            "descricao": "\n".join(desc)
        })
    
    # Extrair também as abreviações
    abreviacoes = []
    for i in range(inicio, min(inicio + 100, len(linhas))):
        if "Abreviação" in linhas[i] and linhas[i].strip().startswith("|"):
            _, dados = parse_tabela_md(linhas, i, i + 50)
            for d in dados:
                abreviacoes.append({
                    "abreviacao": d.get("Abreviação", ""),
                    "descricao": d.get("Descrição", "")
                })
            break
    
    salvar_json("apendices/glossario.json", {
        "total_termos": len(termos),
        "abreviacoes": abreviacoes,
        "termos": termos
    })
    print(f"  {len(termos)} termos de glossário extraídos")


# ============================================================================
# EXTRATOR DE REGRAS (Capítulo 1)
# ============================================================================

def extrair_regras_cap1(linhas):
    """Extrai dados estruturados do capítulo 1."""
    print("Processando capítulo 1 - Regras...")
    
    # Encontrar limites do capítulo 1
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if "Capítulo 1 - Jogando o Jogo" in l:
            inicio = i
        if inicio and "Capítulo 2 - Criação de Personagens" in l:
            fim = i
            break
    
    if inicio is None:
        inicio = 173
    if fim is None:
        fim = 1464
    
    # Extrair tabelas importantes
    tabelas_cap1 = parse_todas_tabelas_md(linhas, inicio, fim)
    
    # Extrair seções principais (# headings)
    secoes = encontrar_secoes_h1(linhas[inicio:fim])
    
    dados = {
        "capitulo": 1,
        "titulo": "Jogando o Jogo",
        "tabelas": tabelas_cap1,
        "secoes": [s[1] for s in secoes],
        "texto_completo": "".join(linhas[inicio:fim]).strip()
    }
    
    salvar_json("capitulo1_regras.json", dados)
    print("  Capítulo 1 processado")


# ============================================================================
# EXTRATOR DE CRIAÇÃO DE PERSONAGENS (Capítulo 2)
# ============================================================================

def extrair_criacao_personagem(linhas):
    """Extrai dados do capítulo 2."""
    print("Processando capítulo 2 - Criação de Personagens...")
    
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if "Capítulo 2 - Criação de Personagens" in l:
            inicio = i
        if inicio and ("Capítulo 3" in l and "Classes de Personagens" in l):
            fim = i
            break
    
    if inicio is None:
        inicio = 1464
    if fim is None:
        fim = 2228
    
    tabelas = parse_todas_tabelas_md(linhas, inicio, fim)
    
    dados = {
        "capitulo": 2,
        "titulo": "Criação de Personagens",
        "tabelas": tabelas,
        "texto_completo": "".join(linhas[inicio:fim]).strip()
    }
    
    salvar_json("capitulo2_criacao.json", dados)
    print("  Capítulo 2 processado")


# ============================================================================
# EXTRATOR DO MULTIVERSO (Apêndice A)
# ============================================================================

def extrair_multiverso(linhas):
    """Extrai dados do apêndice A."""
    print("Processando apêndice A - Multiverso...")
    
    inicio = None
    fim = None
    for i, l in enumerate(linhas):
        if "Apêndice A - O Multiverso" in l:
            inicio = i
        if inicio and "Apêndice B" in l and i > inicio:
            fim = i
            break
    
    if inicio is None:
        return
    if fim is None:
        fim = len(linhas)
    
    secoes_h1 = encontrar_secoes_h1(linhas[inicio:fim])
    
    dados = {
        "titulo": "O Multiverso",
        "secoes": [],
        "texto_completo": "".join(linhas[inicio:fim]).strip()
    }
    
    for idx, (pos_rel, nome) in enumerate(secoes_h1):
        pos_abs = inicio + pos_rel
        fim_secao = inicio + (secoes_h1[idx+1][0] if idx+1 < len(secoes_h1) else (fim - inicio))
        
        desc = []
        for j in range(pos_abs + 1, fim_secao):
            if linhas[j].strip():
                desc.append(linhas[j].strip())
        
        dados["secoes"].append({
            "nome": nome,
            "descricao": "\n".join(desc)
        })
    
    salvar_json("apendices/multiverso.json", dados)
    print("  Multiverso processado")


# ============================================================================
# METADADOS
# ============================================================================

def extrair_metadados(linhas):
    """Extrai metadados do livro (versão, créditos, etc.)."""
    print("Processando metadados...")
    
    # Encontrar versão
    versao = ""
    for l in linhas[:10]:
        if "Versão" in l or "Edição" in l:
            versao = l.strip().replace("**", "").replace("Versão:", "").strip()
            break
    
    # Capítulos do livro
    capitulos = [
        {"numero": 1, "titulo": "Jogando o Jogo", "arquivo": "capitulo1_regras.json"},
        {"numero": 2, "titulo": "Criação de Personagens", "arquivo": "capitulo2_criacao.json"},
        {"numero": 3, "titulo": "Classes de Personagem", "arquivo": "classes/"},
        {"numero": 4, "titulo": "Origens dos Personagens", "arquivo": "origens/"},
        {"numero": 5, "titulo": "Talentos", "arquivo": "talentos/talentos.json"},
        {"numero": 6, "titulo": "Equipamento", "arquivo": "equipamento/"},
        {"numero": 7, "titulo": "Magias", "arquivo": "magias/"},
    ]
    
    apendices = [
        {"id": "A", "titulo": "O Multiverso", "arquivo": "apendices/multiverso.json"},
        {"id": "B", "titulo": "Blocos de Estatísticas de Criaturas", "arquivo": "apendices/criaturas.json"},
        {"id": "C", "titulo": "Glossário de Regras", "arquivo": "apendices/glossario.json"},
    ]
    
    dados = {
        "titulo": "D&D 5.5 - Livro do Jogador (2024)",
        "versao": versao,
        "total_linhas": len(linhas),
        "capitulos": capitulos,
        "apendices": apendices,
        "estrutura_arquivos": {
            "capitulo1_regras.json": "Regras básicas do jogo",
            "capitulo2_criacao.json": "Passo a passo para criar personagens",
            "classes/": "Uma JSON por classe com traços, características, subclasses e lista de magias",
            "classes/magias_*.json": "Lista de magias disponíveis por classe conjuradora",
            "origens/antecedentes.json": "Os 16 antecedentes com atributos, talentos e proficiências",
            "origens/especies.json": "As 10 espécies com traços raciais",
            "talentos/talentos.json": "Todos os talentos organizados por categoria",
            "equipamento/armas.json": "Todas as armas com dano, propriedades e maestrias",
            "equipamento/armaduras.json": "Armaduras com CA e requisitos",
            "equipamento/ferramentas.json": "Ferramentas de artesão e outros kits",
            "equipamento/equipamento_aventura.json": "Itens de aventura com custo e peso",
            "equipamento/montarias_veiculos.json": "Montarias e veículos",
            "equipamento/servicos.json": "Serviços disponíveis",
            "magias/truques.json": "Magias de 0 Círculo (truques)",
            "magias/circulo_1.json a circulo_9.json": "Magias organizadas por círculo",
            "magias/_indice.json": "Índice completo de todas as magias",
            "magias/por_classe/": "Magias filtradas por classe conjuradora",
            "apendices/criaturas.json": "Blocos de estatísticas de criaturas",
            "apendices/multiverso.json": "Informações sobre o multiverso de D&D",
            "apendices/glossario.json": "Glossário completo de termos de regras"
        }
    }
    
    salvar_json("_metadados.json", dados)
    print("  Metadados salvos")


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 60)
    print("Extraindo dados do Livro do Jogador D&D 5.5 para JSON")
    print("=" * 60)
    
    # Criar diretório de saída
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Ler arquivo
    print(f"\nLendo: {MD_FILE}")
    linhas = ler_arquivo()
    print(f"  {len(linhas)} linhas lidas\n")
    
    # Executar todos os extratores
    extrair_metadados(linhas)
    print()
    extrair_regras_cap1(linhas)
    print()
    extrair_criacao_personagem(linhas)
    print()
    extrair_classes(linhas)
    print()
    extrair_listas_magias_classe(linhas)
    print()
    extrair_antecedentes(linhas)
    print()
    extrair_especies(linhas)
    print()
    extrair_talentos(linhas)
    print()
    extrair_armas(linhas)
    print()
    extrair_armaduras(linhas)
    print()
    extrair_ferramentas(linhas)
    print()
    extrair_equipamento_aventura(linhas)
    print()
    extrair_servicos(linhas)
    print()
    extrair_magias(linhas)
    print()
    extrair_criaturas(linhas)
    print()
    extrair_multiverso(linhas)
    print()
    extrair_glossario(linhas)
    
    print("\n" + "=" * 60)
    print("Extração concluída!")
    print(f"Arquivos salvos em: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
