# Ponto & Trama — Versão Android (`mobile/`)

Esta pasta contém o projeto Android nativo e o executável instalável **`.apk`** do Ponto & Trama para celular Android (Android 7.0 a 15+ / API 24–35).

## Características do App Android
- **100% local e offline:** zero permissão de internet (`INTERNET` removida do `AndroidManifest.xml`), sem servidor HTTP e sem abrir páginas web externas — todos os recursos são carregados diretamente da memória do APK.
- **Início limpo:** Inventário de Fios, Agulhas e Acessórios, Banco de Amostras e Projetos iniciam **completamente vazios** (0 itens pré-cadastrados) para o usuário cadastrar seus próprios materiais.
- **Android 15 Edge-to-Edge (`WindowInsets`):** respeita automaticamente a barra de status, o notch/câmera, a barra de navegação inferior e o teclado virtual sem sobrepor elementos.
- **Front mobile dedicado (`frontend/styles/base/mobile.css`):** barra de navegação inferior nativa (*Início*, *Projetos*, *Contador*, *Preço*, *Mais*), gaveta lateral deslizante (com gesto de borda esquerda e aba **Ferramentas** arrastável), **Busca Global (lupa no topo)**, **Bancada do Ateliê** na Home, **Prateleira Pantone + Simulador de Cores** nos Fios, **8 temas visuais** e **Ecossistema Vivo de 7 Aranhas (Ñanduobyeté)** com hábitos de caça reais, 5 presas animadas em escala de raridade e interações entre aranhas configuráveis.
- **Gestos Touch Nativos:** pinça para zoom e pan com 2 dedos no Editor de Gráficos, Fotos de Receitas e Lightbox da Galeria; toque com 2/3 dedos (Desfazer/Refazer) e pressão longa (Conta-gotas) no Editor; régua **"⇅ Onde parei"** arrastável com o dedo; deslizar para baixo (`−1`) no Contador Tela Toda e pressão longa em `+`/`−`.
- **Ícone adaptativo com fundo escuro:** fundo gradiente azul-marinho escuro destacando a logo em qualquer tela inicial (Android 7 a 15).
- **Recursos nativos integrados:** barra de status sincronizada com os 8 temas, *Manter Tela Acesa* nativo (`FLAG_KEEP_SCREEN_ON`), vibração háptica, botão Voltar integrado a modais/paleta e salvamento nativo de backups `.json` e paletas `.png` (`ACTION_CREATE_DOCUMENT`).

## Como instalar no celular
1. Copie o arquivo `mobile/ponto-e-trama.apk` para o seu celular Android (via cabo USB, WhatsApp, Drive, etc.).
2. Toque no arquivo **`ponto-e-trama.apk`** no gerenciador de arquivos do celular.
3. Se o Android pedir permissão para instalar apps de fontes desconhecidas, autorize e toque em **Instalar**.
4. O aplicativo **Ponto & Trama** aparecerá na tela inicial do celular com o ícone de fundo escuro e rodará **100% localmente no aparelho**.

## Como regerar o APK após alterar o código
```bash
./mobile/build-apk.sh
```
O script sincroniza e minifica automaticamente a pasta `frontend/` e recompila e assina `mobile/ponto-e-trama.apk`.
