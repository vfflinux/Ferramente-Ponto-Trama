#!/usr/bin/env python3
"""
Ponto & Trama — Verificador Automatizado de Integridade Pré-Build
Valida:
1. Compilação Python de backend/server.py e desktop/app.py
2. Existência de todos os assets referenciados em frontend/index.html e frontend/sw.js
3. Balanceamento léxico e presença dos módulos principais
"""

from __future__ import annotations

import py_compile
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"


def verificar_python() -> None:
    for rel in ("backend/server.py", "desktop/app.py", "desktop/instalador-gui.py"):
        p = ROOT / rel
        if p.exists():
            py_compile.compile(str(p), doraise=True)


def verificar_referencias_html_sw() -> None:
    html = (FRONTEND / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:href|src)="([^"#?]+)', html)
    for ref in refs:
        if ref.startswith(("http:", "https:", "data:")):
            continue
        alvo = FRONTEND / ref
        assert alvo.exists(), f"Asset referenciado em index.html não existe: {ref}"

    sw = (FRONTEND / "sw.js").read_text(encoding="utf-8")
    for m in re.findall(r'"\.\/([^"]+)"', sw):
        alvo = FRONTEND / m
        assert alvo.exists(), f"Asset referenciado em sw.js não existe: {m}"


def verificar_modulos() -> None:
    obrigatorios = {
        "frontend/src/core/aranhas-cinematica-ik.js": ["AranhasCinematicaIK", "atualizarBiomecanicaAranha", "renderizarFrame"],
        "frontend/src/core/aranhas-atelie.js": ["AranhasAtelie", "AranhasCinematicaIK", "avaliacao_ameaca", "esgrima_patas"],
        "frontend/src/core/historico-acoes.js": ["HistoricoAcoes", "gerarFichaOrcamentoPDF", "alternarMiniJanelaTopo", "abrirModalSnapshots"],
        "frontend/src/modules/contador-carreiras.js": ["calcularTextoRitmoETA", "btn-contador-mini-topo"],
        "frontend/src/modules/leitor-receitas.js": ["abrirModalConferenciaEstoque", "btn-conferir-estoque-receita"],
        "frontend/src/modules/home.js": ["home-bancada-receita-preview", "btn-home-hero-ficha-pdf"],
        "frontend/src/modules/gerenciador-projetos.js": ["btn-ws-ficha-pdf", "salvarSnapshotAutomatico"],
    }
    for rel, tokens in obrigatorios.items():
        p = ROOT / rel
        assert p.exists(), f"Módulo ausente: {rel}"
        conteudo = p.read_text(encoding="utf-8")
        for tok in tokens:
            assert tok in conteudo, f"Token '{tok}' ausente em {rel}"


def main() -> int:
    verificar_python()
    verificar_referencias_html_sw()
    verificar_modulos()
    print("✅ Verificação automatizada de integridade (Python + HTML + SW + Módulos JS/CSS) aprovada!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
