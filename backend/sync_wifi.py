#!/usr/bin/env python3
"""
Ponto & Trama — Sincronização Local via Wi-Fi (PC Ubuntu <-> Celular)
100% offline, biblioteca padrão Python (zero dependências externas / zero CDNs).

Cobre:
  - RF01: Servidor HTTP temporário escutando no IP LAN Wi-Fi atual em porta livre
  - RF02: Geração de QR Code SVG 100% offline (ISO/IEC 18004) + URL manual
  - RF03: Direções PC -> Celular, Celular -> PC e Mesclar (Merge por updatedAt/atualizado_em)
  - RF04: Página mobile responsiva embutida direto no navegador do celular
  - RF05: Status em tempo real (aguardando, conectado, transferindo, concluido)
  - RF06: Backup automático pré-sincronização (backup_pre_sync.json) + Rollback
  - RNF01: Token aleatório de sessão com expiração de 5 min e uso único
  - RNF02: 100% offline (QR Code + HTML/CSS/JS mobile embutidos)
  - RNF03: Validação estrita de integridade/schema do JSON antes de gravar
  - RNF04: Encerramento limpo automático ao concluir, expirar ou fechar
  - RNF05: Diagnóstico de rede/firewall (UFW) em caso de demora na conexão
"""

from __future__ import annotations

import html
import json
import secrets
import socket
import subprocess
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

# ============================================================================
# 1. GERADOR DE QR CODE 100% OFFLINE EM PYTHON PURO (ISO/IEC 18004, ECC-M)
#    Suporta Byte Mode, Versões 1 a 10 (até 213 bytes — ideal para URLs LAN)
# ============================================================================

# (total_codewords, ec_codewords_per_block, blocks_g1, data_cw_g1, blocks_g2, data_cw_g2)
_QR_TABELA_M: dict[int, tuple[int, int, int, int, int, int]] = {
    1:  (26,  10, 1, 16, 0,  0),
    2:  (44,  16, 1, 28, 0,  0),
    3:  (70,  26, 1, 44, 0,  0),
    4:  (100, 18, 2, 32, 0,  0),
    5:  (134, 24, 2, 43, 0,  0),
    6:  (172, 16, 4, 27, 0,  0),
    7:  (196, 18, 4, 31, 0,  0),
    8:  (242, 22, 2, 38, 2, 39),
    9:  (292, 22, 3, 36, 2, 37),
    10: (346, 26, 4, 43, 1, 44),
}

_QR_ALINHAMENTO: dict[int, list[int]] = {
    1:  [],
    2:  [6, 18],
    3:  [6, 22],
    4:  [6, 26],
    5:  [6, 30],
    6:  [6, 34],
    7:  [6, 22, 38],
    8:  [6, 24, 42],
    9:  [6, 26, 46],
    10: [6, 28, 50],
}

# Tabelas GF(256) com polinômio primitivo 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
_GF_EXP = [0] * 512
_GF_LOG = [0] * 256
_x = 1
for _i in range(255):
    _GF_EXP[_i] = _x
    _GF_LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    _GF_EXP[_i] = _GF_EXP[_i - 255]


def _gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return _GF_EXP[_GF_LOG[a] + _GF_LOG[b]]


def _rs_gerador(grau: int) -> list[int]:
    poly = [1]
    for i in range(grau):
        fator = [1, _GF_EXP[i]]
        novo = [0] * (len(poly) + 1)
        for j, a in enumerate(poly):
            novo[j] ^= _gf_mul(a, fator[0])
            novo[j + 1] ^= _gf_mul(a, fator[1])
        poly = novo
    return poly


def _rs_resto(dados: list[int], n_ec: int) -> list[int]:
    gen = _rs_gerador(n_ec)
    res = list(dados) + [0] * n_ec
    for i in range(len(dados)):
        coef = res[i]
        if coef != 0:
            for j in range(1, len(gen)):
                res[i + j] ^= _gf_mul(gen[j], coef)
    return res[len(dados):]


def _qr_bch_formato(ec_bits: int, mask: int) -> int:
    """Calcula os 15 bits de informação de formato (ECC + máscara) com BCH(15,5)."""
    data = (ec_bits << 3) | mask
    rem = data
    for _ in range(10):
        rem = (rem << 1) ^ ((rem >> 9) * 0x537)
    return ((data << 10) | rem) ^ 0x5412


def _qr_bch_versao(versao: int) -> int:
    """Calcula os 18 bits de informação de versão (para versões >= 7)."""
    rem = versao
    for _ in range(12):
        rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
    return (versao << 12) | rem


