// ==========================================================================
// PONTO & TRAMA — BUSCA GLOBAL / PALETA DE COMANDOS (CTRL + K)
// Inspirada em Linear + Raycast + Notion. 100% offline e instantânea.
// Pesquisa unificada em: Projetos, Fios, Agulhas & Acessórios, Amostras,
// Dicionário de Pontos (PT/US/UK/ES), Tabelas de Conversão e Ações Rápidas.
// ==========================================================================

const BuscaGlobal = (() => {
  const STORAGE_RECENTES_KEY = "ponto_trama_busca_recentes_v1";
  const MAX_RECENTES = 5;

  const ESCOPOS = [
    { id: "tudo", rotulo: "Tudo" },
    { id: "projetos", rotulo: "Projetos" },
    { id: "fios", rotulo: "Fios" },
    { id: "agulhas", rotulo: "Agulhas" },
    { id: "pontos", rotulo: "Pontos" },
    { id: "tabelas", rotulo: "Tabelas" },
    { id: "acoes", rotulo: "Ações" }
  ];

  const ORDEM_GRUPOS = [
    { id: "projetos", titulo: "Projetos", icone: "📂" },
    { id: "fios", titulo: "Fios no Estoque", icone: "🧶" },
    { id: "agulhas", titulo: "Agulhas & Acessórios", icone: "🪡" },
    { id: "amostras", titulo: "Banco de Amostras", icone: "🧪" },
    { id: "pontos", titulo: "Dicionário de Pontos", icone: "📖" },
    { id: "tabelas", titulo: "Tabelas de Conversão & Medidas", icone: "📏" },
    { id: "acoes", titulo: "Ferramentas & Ações Rápidas", icone: "⚡" }
  ];

  const FERRAMENTAS_APP = [
    { chave: "home", nome: "Início (Bancada do Ateliê)", icone: "🏠", sub: "Resumo do projeto ativo, métricas e atalhos", palavras: "home inicio bancada painel resumo" },
    { chave: "projetos", nome: "Gerenciador de Projetos", icone: "📂", sub: "Pastas, etapas, receitas, fios e prazos", palavras: "projetos pastas workspace tarefas encomendas" },
    { chave: "contador-carreiras", nome: "Contador de Carreiras", icone: "🔢", sub: "Contadores, metas e modo Tela Toda", palavras: "contador carreiras pontos voltas cronometro" },
    { chave: "receitas", nome: "Receitas, Tradutor & Dicionário", icone: "📜", sub: "Leitor de PDF/texto, tradutor US/UK/ES e pontos", palavras: "receitas pdf tradutor dicionario siglas pontos" },
    { chave: "precificacao", nome: "Calculadora de Precificação", icone: "💰", sub: "Custos de fios, hora trabalhada e margem", palavras: "precificacao preco venda custo lucro orcamento" },
    { chave: "fios", nome: "Inventário de Fios (Prateleira Pantone)", icone: "🧶", sub: "Estoque de novelos, cores, lotes e simulador", palavras: "fios novelos estoque cores pantone paleta" },
    { chave: "agulhas", nome: "Agulhas & Acessórios", icone: "🪡", sub: "Agulhas, aviamentos, olhos e marcadores", palavras: "agulhas acessorios aviamentos ganchos mm" },
    { chave: "amostra", nome: "Calculadora de Amostra & Medidas", icone: "📐", sub: "Regra de 3, tensão, aumentos e diminuições", palavras: "amostra tensao gauge pontos centimetros aumentos" },
    { chave: "banco-amostras", nome: "Banco de Amostras", icone: "🧪", sub: "Histórico de amostras de tensão salvas", palavras: "banco amostras historico tensao fotos" },
    { chave: "editor-graficos", nome: "Editor de Gráficos (Pixel Art / Tapestry)", icone: "🎨", sub: "Grade de pixels, crochê conduzido e C2C", palavras: "graficos pixel art tapestry c2c grade desenho" },
    { chave: "tabelas-conversao", nome: "Tabelas de Conversão e Medidas", icone: "📏", sub: "Agulhas mm/US/UK, TEX/CYC e medidas padrão", palavras: "tabelas conversao medidas touca meia blusa manta bolsa cyc tex" },
    { chave: "configuracoes", nome: "Configurações", icone: "⚙️", sub: "Temas, nome do ateliê, barra lateral e backup", palavras: "configuracoes tema claro escuro backup exportar importar" }
  ];

  let jaInicializado = false;
  let aberta = false;
  let escopoAtivo = "tudo";
  let termoAtual = "";
  let resultadosAtuais = [];
  let indiceSelecionado = 0;
  let elementoFocoAnterior = null;
  let indiceCache = null; // Cache montado a cada abertura para resposta < 10ms

  // ==========================================================================
  // NORMALIZAÇÃO E UTILITÁRIOS (RN02)
  // ==========================================================================

  function escapeHtml(txt) {
    return String(txt == null ? "" : txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizarTexto(txt) {
    return String(txt || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(\d)mm\b/g, "$1 mm")
      .replace(/\s+/g, " ")
      .trim();
  }

  function destacarTermo(textoOriginal, query) {
    const seguro = escapeHtml(textoOriginal || "");
    const tokens = normalizarTexto(query)
      .split(" ")
      .filter((t) => t.length >= 2);
    if (tokens.length === 0) return seguro;

    let resultado = seguro;
    // Destaca o primeiro token mais longo encontrado (case-insensitive simples sem quebrar HTML)
    const ordenados = [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 3);
    ordenados.forEach((tok) => {
      const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${esc})`, "gi");
      resultado = resultado.replace(re, "<mark class=\"busca-global-mark\">$1</mark>");
    });
    return resultado;
  }

  function formatarIntervaloCm(val) {
    if (Array.isArray(val) && val.length === 2) {
      return `${val[0]}–${val[1]} cm`;
    }
    if (typeof val === "number") return `${val} cm`;
    return val ? String(val) : "";
  }

  function lerRecentes() {
    try {
      const raw = localStorage.getItem(STORAGE_RECENTES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function salvarRecente(item) {
    if (!item || !item.chaveRecente) return;
    try {
      const atual = lerRecentes().filter((r) => r.chaveRecente !== item.chaveRecente);
      atual.unshift({
        chaveRecente: item.chaveRecente,
        grupo: item.grupo,
        titulo: item.titulo,
        subtitulo: item.subtitulo || "",
        icone: item.icone || "🔎",
        corSwatch: item.corSwatch || null,
        badge: item.badge || "",
        acaoMeta: item.acaoMeta
      });
      localStorage.setItem(STORAGE_RECENTES_KEY, JSON.stringify(atual.slice(0, MAX_RECENTES)));
    } catch {
      // ignora
    }
  }

  // ==========================================================================
  // NAVEGAÇÃO DIRETA (DEEP-LINKING ENTRE OS 12 MÓDULOS — RN01)
  // ==========================================================================

  function irParaFerramenta(chave) {
    const botao = document.querySelector(`.barraLateral .botaoFerramenta[data-ferramenta="${chave}"]`);
    if (botao && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
      BarraLateral.alternarFerramenta(botao);
    } else if (typeof PontoTramaApp !== "undefined" && typeof PontoTramaApp.garantirModulo === "function") {
      PontoTramaApp.garantirModulo(chave);
    }
    // Fecha a gaveta no mobile se estiver aberta
    const chkMenu = document.getElementById("opcao-menu");
    if (chkMenu && window.innerWidth <= 768) {
      chkMenu.checked = true;
    }
  }

  function executarAcaoMeta(meta) {
    if (!meta || !meta.tipo) return;
    fechar();

    switch (meta.tipo) {
      case "ferramenta":
        irParaFerramenta(meta.chave);
        break;

      case "projeto":
        irParaFerramenta("projetos");
        setTimeout(() => {
          if (typeof GerenciadorProjetos !== "undefined" && typeof GerenciadorProjetos.abrirWorkspacePorId === "function") {
            GerenciadorProjetos.abrirWorkspacePorId(meta.id);
          }
        }, 70);
        break;

      case "fio":
        irParaFerramenta("fios");
        setTimeout(() => {
          if (typeof InventarioFios !== "undefined" && typeof InventarioFios.abrirModalDetalhesPorId === "function") {
            InventarioFios.abrirModalDetalhesPorId(meta.id);
          }
        }, 120);
        break;

      case "agulha":
        irParaFerramenta("agulhas");
        setTimeout(() => {
          if (typeof InventarioAgulhas !== "undefined" && typeof InventarioAgulhas.abrirDrawer === "function") {
            InventarioAgulhas.abrirDrawer(meta.id);
          }
        }, 120);
        break;

      case "amostra":
        irParaFerramenta("banco-amostras");
        setTimeout(() => {
          if (typeof BancoAmostras !== "undefined" && typeof BancoAmostras.abrirModalDetalhes === "function") {
            BancoAmostras.abrirModalDetalhes(meta.id);
          }
        }, 120);
        break;

      case "ponto":
        irParaFerramenta("receitas");
        setTimeout(() => {
          if (typeof TradutorReceitas !== "undefined" && typeof TradutorReceitas.abrirNoDicionario === "function") {
            TradutorReceitas.abrirNoDicionario(meta.busca || "");
          }
        }, 80);
        break;

      case "tabela":
        irParaFerramenta("tabelas-conversao");
        setTimeout(() => {
          if (typeof TabelasConversao !== "undefined" && typeof TabelasConversao.abrirComBusca === "function") {
            TabelasConversao.abrirComBusca(meta.aba, meta.subcategoria || null, meta.termo || "");
          }
        }, 60);
        break;

      case "comando":
        executarComandoRapido(meta.comando);
        break;
    }
  }

  function executarComandoRapido(comando) {
    switch (comando) {
      case "novo-projeto":
        irParaFerramenta("projetos");
        setTimeout(() => window.dispatchEvent(new CustomEvent("ponto-trama:novo-projeto")), 60);
        break;

      case "novo-fio":
        irParaFerramenta("fios");
        setTimeout(() => document.getElementById("btn-novo-fio")?.click(), 100);
        break;

      case "tela-toda":
        irParaFerramenta("contador-carreiras");
        setTimeout(() => {
          if (typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.abrirTelaToda === "function") {
            ContadorCarreiras.abrirTelaToda();
          }
        }, 60);
        break;

      case "simulador-cores":
        irParaFerramenta("fios");
        setTimeout(() => {
          if (typeof InventarioFios !== "undefined" && typeof InventarioFios.abrirSimuladorCores === "function") {
            InventarioFios.abrirSimuladorCores();
          }
        }, 120);
        break;

      case "tradutor-receitas":
        irParaFerramenta("receitas");
        setTimeout(() => {
          if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.alternarModo === "function") {
            LeitorReceitas.alternarModo("tradutor");
          }
        }, 60);
        break;

      case "dicionario-pontos":
        irParaFerramenta("receitas");
        setTimeout(() => {
          if (typeof TradutorReceitas !== "undefined" && typeof TradutorReceitas.abrirNoDicionario === "function") {
            TradutorReceitas.abrirNoDicionario("");
          }
        }, 60);
        break;

      case "alternar-tema":
        if (typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function" && typeof Configuracoes.atualizar === "function") {
          const temas = ["classico", "noite", "claro", "linho", "salvia", "ameixa", "mel", "floresta"];
          const atual = Configuracoes.obter("tema") || "classico";
          const prox = temas[(temas.indexOf(atual) + 1) % temas.length];
          Configuracoes.atualizar("tema", prox);
        }
        break;

      case "chamar-aranha":
        if (typeof AranhasAtelie !== "undefined" && typeof AranhasAtelie.invocarAgora === "function") {
          AranhasAtelie.invocarAgora();
        }
        break;
    }
  }

  // ==========================================================================
  // CONSTRUÇÃO DO ÍNDICE UNIFICADO (7 DOMÍNIOS — 100% OFFLINE)
  // ==========================================================================

  function criarComandosRapidos() {
    const acoes = [
      {
        chaveRecente: "cmd:novo-projeto",
        grupo: "acoes",
        titulo: "Criar Novo Projeto",
        subtitulo: "Abrir formulário de nova pasta de projeto",
        icone: "＋",
        badge: "Ação",
        palavras: "novo projeto criar pasta iniciar peca encomenda",
        acaoMeta: { tipo: "comando", comando: "novo-projeto" }
      },
      {
        chaveRecente: "cmd:novo-fio",
        grupo: "acoes",
        titulo: "Cadastrar Novo Fio",
        subtitulo: "Adicionar novelo à Prateleira de Cores Pantone",
        icone: "🧶",
        badge: "Ação",
        palavras: "novo fio cadastrar novelo linha cor estoque",
        acaoMeta: { tipo: "comando", comando: "novo-fio" }
      },
      {
        chaveRecente: "cmd:tela-toda",
        grupo: "acoes",
        titulo: "Abrir Contador em Tela Toda",
        subtitulo: "Modo foco para contar carreiras com 1 toque",
        icone: "⛶",
        badge: "Ação",
        palavras: "tela toda contador fullscreen carreiras modo foco",
        acaoMeta: { tipo: "comando", comando: "tela-toda" }
      },
      {
        chaveRecente: "cmd:simulador-cores",
        grupo: "acoes",
        titulo: "Abrir Simulador de Combinação de Cores",
        subtitulo: "Testar 2 a 5 fios em Listras, Granny Square ou Pantone",
        icone: "🌈",
        badge: "Ação",
        palavras: "simulador combinar cores paleta granny square listras pantone harmonia",
        acaoMeta: { tipo: "comando", comando: "simulador-cores" }
      },
      {
        chaveRecente: "cmd:tradutor-receitas",
        grupo: "acoes",
        titulo: "Abrir Tradutor de Receitas (US / UK / ES → PT)",
        subtitulo: "Traduzir abreviações de receitas instantaneamente",
        icone: "🌐",
        badge: "Ação",
        palavras: "tradutor traduzir receita ingles us uk espanhol siglas",
        acaoMeta: { tipo: "comando", comando: "tradutor-receitas" }
      },
      {
        chaveRecente: "cmd:dicionario-pontos",
        grupo: "acoes",
        titulo: "Abrir Dicionário de Pontos",
        subtitulo: "Consultar abreviações de crochê e tricô em 4 idiomas",
        icone: "📖",
        badge: "Ação",
        palavras: "dicionario glossario pontos abreviacoes siglas croche trico",
        acaoMeta: { tipo: "comando", comando: "dicionario-pontos" }
      },
      {
        chaveRecente: "cmd:alternar-tema",
        grupo: "acoes",
        titulo: "Alternar Tema Visual",
        subtitulo: "Clássico, Noite, Claro, Linho, Sálvia, Ameixa, Mel ou Floresta",
        icone: "🎨",
        badge: "Tema",
        palavras: "tema escuro claro noite classico linho terracota salvia algodao ameixa roxo veludo mel cacau dourado floresta verde ambar aparencia dark light",
        acaoMeta: { tipo: "comando", comando: "alternar-tema" }
      },
      {
        chaveRecente: "cmd:chamar-aranha",
        grupo: "acoes",
        titulo: "Chamar Aranha Tecelã Agora",
        subtitulo: "Invoca uma das 5 espécies Ñanduobyeté para passear pela tela",
        icone: "🕷️",
        badge: "Ateliê",
        palavras: "aranha nanduobyete teia papa moscas caranguejo tecela filhote chamar invocar animacao",
        acaoMeta: { tipo: "comando", comando: "chamar-aranha" }
      }
    ];

    const ferramentas = FERRAMENTAS_APP.map((f) => ({
      chaveRecente: `tool:${f.chave}`,
      grupo: "acoes",
      titulo: f.nome,
      subtitulo: f.sub,
      icone: f.icone,
      badge: "Ferramenta",
      palavras: `${f.nome} ${f.sub} ${f.palavras}`,
      acaoMeta: { tipo: "ferramenta", chave: f.chave }
    }));

    return [...acoes, ...ferramentas];
  }

  async function construirIndice() {
    const itens = [];

    // 1. Dados do banco local (Projetos, Fios, Agulhas/Acessórios, Amostras)
    let projetos = [], fios = [], biblioteca = [], amostras = [];
    if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.obterTodos === "function") {
      try {
        [projetos, fios, biblioteca, amostras] = await Promise.all([
          BancoDadosPT.obterTodos("projetos").catch(() => []),
          BancoDadosPT.obterTodos("fios").catch(() => []),
          BancoDadosPT.obterTodos("itens_biblioteca").catch(() => []),
          BancoDadosPT.obterTodos("banco_amostras").catch(() => [])
        ]);
      } catch {
        // segue com listas vazias
      }
    }

    const rotStatus = {
      na_fila: "Na fila",
      em_andamento: "Em andamento",
      pausado: "Pausado",
      concluido: "Concluído",
      arquivado: "Arquivado"
    };

    (projetos || []).forEach((p) => {
      if (!p) return;
      const st = rotStatus[p.status] || p.status || "Projeto";
      const tec = p.tecnica === "trico" ? "Tricô" : "Crochê";
      const c0 = Array.isArray(p.contadores) && p.contadores[0] ? ` • Carr. ${p.contadores[0].carreiras || 0}` : "";
      itens.push({
        chaveRecente: `proj:${p.id}`,
        grupo: "projetos",
        titulo: p.nome || "Projeto sem nome",
        subtitulo: `${tec}${p.cliente ? ` • ${p.cliente}` : ""}${c0}`,
        icone: "📂",
        badge: st,
        buscaPrincipal: normalizarTexto(p.nome || ""),
        buscaCompleta: normalizarTexto(`${p.nome || ""} ${p.categoria || ""} ${tec} ${p.cliente || ""} ${st} ${p.observacoes || ""} ${p.agulha_tamanho || ""}`),
        acaoMeta: { tipo: "projeto", id: p.id }
      });
    });

    (fios || []).forEach((f) => {
      if (!f) return;
      const corHex =
        typeof InventarioFios !== "undefined" && typeof InventarioFios.obterCorRealFio === "function"
          ? InventarioFios.obterCorRealFio(f)
          : f.cor_hex || "#BFA893";
      const qtd = Number(f.quantidade) || 0;
      const qtdTxt = qtd % 1 === 0 ? String(qtd) : qtd.toFixed(1).replace(".", ",");
      const cod = f.cor_codigo ? ` #${f.cor_codigo}` : "";
      const tex = f.tex ? ` • TEX ${f.tex}` : "";
      itens.push({
        chaveRecente: `fio:${f.id}`,
        grupo: "fios",
        titulo: `${f.nome || "Fio"} — ${f.cor_nome || "Cor"}${cod}`,
        subtitulo: `${f.marca || "Marca"}${tex}${f.agulha ? ` • Ag. ${f.agulha}` : ""}${f.lote ? ` • Lote ${f.lote}` : ""}`,
        icone: "🧶",
        corSwatch: corHex,
        badge: `${qtdTxt} nov.`,
        buscaPrincipal: normalizarTexto(`${f.nome || ""} ${f.cor_nome || ""} ${f.cor_codigo || ""}`),
        buscaCompleta: normalizarTexto(`${f.nome || ""} ${f.marca || ""} ${f.cor_nome || ""} ${f.cor_codigo || ""} ${f.lote || ""} ${f.tex || ""} ${f.agulha || ""} ${f.composicao || ""} ${f.localizacao || ""}`),
        acaoMeta: { tipo: "fio", id: f.id }
      });
    });

    (biblioteca || []).forEach((it) => {
      if (!it) return;
      const tam = it.tamanho_mm ? `${it.tamanho_mm} mm` : it.tamanho || "";
      const cat = it.categoria === "aviamento" ? "Aviamento" : it.categoria === "ferramenta" ? "Ferramenta" : "Agulha";
      itens.push({
        chaveRecente: `bib:${it.id}`,
        grupo: "agulhas",
        titulo: it.nome || `${cat} ${tam}`.trim(),
        subtitulo: `${it.marca || cat}${tam ? ` • ${tam}` : ""}${it.material ? ` • ${it.material}` : ""}`,
        icone: it.categoria === "aviamento" ? "🧷" : it.categoria === "ferramenta" ? "✂️" : "🪡",
        badge: tam || cat,
        buscaPrincipal: normalizarTexto(`${it.nome || ""} ${tam}`),
        buscaCompleta: normalizarTexto(`${it.nome || ""} ${it.marca || ""} ${tam} ${it.tamanho_mm || ""} ${it.material || ""} ${it.tipo || ""} ${cat} ${it.localizacao || ""} ${it.observacoes || ""}`),
        acaoMeta: { tipo: "agulha", id: it.id }
      });
    });

    (amostras || []).forEach((a) => {
      if (!a) return;
      const tensao = a.pontos_10cm && a.carreiras_10cm ? `${a.pontos_10cm} pts × ${a.carreiras_10cm} carr / 10cm` : "";
      itens.push({
        chaveRecente: `amo:${a.id}`,
        grupo: "amostras",
        titulo: a.nome || "Amostra",
        subtitulo: `${a.fio_usado || "Fio"}${a.agulha ? ` • Ag. ${a.agulha}` : ""}${tensao ? ` • ${tensao}` : ""}`,
        icone: "🧪",
        badge: a.agulha || "Amostra",
        buscaPrincipal: normalizarTexto(`${a.nome || ""} ${a.ponto || ""}`),
        buscaCompleta: normalizarTexto(`${a.nome || ""} ${a.ponto || ""} ${a.fio_usado || ""} ${a.agulha || ""} ${a.observacoes || ""}`),
        acaoMeta: { tipo: "amostra", id: a.id }
      });
    });

    // 2. Dicionário de Pontos (PT / US / UK / ES)
    if (typeof TradutorReceitas !== "undefined") {
      let termosDic = [];
      if (typeof TradutorReceitas.garantirBaseDicionario === "function") {
        termosDic = await TradutorReceitas.garantirBaseDicionario().catch(() => []);
      } else if (typeof TradutorReceitas.obterTermos === "function") {
        termosDic = TradutorReceitas.obterTermos();
      }

      (termosDic || []).forEach((t) => {
        if (!t) return;
        const ptS = (t.siglas?.pt || []).join(", ");
        const usS = (t.siglas?.us || []).join(", ");
        const ukS = (t.siglas?.uk || []).join(", ");
        const esS = (t.siglas?.es || []).join(", ");
        const nomePt = t.nomes?.pt || t.id;
        const nomeUs = t.nomes?.us || "";
        const tec = t.tecnica === "trico" ? "Tricô" : t.tecnica === "ambos" ? "Crochê / Tricô" : "Crochê";
        const tituloSigla = usS && ptS && usS.toLowerCase() !== ptS.toLowerCase()
          ? `${ptS} ↔ ${usS} — ${nomePt}`
          : `${ptS || usS} — ${nomePt}`;

        itens.push({
          chaveRecente: `pt:${t.id}`,
          grupo: "pontos",
          titulo: tituloSigla,
          subtitulo: `${t.descricao || nomeUs}${ukS && ukS !== usS ? ` • UK: ${ukS}` : ""}${esS ? ` • ES: ${esS}` : ""}`,
          icone: "📖",
          badge: tec,
          buscaPrincipal: normalizarTexto(`${ptS} ${usS} ${ukS} ${esS} ${nomePt}`),
          buscaCompleta: normalizarTexto(`${t.id} ${ptS} ${usS} ${ukS} ${esS} ${nomePt} ${nomeUs} ${t.nomes?.uk || ""} ${t.nomes?.es || ""} ${t.descricao || ""} ${tec}`),
          acaoMeta: { tipo: "ponto", busca: (t.siglas?.us?.[0] || t.siglas?.pt?.[0] || nomePt) }
        });
      });
    }

    // 3. Tabelas de Conversão e Medidas Padrão
    if (typeof TabelasConversao !== "undefined" && typeof TabelasConversao.obterDados === "function") {
      const dadosTab = TabelasConversao.obterDados() || {};
      const metaSub = typeof TabelasConversao.obterMetaSubcategorias === "function"
        ? TabelasConversao.obterMetaSubcategorias()
        : {};

      // 3a. Agulhas mm / US / UK / Letra
      (dadosTab.agulhas_croche || []).forEach((ag) => {
        const mmStr = Number(ag.mm).toFixed(ag.mm % 1 === 0 ? 1 : 2).replace(/0$/, "");
        const usPart = ag.us && ag.us !== "—" ? `US ${ag.us}` : "";
        const ukPart = ag.uk && ag.uk !== "—" ? `UK ${ag.uk}` : "";
        const eq = [usPart, ukPart].filter(Boolean).join(" • ");
        itens.push({
          chaveRecente: `tab:ag:${mmStr}`,
          grupo: "tabelas",
          titulo: `Agulha ${mmStr} mm${eq ? ` (${eq})` : ""}`,
          subtitulo: ag.uso_comum || "Conversão de agulhas de crochê e tricô",
          icone: "📏",
          badge: "Agulhas",
          buscaPrincipal: normalizarTexto(`${mmStr} mm ${ag.mm} ${ag.us || ""} ${ag.letra || ""}`),
          buscaCompleta: normalizarTexto(`agulha ${mmStr} mm ${ag.mm} us ${ag.us || ""} uk ${ag.uk || ""} letra ${ag.letra || ""} ${ag.uso_comum || ""}`),
          acaoMeta: { tipo: "tabela", aba: "agulhas", termo: mmStr }
        });
      });

      // 3b. Espessuras de Fios (CYC / TEX / Exemplos BR)
      (dadosTab.espessura_fios || []).forEach((esp) => {
        const exemplos = Array.isArray(esp.exemplos_br) ? esp.exemplos_br.join(", ") : "";
        const faixaTex = esp.tex_max >= 9999 ? `${esp.tex_min}+` : `${esp.tex_min}–${esp.tex_max}`;
        itens.push({
          chaveRecente: `tab:fio:${esp.cyc}`,
          grupo: "tabelas",
          titulo: `CYC ${esp.cyc} — ${esp.nome_pt} (${esp.nome_internacional})`,
          subtitulo: `TEX ${faixaTex} • Ag. ${esp.agulha_sugerida_mm} mm${exemplos ? ` • Ex: ${exemplos}` : ""}`,
          icone: "🧵",
          badge: `CYC ${esp.cyc}`,
          buscaPrincipal: normalizarTexto(`cyc ${esp.cyc} ${esp.nome_pt} ${esp.nome_internacional} ${exemplos}`),
          buscaCompleta: normalizarTexto(`espessura fio cyc ${esp.cyc} ${esp.nome_pt} ${esp.nome_internacional} tex ${esp.tex_min} ${esp.tex_max} ${esp.agulha_sugerida_mm} ${exemplos}`),
          acaoMeta: { tipo: "tabela", aba: "fios", termo: esp.nome_internacional.split(" ")[0] }
        });
      });

      // 3c. Medidas Padrão (8 subcategorias: Toucas, Meias, Blusas, Calças, Vestidos, Cachecóis, Mantas, Bolsas)
      const medidas = dadosTab.medidas_padrao || {};
      Object.keys(medidas).forEach((subKey) => {
        const bloco = medidas[subKey];
        const meta = metaSub[subKey] || { rotulo: subKey, prefixoCopia: subKey, palavras: [], colunas: [] };
        (bloco.itens || []).forEach((linha, idx) => {
          const nomeItem = linha.tamanho || linha.numeracao_br || linha.modelo || "";
          const detalhes = (meta.colunas || [])
            .slice(1, 4)
            .map((col) => {
              const v = linha[col.key];
              if (v === undefined || v === null) return "";
              const f = col.tipo === "medida" ? formatarIntervaloCm(v) : String(v);
              return `${col.copia || col.label}: ${f}`;
            })
            .filter(Boolean)
            .join(" • ");

          itens.push({
            chaveRecente: `tab:med:${subKey}:${idx}`,
            grupo: "tabelas",
            titulo: `${meta.prefixoCopia} — ${nomeItem}`,
            subtitulo: detalhes || meta.rotulo,
            icone: "📐",
            badge: meta.curto || meta.rotulo,
            buscaPrincipal: normalizarTexto(`${meta.prefixoCopia} ${meta.rotulo} ${nomeItem}`),
            buscaCompleta: normalizarTexto(`${meta.rotulo} ${meta.prefixoCopia} ${(meta.palavras || []).join(" ")} ${nomeItem} ${detalhes}`),
            acaoMeta: { tipo: "tabela", aba: "medidas", subcategoria: subKey, termo: nomeItem.split("(")[0].trim() }
          });
        });
      });
    }

    // 4. Ferramentas & Comandos Rápidos
    criarComandosRapidos().forEach((cmd) => {
      itens.push({
        ...cmd,
        buscaPrincipal: normalizarTexto(cmd.titulo),
        buscaCompleta: normalizarTexto(`${cmd.titulo} ${cmd.subtitulo} ${cmd.palavras || ""}`)
      });
    });

    indiceCache = itens;
    return itens;
  }

  // ==========================================================================
  // MOTOR DE BUSCA E RANQUEAMENTO INSTANTÂNEO
  // ==========================================================================

  function filtrarERanquear(query, escopo) {
    const lista = indiceCache || [];
    const qNorm = normalizarTexto(query);

    // Estado vazio: mostra Recentes + Ações Rápidas + Ferramentas principais
    if (!qNorm) {
      if (escopo !== "tudo") {
        return lista
          .filter((it) => (escopo === "agulhas" ? it.grupo === "agulhas" || it.grupo === "amostras" : it.grupo === escopo))
          .slice(0, 18);
      }

      const recentes = lerRecentes().map((r) => ({ ...r, ehRecente: true }));
      const acoes = lista.filter((it) => it.grupo === "acoes").slice(0, 7);
      const projetosRecentes = lista.filter((it) => it.grupo === "projetos").slice(0, 3);
      return [...recentes, ...projetosRecentes, ...acoes];
    }

    const tokens = qNorm.split(" ").filter(Boolean);
    const pontuados = [];

    for (let i = 0; i < lista.length; i++) {
      const it = lista[i];
      if (escopo !== "tudo") {
        const bateEscopo =
          escopo === "agulhas"
            ? it.grupo === "agulhas" || it.grupo === "amostras"
            : it.grupo === escopo;
        if (!bateEscopo) continue;
      }

      const completo = it.buscaCompleta || "";
      let todosBateram = true;
      for (let t = 0; t < tokens.length; t++) {
        if (!completo.includes(tokens[t])) {
          todosBateram = false;
          break;
        }
      }
      if (!todosBateram) continue;

      const principal = it.buscaPrincipal || "";
      let score = 0;

      if (principal === qNorm) score += 140;
      else if (principal.startsWith(qNorm)) score += 90;
      else if (principal.includes(qNorm)) score += 60;

      tokens.forEach((tok) => {
        if (principal === tok) score += 80;
        else if (principal.startsWith(tok) || principal.includes(` ${tok}`)) score += 40;
        else if (principal.includes(tok)) score += 24;
        else score += 12;
      });

      // Leve prioridade para itens do próprio usuário (projetos, fios, agulhas)
      if (it.grupo === "projetos") score += 8;
      if (it.grupo === "fios") score += 6;
      if (it.grupo === "agulhas") score += 5;
      if (it.grupo === "pontos") score += 7;

      pontuados.push({ item: it, score });
    }

    pontuados.sort((a, b) => b.score - a.score);

    // Limita por grupo para manter variedade quando escopo = "tudo"
    if (escopo === "tudo") {
      const contagemGrupo = {};
      const resultado = [];
      for (let i = 0; i < pontuados.length && resultado.length < 28; i++) {
        const it = pontuados[i].item;
        contagemGrupo[it.grupo] = (contagemGrupo[it.grupo] || 0) + 1;
        if (contagemGrupo[it.grupo] <= 5) {
          resultado.push(it);
        }
      }
      return resultado;
    }

    return pontuados.slice(0, 30).map((p) => p.item);
  }

  // ==========================================================================
  // RENDERIZAÇÃO DA PALETA DE COMANDOS (UI LINEAR / RAYCAST / NOTION)
  // ==========================================================================

  function renderizarEscopos() {
    const wrap = document.getElementById("busca-global-escopos");
    if (!wrap) return;
    wrap.innerHTML = "";
    ESCOPOS.forEach((esc) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `busca-escopo-chip${escopoAtivo === esc.id ? " ativo" : ""}`;
      btn.dataset.escopo = esc.id;
      btn.setAttribute("aria-pressed", String(escopoAtivo === esc.id));
      btn.textContent = esc.rotulo;
      btn.addEventListener("click", () => {
        escopoAtivo = esc.id;
        indiceSelecionado = 0;
        renderizarEscopos();
        renderizarResultados();
        document.getElementById("input-busca-global")?.focus();
      });
      wrap.appendChild(btn);
    });
  }

  function renderizarResultados() {
    const listaEl = document.getElementById("busca-global-lista");
    const contEl = document.getElementById("busca-global-contagem");
    const inputEl = document.getElementById("input-busca-global");
    if (!listaEl) return;

    resultadosAtuais = filtrarERanquear(termoAtual, escopoAtivo);
    if (indiceSelecionado >= resultadosAtuais.length) {
      indiceSelecionado = Math.max(0, resultadosAtuais.length - 1);
    }

    if (contEl) {
      const n = resultadosAtuais.length;
      contEl.textContent = termoAtual.trim()
        ? `${n} resultado${n === 1 ? "" : "s"}`
        : "Sugestões rápidas";
    }

    if (resultadosAtuais.length === 0) {
      listaEl.innerHTML = `
        <div class="busca-global-vazio">
          <span class="svg-vazio-artesanal compacto" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="34" cy="34" r="22" fill="currentColor" fill-opacity="0.08"></circle>
              <path d="M50 50 68 68" stroke-width="3.2"></path>
              <!-- Teia fina tecida dentro da lente -->
              <path d="M14 34h40M34 14v40M19 19l30 30M49 19 19 49" stroke-width="1.1" opacity="0.45"></path>
              <circle cx="34" cy="34" r="14" stroke-dasharray="3 3" stroke-width="1.2" opacity="0.55"></circle>
              <!-- Mini aranha tecelã no centro da teia -->
              <path d="M30 32 24 28 M29 35 23 36 M30 38 25 42 M38 32 44 28 M39 35 45 36 M38 38 43 42" stroke-width="1.4"></path>
              <polygon points="34,27 38,33 34,39 30,33" fill="currentColor" fill-opacity="0.35" stroke-width="1.5"></polygon>
              <circle cx="34" cy="41.5" r="2.3" fill="currentColor"></circle>
            </svg>
          </span>
          <strong>Nenhum resultado para "${escapeHtml(termoAtual)}"</strong>
          <span>Tente buscar por medidas (ex.: 4.5, Touca bebê), pontos (sc2tog, pbx), fios ou projetos.</span>
        </div>
      `;
      if (inputEl) inputEl.removeAttribute("aria-activedescendant");
      return;
    }

    // Agrupa preservando ordem lógica e atribuindo índice linear para ↑ ↓ Enter
    const blocos = [];
    const semBusca = !termoAtual.trim() && escopoAtivo === "tudo";

    if (semBusca) {
      const rec = resultadosAtuais.filter((x) => x.ehRecente);
      const proj = resultadosAtuais.filter((x) => !x.ehRecente && x.grupo === "projetos");
      const ac = resultadosAtuais.filter((x) => !x.ehRecente && x.grupo === "acoes");
      if (rec.length) blocos.push({ titulo: "Recentes", itens: rec });
      if (proj.length) blocos.push({ titulo: "Seus Projetos", itens: proj });
      if (ac.length) blocos.push({ titulo: "Ações Rápidas", itens: ac });
    } else {
      ORDEM_GRUPOS.forEach((g) => {
        const doGrupo = resultadosAtuais.filter((x) => x.grupo === g.id);
        if (doGrupo.length > 0) {
          blocos.push({ titulo: g.titulo, itens: doGrupo });
        }
      });
    }

    // Reordena resultadosAtuais exatamente na ordem renderizada para ↑/↓ bater 1:1
    const ordemPlana = [];
    const frag = document.createDocumentFragment();

    blocos.forEach((bloco) => {
      const header = document.createElement("div");
      header.className = "busca-grupo-titulo";
      header.textContent = bloco.titulo;
      frag.appendChild(header);

      bloco.itens.forEach((item) => {
        const idx = ordemPlana.length;
        ordemPlana.push(item);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `busca-item-resultado${idx === indiceSelecionado ? " selecionado" : ""}`;
        btn.id = `busca-global-opt-${idx}`;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", String(idx === indiceSelecionado));
        btn.dataset.idx = String(idx);

        const iconeHtml = item.corSwatch
          ? `<span class="busca-item-swatch" style="background-color: ${escapeHtml(item.corSwatch)};" aria-hidden="true"></span>`
          : `<span class="busca-item-icone" aria-hidden="true">${escapeHtml(item.icone || "🔎")}</span>`;

        const badgeHtml = item.badge
          ? `<span class="busca-item-badge">${escapeHtml(item.badge)}</span>`
          : "";

        btn.innerHTML = `
          ${iconeHtml}
          <div class="busca-item-textos">
            <div class="busca-item-titulo">${destacarTermo(item.titulo, termoAtual)}</div>
            ${item.subtitulo ? `<div class="busca-item-sub">${destacarTermo(item.subtitulo, termoAtual)}</div>` : ""}
          </div>
          ${badgeHtml}
          <span class="busca-item-enter" aria-hidden="true">↵</span>
        `;

        btn.addEventListener("mouseenter", () => {
          if (indiceSelecionado !== idx) {
            indiceSelecionado = idx;
            atualizarSelecaoVisual(false);
          }
        });

        btn.addEventListener("click", () => {
          selecionarItem(idx);
        });

        frag.appendChild(btn);
      });
    });

    resultadosAtuais = ordemPlana;
    listaEl.innerHTML = "";
    listaEl.appendChild(frag);
    atualizarSelecaoVisual(false);
  }

  function atualizarSelecaoVisual(rolar = true) {
    const listaEl = document.getElementById("busca-global-lista");
    const inputEl = document.getElementById("input-busca-global");
    if (!listaEl) return;

    listaEl.querySelectorAll(".busca-item-resultado").forEach((el) => {
      const ativo = Number(el.dataset.idx) === indiceSelecionado;
      el.classList.toggle("selecionado", ativo);
      el.setAttribute("aria-selected", String(ativo));
      if (ativo) {
        if (inputEl) inputEl.setAttribute("aria-activedescendant", el.id);
        if (rolar) el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function selecionarItem(idx) {
    const item = resultadosAtuais[idx];
    if (!item) return;
    salvarRecente(item);
    executarAcaoMeta(item.acaoMeta);
  }

  // ==========================================================================
  // ABERTURA, FECHAMENTO E INJEÇÃO DO BOTÃO LUPA NO TOPO DE TODAS AS TELAS
  // ==========================================================================

  async function abrir(termoInicial = "") {
    const overlay = document.getElementById("modal-busca-global");
    const input = document.getElementById("input-busca-global");
    if (!overlay || !input) return;

    elementoFocoAnterior = document.activeElement;
    aberta = true;
    escopoAtivo = "tudo";
    termoAtual = typeof termoInicial === "string" ? termoInicial : "";
    indiceSelecionado = 0;

    input.value = termoAtual;
    const btnLimpar = document.getElementById("btn-limpar-busca-global");
    if (btnLimpar) btnLimpar.hidden = !termoAtual;

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
    renderizarEscopos();

    await construirIndice();
    renderizarResultados();

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function fechar() {
    const overlay = document.getElementById("modal-busca-global");
    if (!overlay || !aberta) return;
    aberta = false;
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");

    if (elementoFocoAnterior && typeof elementoFocoAnterior.focus === "function") {
      try {
        elementoFocoAnterior.focus();
      } catch {
        // ignora
      }
    }
    elementoFocoAnterior = null;
  }

  function alternar() {
    if (aberta) fechar();
    else abrir("");
  }

  // Injeta um botão discreto de Busca Global (🔍 + Ctrl K) em todos os cabeçalhos das 12 ferramentas
  function injetarBotaoNosCabecalhos() {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
    const atalhoTxt = isMac ? "⌘K" : "Ctrl K";

    document.querySelectorAll(".secao-ferramenta > .cabecalho > .cabecalho-conteudo").forEach((cab) => {
      if (cab.querySelector(".btn-busca-global-topo")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-busca-global-topo";
      btn.title = `Busca Global / Paleta de Comandos (${atalhoTxt})`;
      btn.setAttribute("aria-label", `Abrir Busca Global (${atalhoTxt})`);
      btn.innerHTML = `
        <svg class="icone-lupa-global" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span class="busca-topo-texto">Buscar...</span>
        <kbd class="busca-topo-kbd">${atalhoTxt}</kbd>
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrir("");
      });

      // Se houver um contêiner de ações à direita no cabeçalho, insere logo antes ou dentro com harmonia
      const grupoAcoes = cab.querySelector(
        ".cabecalho-acoes-home, .cabecalho-acoes-contador, .cabecalho-acoes-receitas, .cabecalho-acoes, .cabecalho-acoes-projetos, .cabecalho-acoes-amostra, .cabecalho-acoes-graficos, .cabecalho-acoes-config"
      );
      if (grupoAcoes) {
        grupoAcoes.insertBefore(btn, grupoAcoes.firstChild);
      } else {
        cab.appendChild(btn);
      }
    });
  }

  function estaDigitandoEmCampo(alvo) {
    if (!alvo) return false;
    const tag = (alvo.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (alvo.isContentEditable) return true;
    return false;
  }

  function vincularEventos() {
    const overlay = document.getElementById("modal-busca-global");
    const input = document.getElementById("input-busca-global");
    const btnLimpar = document.getElementById("btn-limpar-busca-global");
    const btnFechar = document.getElementById("btn-fechar-busca-global");

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) fechar();
      });
    }

    if (btnFechar) {
      btnFechar.addEventListener("click", fechar);
    }

    if (btnLimpar && input) {
      btnLimpar.addEventListener("click", () => {
        termoAtual = "";
        input.value = "";
        btnLimpar.hidden = true;
        indiceSelecionado = 0;
        renderizarResultados();
        input.focus();
      });
    }

    if (input) {
      input.addEventListener("input", () => {
        termoAtual = input.value;
        if (btnLimpar) btnLimpar.hidden = !termoAtual;
        indiceSelecionado = 0;
        renderizarResultados();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (resultadosAtuais.length > 0) {
            indiceSelecionado = (indiceSelecionado + 1) % resultadosAtuais.length;
            atualizarSelecaoVisual(true);
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (resultadosAtuais.length > 0) {
            indiceSelecionado = (indiceSelecionado - 1 + resultadosAtuais.length) % resultadosAtuais.length;
            atualizarSelecaoVisual(true);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          selecionarItem(indiceSelecionado);
        } else if (e.key === "Tab") {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          const idxEsc = ESCOPOS.findIndex((s) => s.id === escopoAtivo);
          escopoAtivo = ESCOPOS[(idxEsc + dir + ESCOPOS.length) % ESCOPOS.length].id;
          indiceSelecionado = 0;
          renderizarEscopos();
          renderizarResultados();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          fechar();
        }
      });
    }

    // Atalho global Ctrl+K / Cmd+K e "/"
    document.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        e.stopPropagation();
        alternar();
        return;
      }

      if (aberta && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar();
        return;
      }

      if (!aberta && e.key === "/" && !mod && !e.altKey && !estaDigitandoEmCampo(e.target)) {
        // Não abre se contador em tela toda estiver ativo
        const telaToda = document.getElementById("overlay-contador-tela-toda");
        if (telaToda && telaToda.style.display === "flex") return;
        e.preventDefault();
        abrir("");
      }
    });
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    injetarBotaoNosCabecalhos();
    vincularEventos();
  }

  const api = { init, abrir, fechar, alternar };
  if (typeof window !== "undefined") {
    window.BuscaGlobal = api;
  }
  return api;
})();
