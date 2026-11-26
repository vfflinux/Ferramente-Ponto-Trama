# Ferramente-Ponto-Trama — Ponto & Trama

Aplicação multiplataforma **100% offline e local** para organização de artesanato em **crochê e tricô**, construída sobre uma única base compartilhada e distribuída em três versões sincronizadas: **Web (PWA)**, **App Desktop para Ubuntu (Linux)** e **App Mobile para Android**.

> **Início limpo em todas as plataformas:** ao baixar e abrir pela primeira vez (Web, Ubuntu ou Android), o **Inventário de Fios**, **Agulhas e Acessórios**, **Banco de Amostras** e **Gerenciador de Projetos** iniciam **completamente vazios (0 itens pré-cadastrados)**, prontos para você cadastrar seus próprios materiais e projetos.

---

## Downloads (Android, Linux/Ubuntu e Web)

| Plataforma | Arquivo | Tamanho | Onde baixar | Como instalar / abrir |
| :--- | :--- | :---: | :--- | :--- |
| **Android (Celular)** | `ponto-e-trama.apk` (`v1.0.1`) | `658 KB` | [Baixar APK (`mobile/ponto-e-trama.apk`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/mobile/ponto-e-trama.apk) | Copie o `.apk` para o celular (Android 7.0 a 15+), toque no arquivo e autorize a instalação. Roda **100% local**, sem permissão de internet. |
| **Linux / Ubuntu (Instalador `.deb`)** | `ponto-e-trama_1.0.0_all.deb` | `223 KB` | [Baixar `.deb` (`dist/ponto-e-trama_1.0.0_all.deb`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/dist/ponto-e-trama_1.0.0_all.deb) | Clique duas vezes no `.deb` (abre na Central de Aplicativos do Ubuntu) ou instale via `sudo apt install ./dist/ponto-e-trama_1.0.0_all.deb`. |
| **Linux / Ubuntu (Atalho gráfico)** | `Ponto & Trama.desktop` / `Instalar Ponto & Trama.desktop` | — | Pasta [`dist/`](dist/) | Clique com o botão direito → *Permitir iniciar* e dê duplo clique para abrir o app (`PontoETrama`) ou o instalador gráfico GTK (`desktop/instalador-gui.py`). |
| **Web (Navegador / PWA)** | `frontend/index.html` | — | [`frontend/index.html`](frontend/index.html) | Abra no navegador ou sirva `frontend/` (salva tudo localmente via IndexedDB + Service Worker offline-first). |

---

## As 12 Ferramentas Integradas

> **Barra lateral enxuta, personalizável e arrastável:** em **Configurações → Aparência e Leitura**, você escolhe exatamente quais ferramentas ficam visíveis na barra lateral. As demais ficam na aba **Ferramentas**, que infla um popup conectado exibindo somente os ícones — e, com o popup aberto, basta **arrastar e soltar** ferramentas entre a barra lateral e o popup (ou reordená-las) para ativar/desativar em tempo real nas Configurações.

### 1. Início (Home)
- Tela inicial limpa com acesso direto a **`+ Novo projeto`** e **`Ver meus projetos`**.
- Clique na logo da barra lateral (ou na aba *Início* no celular) para voltar rapidamente.

### 2. Gerenciador de Projetos (Pastas / Fichários + Workspace)
- **Pastas / Fichários no Dashboard:** cards em formato de fichário com aba superior, capa ou ilustração, status colorido (*Na Fila*, *Em Andamento*, *Pausado*, *Concluído*), menu `⋯` (*Workspace*, *Retirar*, *Editar*, *Duplicar*, *Arquivar*, *Excluir*) e barra de progresso.
- **Abertura Animada + Botão `Retirar`:**
  - Ao abrir uma pasta, as **7 fichas** (*Contadores*, *Receita & Notas*, *Fios & Agulha*, *Etapas*, *Amostra*, *Tempo & Preço* e *Gráfico Visual*) deslizam para formar o dossiê completo.
  - **`Retirar`** distribui o projeto para **todas as ferramentas** e exibe a barra global **"📂 Na bancada"** no topo — qualquer alteração feita em qualquer aba (contadores, receita, amostra, precificação ou gráfico) é salva automaticamente na pasta ativa.
- **Workspace do Projeto (2 Colunas no Desktop / 3 Abas fixas no Mobile):**
  - **Execução:** múltiplos contadores integrados (`+1` / `-1`, atalhos `Espaço`, `↑`, `↓`, vibração e alarme sonoro ao atingir a meta), cronômetro de trabalho (**Play / Pause** + envio direto das horas para a Precificação) e leitor/editor de receitas.
  - **Metadados:** checklist de etapas com progresso automático ou manual (`0–100%`), celebração discreta (*confetes* + badge **`🎉 Peça Finalizada!`**), ficha técnica vinculada aos inventários de fios/agulhas e galeria de progresso com lightbox.
- **Formulário de Criação/Edição em Drawer:** acordeões **1. Informações Básicas** e **2. Materiais, Etapas e Prazos** com rolagem interna independente para fácil preenchimento no desktop e celular.
- **Baixa Automática no Estoque ao Concluir Projeto:** ao finalizar o projeto (`100%` ou status *Concluído*), exibe confirmação em 1 clique para descontar automaticamente do estoque os novelos/gramas de fios e aviamentos utilizados.

### 3. Receitas e Anotações (com Dicionário Multilíngue & Tradutor Automático)
- **Modo Texto & Passos:** editor com **marcador interativo de linha atual** (clique na linha ou use *Próxima ↓*) e exemplos adaptados à técnica principal (**Crochê** ou **Tricô**).
- **Modo PDF / Foto:** carregamento de PDFs ou imagens de gráficos com **régua móvel "Onde parei"**.
- **Dicionário de Abreviações (`frontend/data/dicionario-pontos.json`):** catálogo multilíngue minimalista entre **PT-BR**, **Inglês (US)**, **Inglês (UK)** e **Espanhol (ES)** com busca instantânea, filtros por idioma/técnica/categoria e cópia rápida.
- **Tradutor Automático de Receitas (100% Offline / Client-Side):** cola trechos ou receitas inteiras, traduz siglas preservando números/repetições (`*2 sc, inc* x6 → *2 pb, aum* x6`), destaca termos traduzidos com tooltip, exibe alerta de ambiguidade **US vs. UK** e envia direto para o leitor ou para o projeto ativo.

### 4. Contador de Carreiras + Modo "Toque na Tela Toda"
- Múltiplos contadores simultâneos com cálculo automático do total de pontos, meta de carreiras com alarme visual e sonoro offline (Web Audio API), vibração tátil no celular e sincronização bidirecional com o projeto na bancada e o **Editor de Gráficos**.
- **Modo "Toque na Tela Toda":** botão para expandir o contador em tela cheia onde qualquer toque na tela soma `+1` (com vibração suave) e cadeado de segurança para evitar zerar sem querer enquanto tece.

### 5. Calculadora de Precificação
- Cálculo em tempo real de linhas (em **unidades/novelos** ou **gramas**), mão de obra (com importação das horas do cronômetro do projeto), acessórios/extras e margem de lucro com controle deslizante.
- **Integração com Estoque:** botão **Estoque** (autocomplete, cálculo de sobras e gaveta lateral de fios) e botão **`🎀 Aviamentos`** (puxa custos de *Agulhas e Acessórios*).
- Reativa às Configurações: moeda (`R$` / `$` / `€`), valor/hora padrão, margem padrão, nome do ateliê e assinatura personalizada ao copiar o orçamento.

### 6. Inventário de Fios *(inicia vazio)*
- Cadastro de linhas com marca, cor, código, lote, TEX, composição, peso, metragem, agulha recomendada (crochê e tricô), localização, preço (na moeda selecionada nas Configurações) e foto com compressão automática.
- Controle rápido `- / +`, resumo consolidado do estoque, tela de detalhes com ficha técnica, duplicação e backup `.json`.

### 7. Agulhas e Acessórios *(inicia vazio)*
- Organização em **3 zonas** (abas *Todas*, *Agulhas*, *Ferramentas* e *Aviamentos* + subfiltros *Crochê*, *Tricô Reto*, *Tricô Circular*, *Tapeçaria*; busca + alternador Grade/Lista; listagem responsiva).
- Drawer lateral com campos dinâmicos por categoria, calculadora de custo unitário a partir do pacote, toggle **`Em Uso / Livre`** sincronizado com o projeto ativo e ajuste `- / +` para aviamentos.

### 8. Calculadora de Amostra + Aumentos & Diminuições Uniformes
- Dois modos via seletor deslizante (*Por Medida Desejada* e *Adaptar Receita*), conversão **`cm ↔ pol`**, steppers, visualização proporcional da trama, fita métrica elástica e salvamento direto no Banco de Amostras.
- **Modo Avançado (`⚡ On/Off`):** integra Fio, Agulha, pontos-base (**Ponto Baixo** para Crochê e **Ponto Malha** para Tricô), lista personalizável de pontos e modelos do Banco de Amostras, com estimativa de consumo em gramas, metros e novelos.
- **Calculadora de Aumentos & Diminuições Uniformes:** acessível direto por um botão no cabeçalho da ferramenta; calcula a sequência pronta da carreira (ex.: `*5 pb, 1 aum* x4; *6 pb, 1 aum* x9`) para crochê ou tricô, circular ou plano, com envio direto para Receitas/Projeto.

### 9. Banco de Amostras *(inicia vazio)*
- Galeria de pontos com busca instantânea, filtros por categoria e favoritos, visualização detalhada, duplicação e botão **`Usar na Calculadora`**.

### 10. Editor de Gráficos (Pixel Art / Tapestry / C2C / Jacquard)
- **Editor de Grade Manual em HTML5 Canvas (60 fps):** largura/altura e proporção customizáveis (1:1 ou retangular pela amostra), pincel, borracha, balde de tinta (flood fill), conta-gotas, linha, retângulo e elipse, seleção (copiar/colar/mover), espelhamento, desenho simétrico em tempo real, Undo/Redo, zoom/pan, redimensionamento sem perda e guias numeradas com destaque a cada 5/10 pontos.
- **Importação de Imagens e Pixel Art Quadriculada:** recorte (Crop), calibração de grade virtual com detecção automática de linhas e offset/escala, amostragem central de cor (ignora linhas da grade e ruído JPG), agrupamento de cores (Color Merging) e sugestão de fios do Inventário.
- **Modo de Execução & Exportação:** destaca a carreira atual de baixo para cima com direção ida/volta, leitura por blocos de cor, modo alto contraste, sincronização bidirecional com o Contador de Carreiras e o Projeto ativo, autosave local e exportação em **PNG** e **PDF**.

### 11. Tabelas de Conversão e Medidas (`frontend/data/tabelas-conversao.json`)
- **3 Abas com Indicador Deslizante:** *Agulhas* (`mm`, `US`, `UK`, `Letra` e uso comum), *Espessura de Fios* (`CYC 0–7`, `TEX`, agulha sugerida e exemplos brasileiros) e *Medidas Padrão* (8 subcategorias: *Toucas/Gorros*, *Meias*, *Blusas/Camisas*, *Calças*, *Vestidos*, *Cachecóis*, *Mantas* e *Bolsas*, cada uma com dica técnica prática).
- **Conversor Rápido & Toggle `cm | pol`:** cartão instantâneo de equivalências (com badge indicando se você já tem aquela agulha/fio no estoque) e alternância global `cm ↔ pol` ($1\text{ pol} = 2,54\text{ cm}$) persistida em `localStorage`.
- **Produtividade e Responsividade:** busca instantânea (incluindo busca cruzada entre peças/abas), botão **Copiar** em cada linha com confirmação visual, clique na linha para **Modo Leitura** (destaque fixo) e cartões empilhados abaixo de `600 px`.

### 12. Configurações, Temas Harmonizados e Sincronização Wi-Fi
- **Ateliê e Perfil:** nome do ateliê, assinatura para orçamentos e **Técnica Principal** (`Crochê`, `Tricô` ou `Ambos`) refletida em projetos, amostras, agulhas e placeholders.
- **Aparência e Barra Lateral (`frontend/styles/base/temas.css`):**
  - 3 temas visuais harmonizados com contraste AA/AAA: **Azul Marinho Clássico**, **Noite Profunda** e **Ateliê Claro**.
  - 3 tamanhos de fonte (*Compacto*, *Padrão*, *Grande*), *Reduzir Animações*, estado inicial da barra lateral e **seletor de ferramentas da barra lateral** (as desmarcadas vão para o popup conectado da aba **Ferramentas**).
- **Padrões das Ferramentas:** alerta sonoro offline (com teste de som), alerta visual, vibração, *Manter tela acesa* (Wake Lock + nativo Android), atalhos de teclado, valor/hora, margem padrão, moeda global (`BRL` / `USD` / `EUR`), unidade padrão (`cm`/`pol`), vínculo automático de projetos, marcação automática de agulha em uso e confetes.
- **Sincronização Local via Wi-Fi (`backend/sync_wifi.py`):** servidor HTTP temporário no Ubuntu com **QR Code SVG 100% offline** e link manual, token temporário de uso único (5 min), seleção de direção (**PC → Celular**, **Celular → PC** ou **Mesclar** comparando `updatedAt`), página mobile embarcada sem instalação extra, validação de schema, backup automático de rollback (`backup_pre_sync.json`), encerramento limpo e diagnóstico de firewall/UFW.
- **Dados, Backup Unificado e Zona de Perigo:** diagnóstico em tempo real (SQLite vs. IndexedDB), **Exportar/Importar Backup Completo (`.json`)** (*Mesclar* ou *Substituir Tudo*), restauração de padrões e limpeza seletiva com confirmação dupla (`LIMPAR`).

---

## App Android 100% Local e Front Mobile Dedicado

- **Execução 100% local (`mobile/android/`):**
  - **Zero permissão de internet** (`INTERNET` removida do `AndroidManifest.xml`), sem servidor HTTP local e sem abrir navegador externo.
  - Assets servidos diretamente da memória interna do APK via `WebViewClient.shouldInterceptRequest` (`appassets.androidplatform.net`), garantindo **IndexedDB** e **localStorage** persistentes.
  - **Compatibilidade com Android 15 Edge-to-Edge (`WindowInsets`):** aplica automaticamente os recuos de barra de status, barra de navegação, notch/câmera e teclado virtual.
  - **Ponte nativa Android (`PontoETramaAndroid`):** sincroniza cor das barras com o tema, ativa `FLAG_KEEP_SCREEN_ON`, vibração háptica e exportação nativa de arquivos (`ACTION_CREATE_DOCUMENT`).
  - **Ícone adaptativo com fundo escuro:** todas as densidades (`mdpi`–`xxxhdpi` + `mipmap-anydpi-v26`), preservando a logo transparente original no Web e no App Ubuntu.
- **Front mobile dedicado (`frontend/styles/base/mobile.css`) e Gestos Touch Nativos:**
  - **Barra de navegação inferior nativa** (telas ≤ 768 px) com acesso rápido a *Início*, *Projetos*, *Contador*, *Preço* e *Mais*, além de **gesto de borda esquerda** (deslizar da borda para abrir e para a esquerda para fechar a gaveta lateral).
  - **Editor de Gráficos (Touch):** canvas posicionado logo no topo da tela no celular, **pinça para zoom (`0.18×–4.5×`) + pan com 2 dedos** (sem deixar pontos acidentais), **toque com 2 dedos = Desfazer**, **toque com 3 dedos = Refazer**, **pressionar e segurar = Conta-gotas instantâneo**, **toque duplo** para enquadrar no Modo Execução e **deslizar na barra de execução** para trocar de carreira.
  - **Receitas (Foto/PDF):** **pinça para zoom + toque duplo (`1× ↔ 2.2×`)** na imagem da receita e **régua "⇅ Onde parei" arrastável diretamente com o dedo**.
  - **Contador de Carreiras:** no modo *Toque na Tela Toda*, toque soma `+1` e **deslizar para baixo ou esquerda** subtrai `−1`; nos botões `+` e `−`, **pressão longa** avança ou recua carreiras continuamente.
  - **Galeria de Progresso (Lightbox):** **pinça para zoom**, **toque duplo**, **deslizar esquerda/direita** para trocar de foto e **deslizar para baixo** para fechar.
  - Top App Bar flexível, tabelas em cartões empilhados abaixo de `600 px` e modais/drawers em largura total.

---

## Arquitetura, Banco de Dados e Otimizações

- **Persistência dual com auto-reparo (`frontend/src/core/database.js`):**
  - **App Desktop Ubuntu (`./PontoETrama` / `.deb`):** banco relacional **SQLite** local (`backend/database/ponto_e_trama.db`, esquema em [`backend/database/schema.sql`](backend/database/schema.sql)) servido pelo backend Python puro [`backend/server.py`](backend/server.py) (zero dependências externas, conexão persistente por thread, cache em RAM, `ETag / 304` e compressão `gzip`).
  - **Versão Web (PWA) e App Android:** **IndexedDB (`v4`)** com auto-upgrade, fallback em `localStorage` e Service Worker offline-first ([`frontend/sw.js`](frontend/sw.js), [`frontend/manifest.json`](frontend/manifest.json)).
- **Otimização de build e performance:**
  - Minificação automática de HTML/CSS/JS na geração dos pacotes via [`scripts/otimizar-build.py`](scripts/otimizar-build.py) (`-23%` nos assets empacotados), mantendo o código-fonte legível no repositório.
  - Compressão `xz -z9` no `.deb` (`223 KB`), assinatura completa no `.apk` (`658 KB`) e inicialização sob demanda (*lazy init* + *lazy sync*).

---

## Estrutura do Projeto

```text
Ponto&Trama/
├── PontoETrama                              # Executável direto do App Desktop Ubuntu
├── AGENTS.md                                # Diretriz de sincronização Web <-> Ubuntu <-> Android
├── README.md
├── scripts/
│   └── otimizar-build.py                    # Minificador de HTML/CSS/JS usado nos builds .deb e .apk
├── backend/
│   ├── server.py                            # Servidor HTTP local (gzip/ETag) + API REST SQLite
│   ├── sync_wifi.py                         # Sincronização Wi-Fi local (QR SVG offline, merge e rollback)
│   └── database/
│       └── schema.sql                       # Esquema SQL (fios, itens_biblioteca, banco_amostras, projetos)
├── desktop/
│   ├── app.py                               # App nativo Ubuntu (GTK 3 + WebKit2GTK + SQLite)
│   ├── instalador-gui.py                    # Instalador gráfico GTK para Ubuntu
│   └── build-deb.sh                         # Gera dist/ponto-e-trama_1.0.0_all.deb e lançadores .desktop
├── dist/
│   ├── ponto-e-trama_1.0.0_all.deb          # Instalador oficial Ubuntu (.deb — 223 KB)
│   ├── Ponto & Trama.desktop                # Lançador clicável do app
│   └── Instalar Ponto & Trama.desktop       # Lançador clicável do instalador gráfico
├── mobile/
│   ├── ponto-e-trama.apk                    # Aplicativo Android 100% local (.apk — 658 KB)
│   ├── build-apk.sh                         # Compila (aapt2/javac/d8), alinha e assina o APK
│   ├── README.md
│   └── android/
│       ├── AndroidManifest.xml              # Zero permissão INTERNET (100% offline)
│       ├── java/com/pontoetrama/app/
│       │   └── MainActivity.java            # Assets em memória, WindowInsets Android 15 e ponte nativa
│       └── res/                             # Ícones adaptativos escuros (mdpi-xxxhdpi + anydpi-v26)
└── frontend/
    ├── index.html                           # SPA compartilhada entre Web, Ubuntu e Android
    ├── manifest.json                        # Manifesto PWA instalável offline
    ├── sw.js                                # Service Worker offline-first (network-first + fallback cache)
    ├── assets/images/logo.png               # Logo oficial otimizada (15 KB)
    ├── data/
    │   ├── dicionario-pontos.json           # Catálogo multilíngue de pontos (PT-BR, US, UK, ES)
    │   └── tabelas-conversao.json           # Banco de agulhas, fios (CYC/TEX) e medidas padrão
    ├── styles/
    │   ├── base/                            # global.css, mobile.css (front celular), temas.css (3 temas)
    │   ├── layout/                          # barra-lateral.css (barra personalizável + popup conectado)
    │   └── modules/                         # CSS modularizado das 12 ferramentas
    └── src/
        ├── main.js                          # Bootstrap com lazy init por ferramenta + registro SW
        ├── core/                            # database.js, projeto-contexto.js, sidebar.js, animations.js
        └── modules/                         # JS modularizado das 12 ferramentas + tradutor-receitas.js
```

---

## Como Recompilar os Instaladores após Alterações

```bash
# Regerar o instalador Ubuntu (.deb) e lançadores em dist/
./desktop/build-deb.sh

# Regerar o APK Android em mobile/ponto-e-trama.apk
./mobile/build-apk.sh
```
