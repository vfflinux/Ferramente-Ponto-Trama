#!/usr/bin/env python3
"""
Ponto & Trama — Servidor Local + Banco de Dados SQL (SQLite)
100% local/offline, sem dependências externas (apenas biblioteca padrão do Python).

Uso:
    python3 backend/server.py
Acesse no navegador:
    http://127.0.0.1:8080/
"""

from __future__ import annotations

import json
import mimetypes
import os
import sqlite3
import sys
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"


def resolver_diretorio_dados() -> Path:
    """Usa `backend/database/` no modo desenvolvimento; se instalado em `/opt` (somente leitura), usa `~/.local/share/ponto-e-trama/`."""
    env_dir = os.environ.get("PONTO_TRAMA_DATA_DIR")
    if env_dir:
        p = Path(env_dir).expanduser()
        p.mkdir(parents=True, exist_ok=True)
        return p

    dev_dir = BASE_DIR / "database"
    try:
        dev_dir.mkdir(parents=True, exist_ok=True)
        if os.access(dev_dir, os.W_OK):
            return dev_dir
    except OSError:
        pass

    user_dir = Path.home() / ".local" / "share" / "ponto-e-trama"
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


DATABASE_DIR = resolver_diretorio_dados()
DB_PATH = DATABASE_DIR / "ponto_e_trama.db"

HOST = os.environ.get("PONTO_TRAMA_HOST", "127.0.0.1")
PORT = int(os.environ.get("PONTO_TRAMA_PORT", "8080"))

COLECOES_PERMITIDAS = {"fios", "itens_biblioteca", "banco_amostras", "projetos"}


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def conectar_banco() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def inicializar_banco() -> None:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with conectar_banco() as conn:
        conn.executescript(schema_sql)


# ---------------------------------------------------------------------------
# Serialização / Desserialização limpa entre SQLite e o Front-End
# ---------------------------------------------------------------------------
def linha_para_dict(colecao: str, row: sqlite3.Row) -> dict:
    d = dict(row)
    if colecao == "itens_biblioteca":
        bruto = d.pop("atributos_json", "{}") or "{}"
        try:
            d["atributos"] = json.loads(bruto)
        except json.JSONDecodeError:
            d["atributos"] = {}
    elif colecao == "banco_amostras":
        d["favorito"] = bool(d.get("favorito", 0))
    return d


def listar_colecao(conn: sqlite3.Connection, colecao: str) -> list[dict]:
    rows = conn.execute(f"SELECT * FROM {colecao} ORDER BY id DESC").fetchall()
    return [linha_para_dict(colecao, r) for r in rows]


