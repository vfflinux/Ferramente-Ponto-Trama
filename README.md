# Ferramente-Ponto-Trama — Ponto & Trama

Aplicação multiplataforma **100% offline** para organização de artesanato em **crochê e tricô**, disponível em três formatos sincronizados a partir da mesma base: **Web**, **App Desktop para Ubuntu (Linux)** e **App Mobile para Android**.

---

## Downloads (App Android e App Linux)

| Plataforma | Arquivo | Tamanho | Onde baixar | Como instalar |
| :--- | :--- | :---: | :--- | :--- |
| **Android (Celular)** | `ponto-e-trama.apk` | `553 KB` | [Baixar APK (`mobile/ponto-e-trama.apk`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/mobile/ponto-e-trama.apk) | Copie o `.apk` para o celular (Android 7.0+), toque no arquivo e autorize a instalação. Roda **100% local** (zero permissão de internet). |
| **Linux / Ubuntu (Instalador `.deb`)** | `ponto-e-trama_1.0.0_all.deb` | `139 KB` | [Baixar `.deb` (`dist/ponto-e-trama_1.0.0_all.deb`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/dist/ponto-e-trama_1.0.0_all.deb) | Clique duas vezes no `.deb` (abre a Central de Aplicativos do Ubuntu) ou rode `sudo apt install ./dist/ponto-e-trama_1.0.0_all.deb`. |
| **Linux / Ubuntu (Direto da pasta)** | `PontoETrama` + Instalador GTK | — | `dist/Ponto & Trama.desktop` e `dist/Instalar Ponto & Trama.desktop` | Clique com o botão direito → *Permitir iniciar* e dê duplo clique em `Ponto & Trama.desktop` ou no instalador gráfico `Instalar Ponto & Trama.desktop`. |
| **Web (Navegador)** | `frontend/index.html` | — | Pasta [`frontend/`](frontend/index.html) | Abra `frontend/index.html` diretamente no navegador ou hospede a pasta `frontend/` (não precisa de servidor SQL). |

---

## Resumo do que foi adicionado

### 1. Tela Inicial (Home)
- Tela **Início** adicionada como entrada padrão (no Web, App Ubuntu e Android) com o cabeçalho do sistema e acesso direto aos botões **`+ Novo projeto`** e **`Ver meus projetos`**.
- Clique na logo da barra lateral para voltar rapidamente à Home.

### 2. Gerenciador de Projetos (Estilo Pasta / Fichário + Integração Total)
- **Pastas / Fichários no Dashboard**: cards em formato de pasta com aba superior, folhinhas internas que sobem no hover, foto de capa (ou placeholder ilustrado), badge de status colorido (*Na Fila*, *Em Andamento*, *Pausado*, *Concluído*), menu `⋯` (Workspace, Retirar, Editar, Duplicar, Arquivar e Excluir com confirmação) e barra de progresso fina na base.
- **Abertura Animada da Pasta + Botão `Retirar`**:
  - Ao clicar em uma pasta, as **6 fichas** (*Contadores*, *Receita & Notas*, *Fios & Agulha*, *Etapas*, *Amostra* e *Tempo & Preço*) saem animadas de dentro do fichário formando uma telinha de dossiê.
  - O botão **`Retirar`** distribui as informações do projeto para **todas as ferramentas** do sistema e exibe a barra **"📂 Na bancada"** no topo — qualquer alteração feita em qualquer ferramenta é salva automaticamente dentro da pasta ativa.
  - Ao criar um novo projeto (com suporte a **Crochê** e **Tricô** em drawer lateral com *Accordions*), ele já fica vinculado automaticamente às ferramentas.
- **Workspace do Projeto (2 Colunas Desktop / Abas Mobile)**:
  - **Execução**: múltiplos contadores integrados (`+1` / `-1`, atalhos `Espaço`, `↑`, `↓`), cronômetro de trabalho (**Play / Pause** pulsante + envio do tempo para a Precificação) e leitor/anotador de receita integrado.
  - **Metadados**: checklist de etapas com cálculo automático ou manual de progresso (`0–100%`) e celebração discreta com confetes + badge **`🎉 Peça Finalizada!`**, ficha técnica vinculada aos inventários de fios/agulhas e galeria de progresso com fotos intermediárias e lightbox.

### 3. Receitas e Anotações
- **Modo Texto & Passos**: editor de anotações e passo a passo com **marcador interativo de linha atual** (clique em qualquer linha ou use *Próxima ↓*) e exemplos adaptados para **Crochê** e **Tricô**.
- **Modo PDF / Foto**: upload de arquivos PDF ou fotos de gráficos com **régua destacada "Onde parei"** ajustável.
- Sincronização bidirecional automática com o projeto ativo na bancada.

### 4. Contador de Carreiras
- Contadores simultâneos com incremento/decremento rápido, cálculo automático do total de pontos no trabalho, meta de carreiras com alarme visual/sonoro offline (Web Audio API), vibração tátil no celular e sincronização em tempo real com o projeto ativo.

### 5. Calculadora de Precificação
- Cálculo em tempo real de linhas (em **unidades/novelos** ou **gramas**), mão de obra (com importação automática das horas do cronômetro do projeto), acessórios/extras e margem de lucro com controle deslizante (*slider*).
- **Integração com Inventário de Fios e Aviamentos**: botão **Estoque** (autocomplete, cálculo de sobras e gaveta lateral) e botão **`🎀 Aviamentos`** (puxa custos de `Agulhas e Acessórios`).
- Suporte reativo às Configurações: moeda (`R$` / `$` / `€`), valor/hora padrão, margem padrão, nome do ateliê e assinatura personalizada ao copiar o orçamento.

### 6. Inventário de Fios
- Cadastro de linhas com marca, cor, código, lote, TEX, composição, peso, metragem, agulha recomendada (crochê e tricô), localização, preço e upload de foto com compressão automática.
- Controle rápido `- / +`, badges de resumo consolidado, tela de detalhes com ficha técnica, duplicação e backup/importação `.json`.

### 7. Agulhas e Acessórios
- Arquitetura em **3 zonas** (abas com subfiltros `Crochê`, `Tricô Reto`, `Tricô Circular`, `Tapeçaria`; toolbar compacta com busca e alternador Grade/Lista; grade responsiva de 3 → 4 colunas ao recolher a barra lateral).
- Drawer lateral com campos dinâmicos por categoria, calculadora de custo unitário a partir do pacote, toggle **`Em Uso / Livre`** sincronizado automaticamente ao retirar um projeto, ajuste `- / +` para aviamentos e modal de confirmação de exclusão.

### 8. Calculadora de Amostra (Tensão do Ponto) + Modo Avançado
- Dois modos via pílula deslizante (*Por Medida Desejada* e *Adaptar Receita*), conversão **`cm ↔ pol`**, steppers, visualização proporcional da trama, fita métrica elástica, contador rolante (*count-up*), salvamento integrado ao Banco de Amostras e atualização reativa com as Configurações.
- **Modo Avançado (`⚡ On/Off`)**: integra Fio, Agulha, pontos-base (**Ponto Baixo** para Crochê e **Ponto Malha** para Tricô), listinha personalizável de pontos e modelos do Banco de Amostras, com estimativa de consumo em gramas, metros e novelos.

### 9. Banco de Amostras
- Galeria de modelos de pontos com busca em tempo real, chips de filtro, favoritos com efeito *pop*, duplicação, detalhes e botão **`Usar na Calculadora`** que preenche automaticamente a Calculadora de Amostra.

### 10. Configurações e Temas Harmonizados
- **Ateliê e Perfil**: nome do ateliê, assinatura para orçamentos e **Técnica Principal** (`Crochê`, `Tricô` ou `Ambos`) refletida em projetos, amostras, agulhas e placeholders.
- **Aparência e Leitura (`frontend/styles/base/temas.css`)**: 3 temas visuais totalmente harmonizados com alto contraste AA/AAA (*Azul Marinho Clássico*, *Noite Profunda* em obsidiana + marfim suave e *Ateliê Claro* em pergaminho + marfim + azul-tinta, eliminando qualquer botão escuro com texto escuro), 3 tamanhos de fonte (*Compacto*, *Padrão*, *Grande*), toggle *Reduzir Animações* e estado inicial da barra lateral.
- **Padrões das Ferramentas**: alerta sonoro offline (com botão *Testar som*), alerta visual, vibração, *Manter tela acesa* (Wake Lock / nativo no Android), atalhos de teclado, valor/hora, margem, moeda, unidade padrão (`cm`/`pol`), vínculo automático de projetos e confetes.
- **Dados, Backup Unificado e Zona de Perigo**: diagnóstico em tempo real (SQLite vs. IndexedDB, contagem de registros e tamanho), **Exportar/Importar Backup Completo (`.json`)** com opção de *Mesclar* ou *Substituir Tudo* entre PC, Web e Android, restauração de padrões e limpeza seletiva com confirmação dupla.

### 11. App Android 100% Local e Layout Mobile Remodelado
- **Execução 100% local no celular (`mobile/android/`)**:
  - **Zero permissão de internet** (`android.permission.INTERNET` removida do `AndroidManifest.xml`), sem servidor HTTP local e sem abrir páginas web externas.
  - Todos os arquivos embutidos no APK são carregados diretamente em memória via `WebViewClient.shouldInterceptRequest` (padrão oficial Android `appassets.androidplatform.net`), mantendo **IndexedDB** e **localStorage** persistentes no aparelho.
  - **Ponte nativa Android (`PontoETramaAndroid`)**: sincroniza a cor da barra de status/navegação com o tema escolhido, mantém a tela acesa nativamente (`FLAG_KEEP_SCREEN_ON`) e salva backups `.json` diretamente pelo seletor de arquivos do celular (`ACTION_CREATE_DOCUMENT`).
  - **Ícone adaptativo com fundo escuro**: ícones Android (Android 7 a 15, padrão, redondo e adaptativo `mipmap-anydpi-v26`) com fundo gradiente azul-marinho escuro destacando a logo oficial sem alterar a logo transparente usada no Web e no App Ubuntu.
- **Layout mobile remodelado (`frontend/styles/base/mobile.css`)**:
  - Remodelagem completa para telas de celular (`≤ 768px` e `≤ 400px`) em **todas as 10 ferramentas**, com viewport real 1:1 no Android (`setLoadWithOverviewMode(false)` + `setTextZoom(100)`).
  - Gaveta lateral deslizante com fundo escurecido, cabeçalho flexível sem sobreposição, scroll vertical único por ferramenta, faixas de filtros/chips deslizáveis na horizontal, grades em 1 coluna, linhas da Calculadora de Precificação em mini-cards 2 colunas e modais/drawers em largura total.

### 12. Banco de Dados, Otimizações e Multiplataforma
- **Persistência dual com auto-reparo**:
  - **App Desktop Ubuntu**: banco relacional **SQL (SQLite)** local (`backend/database/ponto_e_trama.db` / [`schema.sql`](backend/database/schema.sql)) servido pelo backend Python (`backend/server.py`, sem dependências externas) com conexão persistente por thread, cache estático em RAM, `ETag / 304` e compressão **`gzip`**.
  - **Versão Web e App Android**: **IndexedDB** (`v4`) com auto-upgrade e fallback automático em `localStorage`.
- **Otimização de tamanho e resposta**:
  - Imagens otimizadas (`logo.png` reduzida de `312 KB` para `14 KB` e remoção de `3,1 MB` de imagens não utilizadas).
  - Minificação automática no empacotamento via [`scripts/otimizar-build.py`](scripts/otimizar-build.py) e compressão `xz -z9` no `.deb` (`139 KB`) e assinatura final no APK Android (`553 KB` já com o conjunto completo de ícones adaptativos em alta definição).
  - Remoção de `backdrop-filter: blur()` pesados, `content-visibility: auto`, scroll fluido em todas as telas e inicialização/sincronização sob demanda (*lazy init* + *lazy sync*).

---

## Estrutura do Projeto

```text
Ponto&Trama/
├── PontoETrama                              # Executável do App Desktop Ubuntu
├── AGENTS.md                                # Diretriz de sincronização Web <-> App <-> Mobile
├── README.md
├── scripts/
│   └── otimizar-build.py                    # Minificador seguro de HTML/CSS/JS para .deb e .apk
├── backend/
│   ├── server.py                            # Servidor HTTP local (gzip/ETag) + API REST SQLite
│   └── database/
│       └── schema.sql                       # Esquema relacional SQL (fios, itens_biblioteca, banco_amostras, projetos)
├── desktop/
│   ├── app.py                               # App nativo Ubuntu (GTK 3 + WebKit2GTK + SQLite)
│   ├── instalador-gui.py                    # Instalador gráfico GTK para Ubuntu
│   └── build-deb.sh                         # Gera o pacote dist/ponto-e-trama_1.0.0_all.deb
├── dist/
│   ├── ponto-e-trama_1.0.0_all.deb          # Instalador oficial Ubuntu (.deb - 139 KB)
│   ├── Ponto & Trama.desktop                # Lançador clicável do app
│   └── Instalar Ponto & Trama.desktop       # Lançador clicável do instalador gráfico
├── mobile/
│   ├── ponto-e-trama.apk                    # Aplicativo Android 100% local (.apk - 553 KB)
│   ├── build-apk.sh                         # Recompila, otimiza e assina o APK
│   ├── README.md
│   └── android/                             # Código-fonte Android (MainActivity.java, Manifest sem INTERNET, ícones adaptativos escuros)
└── frontend/
    ├── index.html                           # SPA compartilhada entre Web, Ubuntu e Android
    ├── assets/images/                       # Logo oficial otimizada
    ├── styles/
    │   ├── base/                            # global.css, mobile.css (layout celular), temas.css (3 temas)
    │   ├── layout/                          # barra-lateral.css
    │   └── modules/                         # CSS modularizado das 10 ferramentas
    └── src/{core,modules}/                  # JS modularizado (database, projeto-contexto, módulos)
```

---

## Como Recompilar os Instaladores após Alterações

```bash
# Regerar o instalador Ubuntu (.deb) e lançadores em dist/
./desktop/build-deb.sh

# Regerar o APK Android em mobile/ponto-e-trama.apk
./mobile/build-apk.sh
```
