#!/usr/bin/env python3
"""
Ponto & Trama — Aplicativo Desktop Nativo para Ubuntu (GTK 3 + WebKit2GTK)
- Carrega diretamente `frontend/` e `backend/` (mesma fonte de verdade do Web).
- Sobe o servidor local SQLite embarcado em porta fixa (18420) para preservar
  preferências e dados locais 100% offline.
- Usa a logo oficial (`frontend/assets/images/logo.png`) como ícone da janela e do dock.
"""

from __future__ import annotations

import os
import socket
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
LOGO_PATH = FRONTEND_DIR / "assets" / "images" / "logo.png"

sys.path.insert(0, str(BACKEND_DIR))
import server  # noqa: E402

APP_DATA_DIR = server.DATABASE_DIR / ".app-webview-data"

import gi  # noqa: E402

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GdkPixbuf", "2.0")
gi.require_version("WebKit2", "4.1")

from gi.repository import Gdk, GdkPixbuf, GLib, Gtk, WebKit2  # noqa: E402

APP_ID = "ponto-e-trama"
APP_TITLE = "Ponto & Trama"
HOST = "127.0.0.1"
PORTA_PREFERENCIAL = 18420


def escolher_porta_local() -> int:
    """Prefere uma porta fixa (18420) para manter localStorage persistente entre sessões."""
    for porta in range(PORTA_PREFERENCIAL, PORTA_PREFERENCIAL + 10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((HOST, porta))
                return porta
            except OSError:
                continue
    return 0


def pasta_downloads_usuario() -> Path:
    for nome in ("Downloads", "Transferências"):
        cand = Path.home() / nome
        if cand.exists() and cand.is_dir():
            return cand
    return Path.home()


class PontoTramaDesktopApp:
    def __init__(self) -> None:
        GLib.set_prgname(APP_ID)
        GLib.set_application_name(APP_TITLE)

        # 1. Inicializa o banco SQLite e o servidor HTTP local embarcado
        server.inicializar_banco()
        porta = escolher_porta_local()
        self.http_server = ThreadingHTTPServer((HOST, porta), server.PontoTramaHandler)
        self.porta_ativa = self.http_server.server_address[1]
        self.server_thread = threading.Thread(target=self.http_server.serve_forever, daemon=True)
        self.server_thread.start()

        # 2. Cria janela GTK nativa com ícone da logo e cor de fundo azul-marinho (zero flash branco)
        self.window = Gtk.Window(title=APP_TITLE)
        self.window.set_wmclass(APP_ID, APP_TITLE)
        self.window.set_role(APP_ID)
        self.window.set_default_size(1320, 840)
        self.window.set_size_request(380, 560)
        self.window.set_position(Gtk.WindowPosition.CENTER)

        self._aplicar_icone_logo()
        self._aplicar_cor_fundo_janela()

        # 3. Configura WebView com dados persistentes, clipboard, upload e download
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        data_manager = WebKit2.WebsiteDataManager(
            base_data_directory=str(APP_DATA_DIR / "data"),
            base_cache_directory=str(APP_DATA_DIR / "cache"),
        )
        web_context = WebKit2.WebContext.new_with_website_data_manager(data_manager)
        web_context.connect("download-started", self._ao_iniciar_download)

        # Sinaliza explicitamente ao frontend que está rodando no App Desktop (ativa banco SQLite)
        user_content_manager = WebKit2.UserContentManager()
        user_content_manager.add_script(
            WebKit2.UserScript(
                "window.__PONTO_TRAMA_DESKTOP__ = true;",
                WebKit2.UserContentInjectedFrames.TOP_FRAME,
                WebKit2.UserScriptInjectionTime.START,
                None,
                None,
            )
        )

        self.webview = WebKit2.WebView(
            web_context=web_context,
            user_content_manager=user_content_manager,
        )
        self._configurar_webview()
        self.webview.connect("print", self._ao_imprimir)
        self.webview.connect("run-file-chooser", self._ao_escolher_arquivo)

        self.window.add(self.webview)
        self.window.connect("destroy", self._ao_fechar)
        self.window.connect("key-press-event", self._ao_pressionar_tecla)

        self.fullscreen_ativo = False

        # Carrega a aplicação local (mesma base do Web, com SQLite ativado para o App)
        self.url_inicial = f"http://{HOST}:{self.porta_ativa}/?ambiente=desktop"
        self.webview.load_uri(self.url_inicial)

    def _aplicar_icone_logo(self) -> None:
        if LOGO_PATH.exists():
            try:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file(str(LOGO_PATH))
                self.window.set_icon(pixbuf)
                Gtk.Window.set_default_icon(pixbuf)
            except Exception as exc:
                print(f"[App] Aviso ao carregar ícone da logo: {exc}", file=sys.stderr)

    def _aplicar_cor_fundo_janela(self) -> None:
        try:
            gtk_settings = Gtk.Settings.get_default()
            if gtk_settings is not None:
                gtk_settings.set_property("gtk-application-prefer-dark-theme", True)
        except Exception:
            pass
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(b"window { background-color: #0d1c42; }")
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

    def _configurar_webview(self) -> None:
        bg = Gdk.RGBA()
        bg.parse("#0d1c42")
        self.webview.set_background_color(bg)

        settings = self.webview.get_settings()
        settings.set_enable_javascript(True)
        settings.set_enable_html5_local_storage(True)
        settings.set_enable_html5_database(True)
        settings.set_javascript_can_access_clipboard(True)
        settings.set_enable_smooth_scrolling(True)
        settings.set_enable_developer_extras(True)

    def _ao_iniciar_download(self, _context, download: WebKit2.Download) -> None:
        def decidir_destino(dl: WebKit2.Download, nome_sugerido: str) -> bool:
            nome = os.path.basename(nome_sugerido or "ponto-e-trama-backup.json")
            destino = pasta_downloads_usuario() / nome
            dl.set_destination(destino.as_uri())
            return True

        download.connect("decide-destination", decidir_destino)

    def _ao_imprimir(self, _webview: WebKit2.WebView, print_operation: WebKit2.PrintOperation) -> bool:
        print_operation.run_dialog(self.window)
        return True

    def _ao_escolher_arquivo(self, _webview: WebKit2.WebView, request: WebKit2.FileChooserRequest) -> bool:
        dialog = Gtk.FileChooserDialog(
            title="Selecionar arquivo — Ponto & Trama",
            transient_for=self.window,
            action=Gtk.FileChooserAction.OPEN,
        )
        dialog.add_buttons(
            Gtk.STOCK_CANCEL,
            Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN,
            Gtk.ResponseType.ACCEPT,
        )
        dialog.set_select_multiple(bool(request.get_select_multiple()))

        try:
            mimes = request.get_mime_types() or []
        except Exception:
            mimes = []

        if mimes:
            filtro_esp = Gtk.FileFilter()
            eh_img = any("image" in m for m in mimes)
            eh_pdf = any("pdf" in m for m in mimes)
            eh_json = any("json" in m for m in mimes)
            if eh_img and eh_pdf:
                filtro_esp.set_name("Imagens e PDF")
                filtro_esp.add_mime_type("image/*")
                filtro_esp.add_mime_type("application/pdf")
                for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.gif", "*.pdf"):
                    filtro_esp.add_pattern(ext)
            elif eh_img:
                filtro_esp.set_name("Imagens (PNG, JPG, WEBP)")
                filtro_esp.add_mime_type("image/*")
                for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.gif", "*.bmp"):
                    filtro_esp.add_pattern(ext)
            elif eh_json:
                filtro_esp.set_name("Backup JSON (*.json)")
                filtro_esp.add_mime_type("application/json")
                filtro_esp.add_pattern("*.json")
            else:
                filtro_esp.set_name("Arquivos suportados")
                for m in mimes:
                    filtro_esp.add_mime_type(m)
            dialog.add_filter(filtro_esp)

        filtro_todos = Gtk.FileFilter()
        filtro_todos.set_name("Todos os arquivos")
        filtro_todos.add_pattern("*")
        dialog.add_filter(filtro_todos)

        resposta = dialog.run()
        if resposta == Gtk.ResponseType.ACCEPT:
            arquivos = dialog.get_filenames()
            if arquivos:
                request.select_files(arquivos)
            else:
                request.cancel()
        else:
            request.cancel()
        dialog.destroy()
        return True

    def _ao_pressionar_tecla(self, _widget, event: Gdk.EventKey) -> bool:
        ctrl = bool(event.state & Gdk.ModifierType.CONTROL_MASK)
        if ctrl and event.keyval in (Gdk.KEY_k, Gdk.KEY_K):
            self.webview.run_javascript(
                "if (window.BuscaGlobal) { window.BuscaGlobal.alternar(); }",
                None,
                None,
            )
            return True
        if event.keyval == Gdk.KEY_F5 or (ctrl and event.keyval in (Gdk.KEY_r, Gdk.KEY_R)):
            self.webview.reload_bypass_cache()
            return True
        if event.keyval == Gdk.KEY_F11:
            if self.fullscreen_ativo:
                self.window.unfullscreen()
            else:
                self.window.fullscreen()
            self.fullscreen_ativo = not self.fullscreen_ativo
            return True
        return False

    def _ao_fechar(self, *_args) -> None:
        try:
            if hasattr(server, "SYNC_MANAGER"):
                server.SYNC_MANAGER.encerrar()
            self.http_server.shutdown()
            self.http_server.server_close()
        except Exception:
            pass
        Gtk.main_quit()

    def executar(self) -> None:
        self.window.show_all()
        Gtk.main()


def main() -> None:
    app = PontoTramaDesktopApp()
    app.executar()


if __name__ == "__main__":
    main()