def _qr_construir_matriz(texto: str) -> list[list[int]]:
    raw = texto.encode("utf-8")
    n_bytes = len(raw)

    versao = 0
    for v in range(1, 11):
        _, _, b1, d1, b2, d2 = _QR_TABELA_M[v]
        cap_data = b1 * d1 + b2 * d2
        overhead_bits = 4 + (8 if v <= 9 else 16)
        if overhead_bits + n_bytes * 8 <= cap_data * 8:
            versao = v
            break
    if versao == 0:
        raise ValueError("URL longa demais para QR Code local (máx. Versão 10).")

    _, ec_len, b1, d1, b2, d2 = _QR_TABELA_M[versao]
    cap_data = b1 * d1 + b2 * d2

    # 1. Monta fluxo de bits (Byte Mode = 0100)
    bits: list[int] = []

    def push_bits(val: int, length: int) -> None:
        for i in range(length - 1, -1, -1):
            bits.append((val >> i) & 1)

    push_bits(0b0100, 4)
    push_bits(n_bytes, 8 if versao <= 9 else 16)
    for b in raw:
        push_bits(b, 8)

    # Terminador (até 4 zeros) + padding até múltiplo de 8
    max_bits = cap_data * 8
    push_bits(0, min(4, max_bits - len(bits)))
    while len(bits) % 8 != 0:
        bits.append(0)

    data_cw: list[int] = []
    for i in range(0, len(bits), 8):
        byte_val = 0
        for bit in bits[i : i + 8]:
            byte_val = (byte_val << 1) | bit
        data_cw.append(byte_val)

    pad_seq = (0xEC, 0x11)
    pad_idx = 0
    while len(data_cw) < cap_data:
        data_cw.append(pad_seq[pad_idx % 2])
        pad_idx += 1

    # 2. Divide em blocos, calcula Reed-Solomon e intercala
    blocos_dados: list[list[int]] = []
    blocos_ec: list[list[int]] = []
    pos = 0
    for count, dlen in ((b1, d1), (b2, d2)):
        for _ in range(count):
            bloco = data_cw[pos : pos + dlen]
            pos += dlen
            blocos_dados.append(bloco)
            blocos_ec.append(_rs_resto(bloco, ec_len))

    stream: list[int] = []
    max_dlen = max(len(b) for b in blocos_dados)
    for i in range(max_dlen):
        for bloco in blocos_dados:
            if i < len(bloco):
                stream.append(bloco[i])
    for i in range(ec_len):
        for ec in blocos_ec:
            stream.append(ec[i])

    # 3. Prepara grade e padrões fixos (Finder, Separator, Alignment, Timing, Dark Module)
    size = 17 + 4 * versao
    mod = [[0] * size for _ in range(size)]
    func = [[False] * size for _ in range(size)]

    def set_func(r: int, c: int, val: int) -> None:
        if 0 <= r < size and 0 <= c < size:
            mod[r][c] = val
            func[r][c] = True

    def desenhar_finder(r0: int, c0: int) -> None:
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = r0 + dr, c0 + dc
                if 0 <= r < size and 0 <= c < size:
                    dentro = 0 <= dr <= 6 and 0 <= dc <= 6
                    preto = dentro and (
                        dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4)
                    )
                    set_func(r, c, 1 if preto else 0)

    desenhar_finder(0, 0)
    desenhar_finder(0, size - 7)
    desenhar_finder(size - 7, 0)

    # Alignment patterns
    coords = _QR_ALINHAMENTO[versao]
    for r in coords:
        for c in coords:
            if func[r][c]:
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    preto = max(abs(dr), abs(dc)) != 1
                    set_func(r + dr, c + dc, 1 if preto else 0)

    # Timing patterns
    for i in range(8, size - 8):
        if not func[6][i]:
            set_func(6, i, 1 if i % 2 == 0 else 0)
        if not func[i][6]:
            set_func(i, 6, 1 if i % 2 == 0 else 0)

    # Dark module + reserva áreas de formato
    set_func(4 * versao + 9, 8, 1)
    for i in range(9):
        if not func[8][i]:
            set_func(8, i, 0)
        if not func[i][8]:
            set_func(i, 8, 0)
    for i in range(8):
        set_func(8, size - 1 - i, 0)
        set_func(size - 1 - i, 8, 0)

    # Reserva áreas de versão (>= 7)
    if versao >= 7:
        vbits = _qr_bch_versao(versao)
        for i in range(18):
            bit = (vbits >> i) & 1
            a = size - 11 + (i % 3)
            b = i // 3
            set_func(a, b, bit)
            set_func(b, a, bit)

    # 4. Preenche os bits de dados em zigue-zague (direita -> esquerda, pulando coluna 6)
    bit_idx = 0
    total_bits = len(stream) * 8
    col = size - 1
    subindo = True
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(size - 1, -1, -1) if subindo else range(size)
        for r in rows:
            for dc in (0, -1):
                c = col + dc
                if not func[r][c]:
                    bit = 0
                    if bit_idx < total_bits:
                        bit = (stream[bit_idx >> 3] >> (7 - (bit_idx & 7))) & 1
                    mod[r][c] = bit
                    bit_idx += 1
        col -= 2
        subindo = not subindo

    # 5. Avalia as 8 máscaras padrão e escolhe a de menor penalidade
    def aplicar_mascara(m: int) -> list[list[int]]:
        g = [row[:] for row in mod]
        for r in range(size):
            for c in range(size):
                if func[r][c]:
                    continue
                if (
                    (m == 0 and (r + c) % 2 == 0)
                    or (m == 1 and r % 2 == 0)
                    or (m == 2 and c % 3 == 0)
                    or (m == 3 and (r + c) % 3 == 0)
                    or (m == 4 and ((r // 2) + (c // 3)) % 2 == 0)
                    or (m == 5 and (r * c) % 2 + (r * c) % 3 == 0)
                    or (m == 6 and ((r * c) % 2 + (r * c) % 3) % 2 == 0)
                    or (m == 7 and ((r + c) % 2 + (r * c) % 3) % 2 == 0)
                ):
                    g[r][c] ^= 1

        # Escreve bits de formato (ECC M = 00)
        fmt = _qr_bch_formato(0b00, m)
        for i in range(6):
            g[8][i] = (fmt >> (14 - i)) & 1
        g[8][7] = (fmt >> 8) & 1
        g[8][8] = (fmt >> 7) & 1
        g[7][8] = (fmt >> 6) & 1
        for i in range(6):
            g[5 - i][8] = (fmt >> (5 - i)) & 1

        for i in range(8):
            g[8][size - 1 - i] = (fmt >> i) & 1
        for i in range(7):
            g[size - 7 + i][8] = (fmt >> (14 - i)) & 1
        return g

    def penalidade(g: list[list[int]]) -> int:
        score = 0
        # Regra 1: corridas >= 5 na mesma cor
        for linha in g:
            run = 1
            for i in range(1, size):
                if linha[i] == linha[i - 1]:
                    run += 1
                else:
                    if run >= 5:
                        score += 3 + (run - 5)
                    run = 1
            if run >= 5:
                score += 3 + (run - 5)
        for c in range(size):
            run = 1
            for r in range(1, size):
                if g[r][c] == g[r - 1][c]:
                    run += 1
                else:
                    if run >= 5:
                        score += 3 + (run - 5)
                    run = 1
            if run >= 5:
                score += 3 + (run - 5)
        # Regra 2: blocos 2x2
        for r in range(size - 1):
            for c in range(size - 1):
                v = g[r][c]
                if v == g[r][c + 1] == g[r + 1][c] == g[r + 1][c + 1]:
                    score += 3
        # Regra 4: balanço de módulos escuros
        escuros = sum(sum(row) for row in g)
        pct = abs(escuros * 100 // (size * size) - 50)
        score += (pct // 5) * 10
        return score

    melhor_g = None
    melhor_p = 10**9
    for m in range(8):
        cand = aplicar_mascara(m)
        p = penalidade(cand)
        if p < melhor_p:
            melhor_p = p
            melhor_g = cand

    assert melhor_g is not None
    return melhor_g


def gerar_qr_svg(texto: str, quiet_zone: int = 4) -> str:
    """Gera um SVG vetorial compacto do QR Code 100% offline."""
    matriz = _qr_construir_matriz(texto)
    n = len(matriz)
    total = n + quiet_zone * 2
    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="220" height="220" shape-rendering="crispEdges" role="img" '
        f'aria-label="QR Code de sincronização Wi-Fi">',
        f'<rect width="{total}" height="{total}" fill="#ffffff"/>',
        '<path fill="#0b1533" d="',
    ]
    cmds: list[str] = []
    for r, row in enumerate(matriz):
        y = r + quiet_zone
        c = 0
        while c < n:
            if row[c]:
                ini = c
                while c < n and row[c]:
                    c += 1
                x = ini + quiet_zone
                w = c - ini
                cmds.append(f"M{x},{y}h{w}v1h-{w}z")
            else:
                c += 1
    partes.append("".join(cmds))
    partes.append('"/></svg>')
    return "".join(partes)


# ============================================================================
# 2. DETECÇÃO DO IP DA REDE WI-FI / LAN ATUAL (RF01)
# ============================================================================

def detectar_ip_wifi_local() -> tuple[str, bool]:
    """
    Descobre o IP LAN da rede Wi-Fi atual (ex.: 192.168.x.x).
    Retorna (ip, tem_rede_lan).
    """
    # 1. Rota padrão via socket UDP (não envia nenhum pacote de rede!)
    for alvo in (("192.168.255.255", 1), ("10.255.255.255", 1), ("172.16.0.1", 1), ("8.8.8.8", 80)):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.settimeout(0.2)
            sock.connect(alvo)
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip, True
        except OSError:
            continue
        finally:
            sock.close()

    # 2. Fallback via `hostname -I` no Ubuntu/Linux
    try:
        out = subprocess.check_output(["hostname", "-I"], timeout=1.0, text=True).strip()
        for tok in out.split():
            if "." in tok and not tok.startswith("127.") and not tok.startswith("169.254."):
                return tok, True
    except Exception:
        pass

    return "127.0.0.1", False


# ============================================================================
# 3. VALIDAÇÃO DE INTEGRIDADE / SCHEMA (RNF03) & MERGE POR updatedAt (RF03)
# ============================================================================

COLECOES_SYNC = ("fios", "itens_biblioteca", "banco_amostras", "projetos")


def extrair_timestamp_ms(item: dict) -> float:
    """Extrai timestamp em milissegundos aceitando updatedAt, atualizado_em ou criado_em."""
    if not isinstance(item, dict):
        return 0.0
    for chave in ("updatedAt", "atualizado_em", "updated_at", "criado_em", "createdAt"):
        val = item.get(chave)
        if not val:
            continue
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            s = val.strip()
            if not s:
                continue
            try:
                if s.endswith("Z"):
                    s = s[:-1] + "+00:00"
                dt = datetime.fromisoformat(s)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.timestamp() * 1000.0
            except ValueError:
                continue
    return 0.0


def validar_pacote_json(pacote: Any) -> tuple[bool, str, dict | None]:
    """
    RNF03 — Valida integridade e schema do JSON antes de qualquer gravação.
    Retorna (ok, mensagem_erro, pacote_normalizado).
    """
    if not isinstance(pacote, dict):
        return False, "O arquivo não contém um objeto JSON válido.", None

    # Aceita pacote completo ({ app, versao, preferencias, dados }) ou objeto direto de coleções
    eh_envelope = "dados" in pacote
    if eh_envelope:
        if not isinstance(pacote.get("dados"), dict):
            return False, "Campo obrigatório 'dados' ausente ou inválido no backup.", None
        versao = pacote.get("versao")
        if versao is not None and not isinstance(versao, (str, int, float)):
            return False, "Campo 'versao' inválido no arquivo de backup.", None
        dados = pacote["dados"]
        prefs = pacote.get("preferencias")
        if prefs is not None and not isinstance(prefs, dict):
            return False, "Campo 'preferencias' está corrompido.", None
    else:
        dados = pacote
        prefs = pacote.get("preferencias") if isinstance(pacote.get("preferencias"), dict) else None

    tem_alguma_colecao = any(col in dados for col in COLECOES_SYNC)
    if not tem_alguma_colecao and prefs is None:
        return False, "Arquivo JSON não pertence ao formato do Ponto & Trama (nenhuma coleção reconhecida).", None

    dados_norm: dict[str, list[dict]] = {}
    for col in COLECOES_SYNC:
        bruto = dados.get(col, [])
        if bruto is None:
            bruto = []
        if not isinstance(bruto, list):
            return False, f"A coleção '{col}' deve ser uma lista.", None

        lista_limpa: list[dict] = []
        for idx, item in enumerate(bruto):
            if not isinstance(item, dict):
                return False, f"Registro #{idx + 1} em '{col}' não é um objeto válido.", None

            if col == "projetos":
                nome = item.get("nome")
                if not isinstance(nome, str) or not nome.strip():
                    return False, f"Projeto #{idx + 1} está sem nome obrigatório.", None
                for campo_lista in ("contadores", "etapas", "galeria"):
                    if campo_lista in item and item[campo_lista] is not None and not isinstance(item[campo_lista], list):
                        return False, f"Projeto '{nome}' possui '{campo_lista}' em formato inválido.", None
                for campo_dict in ("receita", "materiais", "amostra", "precificacao"):
                    if campo_dict in item and item[campo_dict] is not None and not isinstance(item[campo_dict], dict):
                        return False, f"Projeto '{nome}' possui '{campo_dict}' em formato inválido.", None
                if isinstance(item.get("contadores"), list):
                    for c_idx, c in enumerate(item["contadores"]):
                        if not isinstance(c, dict):
                            return False, f"Contador #{c_idx + 1} do projeto '{nome}' é inválido.", None

            elif col == "fios":
                nome = item.get("nome")
                if not isinstance(nome, str) or not nome.strip():
                    return False, f"Fio #{idx + 1} no estoque está sem nome obrigatório.", None
                qtd = item.get("quantidade", 0)
                if qtd is not None:
                    try:
                        if float(qtd) < 0:
                            return False, f"Fio '{nome}' possui quantidade negativa.", None
                    except (TypeError, ValueError):
                        return False, f"Fio '{nome}' possui quantidade inválida.", None

            elif col == "itens_biblioteca":
                nome = item.get("nome")
                if not isinstance(nome, str) or not nome.strip():
                    return False, f"Item #{idx + 1} em Agulhas/Acessórios está sem nome obrigatório.", None
                cat = item.get("categoria", "agulha")
                if cat not in ("agulha", "ferramenta", "aviamento"):
                    return False, f"Item '{nome}' possui categoria inválida ('{cat}').", None
                if "atributos" in item and item["atributos"] is not None and not isinstance(item["atributos"], dict):
                    return False, f"Item '{nome}' possui atributos corrompidos.", None

            elif col == "banco_amostras":
                nome = item.get("nome")
                if not isinstance(nome, str) or not nome.strip():
                    return False, f"Amostra #{idx + 1} está sem nome obrigatório.", None
                for campo_num in ("pontos", "carreiras"):
                    val = item.get(campo_num)
                    if val is not None:
                        try:
                            if float(val) <= 0:
                                return False, f"Amostra '{nome}' possui '{campo_num}' inválido.", None
                        except (TypeError, ValueError):
                            return False, f"Amostra '{nome}' possui '{campo_num}' não numérico.", None

            lista_limpa.append(item)
        dados_norm[col] = lista_limpa

    return True, "", {
        "app": "Ponto & Trama",
        "versao": str(pacote.get("versao") or "1.0.0"),
        "exportado_em": str(pacote.get("exportado_em") or datetime.now(timezone.utc).isoformat()),
        "preferencias": prefs,
        "dados": dados_norm,
    }


def _chave_natural_item(colecao: str, item: dict) -> str:
    """Gera chave de correspondência estável para mesclar registros entre dispositivos."""
    nome = str(item.get("nome") or "").strip().lower()
    if colecao == "fios":
        marca = str(item.get("marca") or "").strip().lower()
        cor = str(item.get("cor_nome") or "").strip().lower()
        lote = str(item.get("lote") or "").strip().lower()
        return f"fio|{nome}|{marca}|{cor}|{lote}"
    if colecao == "itens_biblioteca":
        cat = str(item.get("categoria") or "agulha").strip().lower()
        mm = str((item.get("atributos") or {}).get("espessura_mm") or "").strip().lower()
        return f"bib|{cat}|{nome}|{mm}"
    if colecao == "banco_amostras":
        tec = str(item.get("tecnica") or "croche").strip().lower()
        fio = str(item.get("fio") or "").strip().lower()
        return f"am|{tec}|{nome}|{fio}"
    # projetos
    cat = str(item.get("categoria") or "").strip().lower()
    criado = str(item.get("criado_em") or "").strip()[:19]
    return f"proj|{nome}|{cat}|{criado}" if criado else f"proj|{nome}|{cat}"


def _mesclar_contadores_projeto(local_p: dict, remoto_p: dict, ts_local: float, ts_remoto: float) -> list[dict]:
    """Mescla contadores de um projeto preservando a versão mais recente por contador/projeto."""
    c_loc = local_p.get("contadores") if isinstance(local_p.get("contadores"), list) else []
    c_rem = remoto_p.get("contadores") if isinstance(remoto_p.get("contadores"), list) else []
    if not c_loc:
        return [dict(c) for c in c_rem if isinstance(c, dict)]
    if not c_rem:
        return [dict(c) for c in c_loc if isinstance(c, dict)]

    # Se um projeto tem timestamp mais recente, parte dele e preserva contadores extras do outro
    prim, sec = (c_rem, c_loc) if ts_remoto >= ts_local else (c_loc, c_rem)
    resultado = [dict(c) for c in prim if isinstance(c, dict)]
    chaves_prim = {
        str(c.get("id") or c.get("nome") or "").strip().lower()
        for c in resultado
    }
    for c in sec:
        if not isinstance(c, dict):
            continue
        ch = str(c.get("id") or c.get("nome") or "").strip().lower()
        if ch and ch not in chaves_prim:
            resultado.append(dict(c))
            chaves_prim.add(ch)
    return resultado


def mesclar_pacotes(local_pkg: dict, remoto_pkg: dict) -> tuple[dict, dict]:
    """
    RF03 (Merge): Compara datas de modificação (updatedAt / atualizado_em) de cada
    projeto/contador/fio/item/amostra e mantém sempre a versão mais recente.
    Retorna (pacote_mesclado, estatisticas).
    """
    dados_loc = local_pkg.get("dados") or {}
    dados_rem = remoto_pkg.get("dados") or {}
    dados_out: dict[str, list[dict]] = {}
    stats = {
        "mantidos_pc": 0,
        "atualizados_do_celular": 0,
        "adicionados_do_celular": 0,
        "total_final": 0,
    }

    for col in COLECOES_SYNC:
        mapa: dict[str, tuple[dict, float]] = {}
        ordem: list[str] = []

        for item in dados_loc.get(col) or []:
            if not isinstance(item, dict):
                continue
            chave = _chave_natural_item(col, item)
            ts = extrair_timestamp_ms(item)
            if chave not in mapa:
                ordem.append(chave)
                mapa[chave] = (dict(item), ts)
            elif ts >= mapa[chave][1]:
                mapa[chave] = (dict(item), ts)

        for item in dados_rem.get(col) or []:
            if not isinstance(item, dict):
                continue
            chave = _chave_natural_item(col, item)
            ts_rem = extrair_timestamp_ms(item)
            if chave not in mapa:
                ordem.append(chave)
                mapa[chave] = (dict(item), ts_rem)
                stats["adicionados_do_celular"] += 1
            else:
                item_loc, ts_loc = mapa[chave]
                if ts_rem > ts_loc:
                    vencedor = dict(item)
                    if col == "projetos":
                        vencedor["contadores"] = _mesclar_contadores_projeto(item_loc, item, ts_loc, ts_rem)
                    mapa[chave] = (vencedor, ts_rem)
                    stats["atualizados_do_celular"] += 1
                else:
                    if col == "projetos":
                        item_loc = dict(item_loc)
                        item_loc["contadores"] = _mesclar_contadores_projeto(item_loc, item, ts_loc, ts_rem)
                        mapa[chave] = (item_loc, ts_loc)
                    stats["mantidos_pc"] += 1

        dados_out[col] = [mapa[k][0] for k in ordem]
        stats["total_final"] += len(dados_out[col])

    # Preferências: usa o pacote com exportado_em mais recente como prioridade
    ts_pkg_loc = extrair_timestamp_ms({"updatedAt": local_pkg.get("exportado_em")})
    ts_pkg_rem = extrair_timestamp_ms({"updatedAt": remoto_pkg.get("exportado_em")})
    prefs_loc = local_pkg.get("preferencias") if isinstance(local_pkg.get("preferencias"), dict) else {}
    prefs_rem = remoto_pkg.get("preferencias") if isinstance(remoto_pkg.get("preferencias"), dict) else {}
    if prefs_rem and ts_pkg_rem > ts_pkg_loc:
        prefs_final = {**prefs_loc, **prefs_rem}
    else:
        prefs_final = {**prefs_rem, **prefs_loc} if (prefs_loc or prefs_rem) else None

    pacote_mesclado = {
        "app": "Ponto & Trama",
        "versao": "1.0.0",
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "preferencias": prefs_final,
        "dados": dados_out,
    }
    return pacote_mesclado, stats


# ============================================================================
# 4. PÁGINA MOBILE EMBUTIDA 100% OFFLINE (RF04 + RNF02)
# ============================================================================

def _renderizar_pagina_mobile(token: str, direcao: str, resumo_pc: dict) -> bytes:
    tok_js = json.dumps(token)
    dir_js = json.dumps(direcao)
    tot_proj = int(resumo_pc.get("projetos", 0))
    tot_fios = int(resumo_pc.get("fios", 0))
    tot_bib = int(resumo_pc.get("itens_biblioteca", 0))
    tot_am = int(resumo_pc.get("banco_amostras", 0))

    pagina = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<title>Sincronização Wi-Fi — Ponto &amp; Trama</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0d1c42; color: #fcf1d0; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; padding: 18px 14px 36px 14px;
  }}
  .wrap {{ width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 14px; }}
  .topo {{ text-align: center; padding: 6px 0; }}
  .topo h1 {{ margin: 0; font-size: 21px; font-weight: 800; letter-spacing: 0.2px; }}
  .topo p {{ margin: 4px 0 0 0; font-size: 13px; color: rgba(252,241,208,0.74); }}
  .pill-ok {{
    display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
    background: rgba(61,214,140,0.16); border: 1px solid rgba(61,214,140,0.5);
    color: #9af5c9; font-size: 12px; font-weight: 700; padding: 4px 11px; border-radius: 999px;
  }}
  .card {{
    background: rgba(1,7,54,0.58); border: 1px solid rgba(252,241,208,0.16);
    border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
  }}
  .card h2 {{ margin: 0; font-size: 15px; font-weight: 800; }}
  .sub {{ font-size: 12.5px; color: rgba(252,241,208,0.74); margin: 0; line-height: 1.45; }}
  .stats {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }}
  .stat {{
    background: rgba(34,57,111,0.34); border: 1px solid rgba(252,241,208,0.12);
    border-radius: 10px; padding: 8px 10px; display: flex; justify-content: space-between;
    align-items: center; font-size: 12.5px;
  }}
  .stat strong {{ font-size: 15px; }}
  .dir-grid {{ display: grid; grid-template-columns: 1fr; gap: 8px; }}
  .btn-dir {{
    text-align: left; padding: 11px 12px; border-radius: 11px; cursor: pointer;
    background: rgba(34,57,111,0.28); border: 1.5px solid rgba(252,241,208,0.16);
    color: #fcf1d0; font-family: inherit; display: flex; flex-direction: column; gap: 2px;
  }}
  .btn-dir strong {{ font-size: 13.5px; }}
  .btn-dir span {{ font-size: 11.5px; color: rgba(252,241,208,0.72); }}
  .btn-dir.ativo {{ background: #2c4a91; border-color: #fcf1d0; }}
  .btn {{
    width: 100%; min-height: 46px; border-radius: 12px; border: none;
    font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px;
  }}
  .btn-primario {{ background: #fcf1d0; color: #010736; }}
  .btn-secundario {{ background: rgba(34,57,111,0.65); color: #fcf1d0; border: 1px solid rgba(252,241,208,0.26); }}
  .btn:disabled {{ opacity: 0.45; cursor: not-allowed; }}
  .file-box {{
    border: 1.5px dashed rgba(252,241,208,0.35); border-radius: 12px; padding: 14px;
    text-align: center; background: rgba(34,57,111,0.2);
  }}
  .file-box input {{ width: 100%; color: #fcf1d0; font-size: 13px; }}
  .status-box {{
    padding: 12px; border-radius: 11px; font-size: 13px; font-weight: 600; line-height: 1.45;
    display: none;
  }}
  .status-box.ok {{ display: block; background: rgba(61,214,140,0.18); border: 1px solid #3dd68c; color: #b8f9d8; }}
  .status-box.erro {{ display: block; background: rgba(231,76,60,0.2); border: 1px solid #ff796c; color: #ffd0cb; }}
  .status-box.info {{ display: block; background: rgba(91,135,232,0.22); border: 1px solid #80abff; color: #dce8ff; }}
  .passos {{ font-size: 12px; color: rgba(252,241,208,0.72); margin: 0; padding-left: 18px; line-height: 1.55; }}
</style>
</head>
<body>
  <div class="wrap">
    <header class="topo">
      <h1>🧶 Ponto &amp; Trama</h1>
      <p>Sincronização Local via Wi-Fi (100% Offline)</p>
      <span class="pill-ok">✓ Conectado ao PC Ubuntu</span>
    </header>

    <section class="card">
      <h2>Dados disponíveis no PC</h2>
      <div class="stats">
        <div class="stat"><span>📂 Projetos</span><strong>{tot_proj}</strong></div>
        <div class="stat"><span>🧶 Fios</span><strong>{tot_fios}</strong></div>
        <div class="stat"><span>🪡 Agulhas/Acess.</span><strong>{tot_bib}</strong></div>
        <div class="stat"><span>📐 Amostras</span><strong>{tot_am}</strong></div>
      </div>
    </section>

    <section class="card">
      <h2>1. Direção da Sincronização</h2>
      <div class="dir-grid" id="dir-grid">
        <button type="button" class="btn-dir" data-dir="pc_para_celular">
          <strong>💻 → 📱 PC para Celular</strong>
          <span>Baixe o backup (.json) do Ubuntu para importar no celular.</span>
        </button>
        <button type="button" class="btn-dir" data-dir="celular_para_pc">
          <strong>📱 → 💻 Celular para PC</strong>
          <span>Envie o backup (.json) do celular para atualizar o Ubuntu.</span>
        </button>
        <button type="button" class="btn-dir" data-dir="mesclar">
          <strong>🔄 Mesclar (Merge inteligente)</strong>
          <span>Mantém a versão mais recente de cada item nos dois aparelhos.</span>
        </button>
      </div>
    </section>

    <section class="card" id="painel-pc-cel" style="display:none">
      <h2>2. Baixar backup do PC</h2>
      <p class="sub">Toque abaixo para salvar o arquivo <strong>.json</strong> do PC neste celular. Depois, abra o Ponto &amp; Trama no celular em <em>Configurações → Importar Arquivo</em> (um backup de segurança será criado automaticamente antes de aplicar).</p>
      <button type="button" class="btn btn-primario" id="btn-baixar-pc">📥 Baixar Backup do PC (.json)</button>
    </section>

    <section class="card" id="painel-upload" style="display:none">
      <h2 id="titulo-upload">2. Enviar backup do Celular</h2>
      <p class="sub" id="desc-upload">No app Ponto &amp; Trama do celular, exporte seu backup em <em>Configurações → Exportar Tudo</em> e selecione o arquivo <strong>.json</strong> abaixo:</p>
      <div class="file-box">
        <input type="file" id="input-arquivo-sync" accept=".json,application/json" />
      </div>
      <button type="button" class="btn btn-primario" id="btn-enviar-cel" disabled>📤 Enviar e Sincronizar</button>
      <button type="button" class="btn btn-secundario" id="btn-baixar-mesclado" style="display:none">📥 Baixar Arquivo Mesclado (.json)</button>
    </section>

    <div class="status-box" id="status-box" role="status"></div>

    <section class="card">
      <h2>🔒 Segurança &amp; Rollback</h2>
      <ol class="passos">
        <li>Conexão privada apenas no seu Wi-Fi local com token temporário.</li>
        <li>Antes de sobrescrever dados no PC, o sistema salva <code>backup_pre_sync.json</code> automaticamente.</li>
        <li>O servidor local fecha sozinho assim que a sincronização terminar.</li>
      </ol>
    </section>
  </div>

<script>
(function() {{
  const TOKEN = {tok_js};
  let direcao = {dir_js};
  let arquivoSelecionado = null;
  let blobMescladoUrl = null;

  const statusBox = document.getElementById("status-box");
  const painelPcCel = document.getElementById("painel-pc-cel");
  const painelUpload = document.getElementById("painel-upload");
  const tituloUpload = document.getElementById("titulo-upload");
  const descUpload = document.getElementById("desc-upload");
  const inpArq = document.getElementById("input-arquivo-sync");
  const btnEnviar = document.getElementById("btn-enviar-cel");
  const btnBaixarPc = document.getElementById("btn-baixar-pc");
  const btnBaixarMesclado = document.getElementById("btn-baixar-mesclado");

  function setStatus(tipo, msg) {{
    statusBox.className = "status-box " + tipo;
    statusBox.textContent = msg;
  }}

  function atualizarUI() {{
    document.querySelectorAll(".btn-dir").forEach((b) => {{
      b.classList.toggle("ativo", b.dataset.dir === direcao);
    }});
    if (direcao === "pc_para_celular") {{
      painelPcCel.style.display = "flex";
      painelUpload.style.display = "none";
    }} else {{
      painelPcCel.style.display = "none";
      painelUpload.style.display = "flex";
      if (direcao === "mesclar") {{
        tituloUpload.textContent = "2. Enviar .json para Mesclar (Merge)";
        descUpload.innerHTML = "Selecione o <strong>.json</strong> exportado do celular. O PC comparará as datas de modificação, atualizará o Ubuntu e devolverá o arquivo mesclado para você baixar aqui.";
        btnEnviar.textContent = "🔄 Mesclar PC + Celular";
      }} else {{
        tituloUpload.textContent = "2. Enviar backup do Celular para o PC";
        descUpload.innerHTML = "Selecione o <strong>.json</strong> exportado em <em>Configurações → Exportar Tudo</em> no celular para atualizar o Ubuntu.";
        btnEnviar.textContent = "📤 Enviar para o PC Ubuntu";
      }}
    }}
  }}

  document.querySelectorAll(".btn-dir").forEach((btn) => {{
    btn.addEventListener("click", async () => {{
      direcao = btn.dataset.dir;
      atualizarUI();
      try {{
        await fetch("/sync/direcao?token=" + encodeURIComponent(TOKEN), {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ direcao }})
        }});
      }} catch (_e) {{}}
    }});
  }});

  inpArq.addEventListener("change", () => {{
    arquivoSelecionado = inpArq.files && inpArq.files[0] ? inpArq.files[0] : null;
    btnEnviar.disabled = !arquivoSelecionado;
  }});

  btnBaixarPc.addEventListener("click", async () => {{
    btnBaixarPc.disabled = true;
    setStatus("info", "Baixando backup do PC...");
    try {{
      const resp = await fetch("/sync/download?token=" + encodeURIComponent(TOKEN));
      if (!resp.ok) {{
        const err = await resp.json().catch(() => ({{}}));
        throw new Error(err.erro || "Falha ao baixar backup.");
      }}
      const texto = await resp.text();
      const blob = new Blob([texto], {{ type: "application/json;charset=utf-8" }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ponto-e-trama-pc-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus("ok", "✓ Backup do PC baixado! Agora importe este arquivo no app Ponto & Trama em Configurações → Importar Arquivo.");
    }} catch (e) {{
      setStatus("erro", "Erro: " + (e.message || e));
      btnBaixarPc.disabled = false;
    }}
  }});

  btnEnviar.addEventListener("click", async () => {{
    if (!arquivoSelecionado) return;
    btnEnviar.disabled = true;
    setStatus("info", "Validando e enviando dados ao PC...");
    try {{
      const texto = await arquivoSelecionado.text();
      JSON.parse(texto); // pré-validação rápida no navegador
      const resp = await fetch("/sync/upload?token=" + encodeURIComponent(TOKEN) + "&direcao=" + encodeURIComponent(direcao), {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: texto
      }});
      const res = await resp.json();
      if (!resp.ok || !res.ok) {{
        throw new Error(res.erro || "Falha na sincronização.");
      }}
      if (direcao === "mesclar" && res.pacote_mesclado) {{
        const blob = new Blob([JSON.stringify(res.pacote_mesclado, null, 2)], {{ type: "application/json;charset=utf-8" }});
        if (blobMescladoUrl) URL.revokeObjectURL(blobMescladoUrl);
        blobMescladoUrl = URL.createObjectURL(blob);
        btnBaixarMesclado.style.display = "inline-flex";
        btnBaixarMesclado.onclick = () => {{
          const a = document.createElement("a");
          a.href = blobMescladoUrl;
          a.download = "ponto-e-trama-mesclado-" + new Date().toISOString().slice(0, 10) + ".json";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }};
        btnBaixarMesclado.click();
        setStatus("ok", "✓ Merge concluído no PC (" + (res.resumo_texto || "atualizado") + ")! Baixe o arquivo mesclado acima e importe no app do celular para finalizar.");
      }} else {{
        setStatus("ok", "✓ Sincronização concluída! O PC Ubuntu foi atualizado com segurança (backup pré-sync salvo automaticamente).");
      }}
    }} catch (e) {{
      setStatus("erro", "Erro na validação/envio: " + (e.message || e));
      btnEnviar.disabled = false;
    }}
  }});

  atualizarUI();
}})();
</script>
</body>
</html>"""
    return pagina.encode("utf-8")


# ============================================================================
# 5. GERENCIADOR DA SESSÃO & SERVIDOR TEMPORÁRIO WI-FI (RF01, RF05, RNF01/04)
# ============================================================================

class GerenciadorSyncWifi:
    TTL_SEGUNDOS = 300  # 5 minutos (RNF01)

    def __init__(
        self,
        database_dir: Path,
        exportar_fn: Callable[[], dict],
        aplicar_fn: Callable[[dict], dict],
    ) -> None:
        self.database_dir = database_dir
        self.exportar_fn = exportar_fn
        self.aplicar_fn = aplicar_fn
        self.backup_path = database_dir / "backup_pre_sync.json"

        self._lock = threading.RLock()
        self._servidor: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._timer_expirar: threading.Timer | None = None
        self._timer_fechar: threading.Timer | None = None

        self._ativo = False
        self._token = ""
        self._ip = ""
        self._tem_lan = False
        self._porta = 0
        self._url = ""
        self._qr_svg = ""
        self._direcao = "mesclar"  # pc_para_celular | celular_para_pc | mesclar
        self._preferencias_pc: dict = {}
        self._status = "inativo"  # inativo | aguardando | conectado | transferindo | concluido | erro | expirado
        self._mensagem = ""
        self._iniciado_em = 0.0
        self._expira_em = 0.0
        self._ultima_stats: dict = {}
        self._preferencias_recebidas: dict | None = None

    def iniciar(self, direcao: str = "mesclar", preferencias_pc: dict | None = None) -> dict:
        with self._lock:
            self._encerrar_interno(resetar_status=False)

            if direcao not in ("pc_para_celular", "celular_para_pc", "mesclar"):
                direcao = "mesclar"

            ip, tem_lan = detectar_ip_wifi_local()
            token = secrets.token_urlsafe(18)

            gerenciador = self

            class SyncWifiHandler(BaseHTTPRequestHandler):
                protocol_version = "HTTP/1.1"

                def log_message(self, fmt: str, *args) -> None:
                    return

                def _enviar(self, corpo: bytes, content_type: str, status: int = HTTPStatus.OK, extra_headers: dict[str, str] | None = None) -> None:
                    self.send_response(status)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(corpo)))
                    self.send_header("Cache-Control", "no-store")
                    if extra_headers:
                        for k, v in extra_headers.items():
                            self.send_header(k, v)
                    self.end_headers()
                    self.wfile.write(corpo)

                def _enviar_json(self, obj: dict, status: int = HTTPStatus.OK) -> None:
                    self._enviar(
                        json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                        "application/json; charset=utf-8",
                        status=status,
                    )

                def _validar_token(self) -> bool:
                    qs = parse_qs(urlparse(self.path).query)
                    tok = (qs.get("token") or [""])[0]
                    return gerenciador.validar_token(tok)

                def do_GET(self) -> None:
                    parsed = urlparse(self.path)
                    if not self._validar_token():
                        self._enviar(
                            b"<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;background:#0d1c42;color:#fcf1d0;padding:32px;text-align:center'><h2>Sessao expirada ou token invalido</h2><p>Gere um novo QR Code no Ponto &amp; Trama no PC.</p></body>",
                            "text/html; charset=utf-8",
                            status=HTTPStatus.UNAUTHORIZED,
                        )
                        return

                    if parsed.path in ("/", "/sync"):
                        gerenciador.registrar_conexao_celular()
                        dados_pc = gerenciador.exportar_fn()
                        resumo = {col: len(dados_pc.get(col) or []) for col in COLECOES_SYNC}
                        pagina = _renderizar_pagina_mobile(gerenciador._token, gerenciador._direcao, resumo)
                        self._enviar(pagina, "text/html; charset=utf-8")
                        return

                    if parsed.path == "/sync/download":
                        pacote = gerenciador.preparar_download_pc()
                        corpo = json.dumps(pacote, ensure_ascii=False, indent=2).encode("utf-8")
                        self._enviar(
                            corpo,
                            "application/json; charset=utf-8",
                            extra_headers={"Content-Disposition": 'attachment; filename="ponto-e-trama-pc.json"'},
                        )
                        gerenciador.concluir_e_agendar_fechamento("Backup enviado do PC para o celular com sucesso!")
                        return

                    self._enviar_json({"erro": "Rota não encontrada"}, HTTPStatus.NOT_FOUND)

                def do_POST(self) -> None:
                    parsed = urlparse(self.path)
                    if not self._validar_token():
                        self._enviar_json({"ok": False, "erro": "Token inválido ou expirado."}, HTTPStatus.UNAUTHORIZED)
                        return

                    tamanho = int(self.headers.get("Content-Length", "0") or 0)
                    if tamanho > 40 * 1024 * 1024:
                        self._enviar_json({"ok": False, "erro": "Arquivo muito grande (máx. 40 MB)."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                        return
                    bruto = self.rfile.read(tamanho) if tamanho > 0 else b"{}"

                    if parsed.path == "/sync/direcao":
                        try:
                            payload = json.loads(bruto.decode("utf-8"))
                            nova_dir = str(payload.get("direcao") or "")
                            gerenciador.alterar_direcao(nova_dir)
                            self._enviar_json({"ok": True, "direcao": gerenciador._direcao})
                        except Exception:
                            self._enviar_json({"ok": False, "erro": "Requisição inválida."}, HTTPStatus.BAD_REQUEST)
                        return

                    if parsed.path == "/sync/upload":
                        qs = parse_qs(urlparse(self.path).query)
                        dir_req = (qs.get("direcao") or [gerenciador._direcao])[0]
                        try:
                            payload = json.loads(bruto.decode("utf-8"))
                        except json.JSONDecodeError:
                            self._enviar_json({"ok": False, "erro": "Arquivo JSON corrompido ou malformado."}, HTTPStatus.BAD_REQUEST)
                            return

                        ok, msg, extra = gerenciador.processar_upload_celular(payload, dir_req)
                        if not ok:
                            self._enviar_json({"ok": False, "erro": msg}, HTTPStatus.BAD_REQUEST)
                            return
                        self._enviar_json({"ok": True, "mensagem": msg, **extra})
                        gerenciador.concluir_e_agendar_fechamento(msg)
                        return

                    self._enviar_json({"erro": "Rota não encontrada"}, HTTPStatus.NOT_FOUND)

            servidor = ThreadingHTTPServer(("0.0.0.0", 0), SyncWifiHandler)
            porta = servidor.server_address[1]
            url = f"http://{ip}:{porta}/sync?token={token}"
            qr_svg = gerar_qr_svg(url)

            self._servidor = servidor
            self._thread = threading.Thread(target=servidor.serve_forever, daemon=True, name="PontoTramaSyncWifi")
            self._thread.start()

            agora = time.time()
            self._ativo = True
            self._token = token
            self._ip = ip
            self._tem_lan = tem_lan
            self._porta = porta
            self._url = url
            self._qr_svg = qr_svg
            self._direcao = direcao
            self._preferencias_pc = dict(preferencias_pc) if isinstance(preferencias_pc, dict) else {}
            self._status = "aguardando"
            self._mensagem = (
                "Aguardando conexão do celular no Wi-Fi..."
                if tem_lan
                else "Nenhuma rede Wi-Fi detectada (escutando apenas em 127.0.0.1). Conecte o PC ao Wi-Fi."
            )
            self._iniciado_em = agora
            self._expira_em = agora + self.TTL_SEGUNDOS
            self._ultima_stats = {}
            self._preferencias_recebidas = None

            self._timer_expirar = threading.Timer(self.TTL_SEGUNDOS, self._ao_expirar)
            self._timer_expirar.daemon = True
            self._timer_expirar.start()

            return self.obter_status()

    def validar_token(self, token_recebido: str) -> bool:
        with self._lock:
            if not self._ativo or not self._token:
                return False
            if time.time() > self._expira_em:
                self._status = "expirado"
                self._mensagem = "Sessão expirada após 5 minutos. Inicie novamente se precisar."
                self._encerrar_interno(resetar_status=False)
                return False
            return secrets.compare_digest(self._token, token_recebido or "")

    def alterar_direcao(self, nova_direcao: str) -> dict:
        with self._lock:
            if nova_direcao in ("pc_para_celular", "celular_para_pc", "mesclar"):
                self._direcao = nova_direcao
            return self.obter_status()

    def registrar_conexao_celular(self) -> None:
        with self._lock:
            if self._status == "aguardando":
                self._status = "conectado"
                self._mensagem = "Celular conectado! Escolha ou confirme a ação no celular."

    def preparar_download_pc(self) -> dict:
        with self._lock:
            self._status = "transferindo"
            self._mensagem = "Transferindo backup do PC para o celular..."
            dados = self.exportar_fn()
            return {
                "app": "Ponto & Trama",
                "versao": "1.0.0",
                "exportado_em": datetime.now(timezone.utc).isoformat(),
                "preferencias": self._preferencias_pc or None,
                "dados": dados,
            }

    def salvar_backup_pre_sync(self, origem_acao: str) -> Path:
        """RF06: Salva backup_pre_sync.json antes de qualquer sobrescrita no PC."""
        dados_atuais = self.exportar_fn()
        pacote = {
            "app": "Ponto & Trama",
            "versao": "1.0.0",
            "tipo": "backup_pre_sync",
            "origem_acao": origem_acao,
            "criado_em": datetime.now(timezone.utc).isoformat(),
            "preferencias": self._preferencias_pc or None,
            "dados": dados_atuais,
        }
        self.database_dir.mkdir(parents=True, exist_ok=True)
        self.backup_path.write_text(json.dumps(pacote, ensure_ascii=False, indent=2), encoding="utf-8")
        return self.backup_path

    def processar_upload_celular(self, payload: Any, direcao_req: str) -> tuple[bool, str, dict]:
        with self._lock:
            self._status = "transferindo"
            self._mensagem = "Validando schema e transferindo dados do celular..."

            ok, erro, pkg_remoto = validar_pacote_json(payload)
            if not ok or pkg_remoto is None:
                self._status = "erro"
                self._mensagem = f"Arquivo rejeitado na validação: {erro}"
                return False, erro, {}

            if direcao_req not in ("celular_para_pc", "mesclar"):
                direcao_req = self._direcao if self._direcao in ("celular_para_pc", "mesclar") else "mesclar"

            # RF06: Backup automático antes de sobrescrever qualquer dado no PC
            self.salvar_backup_pre_sync(direcao_req)

            if direcao_req == "mesclar":
                pkg_local = {
                    "app": "Ponto & Trama",
                    "versao": "1.0.0",
                    "exportado_em": datetime.now(timezone.utc).isoformat(),
                    "preferencias": self._preferencias_pc or None,
                    "dados": self.exportar_fn(),
                }
                pkg_final, stats = mesclar_pacotes(pkg_local, pkg_remoto)
                resumo_db = self.aplicar_fn(pkg_final["dados"])
                self._preferencias_recebidas = pkg_final.get("preferencias")
                self._ultima_stats = {**stats, **resumo_db}
                resumo_txt = (
                    f"{stats['adicionados_do_celular']} novo(s), "
                    f"{stats['atualizados_do_celular']} atualizado(s), "
                    f"{stats['mantidos_pc']} mantido(s) do PC"
                )
                return True, f"Merge concluído ({resumo_txt})!", {
                    "resumo_texto": resumo_txt,
                    "stats": self._ultima_stats,
                    "pacote_mesclado": pkg_final,
                }

            # celular_para_pc
            resumo_db = self.aplicar_fn(pkg_remoto["dados"])
            self._preferencias_recebidas = pkg_remoto.get("preferencias")
            total = sum(resumo_db.values())
            self._ultima_stats = {"total_importado": total, **resumo_db}
            return True, f"PC atualizado com {total} registro(s) do celular!", {
                "resumo_texto": f"{total} registro(s) importado(s)",
                "stats": self._ultima_stats,
            }

    def concluir_e_agendar_fechamento(self, mensagem: str) -> None:
        with self._lock:
            self._status = "concluido"
            self._mensagem = mensagem
            # RNF01 + RNF04: invalida token de uso único e encerra servidor após entregar resposta HTTP
            self._token = ""
            if self._timer_fechar:
                self._timer_fechar.cancel()
            self._timer_fechar = threading.Timer(1.5, lambda: self._encerrar_interno(resetar_status=False))
            self._timer_fechar.daemon = True
            self._timer_fechar.start()

    def _ao_expirar(self) -> None:
        with self._lock:
            if self._ativo and self._status in ("aguardando", "conectado"):
                self._status = "expirado"
                self._mensagem = "Token temporário expirado (5 min). Gere um novo QR Code se precisar."
                self._encerrar_interno(resetar_status=False)

    def encerrar(self) -> dict:
        with self._lock:
            self._encerrar_interno(resetar_status=True)
            return self.obter_status()

    def _encerrar_interno(self, resetar_status: bool = True) -> None:
        if self._timer_expirar:
            self._timer_expirar.cancel()
            self._timer_expirar = None
        if self._timer_fechar:
            self._timer_fechar.cancel()
            self._timer_fechar = None

        srv = self._servidor
        self._servidor = None
        self._thread = None
        self._ativo = False
        self._token = ""

        if srv is not None:
            def _desligar(s: ThreadingHTTPServer) -> None:
                try:
                    s.shutdown()
                    s.server_close()
                except Exception:
                    pass
            threading.Thread(target=_desligar, args=(srv,), daemon=True).start()

        if resetar_status:
            self._status = "inativo"
            self._mensagem = "Servidor de sincronização encerrado."
            self._url = ""
            self._qr_svg = ""
            self._porta = 0

    def info_rollback(self) -> dict:
        if not self.backup_path.exists():
            return {"disponivel": False}
        try:
            raw = json.loads(self.backup_path.read_text(encoding="utf-8"))
            dados = raw.get("dados") or {}
            return {
                "disponivel": True,
                "arquivo": self.backup_path.name,
                "criado_em": raw.get("criado_em") or "",
                "origem_acao": raw.get("origem_acao") or "",
                "contagem": {col: len(dados.get(col) or []) for col in COLECOES_SYNC},
            }
        except Exception:
            return {"disponivel": False}

    def executar_rollback(self) -> tuple[bool, str, dict | None]:
        """RF06: Restaura backup_pre_sync.json no SQLite."""
        with self._lock:
            if not self.backup_path.exists():
                return False, "Nenhum backup pré-sincronização encontrado.", None
            try:
                raw = json.loads(self.backup_path.read_text(encoding="utf-8"))
                ok, erro, pkg = validar_pacote_json(raw)
                if not ok or pkg is None:
                    return False, f"Backup de rollback inválido: {erro}", None
                resumo = self.aplicar_fn(pkg["dados"])
                return True, "Sincronização desfeita! Dados restaurados para o estado anterior.", {
                    "resumo": resumo,
                    "preferencias": pkg.get("preferencias"),
                }
            except Exception as exc:
                return False, f"Erro ao restaurar rollback: {exc}", None

    def obter_status(self) -> dict:
        with self._lock:
            agora = time.time()
            restante = max(0, int(round(self._expira_em - agora))) if self._ativo else 0
            segundos_esperando = int(agora - self._iniciado_em) if (self._ativo and self._status == "aguardando") else 0
            return {
                "ativo": self._ativo,
                "status": self._status,
                "mensagem": self._mensagem,
                "ip": self._ip,
                "tem_lan": self._tem_lan,
                "porta": self._porta,
                "url": self._url,
                "qr_svg": self._qr_svg if self._ativo else "",
                "direcao": self._direcao,
                "expira_em_seg": restante,
                "segundos_esperando": segundos_esperando,
                "mostrar_diagnostico_rede": (self._status == "aguardando" and segundos_esperando >= 10) or (self._ativo and not self._tem_lan),
                "stats": self._ultima_stats,
                "preferencias_recebidas": self._preferencias_recebidas if self._status == "concluido" else None,
                "rollback": self.info_rollback(),
            }