def inserir_ou_atualizar(conn: sqlite3.Connection, colecao: str, dados: dict, id_url: int | None = None) -> dict:
    agora = agora_iso()
    item_id = id_url if id_url is not None else dados.get("id")
    if item_id in ("", None):
        item_id = None
    else:
        item_id = int(item_id)

    if colecao == "fios":
        colunas = [
            "nome", "marca", "cor_nome", "cor_codigo", "lote", "imagem_url",
            "tex", "composicao", "peso_novelo_g", "metragem_novelo_m", "agulha",
            "quantidade", "peso_restante_g", "preco_pago", "localizacao", "observacoes",
            "atualizado_em",
        ]
        valores = [
            str(dados.get("nome") or "").strip(),
            str(dados.get("marca") or "").strip(),
            str(dados.get("cor_nome") or "").strip(),
            str(dados.get("cor_codigo") or "").strip(),
            str(dados.get("lote") or "").strip(),
            dados.get("imagem_url") or "",
            dados.get("tex"),
            str(dados.get("composicao") or "").strip(),
            dados.get("peso_novelo_g"),
            dados.get("metragem_novelo_m"),
            str(dados.get("agulha") or "").strip(),
            max(0.0, float(dados.get("quantidade") or 0)),
            dados.get("peso_restante_g"),
            dados.get("preco_pago"),
            str(dados.get("localizacao") or "").strip(),
            str(dados.get("observacoes") or "").strip(),
            dados.get("atualizado_em") or agora,
        ]
    elif colecao == "itens_biblioteca":
        categoria = str(dados.get("categoria") or "agulha").strip()
        if categoria not in ("agulha", "ferramenta", "aviamento"):
            categoria = "agulha"
        atributos = dados.get("atributos")
        if not isinstance(atributos, dict):
            atributos = {}
        colunas = ["nome", "categoria", "foto_url", "observacoes", "atributos_json", "atualizado_em"]
        valores = [
            str(dados.get("nome") or "").strip(),
            categoria,
            dados.get("foto_url") or "",
            str(dados.get("observacoes") or "").strip(),
            json.dumps(atributos, ensure_ascii=False),
            dados.get("atualizado_em") or agora,
        ]
    elif colecao == "banco_amostras":
        tecnica = str(dados.get("tecnica") or "croche").strip()
        if tecnica not in ("croche", "trico"):
            tecnica = "croche"
        tensao = str(dados.get("tensao") or "medio").strip()
        if tensao not in ("apertado", "medio", "solto"):
            tensao = "medio"
        colunas = [
            "nome", "tecnica", "categoria", "tensao", "fio", "agulha_mm",
            "largura_cm", "altura_cm", "pontos", "carreiras", "peso_g", "metros",
            "foto_url", "link_referencia", "anotacoes", "favorito", "atualizado_em",
        ]
        valores = [
            str(dados.get("nome") or "").strip(),
            tecnica,
            str(dados.get("categoria") or "basico").strip(),
            tensao,
            str(dados.get("fio") or "").strip(),
            float(dados.get("agulha_mm") or 4.0),
            max(0.1, float(dados.get("largura_cm") or 10.0)),
            max(0.1, float(dados.get("altura_cm") or 10.0)),
            max(1, int(round(float(dados.get("pontos") or 1)))),
            max(1, int(round(float(dados.get("carreiras") or 1)))),
            dados.get("peso_g"),
            dados.get("metros"),
            dados.get("foto_url") or "",
            str(dados.get("link_referencia") or "").strip(),
            str(dados.get("anotacoes") or "").strip(),
            1 if dados.get("favorito") else 0,
            dados.get("atualizado_em") or agora,
        ]
    elif colecao == "projetos":
        colunas = [
            "nome", "cliente", "status", "data_entrega",
            "agulha_id", "amostra_id", "observacoes", "atualizado_em",
        ]
        valores = [
            str(dados.get("nome") or "").strip(),
            str(dados.get("cliente") or "").strip(),
            str(dados.get("status") or "em_andamento").strip(),
            dados.get("data_entrega"),
            dados.get("agulha_id"),
            dados.get("amostra_id"),
            str(dados.get("observacoes") or "").strip(),
            dados.get("atualizado_em") or agora,
        ]
    else:
        raise ValueError(f"Coleção desconhecida: {colecao}")

    if item_id is not None:
        existe = conn.execute(f"SELECT id FROM {colecao} WHERE id = ?", (item_id,)).fetchone()
        if existe:
            sets = ", ".join(f"{c} = ?" for c in colunas)
            conn.execute(f"UPDATE {colecao} SET {sets} WHERE id = ?", (*valores, item_id))
            row = conn.execute(f"SELECT * FROM {colecao} WHERE id = ?", (item_id,)).fetchone()
            return linha_para_dict(colecao, row)

    criado_em = dados.get("criado_em") or agora
    colunas_ins = [*colunas, "criado_em"]
    valores_ins = [*valores, criado_em]
    placeholders = ", ".join("?" for _ in colunas_ins)
    cols_sql = ", ".join(colunas_ins)
    cur = conn.execute(f"INSERT INTO {colecao} ({cols_sql}) VALUES ({placeholders})", valores_ins)
    novo_id = cur.lastrowid
    row = conn.execute(f"SELECT * FROM {colecao} WHERE id = ?", (novo_id,)).fetchone()
    return linha_para_dict(colecao, row)


class PontoTramaHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        # Log compacto para manter o terminal limpo
        sys.stdout.write(f"[Ponto&Trama] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}\n")

    def enviar_json(self, payload, status: int = HTTPStatus.OK) -> None:
        corpo = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def ler_json_corpo(self) -> dict | list:
        tamanho = int(self.headers.get("Content-Length", "0") or 0)
        if tamanho <= 0:
            return {}
        bruto = self.rfile.read(tamanho)
        return json.loads(bruto.decode("utf-8"))

    def servir_arquivo_estatico(self, caminho_url: str) -> None:
        rel = unquote(caminho_url).lstrip("/")
        if not rel:
            rel = "index.html"

        alvo = (FRONTEND_DIR / rel).resolve()
        # Bloqueia path traversal fora da pasta front-end
        try:
            alvo.relative_to(FRONTEND_DIR.resolve())
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Acesso negado")
            return

        if alvo.is_dir():
            alvo = alvo / "index.html"

        if not alvo.exists() or not alvo.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Arquivo não encontrado")
            return

        mime, _ = mimetypes.guess_type(str(alvo))
        if not mime:
            mime = "application/octet-stream"
        if mime.startswith("text/") or mime in ("application/javascript", "application/json"):
            mime = f"{mime}; charset=utf-8"

        conteudo = alvo.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(conteudo)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(conteudo)

    def parsear_rota_api(self) -> tuple[str | None, int | None]:
        path = urlparse(self.path).path.rstrip("/")
        partes = [p for p in path.split("/") if p]
        # Esperado: ['api', '<rota>'] ou ['api', '<colecao>', '<id>']
        if len(partes) < 2 or partes[0] != "api":
            return None, None
        rota = partes[1]
        item_id = None
        if len(partes) >= 3:
            try:
                item_id = int(partes[2])
            except ValueError:
                item_id = -1
        return rota, item_id

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.servir_arquivo_estatico(parsed.path)
            return

        rota, item_id = self.parsear_rota_api()
        try:
            if rota == "saude":
                self.enviar_json({"ok": True, "banco": "sqlite", "arquivo": str(DB_PATH.name)})
                return

            if rota == "tudo":
                with conectar_banco() as conn:
                    self.enviar_json({
                        "fios": listar_colecao(conn, "fios"),
                        "itens_biblioteca": listar_colecao(conn, "itens_biblioteca"),
                        "banco_amostras": listar_colecao(conn, "banco_amostras"),
                    })
                return

            if rota in COLECOES_PERMITIDAS:
                with conectar_banco() as conn:
                    if item_id is not None:
                        if item_id < 0:
                            self.enviar_json({"erro": "ID inválido"}, HTTPStatus.BAD_REQUEST)
                            return
                        row = conn.execute(f"SELECT * FROM {rota} WHERE id = ?", (item_id,)).fetchone()
                        if not row:
                            self.enviar_json({"erro": "Registro não encontrado"}, HTTPStatus.NOT_FOUND)
                            return
                        self.enviar_json(linha_para_dict(rota, row))
                    else:
                        self.enviar_json(listar_colecao(conn, rota))
                return

            self.enviar_json({"erro": "Endpoint não encontrado"}, HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self.enviar_json({"erro": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        rota, _ = self.parsear_rota_api()
        try:
            corpo = self.ler_json_corpo()

            # Importação inicial em lote (migração automática do IndexedDB -> SQLite)
            if rota == "sincronizar-inicial" and isinstance(corpo, dict):
                inseridos = {}
                with conectar_banco() as conn:
                    for col in ("fios", "itens_biblioteca", "banco_amostras"):
                        itens = corpo.get(col)
                        if not isinstance(itens, list) or not itens:
                            inseridos[col] = 0
                            continue
                        total_atual = conn.execute(f"SELECT COUNT(*) FROM {col}").fetchone()[0]
                        if total_atual > 0:
                            inseridos[col] = 0
                            continue
                        count = 0
                        for item in itens:
                            if isinstance(item, dict):
                                copia = dict(item)
                                copia.pop("id", None)
                                inserir_ou_atualizar(conn, col, copia, None)
                                count += 1
                        inseridos[col] = count
                    conn.commit()
                    self.enviar_json({
                        "ok": True,
                        "migrados": inseridos,
                        "fios": listar_colecao(conn, "fios"),
                        "itens_biblioteca": listar_colecao(conn, "itens_biblioteca"),
                        "banco_amostras": listar_colecao(conn, "banco_amostras"),
                    })
                return

            if rota in COLECOES_PERMITIDAS:
                with conectar_banco() as conn:
                    if isinstance(corpo, list):
                        salvos = [inserir_ou_atualizar(conn, rota, item, None) for item in corpo if isinstance(item, dict)]
                        conn.commit()
                        self.enviar_json(salvos, HTTPStatus.CREATED)
                    elif isinstance(corpo, dict):
                        salvo = inserir_ou_atualizar(conn, rota, corpo, None)
                        conn.commit()
                        self.enviar_json(salvo, HTTPStatus.CREATED)
                    else:
                        self.enviar_json({"erro": "JSON inválido"}, HTTPStatus.BAD_REQUEST)
                return

            self.enviar_json({"erro": "Endpoint não encontrado"}, HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self.enviar_json({"erro": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_PUT(self) -> None:
        rota, item_id = self.parsear_rota_api()
        if rota not in COLECOES_PERMITIDAS or item_id is None or item_id < 0:
            self.enviar_json({"erro": "Coleção ou ID inválido"}, HTTPStatus.BAD_REQUEST)
            return
        try:
            corpo = self.ler_json_corpo()
            if not isinstance(corpo, dict):
                self.enviar_json({"erro": "JSON inválido"}, HTTPStatus.BAD_REQUEST)
                return
            with conectar_banco() as conn:
                salvo = inserir_ou_atualizar(conn, rota, corpo, item_id)
                conn.commit()
            self.enviar_json(salvo)
        except Exception as exc:
            self.enviar_json({"erro": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_DELETE(self) -> None:
        rota, item_id = self.parsear_rota_api()
        if rota not in COLECOES_PERMITIDAS or item_id is None or item_id < 0:
            self.enviar_json({"erro": "Coleção ou ID inválido"}, HTTPStatus.BAD_REQUEST)
            return
        try:
            with conectar_banco() as conn:
                conn.execute(f"DELETE FROM {rota} WHERE id = ?", (item_id,))
                conn.commit()
            self.enviar_json({"ok": True, "id": item_id})
        except Exception as exc:
            self.enviar_json({"erro": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)


def main() -> None:
    inicializar_banco()
    servidor = ThreadingHTTPServer((HOST, PORT), PontoTramaHandler)
    print(f"🧵 Ponto & Trama rodando localmente em: http://{HOST}:{PORT}/")
    print(f"🗄️  Banco SQL (SQLite): {DB_PATH}")
    print("   Pressione Ctrl+C para encerrar.")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
