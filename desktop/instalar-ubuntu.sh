#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXEC_PATH="$APP_ROOT/PontoETrama"
LOGO_SRC="$APP_ROOT/frontend/assets/images/logo.png"

APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
DESKTOP_DEST="$APPS_DIR/ponto-e-trama.desktop"

chmod +x "$EXEC_PATH" "$APP_ROOT/desktop/app.py" "$APP_ROOT/iniciar.sh" "$APP_ROOT/backend/server.py"

mkdir -p "$APPS_DIR" "$ICONS_DIR"
cp "$LOGO_SRC" "$ICONS_DIR/ponto-e-trama.png"

cat > "$DESKTOP_DEST" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Ponto & Trama
GenericName=Ferramentas para Crochê e Tricô
Comment=Contador de carreiras, precificação, inventários, calculadora e banco de amostras
Exec="$EXEC_PATH"
Icon=$ICONS_DIR/ponto-e-trama.png
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=ponto-e-trama
Keywords=croche;trico;artesanato;amostra;fios;agulhas;
EOF

chmod +x "$DESKTOP_DEST"

# Atualiza o .desktop interno do repositório também
cp "$DESKTOP_DEST" "$SCRIPT_DIR/ponto-e-trama.desktop"

# Se existir Área de Trabalho / Desktop, cria também o atalho clicável com ícone
for AREA in "$HOME/Área de Trabalho" "$HOME/Desktop"; do
  if [ -d "$AREA" ]; then
    ATALHO_AREA="$AREA/Ponto & Trama.desktop"
    cp "$DESKTOP_DEST" "$ATALHO_AREA"
    chmod +x "$ATALHO_AREA"
    if command -v gio >/dev/null 2>&1; then
      gio set "$ATALHO_AREA" metadata::trusted true 2>/dev/null || true
    fi
    echo "🖥️  Atalho criado na Área de Trabalho: $ATALHO_AREA"
  fi
done

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo "✅ Ponto & Trama instalado no menu de aplicativos do Ubuntu com o ícone da logo!"
echo "   Você já pode procurar por 'Ponto & Trama' no menu ou executar: ./PontoETrama"
