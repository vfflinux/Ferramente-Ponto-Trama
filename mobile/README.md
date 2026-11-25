# Ponto & Trama — Versão Android (`mobile/`)

Esta pasta contém o projeto Android nativo e o executável instalável **`.apk`** do Ponto & Trama para celular Android (Android 7.0+ / API 24+).

## Como instalar no celular
1. Copie o arquivo `mobile/ponto-e-trama.apk` para o seu celular Android (via cabo USB, WhatsApp, Drive, etc.).
2. Toque no arquivo **`ponto-e-trama.apk`** no gerenciador de arquivos do celular.
3. Se o Android pedir permissão para instalar apps de fontes desconhecidas, autorize e toque em **Instalar**.
4. O aplicativo **Ponto & Trama** aparecerá na tela inicial do celular com a logo oficial e funcionará **100% offline**.

## Como regerar o APK após alterar o código
```bash
./mobile/build-apk.sh
```
O script sincroniza automaticamente a pasta `frontend/` e recompila e assina `mobile/ponto-e-trama.apk`.
