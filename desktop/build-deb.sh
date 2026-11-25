#!/usr/bin/env bash
set -euo pipefail

# ==========================================================================
# Ponto & Trama — Construtor do Pacote Instalador Ubuntu (.deb) + Atalhos
# Gera:
#   1. dist/ponto-e-trama_1.0.0_all.deb  (Instalador oficial Ubuntu - duplo clique)
#   2. dist/Ponto & Trama.desktop        (Executável com ícone da logo)
#   3. dist/Instalar Ponto & Trama.desktop (Instalador gráfico GTK com ícone)
# ==========================================================================

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSAO="1.0.0"
PKG_NAME="ponto-e-trama"
DEB_FILE="$DIST_DIR/${PKG_NAME}_${VERSAO}_all.deb"

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

PKG_ROOT="$BUILD_DIR/${PKG_NAME}_${VERSAO}_all"
OPT_DIR="$PKG_ROOT/opt/$PKG_NAME"

mkdir -p \
  "$DIST_DIR" \
  "$PKG_ROOT/DEBIAN" \
  "$OPT_DIR/frontend" \
  "$OPT_DIR/backend/database" \
  "$OPT_DIR/desktop" \
  "$PKG_ROOT/usr/bin" \
  "$PKG_ROOT/usr/share/applications" \
  "$PKG_ROOT/usr/share/icons/hicolor/256x256/apps"

# Copia frontend, backend (sem .db pessoal) e desktop/app.py para /opt/ponto-e-trama
cp -r "$ROOT_DIR/frontend/." "$OPT_DIR/frontend/"
if [ -f "$ROOT_DIR/scripts/otimizar-build.py" ]; then
  python3 "$ROOT_DIR/scripts/otimizar-build.py" "$OPT_DIR/frontend"
fi
cp "$ROOT_DIR/backend/server.py" "$OPT_DIR/backend/server.py"
cp "$ROOT_DIR/backend/database/schema.sql" "$OPT_DIR/backend/database/schema.sql"
cp "$ROOT_DIR/desktop/app.py" "$OPT_DIR/desktop/app.py"
chmod 755 "$OPT_DIR/desktop/app.py" "$OPT_DIR/backend/server.py"

# Ícone oficial da logo no sistema
cp "$ROOT_DIR/frontend/assets/images/logo.png" "$PKG_ROOT/usr/share/icons/hicolor/256x256/apps/${PKG_NAME}.png"

# Comando global /usr/bin/ponto-e-trama
cat > "$PKG_ROOT/usr/bin/$PKG_NAME" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec python3 /opt/ponto-e-trama/desktop/app.py "$@"
EOF
chmod 755 "$PKG_ROOT/usr/bin/$PKG_NAME"

# Entrada do Menu de Aplicativos do Ubuntu
cat > "$PKG_ROOT/usr/share/applications/${PKG_NAME}.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Ponto & Trama
GenericName=Ferramentas para Crochê e Tricô
Comment=Contador de carreiras, precificação, inventários, calculadora e banco de amostras
Exec=/usr/bin/${PKG_NAME}
Icon=${PKG_NAME}
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=ponto-e-trama
Keywords=croche;trico;artesanato;amostra;fios;agulhas;
EOF
chmod 644 "$PKG_ROOT/usr/share/applications/${PKG_NAME}.desktop"

# Metadados DEBIAN/control
cat > "$PKG_ROOT/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSAO}
Section: utils
Priority: optional
Architecture: all
Depends: python3, python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1
Maintainer: Ponto & Trama <local@pontoetrama.local>
Description: Ponto & Trama - Ferramentas para Croche e Trico
 Aplicativo desktop offline para organizacao de artesanato em croche e trico:
 contador de carreiras, calculadora de precificacao, inventario de fios,
 catalogo de agulhas e acessorios, calculadora de amostra e banco de amostras
 com banco de dados local SQLite.
EOF

cat > "$PKG_ROOT/DEBIAN/postinst" <<'EOF'
#!/usr/bin/env bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi
EOF
chmod 755 "$PKG_ROOT/DEBIAN/postinst"

cat > "$PKG_ROOT/DEBIAN/postrm" <<'EOF'
#!/usr/bin/env bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi
EOF
chmod 755 "$PKG_ROOT/DEBIAN/postrm"

# Ajusta permissões estritas exigidas pelo dpkg-deb (diretórios 755, control 644)
find "$PKG_ROOT" -type d -exec chmod 755 {} +
chmod 644 "$PKG_ROOT/DEBIAN/control" "$PKG_ROOT/usr/share/applications/${PKG_NAME}.desktop"
chmod 755 "$PKG_ROOT/DEBIAN/postinst" "$PKG_ROOT/DEBIAN/postrm" "$PKG_ROOT/usr/bin/$PKG_NAME" "$OPT_DIR/desktop/app.py" "$OPT_DIR/backend/server.py"

# Gera o pacote .deb oficial do Ubuntu (compressão xz nível 9)
dpkg-deb -Zxz -z9 --build --root-owner-group "$PKG_ROOT" "$DEB_FILE"

# Gera os dois lançadores clicáveis dentro de dist/ com a imagem da logo
LOGO_ABS="$ROOT_DIR/frontend/assets/images/logo.png"

cat > "$DIST_DIR/Ponto & Trama.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Ponto & Trama
Comment=Abrir o aplicativo Ponto & Trama
Exec="$ROOT_DIR/PontoETrama"
Icon=$LOGO_ABS
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=ponto-e-trama
EOF

cat > "$DIST_DIR/Instalar Ponto & Trama.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Instalar Ponto & Trama
Comment=Abrir o instalador gráfico do Ponto & Trama para Ubuntu
Exec=python3 "$ROOT_DIR/desktop/instalador-gui.py"
Icon=$LOGO_ABS
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=ponto-e-trama-instalador
EOF

chmod +x "$DIST_DIR/Ponto & Trama.desktop" "$DIST_DIR/Instalar Ponto & Trama.desktop" "$ROOT_DIR/desktop/instalador-gui.py"

if command -v gio >/dev/null 2>&1; then
  gio set "$DIST_DIR/Ponto & Trama.desktop" metadata::trusted true 2>/dev/null || true
  gio set "$DIST_DIR/Instalar Ponto & Trama.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "✅ Pacote .deb gerado: $DEB_FILE"
echo "✅ Executável clicável: $DIST_DIR/Ponto & Trama.desktop"
echo "✅ Instalador gráfico:  $DIST_DIR/Instalar Ponto & Trama.desktop"
