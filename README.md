# Ferramente-Ponto-Trama — Ponto & Trama

Aplicação multiplataforma **100% offline e local** para organização profissional de artesanato em **crochê e tricô**, construída sobre uma única base compartilhada e distribuída em três versões sincronizadas: **Web (PWA)**, **App Desktop para Ubuntu (Linux)** e **App Mobile para Android**.

> **Início limpo em todas as plataformas:** ao baixar e abrir pela primeira vez (Web, Ubuntu ou Android), o **Inventário de Fios**, **Agulhas e Acessórios**, **Banco de Amostras** e **Gerenciador de Projetos** iniciam **completamente vazios (0 itens pré-cadastrados)**, prontos para você cadastrar seus próprios materiais e projetos.

---

## Downloads (Android, Linux/Ubuntu e Web)

| Plataforma | Arquivo | Tamanho | Onde baixar | Como instalar / abrir |
| :--- | :--- | :---: | :--- | :--- |
| **Android (Celular)** | `ponto-e-trama.apk` (`v1.0.1`) | `811 KB` | [Baixar APK (`mobile/ponto-e-trama.apk`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/mobile/ponto-e-trama.apk) | Copie o `.apk` para o celular (Android 7.0 a 15+), toque no arquivo e autorize a instalação. Roda **100% local**, sem permissão de internet. |
| **Linux / Ubuntu (Instalador `.deb`)** | `ponto-e-trama_1.0.0_all.deb` | `329 KB` | [Baixar `.deb` (`dist/ponto-e-trama_1.0.0_all.deb`)](https://github.com/vfflinux/Ferramente-Ponto-Trama/raw/main/dist/ponto-e-trama_1.0.0_all.deb) | Clique duas vezes no `.deb` (abre na Central de Aplicativos do Ubuntu) ou instale via `sudo apt install ./dist/ponto-e-trama_1.0.0_all.deb`. |
| **Linux / Ubuntu (Atalho gráfico)** | `Ponto & Trama.desktop` / `Instalar Ponto & Trama.desktop` | — | Pasta [`dist/`](dist/) | Clique com o botão direito → *Permitir iniciar* e dê duplo clique para abrir o app (`PontoETrama`) ou o instalador gráfico GTK (`desktop/instalador-gui.py`). |
| **Web (Navegador / PWA)** | `frontend/index.html` | — | [`frontend/index.html`](frontend/index.html) | Abra no navegador ou sirva `frontend/` (salva tudo localmente via IndexedDB + Service Worker offline-first). |

---

## Facilitadores Profissionais do Ateliê

- **Desfazer / Refazer Global (`Ctrl + Z` / `Ctrl + Y`) + Toast Interativo (`frontend/src/core/historico-acoes.js`):** qualquer contador zerado ou projeto removido exibe um toast flutuante com botão **`↩ Desfazer (Ctrl+Z)`** para reversão imediata.
- **Snapshots Automáticos Locais (Backup Rotativo — 5 Pontos de Restauração):** salva automaticamente os últimos 5 pontos de restauração locais antes de exclusões ou baixas de estoque (acessível via `Ctrl + K` → *Snapshots Automáticos* para criar pontos manuais ou restaurar em 1 clique).
- **Drag & Drop Universal na Janela:** arraste e solte qualquer arquivo diretamente sobre o aplicativo:
  - **Receitas (`.txt` / `.md`):** abrem automaticamente no **Leitor Interativo estilo Ribblr**.
  - **Fotos ou PDFs (`.png`, `.jpg`, `.webp`, `.pdf`):** abrem diretamente no **Visualizador com Régua "Onde parei"**.
  - **Backup (`.json`):** cria um snapshot de segurança e restaura os dados imediatamente.
- **Exportador de Ficha Técnica & Orçamento em PDF Limpo (`📄 Ficha PDF`):** disponível na **Home**, no **Workspace do Projeto** e na **Calculadora de Precificação**, gerando uma folha editorial pronta para imprimir ou salvar em PDF e enviar no WhatsApp para clientes.
- **Mini-Janela "Sempre no Topo" (`📌 Mini-Topo` / Atalho `F10`):** no App Desktop Ubuntu (`desktop/app.py` + `/api/desktop/mini-topo`), ativa `window.set_keep_above(True)` no GTK3 e redimensiona para um **Mini-Contador flutuante (`420×580`)**, ideal para tecer assistindo videoaulas ao lado.

---

## As 12 Ferramentas Integradas

> **Barra lateral enxuta, personalizável e arrastável:** em **Configurações → Aparência e Leitura**, você escolhe exatamente quais ferramentas ficam visíveis na barra lateral. As demais ficam na aba **Ferramentas**, que infla um popup conectado exibindo somente os ícones — e, com o popup aberto, basta **arrastar e soltar** ferramentas entre a barra lateral e o popup (ou reordená-las) para ativar/desativar em tempo real nas Configurações.

> **Busca Global / Paleta de Comandos (`Ctrl + K`):** disponível em todas as 12 telas (pelo atalho `Ctrl + K` / `Cmd + K` / `/` ou pelo ícone de lupa no cabeçalho). Digite `4.5`, `Amigurumi`, `Touca bebê`, `sc2tog`, `Snapshots`, `Mini-Janela` ou o nome de um projeto/fio e salte direto para o item, dicionário, tabela de conversão ou comando rápido com 1 clique.

### 1. Início — "Bancada Aberta do Ateliê"
- **Saudação contextual** por horário (*Bom dia / Boa tarde / Boa noite*) com tipografia editorial, etiqueta de tecido costurada (*woven label*) e data formatada em `pt-BR`.
- **Hero Card "Continue de Onde Parou":** exibe automaticamente o projeto na bancada (ou o mais recente *Em andamento*), capa/ícone, tags, anel circular SVG de progresso, contador de carreiras, tempo tecido, **previsão inteligente de término (`⏳ Faltam ~...`)**, **preview clicável da linha atual da Receita (`📜 Onde parei`)** e ações diretas (**`▶ Retomar Workspace`**, **`+1 Carreira`** com sincronização imediata, **`⛶ Tela Toda`** e **`📄 Ficha PDF`**) — ou um cartão de Boas-Vindas limpo quando o ateliê inicia vazio.
- **Métricas reais, alertas discretos e atalhos:** 3 cards clicáveis (*Em andamento*, *Novelos no estoque*, *Tempo tecido*), faixa condicional de prazos próximos/fios zerados, 5 atalhos de 1 toque e mini-cards dos projetos recentes.

### 2. Gerenciador de Projetos (Pastas / Fichários + Workspace)
- **Pastas / Fichários no Dashboard:** cards em formato de fichário com aba superior, capa ou ilustração, status colorido (*Na Fila*, *Em Andamento*, *Pausado*, *Concluído*), menu `⋯` (*Workspace*, *Retirar*, *Editar*, *Duplicar*, *Arquivar*, *Excluir* com suporte a `Ctrl + Z`) e barra de progresso.
- **Abertura Animada + Botão `Retirar`:**
  - Ao abrir uma pasta, as **7 fichas** (*Contadores*, *Receita & Notas*, *Fios & Agulha*, *Etapas*, *Amostra*, *Tempo & Preço* e *Gráfico Visual*) deslizam para formar o dossiê completo.
  - **`Retirar`** distribui o projeto para **todas as ferramentas** e exibe a barra global **"📂 Na bancada"** no topo — qualquer alteração feita em qualquer aba é salva automaticamente na pasta ativa.
- **Workspace do Projeto (2 Colunas no Desktop / 3 Abas fixas no Mobile):**
  - **Execução:** múltiplos contadores integrados (`+1` / `-1`, atalhos `Espaço`, `↑`, `↓`, vibração e alarme sonoro ao atingir a meta), cronômetro de trabalho (**Play / Pause** + envio direto das horas para a Precificação), leitor/editor de receitas e botão **`📄 Ficha PDF`** no topo.
  - **Metadados:** checklist de etapas com progresso automático ou manual (`0–100%`), celebração discreta (*confetes* + badge **`🎉 Peça Finalizada!`**), ficha técnica vinculada aos inventários de fios/agulhas e galeria de progresso com lightbox.
- **Baixa Automática no Estoque ao Concluir Projeto:** ao finalizar o projeto (`100%` ou status *Concluído*), grava um snapshot automático de segurança e exibe confirmação em 1 clique para descontar do estoque os novelos/gramas de fios e aviamentos utilizados.

### 3. Receitas e Anotações (Leitor Interativo estilo Ribblr + Conferência de Estoque + Tradutor)
- **Leitor Interativo estilo *Ribblr* (Checklist + Popover de Ponto):** ao colar, digitar ou arrastar um arquivo `.txt`/`.md`, cada carreira vira uma linha interativa com **checkbox para riscar** (somando **`+1` automaticamente no Contador Principal**), barra de progresso (`%`), destaque automático do total de pontos esperados (`[24]`, `(18)`) e **siglas clicáveis (`pb`, `mpa`, `pa`, `aum`, `dim`, `sc2tog`, `k2tog`...)** que abrem um mini-balão explicativo na hora sem sair da receita.
- **Conferência Automática de Estoque (`🧶 Conferir Estoque`):** analisa o texto da receita em busca de gramas, metragem, TEX e nomes/cores de fios e compara instantaneamente com os novelos disponíveis no seu **Inventário de Fios**.
- **Modo PDF / Foto:** carregamento ou drag-and-drop de PDFs/imagens de gráficos com **régua móvel "Onde parei"** e zoom por pinça/duplo toque.
- **Dicionário de Abreviações (`frontend/data/dicionario-pontos.json`) & Tradutor Automático (100% Offline):** catálogo multilíngue (**PT-BR**, **US**, **UK**, **ES**) e tradutor que preserva números/repetições (`*2 sc, inc* x6 → *2 pb, aum* x6`), destaca termos traduzidos e alerta sobre ambiguidades **US vs. UK**.

### 4. Contador de Carreiras + Modo Mãos-Livres, Ritmo/ETA & "Tela Toda"
- Múltiplos contadores simultâneos com números tabulares (`tabular-nums`), cálculo automático do total de pontos, meta de carreiras com alarme visual e sonoro offline (Web Audio API), vibração tátil no celular, reversão via **`Ctrl + Z`** ao zerar e sincronização bidirecional com o projeto na bancada, o **Leitor Interativo de Receitas** e o **Editor de Gráficos**.
- **Modo Mãos-Livres + Previsão Inteligente de Tempo (Ritmo & ETA):**
  - Pressione **`Espaço`** ou **`Seta ↑`** (ou pedal USB/Bluetooth) para somar `+1 carreira` e **`Seta ↓`** para diminuir `-1` sem tirar as mãos da agulha.
  - Calcula automaticamente o ritmo médio da sessão e a previsão de término (`⏱️ Ritmo: 45s/carr • Previsão: ~22 min`).
  - Botão **`📌 Mini-Topo (F10)`** para destacar o contador em janela compacta sempre no topo no Ubuntu Desktop.
- **Contadores Vinculados com Lembrete de Motivo (*estilo KnitCompanion*):** configure regras como *"Avisar a cada `4` carreiras: `Fazer aumento!`"* e/ou *"Ciclo de motivo de `8` carreiras"* (`Motivo 3/8`).
- **Modo "Toque na Tela Toda":** qualquer toque na tela soma `+1` (deslizar para baixo/esquerda subtrai `−1`) com cadeado de segurança contra toque acidental no botão zerar.

### 5. Calculadora de Precificação + Exportação em PDF
- Cálculo em tempo real de linhas (em **unidades/novelos** ou **gramas**), mão de obra (com importação das horas do cronômetro do projeto), acessórios/extras e margem de lucro com controle deslizante.
- **Integração com Estoque & Orçamento PDF:** botão **Estoque** (autocomplete, cálculo de sobras e gaveta lateral de fios), botão **`🎀 Aviamentos`** e botão **`📄 Gerar PDF`** para exportar a ficha de orçamento pronta para clientes.

### 6. Inventário de Fios — Prateleira de Cores / Pantone & Planejador de Manta *(inicia vazio)*
- **Visualização em Amostras de Cor (Swatches Pantone & Cinta de Meada):** cards com faixa ampla da cor real (`cor_hex`, inferida pelo nome ou extraída da foto), acabamento estilo **cinta de meada (*yarn band*)**, alternador **`🎨 Prateleira`** / **`▦ Compacto`** e indicador visual de saldo (*Cheio*, *Médio*, *Acabando*, *Zerado*).
- **Simulador de Combinação de Cores (2 a 5 fios):** teste harmonias ao vivo em **Listras**, **Granny Square (SVG concêntrico)** ou **Colunas Pantone**, com sugestão **`✨ Harmonia`**, aviso de TEX e exportação em **PNG**.
- **Gerador de Listras & Planejador de Manta (`🧣 Manta & Listras`):** escolha 2 a 6 fios, nº de carreiras e estilo (**Listras Harmônicas**, **Degradê**, **Padrão Escocês** ou **Manta da Temperatura** em `°C`), visualize em Canvas, confira o consumo estimado em gramas/novelos e envie a sequência de carreiras direto para **Receitas**.

### 7. Agulhas e Acessórios *(inicia vazio)*
- Organização em **3 zonas** (*Todas*, *Agulhas*, *Ferramentas* e *Aviamentos* + subfiltros *Crochê*, *Tricô Reto*, *Tricô Circular*, *Tapeçaria*), calculadora de custo unitário a partir do pacote e toggle **`Em Uso / Livre`** sincronizado com o projeto ativo.

### 8. Calculadora de Amostra + Esfera & Círculo Perfeito + Aumentos/Dim.
- Modos *Por Medida Desejada* e *Adaptar Receita*, conversão **`cm ↔ pol`**, visualização proporcional da trama, fita métrica elástica, **Modo Avançado (`⚡ On/Off`)** e salvamento no Banco de Amostras.
- **Gerador de Esfera (Amigurumi) & Círculo Plano Perfeito (`⚪ Esfera & Círculo`):** gera a receita carreira por carreira por nº de carreiras ou diâmetro em `cm` com **aumentos escalonados** (sem quinas hexagonais no amigurumi e sem embabadar no sousplat), diagrama SVG ao vivo e envio em 1 clique para **Receitas** ou **Projeto Ativo**.
- **Calculadora de Aumentos & Diminuições Uniformes:** calcula a sequência exata da carreira para crochê ou tricô, circular ou plano.

### 9. Banco de Amostras *(inicia vazio)*
- Galeria de pontos com busca instantânea, filtros por categoria e favoritos, visualização detalhada, duplicação e botão **`Usar na Calculadora`**.

### 10. Editor de Gráficos (Pixel Art / Tapestry / C2C + Símbolos de Crochê)
- **Editor de Grade Manual em HTML5 Canvas (60 fps):** pincel, borracha, balde de tinta, conta-gotas, linha, retângulo, elipse, seleção, espelhamento, simetria em tempo real, Undo/Redo, zoom/pan, importação de imagens com calibração de grade e modo execução sincronizado com o Contador.
- **Editor de Gráfico com Símbolos de Crochê (`✿ Símbolos` — Fileiras & Circular):** modo vetorial SVG com **14 símbolos padrão CYC** (anel mágico, correntinha, pbx, pb, mpa, pa, pad, aumento, diminuição, leque 3pa, pipoca, picô, relevo frente/trás), simetria radial (`1×/4×/6×/8×/12×`), 3 modelos prontos (*Sousplat*, *Flor 6 Pétalas* e *Barrado*), legenda automática e exportação **SVG** e **PNG**.

### 11. Tabelas de Conversão e Medidas (`frontend/data/tabelas-conversao.json`)
- **3 Abas com Indicador Deslizante:** *Agulhas* (`mm`, `US`, `UK`, `Letra`), *Espessura de Fios* (`CYC 0–7`, `TEX`, exemplos brasileiros) e *Medidas Padrão* (8 subcategorias de peças com dicas técnicas), conversor rápido com badge de estoque e toggle global `cm ↔ pol`.

### 12. Configurações, 8 Temas e Ecossistema Biomecânico de Aranhas (`<canvas>` 2D IK)
- **8 temas visuais harmonizados** com contraste WCAG AA/AAA: **Azul Marinho Clássico**, **Noite Profunda**, **Ateliê Claro**, **Linho & Terracota**, **Sálvia & Algodão**, **Ameixa & Veludo**, **Mel & Cacau** e **Floresta & Âmbar**.
- **Ecossistema Vivo de Aranhas do Ateliê (`frontend/src/core/aranhas-atelie.js` + `aranhas-cinematica-ik.js`):**
  - **Motor Biomecânico Híbrido `<canvas>` 2D HiDPI + Cinemática Inversa (IK) de 2 Juntas:** cada uma das 8 patas realiza *foot-planting* tetrapodal real no pixel exato da tela (fêmur + tíbia/tarso articulados), com **sombra de contato física 3D** que desloca e encolhe conforme a altura real `z`, micro-física de inércia (*follow-through* elástico no abdômen), *head-tracking* em micro-trancos (*saccades*) na Papa-Moscas e oclusão de fresta nas bordas dos cards.
  - **7 Espécies & 5 Presas com Locomoção Biológica Real:** *Ñanduobyeté*, *Papa-Moscas*, *Tecelã-de-Renda*, *Aranha-Caranguejo*, *Filhote Tecelão*, *Aranha Tecelã de Canto* e a lendária *Tarântula Golias (146 px)*; moscas com *saccades* de voo e caminhada após o pouso, mosquitos com voo senoidal duplo e *hovering*, baratas com rajadas curvas, lagartinhos com corrida *stop-and-go* e lagartas com ondas peristálticas.
  - **Comportamentos Etológicos Reais:** ritual completo de cortejo *Salticidae* em 5 fases e 3 desfechos reais; **disputa agonística por presa em 5 estágios** (*Modelo de Avaliação Sequencial*: convergência, avaliação em círculo, esgrima de patas dianteiras, clímax por bote de intimidação ou engalfinhamento giratório, vigilância da vencedora e fuga específica da espécie — exceto Golias); encontros interespecíficos reais (fugas distintas por espécie diante da Golias e intimidação/avaliação entre as demais); e **Tarântula Golias devorando lagarta e lagartinho pedaço por pedaço** com mastigação das quelíceras e descarte do *bolus*.
- **Sincronização Local via Wi-Fi (`backend/sync_wifi.py`):** QR Code SVG 100% offline, token temporário, direções **PC → Celular**, **Celular → PC** ou **Mesclar** e rollback automático.

---

## Arquitetura, Performance e Verificação Automatizada

- **Persistência dual com auto-reparo (`frontend/src/core/database.js`):**
  - **App Desktop Ubuntu (`./PontoETrama` / `.deb`):** banco **SQLite** local servido por [`backend/server.py`](backend/server.py) + interface nativa GTK3/WebKit2GTK ([`desktop/app.py`](desktop/app.py)) com `CacheModel.WEB_BROWSER`, aceleração 2D/WebGL e suporte a Mini-Janela Sempre no Topo (`F10`).
  - **Versão Web (PWA) e App Android:** **IndexedDB (`v4`)** + Service Worker offline-first ([`frontend/sw.js`](frontend/sw.js)) + `MainActivity.java` com cache de assets em memória (`ConcurrentHashMap`), `LAYER_TYPE_HARDWARE`, `RENDERER_PRIORITY_IMPORTANT` e gerenciamento de ciclo de vida `onPause`/`onResume`.
- **Otimização de Renderização (60+ FPS):**
  - Promoção de camada GPU restrita aos containers principais (`will-change: transform` + `contain: layout style`), `content-visibility: auto` nas grades/listas de cards, dirty-checking nas escritas DOM/SVG, FLIP em lote sem layout thrashing ([`frontend/src/core/animations.js`](frontend/src/core/animations.js)) e pausa real do `requestAnimationFrame` quando a aba está oculta.
- **Verificação e Build Automatizados:**
  - [`scripts/verificar-integridade.py`](scripts/verificar-integridade.py): valida compilação Python, referências de assets do `index.html` / `sw.js` e integridade dos módulos JS/CSS antes do empacotamento.
  - [`scripts/otimizar-build.py`](scripts/otimizar-build.py): minifica automaticamente HTML/CSS/JS (`-23%`) durante a geração do `.deb` e do `.apk`.

---

## Estrutura do Projeto

```text
Ponto&Trama/
├── PontoETrama                              # Executável direto do App Desktop Ubuntu
├── AGENTS.md                                # Diretriz de sincronização Web <-> Ubuntu <-> Android
├── README.md
├── scripts/
│   ├── verificar-integridade.py             # Auditoria automatizada pré-build (Python, HTML, SW, JS/CSS)
│   └── otimizar-build.py                    # Minificador de HTML/CSS/JS usado nos builds .deb e .apk
├── backend/
│   ├── server.py                            # Servidor HTTP local (gzip/ETag) + API REST SQLite + hook Mini-Topo
│   ├── sync_wifi.py                         # Sincronização Wi-Fi local (QR SVG offline, merge e rollback)
│   └── database/
│       └── schema.sql                       # Esquema SQL (fios, itens_biblioteca, banco_amostras, projetos)
├── desktop/
│   ├── app.py                               # App nativo Ubuntu (GTK 3 + WebKit2GTK + SQLite + Mini-Topo F10)
│   ├── instalador-gui.py                    # Instalador gráfico GTK para Ubuntu
│   └── build-deb.sh                         # Gera dist/ponto-e-trama_1.0.0_all.deb e lançadores .desktop
├── dist/
│   ├── ponto-e-trama_1.0.0_all.deb          # Instalador oficial Ubuntu (.deb — 329 KB)
│   ├── Ponto & Trama.desktop                # Lançador clicável do app
│   └── Instalar Ponto & Trama.desktop       # Lançador clicável do instalador gráfico
├── mobile/
│   ├── ponto-e-trama.apk                    # Aplicativo Android 100% local (.apk — 811 KB)
│   ├── build-apk.sh                         # Compila (aapt2/javac/d8), alinha e assina o APK
│   ├── README.md
│   └── android/
│       ├── AndroidManifest.xml              # Zero permissão INTERNET (100% offline)
│       ├── java/com/pontoetrama/app/
│       │   └── MainActivity.java            # Cache RAM de assets, Hardware Layer, WindowInsets Android 15
│       └── res/                             # Ícones adaptativos escuros (mdpi-xxxhdpi + anydpi-v26)
└── frontend/
    ├── index.html                           # SPA compartilhada entre Web, Ubuntu e Android
    ├── manifest.json                        # Manifesto PWA instalável offline
    ├── sw.js                                # Service Worker offline-first (cache v42)
    ├── assets/images/logo.png               # Logo oficial otimizada (15 KB)
    ├── data/
    │   ├── dicionario-pontos.json           # Catálogo multilíngue de pontos (PT-BR, US, UK, ES)
    │   └── tabelas-conversao.json           # Banco de agulhas, fios (CYC/TEX) e medidas padrão
    ├── styles/
    │   ├── base/                            # global.css (tabular-nums/content-visibility), mobile.css, temas.css
    │   ├── layout/                          # barra-lateral.css, busca-global.css, identidade-artesanal.css, aranhas-atelie.css
    │   └── modules/                         # CSS modularizado das 12 ferramentas + ferramentas-atelie-pro.css
    └── src/
        ├── main.js                          # Bootstrap com lazy init por ferramenta + registro SW
        ├── core/                            # database.js, projeto-contexto.js, historico-acoes.js, sidebar.js, busca-global.js, aranhas-cinematica-ik.js, aranhas-atelie.js, animations.js
        └── modules/                         # JS modularizado das 12 ferramentas + gerador-esfera-circulo.js, planejador-manta.js, editor-simbolos-croche.js, tradutor-receitas.js
```

---

## Como Verificar e Recompilar os Instaladores após Alterações

```bash
# 1. Executar auditoria automatizada de integridade
python3 scripts/verificar-integridade.py

# 2. Regerar o instalador Ubuntu (.deb) e lançadores em dist/
./desktop/build-deb.sh

# 3. Regerar o APK Android em mobile/ponto-e-trama.apk
./mobile/build-apk.sh
```
