# Diretrizes Obrigatórias — Ponto & Trama

## Diretriz Obrigatória: Sincronização Web ↔ App Ubuntu
**PARA TODA MUDANÇA FEITA NO WEB, DEVE-SE ADICIONAR E GARANTIR NO APP UBUNTU TAMBÉM.**

- A versão Desktop Ubuntu (`desktop/app.py`, executável `./PontoETrama` e atalho `desktop/ponto-e-trama.desktop`) compartilha a mesma base (`frontend/` e `backend/`) como fonte única de verdade.
- Sempre que uma nova funcionalidade, permissão de navegador, download/exportação, upload de arquivo, atalho de teclado, tabela SQL, ícone ou recurso visual for adicionado na versão Web:
  1. Verificar se o `WebKit2GTK` em `desktop/app.py` suporta o recurso nativamente (ex.: clipboard, downloads, diálogos de arquivo, notificações, novos endpoints no `backend/server.py`).
  2. Atualizar `desktop/app.py`, `desktop/ponto-e-trama.desktop`, `desktop/instalador-gui.py` ou `desktop/instalar-ubuntu.sh` caso qualquer ajuste específico de desktop seja necessário.
  3. Regerar o pacote `.deb` (`./desktop/build-deb.sh`) e o APK Android (`./mobile/build-apk.sh`) sempre que mudanças forem feitas no Web/App, mantendo `dist/ponto-e-trama_1.0.0_all.deb` e `mobile/ponto-e-trama.apk` sincronizados.
  4. Manter a logo oficial (`frontend/assets/images/logo.png`) como ícone do aplicativo Ubuntu e validar o carregamento do app após alterações.
