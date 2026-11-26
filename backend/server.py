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

import gzip
import json
import mimetypes
import os
import sqlite3
import sys
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
import sync_wifi  # noqa: E402
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
FRONTEND_RESOLVED = FRONTEND_DIR.resolve()
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"

_THREAD_LOCAL = threading.local()
_CACHE_ESTATICOS: dict[str, tuple[int, str, str, bytes, bytes | None]] = {}
_TIPOS_COMPRESSIVEIS = ("text/", "application/javascript", "application/json", "image/svg+xml")


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
    """Mantém conexão SQLite persistente por thread (elimina overhead de abrir + PRAGMAs por requisição)."""
    db_str = str(DB_PATH)
    conn: sqlite3.Connection | None = getattr(_THREAD_LOCAL, "conn", None)
    conn_path: str | None = getattr(_THREAD_LOCAL, "db_path", None)
    if conn is not None and conn_path == db_str:
        return conn
    if conn is not None:
        try:
            conn.close()
        except sqlite3.Error:
            pass
    conn = sqlite3.connect(db_str, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.execute("PRAGMA cache_size = -8000;")
    _THREAD_LOCAL.conn = conn
    _THREAD_LOCAL.db_path = db_str
    return conn


def inicializar_banco() -> None:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with conectar_banco() as conn:
        # Migração segura ANTES do schema.sql para bancos SQLite antigos que já possuem `projetos`
        cols_existentes = {
            row["name"] for row in conn.execute("PRAGMA table_info(projetos)").fetchall()
        }
        if cols_existentes:
            colunas_migracao = [
                ("categoria", "TEXT NOT NULL DEFAULT 'amigurumi'"),
                ("foto_capa", "TEXT DEFAULT ''"),
                ("data_inicio", "TEXT DEFAULT ''"),
                ("prazo_estimado", "TEXT DEFAULT ''"),
                ("progresso_modo", "TEXT NOT NULL DEFAULT 'auto'"),
                ("progresso_manual", "INTEGER NOT NULL DEFAULT 0"),
                ("tempo_gasto_seg", "INTEGER NOT NULL DEFAULT 0"),
                ("arquivado", "INTEGER NOT NULL DEFAULT 0"),
                ("dados_json", "TEXT NOT NULL DEFAULT '{}'"),
            ]
            for nome_col, definicao in colunas_migracao:
                if nome_col not in cols_existentes:
                    conn.execute(f"ALTER TABLE projetos ADD COLUMN {nome_col} {definicao}")
            conn.commit()
        cols_fios = {
            row["name"] for row in conn.execute("PRAGMA table_info(fios)").fetchall()
        }
        if cols_fios and "cor_hex" not in cols_fios:
            conn.execute("ALTER TABLE fios ADD COLUMN cor_hex TEXT DEFAULT ''")
            conn.commit()
        conn.executescript(schema_sql)
        conn.commit()


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
    elif colecao == "projetos":
        d["arquivado"] = bool(d.get("arquivado", 0))
        d["progresso_manual"] = int(d.get("progresso_manual") or 0)
        d["tempo_gasto_seg"] = int(d.get("tempo_gasto_seg") or 0)
        bruto = d.pop("dados_json", "{}") or "{}"
        try:
            extras = json.loads(bruto)
            if not isinstance(extras, dict):
                extras = {}
        except json.JSONDecodeError:
            extras = {}
        d["tecnica"] = extras.get("tecnica") if extras.get("tecnica") in ("croche", "trico") else "croche"
        d["etapas"] = extras.get("etapas") if isinstance(extras.get("etapas"), list) else []
        d["materiais"] = extras.get("materiais") if isinstance(extras.get("materiais"), dict) else {"fios": [], "agulha_id": d.get("agulha_id"), "agulha_mm": "", "agulha_nome": ""}
        d["contadores"] = extras.get("contadores") if isinstance(extras.get("contadores"), list) else []
        d["receita"] = extras.get("receita") if isinstance(extras.get("receita"), dict) else {"modo": "texto", "texto": "", "linha_atual": 0, "arquivo_nome": "", "arquivo_tipo": "", "arquivo_url": "", "regua_pct": 18}
        d["galeria"] = extras.get("galeria") if isinstance(extras.get("galeria"), list) else []
        d["amostra"] = extras.get("amostra") if isinstance(extras.get("amostra"), dict) else {}
        d["precificacao"] = extras.get("precificacao") if isinstance(extras.get("precificacao"), dict) else {}
        d["grafico"] = extras.get("grafico") if isinstance(extras.get("grafico"), dict) else {}
    return d


def listar_colecao(conn: sqlite3.Connection, colecao: str) -> list[dict]:
    rows = conn.execute(f"SELECT * FROM {colecao} ORDER BY id DESC").fetchall()
    return [linha_para_dict(colecao, r) for r in rows]


def exportar_todas_colecoes() -> dict:
    with conectar_banco() as conn:
        return {
            "fios": listar_colecao(conn, "fios"),
            "itens_biblioteca": listar_colecao(conn, "itens_biblioteca"),
            "banco_amostras": listar_colecao(conn, "banco_amostras"),
            "projetos": listar_colecao(conn, "projetos"),
        }


def substituir_todas_colecoes(dados: dict) -> dict:
    """Substitui atomicamente todas as coleções no SQLite mantendo integridade de FKs."""
    resumo = {"fios": 0, "itens_biblioteca": 0, "banco_amostras": 0, "projetos": 0}
    with conectar_banco() as conn:
        conn.execute("DELETE FROM projetos")
        conn.execute("DELETE FROM banco_amostras")
        conn.execute("DELETE FROM itens_biblioteca")
        conn.execute("DELETE FROM fios")
        for col in ("fios", "itens_biblioteca", "banco_amostras", "projetos"):
            itens = dados.get(col) if isinstance(dados.get(col), list) else []
            for item in itens:
                if isinstance(item, dict):
                    copia = dict(item)
                    copia.pop("id", None)
                    inserir_ou_atualizar(conn, col, copia, None)
                    resumo[col] += 1
        conn.commit()
    return resumo


SYNC_MANAGER = sync_wifi.GerenciadorSyncWifi(
    database_dir=DATABASE_DIR,
    exportar_fn=exportar_todas_colecoes,
    aplicar_fn=substituir_todas_colecoes,
)


def inserir_ou_atualizar(conn: sqlite3.Connection, colecao: str, dados: dict, id_url: int | None = None) -> dict:
    agora = agora_iso()
    item_id = id_url if id_url is not None else dados.get("id")
    if item_id in ("", None):
        item_id = None
    else:
        item_id = int(item_id)

    if colecao == "fios":
        colunas = [
            "nome", "marca", "cor_nome", "cor_codigo", "cor_hex", "lote", "imagem_url",
            "tex", "composicao", "peso_novelo_g", "metragem_novelo_m", "agulha",
            "quantidade", "peso_restante_g", "preco_pago", "localizacao", "observacoes",
            "atualizado_em",
        ]
        valores = [
            str(dados.get("nome") or "").strip(),
            str(dados.get("marca") or "").strip(),
            str(dados.get("cor_nome") or "").strip(),
            str(dados.get("cor_codigo") or "").strip(),
            str(dados.get("cor_hex") or "").strip(),
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
        status_val = str(dados.get("status") or "na_fila").strip()
        if status_val not in ("na_fila", "em_andamento", "pausado", "concluido"):
            status_val = "na_fila"
        categoria_val = str(dados.get("categoria") or "amigurumi").strip()
        progresso_modo = str(dados.get("progresso_modo") or "auto").strip()
        if progresso_modo not in ("auto", "manual"):
            progresso_modo = "auto"

        agulha_id = dados.get("agulha_id")
        if agulha_id in ("", None):
            agulha_id = None
        else:
            try:
                agulha_id = int(agulha_id)
                if not conn.execute("SELECT 1 FROM itens_biblioteca WHERE id = ?", (agulha_id,)).fetchone():
                    agulha_id = None
            except (TypeError, ValueError):
                agulha_id = None

        amostra_id = dados.get("amostra_id")
        if amostra_id in ("", None):
            amostra_id = None
        else:
            try:
                amostra_id = int(amostra_id)
                if not conn.execute("SELECT 1 FROM banco_amostras WHERE id = ?", (amostra_id,)).fetchone():
                    amostra_id = None
            except (TypeError, ValueError):
                amostra_id = None

        extras_obj = {
            "tecnica": "trico" if str(dados.get("tecnica") or "").strip() == "trico" else "croche",
            "etapas": dados.get("etapas") if isinstance(dados.get("etapas"), list) else [],
            "materiais": dados.get("materiais") if isinstance(dados.get("materiais"), dict) else {"fios": [], "agulha_id": agulha_id, "agulha_mm": "", "agulha_nome": ""},
            "contadores": dados.get("contadores") if isinstance(dados.get("contadores"), list) else [],
            "receita": dados.get("receita") if isinstance(dados.get("receita"), dict) else {},
            "galeria": dados.get("galeria") if isinstance(dados.get("galeria"), list) else [],
            "amostra": dados.get("amostra") if isinstance(dados.get("amostra"), dict) else {},
            "precificacao": dados.get("precificacao") if isinstance(dados.get("precificacao"), dict) else {},
            "grafico": dados.get("grafico") if isinstance(dados.get("grafico"), dict) else {},
        }

        prazo = str(dados.get("prazo_estimado") or dados.get("data_entrega") or "").strip()
        colunas = [
            "nome", "categoria", "cliente", "status", "foto_capa",
            "data_inicio", "prazo_estimado", "data_entrega",
            "progresso_modo", "progresso_manual", "tempo_gasto_seg", "arquivado",
            "agulha_id", "amostra_id", "observacoes", "dados_json", "atualizado_em",
        ]
        valores = [
            str(dados.get("nome") or "").strip(),
            categoria_val,
            str(dados.get("cliente") or "").strip(),
            status_val,
            dados.get("foto_capa") or "",
            str(dados.get("data_inicio") or "").strip(),
            prazo,
            prazo,
            progresso_modo,
            max(0, min(100, int(round(float(dados.get("progresso_manual") or 0))))),
            max(0, int(round(float(dados.get("tempo_gasto_seg") or 0)))),
            1 if dados.get("arquivado") else 0,
            agulha_id,
            amostra_id,
            str(dados.get("observacoes") or "").strip(),
            json.dumps(extras_obj, ensure_ascii=False),
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
        # Evita overhead de I/O em cada arquivo estático; loga apenas API/erros ou modo verbose
        if os.environ.get("PONTO_TRAMA_VERBOSE") == "1" or self.path.startswith("/api/"):
            sys.stdout.write(f"[Ponto&Trama] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}\n")

    def _aceita_gzip(self) -> bool:
        return "gzip" in (self.headers.get("Accept-Encoding") or "").lower()

    def enviar_json(self, payload, status: int = HTTPStatus.OK) -> None:
        corpo = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        usar_gzip = len(corpo) > 512 and self._aceita_gzip()
        dados_envio = gzip.compress(corpo, compresslevel=5) if usar_gzip else corpo
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if usar_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(dados_envio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dados_envio)

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
        try:
            alvo.relative_to(FRONTEND_RESOLVED)
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Acesso negado")
            return

        if alvo.is_dir():
            alvo = alvo / "index.html"

        try:
            stat = alvo.stat()
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "Arquivo não encontrado")
            return

        chave = str(alvo)
        mtime = stat.st_mtime_ns
        cached = _CACHE_ESTATICOS.get(chave)
        if cached and cached[0] == mtime:
            _, mime, etag, bruto, comprimido = cached
        else:
            mime, _ = mimetypes.guess_type(chave)
            if not mime:
                mime = "application/octet-stream"
            eh_texto = mime.startswith(_TIPOS_COMPRESSIVEIS)
            if mime.startswith("text/") or mime in ("application/javascript", "application/json"):
                mime = f"{mime}; charset=utf-8"
            bruto = alvo.read_bytes()
            comprimido = gzip.compress(bruto, compresslevel=6) if eh_texto and len(bruto) > 512 else None
            etag = f'W/"{mtime:x}-{len(bruto):x}"'
            _CACHE_ESTATICOS[chave] = (mtime, mime, etag, bruto, comprimido)

        if self.headers.get("If-None-Match") == etag:
            self.send_response(HTTPStatus.NOT_MODIFIED)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            return

        usar_gzip = comprimido is not None and self._aceita_gzip()
        dados_envio = comprimido if usar_gzip else bruto
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("ETag", etag)
        if usar_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(dados_envio)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(dados_envio)

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
        path_limpo = parsed.path.rstrip("/")
        try:
            if path_limpo == "/api/sync/status":
                self.enviar_json(SYNC_MANAGER.obter_status())
                return

            if path_limpo == "/api/sync/rollback-info":
                self.enviar_json(SYNC_MANAGER.info_rollback())
                return

            if rota == "saude":
                self.enviar_json({"ok": True, "banco": "sqlite", "arquivo": str(DB_PATH.name)})
                return

            if rota == "tudo":
                with conectar_banco() as conn:
                    self.enviar_json({
                        "fios": listar_colecao(conn, "fios"),
                        "itens_biblioteca": listar_colecao(conn, "itens_biblioteca"),
                        "banco_amostras": listar_colecao(conn, "banco_amostras"),
                        "projetos": listar_colecao(conn, "projetos"),
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
        path_limpo = urlparse(self.path).path.rstrip("/")
        try:
            corpo = self.ler_json_corpo()

            # Endpoints de Sincronização Wi-Fi Local (RF01-RF06, RNF01-RNF05)
            if path_limpo == "/api/sync/iniciar":
                direcao = corpo.get("direcao", "mesclar") if isinstance(corpo, dict) else "mesclar"
                prefs_pc = corpo.get("preferencias") if isinstance(corpo, dict) else None
                status_sync = SYNC_MANAGER.iniciar(direcao=str(direcao), preferencias_pc=prefs_pc)
                self.enviar_json(status_sync)
                return

            if path_limpo == "/api/sync/direcao":
                direcao = corpo.get("direcao", "mesclar") if isinstance(corpo, dict) else "mesclar"
                self.enviar_json(SYNC_MANAGER.alterar_direcao(str(direcao)))
                return

            if path_limpo == "/api/sync/encerrar":
                self.enviar_json(SYNC_MANAGER.encerrar())
                return

            if path_limpo == "/api/sync/rollback":
                ok, msg, extra = SYNC_MANAGER.executar_rollback()
                if not ok:
                    self.enviar_json({"ok": False, "erro": msg}, HTTPStatus.BAD_REQUEST)
                    return
                self.enviar_json({"ok": True, "mensagem": msg, **(extra or {})})
                return

            # Importação inicial em lote (migração automática do IndexedDB -> SQLite)
            if rota == "sincronizar-inicial" and isinstance(corpo, dict):
                inseridos = {}
                with conectar_banco() as conn:
                    for col in ("fios", "itens_biblioteca", "banco_amostras", "projetos"):
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
                        "projetos": listar_colecao(conn, "projetos"),
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
        if rota not in COLECOES_PERMITIDAS:
            self.enviar_json({"erro": "Coleção inválida"}, HTTPStatus.BAD_REQUEST)
            return
        if item_id is not None and item_id < 0:
            self.enviar_json({"erro": "ID inválido"}, HTTPStatus.BAD_REQUEST)
            return
        try:
            with conectar_banco() as conn:
                if item_id is None:
                    conn.execute(f"DELETE FROM {rota}")
                    conn.commit()
                    self.enviar_json({"ok": True, "limpo": rota})
                else:
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
        SYNC_MANAGER.encerrar()
        servidor.server_close()


if __name__ == "__main__":
    main()
