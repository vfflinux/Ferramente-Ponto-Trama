# Ponto & Trama — Versão Android (`mobile/`)

Esta pasta contém o projeto Android nativo e o executável instalável **`.apk`** do Ponto & Trama para celular Android (Android 7.0+ / API 24+).

## Características do App Android
- **100% local e offline:** zero permissão de internet (`INTERNET` removida do `AndroidManifest.xml`), sem servidor HTTP e sem abrir páginas web externas — todos os recursos são carregados diretamente da memória do APK.
- **Ícone adaptativo com fundo escuro:** fundo gradiente azul-marinho escuro destacando a logo em qualquer tela inicial (Android 7 a 15).
- **Layout mobile dedicado:** interface remodelada em `frontend/styles/base/mobile.css` com gaveta lateral deslizante e todas as 10 ferramentas adaptadas para tela de celular.
- **Recursos nativos integrados:** barra de status sincronizada com o tema, *Manter Tela Acesa* nativo e salvamento de backup `.json` pelo seletor de arquivos do Android.

## Como instalar no celular
1. Copie o arquivo `mobile/ponto-e-trama.apk` para o seu celular Android (via cabo USB, WhatsApp, Drive, etc.).
2. Toque no arquivo **`ponto-e-trama.apk`** no gerenciador de arquivos do celular.
3. Se o Android pedir permissão para instalar apps de fontes desconhecidas, autorize e toque em **Instalar**.
4. O aplicativo **Ponto & Trama** aparecerá na tela inicial do celular com o novo ícone de fundo escuro e rodará **100% localmente no aparelho**.

## Como regerar o APK após alterar o código
```bash
./mobile/build-apk.sh
```
O script sincroniza e minifica automaticamente a pasta `frontend/` e recompila e assina `mobile/ponto-e-trama.apk`.
