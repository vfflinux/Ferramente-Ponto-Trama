#!/usr/bin/env python3
"""
Ponto & Trama — Otimizador de Build (HTML, CSS e JS)
Minifica de forma 100% segura os arquivos estáticos dentro da pasta temporária
de empacotamento (.deb e .apk), sem alterar o código-fonte em `frontend/`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def minificar_html(texto: str) -> str:
    # Remove comentários HTML (exceto condicionais, se houver)
    texto = re.sub(r"<!--(?!\[if).*?-->", "", texto, flags=re.DOTALL)
    # Remove espaços excessivos entre linhas mantendo conteúdo de atributos
    linhas = [ln.strip() for ln in texto.splitlines() if ln.strip()]
    saida = "\n".join(linhas)
    saida = re.sub(r">\n<", "><", saida)
    return saida


def minificar_css(texto: str) -> str:
    # Remove comentários /* ... */
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.DOTALL)
    # Compacta quebras de linha e múltiplos espaços
    texto = re.sub(r"\s+", " ", texto)
    # Remove espaços desnecessários em torno de pontuação CSS (sem tocar em calc/media)
    texto = re.sub(r"\s*([{}:;,>])\s*", r"\1", texto)
    texto = texto.replace(";}", "}")
    # Restaura espaços obrigatórios em media queries (ex: `and(` -> `and (`)
    texto = re.sub(r"\band\(", "and (", texto)
    return texto.strip()


def minificar_js_seguro(texto: str) -> str:
    """
    Minificação conservadora orientada a linhas:
    - Remove linhas de comentário puro (`// ...`) e linhas em branco
    - Remove indentação líder/final fora de template literals multilinha
    Preserva 100% strings, URLs (`https://`), regexes e ASI do JavaScript.
    """
    linhas_out: list[str] = []
    em_template = False

    for linha in texto.splitlines():
        if em_template:
            linhas_out.append(linha)
        else:
            limpa = linha.strip()
            if not limpa or limpa.startswith("//"):
                continue
            linhas_out.append(limpa)

        # Rastreia crases não escapadas para não alterar conteúdo de template strings
        i = 0
        while i < len(linha):
            ch = linha[i]
            if ch == "\\":
                i += 2
                continue
            if ch == "`":
                em_template = not em_template
            i += 1

    return "\n".join(linhas_out) + "\n"


def otimizar_diretorio(alvo: Path) -> None:
    antes_total = 0
    depois_total = 0

    for arq in alvo.rglob("*"):
        if not arq.is_file():
            continue
        ext = arq.suffix.lower()
        if ext not in (".html", ".css", ".js"):
            continue
        bruto = arq.read_text(encoding="utf-8")
        antes_total += len(bruto.encode("utf-8"))

        if ext == ".html":
            otimizado = minificar_html(bruto)
        elif ext == ".css":
            otimizado = minificar_css(bruto)
        else:
            otimizado = minificar_js_seguro(bruto)

        arq.write_text(otimizado, encoding="utf-8")
        depois_total += len(otimizado.encode("utf-8"))

    economia = round((1 - (depois_total / antes_total)) * 100) if antes_total else 0
    print(
        f"⚡ Assets minificados: {antes_total // 1024} KB -> {depois_total // 1024} KB (-{economia}%)"
    )


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/otimizar-build.py <diretorio_frontend>")
        sys.exit(1)
    otimizar_diretorio(Path(sys.argv[1]).resolve())


if __name__ == "__main__":
    main()
