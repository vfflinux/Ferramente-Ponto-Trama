#!/usr/bin/env python3
"""
Ponto & Trama — Instalador Gráfico Nativo para Ubuntu (GTK 3)
Permite instalar ou remover o aplicativo no Menu do Ubuntu e na Área de Trabalho
com um clique (sem precisar abrir o terminal).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GdkPixbuf", "2.0")

from gi.repository import Gdk, GdkPixbuf, GLib, Gtk

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parent
EXEC_PATH = APP_ROOT / "PontoETrama"
LOGO_SRC = APP_ROOT / "frontend" / "assets" / "images" / "logo.png"

APPS_DIR = Path.home() / ".local" / "share" / "applications"
ICONS_DIR = Path.home() / ".local" / "share" / "icons" / "hicolor" / "256x256" / "apps"
DESKTOP_FILE = APPS_DIR / "ponto-e-trama.desktop"
ICON_FILE = ICONS_DIR / "ponto-e-trama.png"


def obter_area_trabalho() -> Path | None:
    try:
        out = subprocess.check_output(["xdg-user-dir", "DESKTOP"], text=True).strip()
        if out and Path(out).is_dir() and Path(out) != Path.home():
            return Path(out)
    except Exception:
        pass
    for nome in ("Área de Trabalho", "Desktop"):
        cand = Path.home() / nome
        if cand.is_dir():
            return cand
    return None


def gerar_conteudo_desktop(icon_path: Path) -> str:
    return (
        "[Desktop Entry]\n"
        "Version=1.0\n"
        "Type=Application\n"
        "Name=Ponto & Trama\n"
        "GenericName=Ferramentas para Crochê e Tricô\n"
        "Comment=Contador de carreiras, precificação, inventários, calculadora e banco de amostras\n"
        f'Exec="{EXEC_PATH}"\n'
        f"Icon={icon_path}\n"
        "Terminal=false\n"
        "Categories=Utility;\n"
        "StartupNotify=true\n"
        "StartupWMClass=ponto-e-trama\n"
        "Keywords=croche;trico;artesanato;amostra;fios;agulhas;\n"
    )


class InstaladorPontoTrama(Gtk.Window):
    def __init__(self) -> None:
        super().__init__(title="Instalador — Ponto & Trama")
        GLib.set_prgname("ponto-e-trama-instalador")
        GLib.set_application_name("Instalador Ponto & Trama")

        self.set_default_size(460, 380)
        self.set_resizable(False)
        self.set_position(Gtk.WindowPosition.CENTER)

        if LOGO_SRC.exists():
            try:
                pix = GdkPixbuf.Pixbuf.new_from_file(str(LOGO_SRC))
                self.set_icon(pix)
            except Exception:
                pass

        self._aplicar_estilo()
        self._construir_ui()
        self.connect("destroy", Gtk.main_quit)

    def _aplicar_estilo(self) -> None:
        css = b"""
        window {
            background-color: #0d1c42;
            color: #fcf1d0;
        }
        .titulo-inst {
            font-size: 20px;
            font-weight: 800;
            color: #fcf1d0;
        }
        .subtitulo-inst {
            font-size: 13px;
            color: rgba(252, 241, 208, 0.78);
        }
        .status-inst {
            font-size: 12.5px;
            padding: 10px 12px;
            border-radius: 8px;
            background-color: rgba(1, 7, 54, 0.65);
            color: #fcf1d0;
        }
        checkbutton {
            color: #fcf1d0;
            font-size: 13.5px;
        }
        button.primario {
            background-image: none;
            background-color: #fcf1d0;
            color: #010736;
            font-weight: 800;
            border-radius: 8px;
            padding: 10px 18px;
            border: none;
        }
        button.primario:hover {
            background-color: #ffffff;
        }
        button.secundario {
            background-image: none;
            background-color: #22396f;
            color: #fcf1d0;
            font-weight: 700;
            border-radius: 8px;
            padding: 10px 16px;
            border: 1px solid rgba(252, 241, 208, 0.25);
        }
        button.perigo {
            background-image: none;
            background-color: rgba(231, 76, 60, 0.22);
            color: #ff9c92;
            font-weight: 700;
            border-radius: 8px;
            padding: 10px 14px;
            border: 1px solid rgba(231, 76, 60, 0.45);
        }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

    def _construir_ui(self) -> None:
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14)
        box.set_margin_top(24)
        box.set_margin_bottom(22)
        box.set_margin_start(26)
        box.set_margin_end(26)

        # Topo com logo + título
        topo = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=14)
        if LOGO_SRC.exists():
            try:
                pix_logo = GdkPixbuf.Pixbuf.new_from_file_at_scale(str(LOGO_SRC), 68, 68, True)
                topo.pack_start(Gtk.Image.new_from_pixbuf(pix_logo), False, False, 0)
            except Exception:
                pass

        titulos = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        titulos.set_valign(Gtk.Align.CENTER)
        lbl_t = Gtk.Label(label="Ponto & Trama")
        lbl_t.set_xalign(0)
        lbl_t.get_style_context().add_class("titulo-inst")

        lbl_s = Gtk.Label(label="Instalador do Aplicativo Desktop para Ubuntu")
        lbl_s.set_xalign(0)
        lbl_s.get_style_context().add_class("subtitulo-inst")

        titulos.pack_start(lbl_t, False, False, 0)
        titulos.pack_start(lbl_s, False, False, 0)
        topo.pack_start(titulos, True, True, 0)
        box.pack_start(topo, False, False, 0)

        # Opções de instalação
        self.chk_menu = Gtk.CheckButton.new_with_label("Criar ícone no Menu de Aplicativos do Ubuntu")
        self.chk_menu.set_active(True)
        box.pack_start(self.chk_menu, False, False, 0)

        self.chk_desktop = Gtk.CheckButton.new_with_label("Criar atalho clicável na Área de Trabalho")
        self.chk_desktop.set_active(obter_area_trabalho() is not None)
        self.chk_desktop.set_sensitive(obter_area_trabalho() is not None)
        box.pack_start(self.chk_desktop, False, False, 0)

        # Status
        ja_instalado = DESKTOP_FILE.exists()
        msg_inicial = (
            "Status: Ponto & Trama já está instalado no Menu de Aplicativos."
            if ja_instalado
            else "Clique em Instalar para registrar o aplicativo com a logo oficial no Ubuntu."
        )
        self.lbl_status = Gtk.Label(label=msg_inicial)
        self.lbl_status.set_line_wrap(True)
        self.lbl_status.set_xalign(0)
        self.lbl_status.get_style_context().add_class("status-inst")
        box.pack_start(self.lbl_status, True, True, 0)

        # Botões de ação
        acoes = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)

        btn_remover = Gtk.Button(label="Desinstalar")
        btn_remover.get_style_context().add_class("perigo")
        btn_remover.connect("clicked", self._desinstalar)
        acoes.pack_start(btn_remover, False, False, 0)

        btn_abrir = Gtk.Button(label="Abrir App")
        btn_abrir.get_style_context().add_class("secundario")
        btn_abrir.connect("clicked", self._abrir_app)
        acoes.pack_end(btn_abrir, False, False, 0)

        btn_instalar = Gtk.Button(label="Instalar no Ubuntu")
        btn_instalar.get_style_context().add_class("primario")
        btn_instalar.connect("clicked", self._instalar)
        acoes.pack_end(btn_instalar, False, False, 0)

        box.pack_end(acoes, False, False, 0)
        self.add(box)

    def _instalar(self, _btn) -> None:
        try:
            os.chmod(EXEC_PATH, 0o755)
            ICONS_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(LOGO_SRC, ICON_FILE)
            conteudo = gerar_conteudo_desktop(ICON_FILE)

            criados = []
            if self.chk_menu.get_active():
                APPS_DIR.mkdir(parents=True, exist_ok=True)
                DESKTOP_FILE.write_text(conteudo, encoding="utf-8")
                os.chmod(DESKTOP_FILE, 0o755)
                criados.append("Menu de Aplicativos")

            if self.chk_desktop.get_active():
                area = obter_area_trabalho()
                if area:
                    atalho = area / "Ponto & Trama.desktop"
                    atalho.write_text(conteudo, encoding="utf-8")
                    os.chmod(atalho, 0o755)
                    subprocess.run(["gio", "set", str(atalho), "metadata::trusted", "true"], check=False)
                    criados.append("Área de Trabalho")

            subprocess.run(["update-desktop-database", str(APPS_DIR)], check=False)
            subprocess.run(
                ["gtk-update-icon-cache", "-f", "-t", str(Path.home() / ".local" / "share" / "icons" / "hicolor")],
                check=False,
            )

            onde = " e ".join(criados) if criados else "sistema"
            self.lbl_status.set_text(f"✅ Instalado com sucesso em: {onde}!\nVocê já pode abrir o Ponto & Trama.")
        except Exception as exc:
            self.lbl_status.set_text(f"❌ Erro ao instalar: {exc}")

    def _desinstalar(self, _btn) -> None:
        try:
            for alvo in (DESKTOP_FILE, ICON_FILE):
                if alvo.exists():
                    alvo.unlink()
            area = obter_area_trabalho()
            if area:
                atalho = area / "Ponto & Trama.desktop"
                if atalho.exists():
                    atalho.unlink()
            subprocess.run(["update-desktop-database", str(APPS_DIR)], check=False)
            self.lbl_status.set_text("🗑️ Atalhos removidos do Ubuntu. Seus dados SQLite foram preservados.")
        except Exception as exc:
            self.lbl_status.set_text(f"❌ Erro ao desinstalar: {exc}")

    def _abrir_app(self, _btn) -> None:
        subprocess.Popen([str(EXEC_PATH)], start_new_session=True)
        Gtk.main_quit()


def main() -> None:
    win = InstaladorPontoTrama()
    win.show_all()
    Gtk.main()


if __name__ == "__main__":
    main()
