# Ferramente-Ponto-Trama — Ponto & Trama

Aplicação multiplataforma **100% offline** para organização de artesanato em **crochê e tricô**, disponível em três formatos sincronizados a partir da mesma base: **Web**, **App Desktop para Ubuntu (Linux)** e **App Mobile para Android**.

---

## Downloads (App Android e App Linux)

| Plataforma | Arquivo | Onde baixar | Como instalar |
| :--- | :--- | :--- | :--- |
| **Android (Celular)** | `ponto-e-trama.apk` | [Baixar APK (`mobile/ponto-e-trama.apk`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/mobile/ponto-e-trama.apk) | Copie o `.apk` para o celular (Android 7.0+), toque no arquivo e autorize a instalação. |
| **Linux / Ubuntu (Instalador `.deb`)** | `ponto-e-trama_1.0.0_all.deb` | [Baixar `.deb` (`dist/ponto-e-trama_1.0.0_all.deb`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/dist/ponto-e-trama_1.0.0_all.deb) | Clique duas vezes no `.deb` (abre a Central de Aplicativos do Ubuntu) ou rode `sudo apt install ./dist/ponto-e-trama_1.0.0_all.deb`. |
| **Linux / Ubuntu (Direto da pasta)** | `PontoETrama` + Instalador GTK | `dist/Ponto & Trama.desktop` e `dist/Instalar Ponto & Trama.desktop` | Após clonar o repositório, clique com o botão direito → *Permitir iniciar* ou execute `./PontoETrama` / `./desktop/instalar-ubuntu.sh`. |
| **Web (Navegador)** | `frontend/index.html` | Pasta [`frontend/`](frontend/index.html) | Abra `frontend/index.html` diretamente no navegador ou hospede a pasta `frontend/` (não precisa de servidor SQL). |

---

## Resumo do que foi adicionado

### 1. Tela Inicial (Home)
- Tela **Início** adicionada como entrada padrão (no Web, App Ubuntu e Android) com o cabeçalho do sistema e acesso direto aos botões **`+ Novo projeto`** e **`Ver meus projetos`**.
- Clique na logo da barra lateral para voltar rapidamente à Home.

### 2. Contador de Carreiras
- Contadores simultâneos com incremento/decremento rápido, cálculo automático do total de pontos no trabalho, meta de carreiras com alarme visual e persistência automática.

### 3. Calculadora de Precificação
- Cálculo em tempo real de linhas (em **unidades/novelos** ou **gramas**), mão de obra, acessórios/extras e margem de lucro com controle deslizante (*slider*).
- **Integração com Inventário de Fios**: botão **Estoque** com autocomplete, cálculo de sobras e gaveta lateral de consulta rápida.
- **Integração com Aviamentos (`Agulhas e Acessórios`)**: botão **`🎀 Aviamentos`** que lê os aviamentos cadastrados, soma o custo unitário exato pelas quantidades usadas na peça, exibe chips removíveis e discrimina tudo ao copiar o orçamento.

### 4. Inventário de Fios
- Cadastro de linhas com marca, cor, código, lote, TEX, composição, peso, metragem, agulha recomendada, localização, preço e upload de foto com compressão automática.
- Controle rápido `- / +`, badges de resumo consolidado (novelos, peso total e valor em estoque), tela de detalhes com ficha técnica, duplicação e backup/importação `.json`.

### 5. Agulhas e Acessórios
- Arquitetura em **3 zonas**:
  1. **Abas internas** (`Todas`, `Agulhas`, `Ferramentas`, `Aviamentos`) com contadores e subfiltros rápidos para agulhas (`Crochê`, `Tricô Reto`, `Tricô Circular`, `Tapeçaria`).
  2. **Toolbar compacta** com busca instantânea, alternador de visualização **Grade / Lista (Tabela)**, filtro dinâmico de numeração (`mm`) e status (`Disponível`, `Em uso em projeto`, `Estoque baixo`).
  3. **Grade responsiva** que expande fluidamente de **3 para 4 colunas** ao recolher a barra lateral.
- **Drawer lateral deslizante** com formulário dinâmico por categoria, upload de foto, calculadora rápida de custo unitário a partir do pacote, toggle **`Em Uso / Livre`** para agulhas, ajuste rápido `- / +` com pulso de cor para aviamentos e modal de confirmação de exclusão.

### 6. Calculadora de Amostra (Tensão do Ponto) + Modo Avançado
- Layout **mobile-first** com dois modos via pílula deslizante (*sliding pill*):
  - **Por Medida Desejada**: calcula pontos iniciais e carreiras necessárias para o tamanho desejado da peça.
  - **Adaptar Receita**: ajusta automaticamente a receita original à sua tensão real com diagnóstico percentual.
- Conversão automática **`cm ↔ pol`**, botões stepper (`−` / `+`), visualização proporcional da trama, fita métrica elástica, contador rolante (*count-up*), opção de ver valor exato, cópia animada com toast, modal de ajuda (`?`) e salvamento por projeto (com opção marcada por padrão para **cadastrar automaticamente no Banco de Amostras**).
- **Modo Avançado (`⚡ On/Off`)**: integra **Fio do Inventário**, **Agulha do Inventário**, pontos-base (**Ponto Baixo** para Crochê e **Ponto Malha** para Tricô), listinha personalizável de novos pontos e modelos do **Banco de Amostras**, exibindo estimativa de consumo em **gramas, metros, novelos** e verificação de estoque.

### 7. Banco de Amostras
- Nova ferramenta na barra lateral para catalogar modelos de pontos (nome, técnica, categoria, tensão, fio, agulha em mm, dimensões, pontos × carreiras, peso/metragem gastos, foto com upload tracejado estilo pesponto, link de referência e anotações de blocagem).
- Busca em tempo real, chips de filtro (`Todos`, `Básicos`, `Fechados`, `Texturizados`, `Rendados`, `Relevo`, `★ Favoritos`), estrela com efeito *pop* fixando favoritos no topo, duplicação, edição, exclusão, modal de detalhes e botão **`Usar na Calculadora`** que envia os dados direto para a Calculadora de Amostra.

### 8. Banco de Dados, Otimizações e Multiplataforma
- **Persistência separada por ambiente**:
  - **App Desktop Ubuntu**: banco relacional **SQL (SQLite)** local em `backend/database/ponto_e_trama.db` ([`schema.sql`](backend/database/schema.sql)) servido pelo backend embarcado em Python (`backend/server.py`, sem dependências externas).
  - **Versão Web e App Android**: persistência simples e direta no **IndexedDB** local (sem precisar de servidor SQL).
- **Otimizações de performance**: cache em memória RAM (`< 0.1 ms`), carregamento paralelo de CSS (sem cascata `@import`), inicialização sob demanda das abas (*lazy init*), renderização em lote com `DocumentFragment`, debounce de `80 ms` nas buscas e `content-visibility: auto` nos cards.
- **Empacotamento**:
  - **Ubuntu Desktop (`desktop/` e `dist/`)**: app nativo GTK 3 + WebKit2GTK com ícone da logo, instalador gráfico GTK e pacote `.deb` oficial (`./desktop/build-deb.sh`).
  - **Android (`mobile/`)**: projeto Android nativo com `WebView` + servidor loopback offline, ícone da logo em todas as densidades (`mdpi` a `xxxhdpi`) e script de build `./mobile/build-apk.sh`.

---

## Estrutura do Projeto

```text
Ponto&Trama/
├── PontoETrama                              # Executável do App Desktop Ubuntu
├── iniciar.sh                               # Inicia servidor local Python + SQLite
├── AGENTS.md                                # Diretriz de sincronização Web <-> App <-> Mobile
├── README.md
├── backend/
│   ├── server.py                            # Servidor HTTP local + API REST SQLite (Python stdlib)
│   ├── database/
│   │   └── schema.sql                       # Esquema relacional SQL (fios, itens_biblioteca, banco_amostras, projetos)
│   └── legacy/
│       └── prototipo-calculo.js
├── desktop/
│   ├── app.py                               # App nativo Ubuntu (GTK 3 + WebKit2GTK + SQLite)
│   ├── instalador-gui.py                    # Instalador gráfico GTK para Ubuntu
│   ├── instalar-ubuntu.sh                   # Registra app + ícone no menu do Ubuntu
│   ├── build-deb.sh                         # Gera o pacote dist/ponto-e-trama_1.0.0_all.deb
│   └── ponto-e-trama.desktop
├── dist/
│   ├── ponto-e-trama_1.0.0_all.deb          # Instalador oficial Ubuntu (.deb)
│   ├── Ponto & Trama.desktop                # Lançador clicável do app
│   └── Instalar Ponto & Trama.desktop       # Lançador clicável do instalador gráfico
├── mobile/
│   ├── ponto-e-trama.apk                    # Aplicativo instalável Android (.apk)
│   ├── build-apk.sh                         # Recompila e assina o APK
│   ├── README.md
│   └── android/                             # Código-fonte Android (MainActivity.java, Manifest, ícones)
├── docs/
│   └── requisitos-ferramentas.txt
└── frontend/
    ├── index.html                           # SPA compartilhada entre Web, Ubuntu e Android
    ├── assets/images/                       # Logo oficial e imagens
    ├── styles/{base,layout,modules}/        # CSS modularizado
    └── src/{core,modules}/                  # JS modularizado + main.js
```

---

## Como Recompilar os Instaladores após Alterações

```bash
# Regerar o instalador Ubuntu (.deb) e lançadores em dist/
./desktop/build-deb.sh

# Regerar o APK Android em mobile/ponto-e-trama.apk
./mobile/build-apk.sh
```
