// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: INVENTÁRIO DE FIOS
// Módulo completo com persistência IndexedDB, busca instantânea, filtros,
// controle de estoque em tempo real (+ e -), cadastro/edição, tela de
// detalhes com ficha técnica, cálculo de rendimento e backup JSON.
// ==========================================================================

const InventarioFios = (() => {
  // Configurações do Banco de Dados IndexedDB
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  // Estado interno em memória
  let db = null;
  let fiosCache = []; // Todos os fios carregados do IndexedDB
  let fiosFiltrados = []; // Fios após aplicação da busca e filtros
  let idFioSelecionado = null; // ID do fio atualmente exibido no modal de detalhes
  let indexFioAtual = -1; // Índice atual na lista filtrada para navegação < e >
  let imagemAtualBase64 = null; // Imagem temporária em edição no formulário
  let filtroFamiliaCor = ""; // Família cromática selecionada na prateleira
  let modoVisualizacao = "pantone"; // "pantone" | "compacto"
  let idsSimulador = []; // IDs dos fios selecionados no Simulador de Combinação (2 a 5)
  let modoSimulador = "listras"; // "listras" | "granny" | "pantone"
  let espessuraListra = "media"; // "fina" | "media" | "larga"
  let corHexEditadaManualmente = false; // Evita sobrescrever cor escolhida manualmente no form

  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (IndexedDB, Filtros, Cálculos e Regras de Negócio)
  // ==========================================================================

  // Inicialização e conexão com o IndexedDB (usa conexão única compartilhada)
  function abrirBanco() {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.abrir();
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  // Obter todos os fios do IndexedDB (via cache em RAM)
  function dbObterTodos(forcarDisco = false) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.obterTodos(STORE_FIOS, forcarDisco);
    }
    return Promise.resolve([]);
  }

  // Salvar ou atualizar fio no IndexedDB (atualiza cache atomicamente)
  function dbSalvar(fio) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.salvar(STORE_FIOS, fio);
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  // Excluir fio do IndexedDB (atualiza cache atomicamente)
  function dbExcluir(id) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.excluir(STORE_FIOS, id);
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  // Carga inicial limpa (sem fios de demonstração pré-cadastrados)
  async function carregarDadosIniciais() {
    let dados = await dbObterTodos();

    // Limpeza única de eventuais fios de demonstração gravados por versões anteriores
    const demoJaLimpo = localStorage.getItem("ponto_trama_fios_demo_limpo") === "true";
    if (!demoJaLimpo && dados && dados.length > 0) {
      const assinaturasDemo = new Set([
        "Amigurumi|482019|Fio super macio e resistente, ótimo acabamento para bichinhos e detalhes.",
        "Mollet|92841|Clássico e quente, perfeito para toucas, mantas e cachecóis.",
        "Anne|771204|Rendimento excelente para peças de vestuário, barrados e toalhas.",
        "Barroco Maxcolor|104928|Acabou na última encomenda. Comprar mais 2 novelos do mesmo lote se possível."
      ]);

      const idsDemo = dados
        .filter((f) => assinaturasDemo.has(`${f.nome || ""}|${f.lote || ""}|${f.observacoes || ""}`))
        .map((f) => f.id);

      if (idsDemo.length > 0 && typeof BancoDadosPT !== "undefined") {
        for (const id of idsDemo) {
          await BancoDadosPT.excluir(STORE_FIOS, id).catch(() => {});
        }
        BancoDadosPT.invalidarCache(STORE_FIOS);
        dados = await dbObterTodos(true);
      }
    }
    try {
      localStorage.setItem("ponto_trama_fios_demo_limpo", "true");
    } catch {
      // ignora
    }

    fiosCache = dados || [];
    return fiosCache;
  }

  // Cálculo do indicador de status de estoque
  function calcularStatus(quantidade) {
    const q = Number(quantidade) || 0;
    if (q > 1) {
      return {
        chave: "em-estoque",
        rotulo: "Em estoque",
        classe: "status-em-estoque"
      };
    } else if (q > 0) {
      return {
        chave: "acabando",
        rotulo: "Acabando",
        classe: "status-acabando"
      };
    } else {
      return {
        chave: "zerado",
        rotulo: "Zerado",
        classe: "status-zerado"
      };
    }
  }

  // Faixa de TEX (fino < 350, médio 350-600, grosso > 600)
  function obterFaixaTex(tex) {
    const t = Number(tex) || 0;
    if (t <= 0) return "";
    if (t < 350) return "fino";
    if (t <= 600) return "medio";
    return "grosso";
  }

  // Formatadores de valores
  function formatarMoeda(valor) {
    if (typeof Configuracoes !== "undefined" && typeof Configuracoes.formatarMoeda === "function") {
      return Configuracoes.formatarMoeda(valor);
    }
    const v = Number(valor) || 0;
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarQuantidade(qtd) {
    const q = Number(qtd) || 0;
    return q % 1 === 0
      ? q.toString()
      : q.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function formatarPeso(pesoGramas) {
    const p = Number(pesoGramas) || 0;
    if (p <= 0) return "—";
    if (p >= 1000) {
      const kg = p / 1000;
      return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
    }
    return `${Math.round(p)} g`;
  }

  function formatarMetragem(metros) {
    const m = Number(metros) || 0;
    if (m <= 0) return "—";
    return `${Math.round(m)} m`;
  }

  function escapeHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================================
  // MOTOR CROMÁTICO PANTONE, CLASSIFICAÇÃO HSL & INDICADOR DE NOVELO
  // ==========================================================================
  const FAMILIAS_CORES = [
    {
      id: "",
      rotulo: "Todas as cores",
      curto: "Todas",
      cor: "conic-gradient(#e74c3c, #f39c12, #f1c40f, #2ecc71, #3498db, #9b59b6, #e74c3c)"
    },
    { id: "branco", rotulo: "Branco & Cru", curto: "Branco", cor: "#f5efe0" },
    { id: "bege", rotulo: "Bege & Terrosos", curto: "Bege", cor: "#c89f74" },
    { id: "amarelo", rotulo: "Amarelo & Laranja", curto: "Amarelo", cor: "#f0a52b" },
    { id: "rosa", rotulo: "Rosa & Coral", curto: "Rosa", cor: "#e57fa1" },
    { id: "vermelho", rotulo: "Vermelho & Vinho", curto: "Vermelho", cor: "#c43440" },
    { id: "roxo", rotulo: "Lilás & Roxo", curto: "Roxo", cor: "#8a63b8" },
    { id: "azul", rotulo: "Azul & Turquesa", curto: "Azul", cor: "#3b82c4" },
    { id: "verde", rotulo: "Verde", curto: "Verde", cor: "#4f9a65" },
    { id: "escuros", rotulo: "Cinza & Escuros", curto: "Escuros", cor: "#343a46" }
  ];

  const SUGESTOES_CORES_RAPIDAS = [
    { hex: "#F7F3E9", nome: "Off-White" },
    { hex: "#E5D5B8", nome: "Cru / Areia" },
    { hex: "#C89B73", nome: "Bege / Caramelo" },
    { hex: "#6F4A33", nome: "Marrom" },
    { hex: "#EAB64D", nome: "Mostarda" },
    { hex: "#DC7A54", nome: "Terracota" },
    { hex: "#C93B46", nome: "Vermelho" },
    { hex: "#F0B6CA", nome: "Rosa Bebê" },
    { hex: "#A378C8", nome: "Lavanda" },
    { hex: "#4377A3", nome: "Azul Jeans" },
    { hex: "#548B66", nome: "Verde Musgo" },
    { hex: "#252932", nome: "Preto" }
  ];

  const DICIONARIO_CORES_PT = [
    ["off-white", "#F5F0E6"],
    ["off white", "#F5F0E6"],
    ["rosa bebe", "#F3BDD0"],
    ["rosa claro", "#F4C2D2"],
    ["rosa antigo", "#C78796"],
    ["rosa chiclete", "#EB5E95"],
    ["azul marinho", "#1F355E"],
    ["azul bebe", "#9BC9EC"],
    ["azul claro", "#93C5EB"],
    ["azul petroleo", "#215D6E"],
    ["azul royal", "#2558B3"],
    ["azul jeans", "#4A6FA5"],
    ["azul turquesa", "#38B2AC"],
    ["verde agua", "#87D3BC"],
    ["verde musgo", "#5C7448"],
    ["verde oliva", "#6E7A3D"],
    ["verde militar", "#556343"],
    ["verde bandeira", "#1E8449"],
    ["verde menta", "#95DEC4"],
    ["verde esmeralda", "#1D835C"],
    ["verde claro", "#89C98E"],
    ["cinza claro", "#C5CCD4"],
    ["cinza escuro", "#4A525C"],
    ["amarelo bebe", "#F9E79F"],
    ["amarelo canario", "#F4D03F"],
    ["branco", "#F8F9FA"],
    ["neve", "#F6F8FA"],
    ["chantilly", "#F5EFE6"],
    ["cru", "#EAE0CC"],
    ["natural", "#E7DCC6"],
    ["creme", "#F0E4C8"],
    ["baunilha", "#F3E5AB"],
    ["marfim", "#F2E9D8"],
    ["areia", "#D9C3A3"],
    ["palha", "#DFC99B"],
    ["linho", "#D5C3AA"],
    ["bege", "#C9A882"],
    ["amendoa", "#C8A682"],
    ["avela", "#A67C52"],
    ["castanha", "#9E6E46"],
    ["caramelo", "#B97542"],
    ["canela", "#A8643B"],
    ["terracota", "#C75E3C"],
    ["ferrugem", "#AE4C2E"],
    ["tijolo", "#B54A35"],
    ["marrom", "#613E2C"],
    ["chocolate", "#523222"],
    ["cacau", "#5C3A29"],
    ["cafe", "#4B2E20"],
    ["amarelo", "#F1C443"],
    ["mostarda", "#D49B27"],
    ["ocre", "#C68C28"],
    ["dourado", "#D4AF37"],
    ["ouro", "#DAB23B"],
    ["laranja", "#EB7A34"],
    ["tangerina", "#F28538"],
    ["abobora", "#DF6C2C"],
    ["pessego", "#F5B092"],
    ["salmao", "#F0947E"],
    ["coral", "#E86A58"],
    ["malva", "#BA7E8E"],
    ["blush", "#EABCC8"],
    ["quartzo", "#DFB1BE"],
    ["rose", "#D48C9C"],
    ["pink", "#E04084"],
    ["magenta", "#C83278"],
    ["fucsia", "#CC2E7C"],
    ["rosa", "#E47EA2"],
    ["vermelho", "#C93037"],
    ["carmim", "#A92030"],
    ["rubi", "#B02338"],
    ["cereja", "#B82940"],
    ["vinho", "#722436"],
    ["marsala", "#7C2E3C"],
    ["bordo", "#6D1F2E"],
    ["ameixa", "#662C4E"],
    ["lilas", "#B497D6"],
    ["lavanda", "#A88FD1"],
    ["violeta", "#7E4EB8"],
    ["roxo", "#6C3FA0"],
    ["uva", "#6A2F7C"],
    ["berinjela", "#4E264F"],
    ["marinho", "#1F355E"],
    ["indigo", "#2D437A"],
    ["petroleo", "#215D6E"],
    ["turquesa", "#38B2AC"],
    ["tiffany", "#5EC8C1"],
    ["aqua", "#68D3CC"],
    ["celeste", "#8EC4EA"],
    ["jeans", "#4A6FA5"],
    ["azul", "#2F70B8"],
    ["menta", "#8CD9BC"],
    ["pistache", "#A9C878"],
    ["musgo", "#5B7548"],
    ["oliva", "#6E7A3D"],
    ["esmeralda", "#20865F"],
    ["verde", "#368F5E"],
    ["prata", "#BEC5CE"],
    ["gelo", "#D9E0E6"],
    ["cinza", "#7A828C"],
    ["chumbo", "#525962"],
    ["grafite", "#404650"],
    ["preto", "#23272F"],
    ["ebano", "#20232A"]
  ];

  function normalizarTextoCor(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizarHex(valor) {
    if (!valor) return null;
    let limpo = String(valor).trim();
    if (!limpo.startsWith("#")) limpo = `#${limpo}`;
    if (/^#[0-9a-fA-F]{3}$/.test(limpo)) {
      limpo = `#${limpo[1]}${limpo[1]}${limpo[2]}${limpo[2]}${limpo[3]}${limpo[3]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(limpo)) {
      return limpo.toUpperCase();
    }
    return null;
  }

  function inferirCorHexDoNome(corNome) {
    const norm = normalizarTextoCor(corNome);
    if (!norm) return "#BFA893";
    for (let i = 0; i < DICIONARIO_CORES_PT.length; i++) {
      const [chave, hex] = DICIONARIO_CORES_PT[i];
      if (norm.includes(chave)) return hex;
    }
    // Fallback determinístico suave para nomes exóticos ou fantasia
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = (hash * 31 + norm.charCodeAt(i)) % 360;
    }
    return hslParaHex(hash, 46, 56);
  }

  function obterCorRealFio(fio) {
    const salvo = normalizarHex(fio?.cor_hex);
    if (salvo) return salvo;
    return inferirCorHexDoNome(fio?.cor_nome || fio?.nome || "");
  }

  function hexParaRgb(hex) {
    const norm = normalizarHex(hex) || "#888888";
    return {
      r: parseInt(norm.slice(1, 3), 16),
      g: parseInt(norm.slice(3, 5), 16),
      b: parseInt(norm.slice(5, 7), 16)
    };
  }

  function hslParaHex(h, s, l) {
    const sN = s / 100;
    const lN = l / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = sN * Math.min(lN, 1 - lN);
    const f = (n) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) =>
      Math.round(255 * x)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  function hexParaHsl(hex) {
    const { r: r255, g: g255, b: b255 } = hexParaRgb(hex);
    const r = r255 / 255;
    const g = g255 / 255;
    const b = b255 / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
    }

    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // RN03: Classificação automática na família cromática da Prateleira
  function classificarFamiliaCor(hex) {
    const { h, s, l } = hexParaHsl(hex);
    if (l >= 91 || (l >= 84 && s <= 32)) return "branco";
    if (l <= 24 && s <= 28) return "escuros";
    if (s <= 13 && l < 84) return "escuros";
    if (h >= 16 && h <= 46 && (s <= 58 || l <= 44)) return "bege";
    if (h >= 342 || h < 14) {
      return l >= 60 ? "rosa" : "vermelho";
    }
    if (h >= 14 && h < 58) {
      if (h < 24 && l >= 62) return "rosa";
      return "amarelo";
    }
    if (h >= 58 && h < 168) return "verde";
    if (h >= 168 && h < 252) return "azul";
    if (h >= 252 && h < 312) return "roxo";
    return "rosa";
  }

  // Contraste WCAG automático sobre a faixa Pantone
  function obterCorTextoContraste(hex) {
    const { r, g, b } = hexParaRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? "#161B2E" : "#FCF9F0";
  }

  // Extrai a cor dominante da região central da imagem enviada
  function extrairCorDominanteDaImagem(dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 48;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          // Recorta os 60% centrais para focar no novelo e ignorar a mesa/fundo
          const sx = img.width * 0.2;
          const sy = img.height * 0.2;
          const sw = img.width * 0.6;
          const sh = img.height * 0.6;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
          const pixels = ctx.getImageData(0, 0, size, size).data;

          let rSum = 0, gSum = 0, bSum = 0, count = 0;
          let rAll = 0, gAll = 0, bAll = 0, countAll = 0;

          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 128) continue;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            rAll += r; gAll += g; bAll += b; countAll++;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            // Prioriza pixels que não são branco estourado nem preto absoluto
            if (!(max > 246 && min > 240) && !(max < 15)) {
              rSum += r; gSum += g; bSum += b; count++;
            }
          }

          const usar = count > 20 ? { r: rSum / count, g: gSum / count, b: bSum / count }
            : countAll > 0 ? { r: rAll / countAll, g: gAll / countAll, b: bAll / countAll }
              : null;

          if (!usar) {
            resolve(null);
            return;
          }
          const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0").toUpperCase();
          resolve(`#${toHex(usar.r)}${toHex(usar.g)}${toHex(usar.b)}`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  // RN02: Indicador visual de quanto resta do novelo (cheio / médio / acabando / zerado)
  function calcularNivelNovelo(fio) {
    const qtd = Number(fio?.quantidade) || 0;
    const pesoUn = Number(fio?.peso_novelo_g) || 0;
    const pesoRest = Number(fio?.peso_restante_g) || 0;

    if (qtd <= 0) {
      return {
        percentual: 0,
        rotulo: "Zerado",
        classe: "nivel-zerado",
        icone: "○",
        detalhe: "0 novelos"
      };
    }

    if (qtd < 1) {
      let pct = Math.max(18, Math.round(qtd * 100));
      let det = `${formatarQuantidade(qtd)} novelo`;
      if (pesoUn > 0 && pesoRest > 0) {
        pct = Math.max(10, Math.min(92, Math.round((pesoRest / pesoUn) * 100)));
        det = `${Math.round(pesoRest)}g / ${Math.round(pesoUn)}g`;
      }
      return {
        percentual: pct,
        rotulo: "Acabando",
        classe: "nivel-acabando",
        icone: "◔",
        detalhe: det
      };
    }

    if (qtd < 2) {
      const pct = qtd === 1 ? 52 : Math.round(52 + (qtd - 1) * 24);
      return {
        percentual: pct,
        rotulo: "Médio",
        classe: "nivel-medio",
        icone: "◑",
        detalhe: `${formatarQuantidade(qtd)} novelo${qtd > 1 ? "s" : ""}`
      };
    }

    const pct = Math.min(100, Math.round(78 + Math.min(qtd - 2, 3) * 7.4));
    return {
      percentual: pct,
      rotulo: "Cheio",
      classe: "nivel-cheio",
      icone: "●",
      detalhe: `${formatarQuantidade(qtd)} novelos`
    };
  }

  function notificarFiosAtualizados(origem = "inventario-fios") {
    window.dispatchEvent(
      new CustomEvent("ponto-trama:fios-atualizados", {
        detail: { origem }
      })
    );
  }

  function aplicarModoVisualizacao(modo) {
    modoVisualizacao = modo === "compacto" ? "compacto" : "pantone";
    const grade = document.getElementById("grade-cards-fios");
    if (grade) {
      grade.classList.toggle("modo-compacto", modoVisualizacao === "compacto");
    }
    const btnPantone = document.getElementById("btn-modo-pantone");
    const btnCompacto = document.getElementById("btn-modo-compacto");
    if (btnPantone) {
      btnPantone.classList.toggle("ativo", modoVisualizacao === "pantone");
      btnPantone.setAttribute("aria-pressed", String(modoVisualizacao === "pantone"));
    }
    if (btnCompacto) {
      btnCompacto.classList.toggle("ativo", modoVisualizacao === "compacto");
      btnCompacto.setAttribute("aria-pressed", String(modoVisualizacao === "compacto"));
    }
    try {
      localStorage.setItem("ponto_trama_fios_modo_vis", modoVisualizacao);
    } catch {
      // ignora
    }
  }

  // RF03: Renderiza a barra de bolinhas da Paleta Cromática com contadores ao vivo
  function renderizarPaletaCromatica() {
    const container = document.getElementById("paleta-cromatica-bolinhas");
    const rotuloAtivo = document.getElementById("paleta-cromatica-ativo-texto");
    if (!container) return;

    const contagens = { "": fiosCache.length };
    fiosCache.forEach((f) => {
      const fam = classificarFamiliaCor(obterCorRealFio(f));
      contagens[fam] = (contagens[fam] || 0) + 1;
    });

    container.innerHTML = "";
    FAMILIAS_CORES.forEach((fam) => {
      const qtd = contagens[fam.id] || 0;
      const ativa = filtroFamiliaCor === fam.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn-bolinha-cor${ativa ? " ativa" : ""}${qtd === 0 && fam.id !== "" ? " vazia" : ""}`;
      btn.dataset.familia = fam.id;
      btn.setAttribute("aria-pressed", String(ativa));
      btn.setAttribute("aria-label", `${fam.rotulo} (${qtd})`);
      btn.title = `${fam.rotulo} (${qtd} ${qtd === 1 ? "fio" : "fios"})`;

      btn.innerHTML = `
        <span class="bolinha-cor-amostra" style="background: ${fam.cor};"></span>
        <span class="bolinha-cor-nome">${escapeHtml(fam.curto)}</span>
        ${qtd > 0 ? `<span class="bolinha-cor-qtd">${qtd}</span>` : ""}
      `;

      btn.addEventListener("click", () => {
        filtroFamiliaCor = filtroFamiliaCor === fam.id && fam.id !== "" ? "" : fam.id;
        aplicarFiltros(false);
      });
      container.appendChild(btn);
    });

    if (rotuloAtivo) {
      const atual = FAMILIAS_CORES.find((f) => f.id === filtroFamiliaCor) || FAMILIAS_CORES[0];
      const qtdAtual = contagens[atual.id] || 0;
      rotuloAtivo.textContent =
        atual.id === "" ? `Todas as cores (${qtdAtual})` : `${atual.rotulo} (${qtdAtual})`;
    }
  }

  // Recalcula o resumo consolidado de estoque no topo
  function atualizarResumoEstoque() {
    let totalNovelos = 0;
    let totalPesoGramas = 0;
    let totalValorEstoque = 0;

    fiosCache.forEach((fio) => {
      const qtd = Number(fio.quantidade) || 0;
      totalNovelos += qtd;

      const pesoUn = Number(fio.peso_novelo_g) || 0;
      if (pesoUn > 0 && qtd > 0) {
        totalPesoGramas += qtd * pesoUn;
      } else if (fio.peso_restante_g) {
        totalPesoGramas += Number(fio.peso_restante_g) || 0;
      }

      const preco = Number(fio.preco_pago) || 0;
      if (preco > 0 && qtd > 0) {
        totalValorEstoque += qtd * preco;
      }
    });

    const elNovelos = document.getElementById("fios-total-novelos");
    const elPeso = document.getElementById("fios-peso-total");
    const elValor = document.getElementById("fios-valor-total");

    if (elNovelos) {
      elNovelos.textContent = formatarQuantidade(totalNovelos);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elNovelos);
      }
    }

    if (elPeso) {
      elPeso.textContent = formatarPeso(totalPesoGramas);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elPeso);
      }
    }

    if (elValor) {
      elValor.textContent = formatarMoeda(totalValorEstoque);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elValor);
      }
    }
  }

  // Aplicação da busca instantânea e dos filtros de marca, composição, TEX e status
  function aplicarFiltros(atualizarSeletores = false) {
    const termoBusca = (document.getElementById("busca-fios")?.value || "").trim().toLowerCase();
    const filtroMarca = (document.getElementById("filtro-marca")?.value || "").trim().toLowerCase();
    const filtroComposicao = (document.getElementById("filtro-composicao")?.value || "").trim().toLowerCase();
    const filtroTex = (document.getElementById("filtro-tex")?.value || "").trim();
    const filtroStatus = (document.getElementById("filtro-status")?.value || "").trim();

    fiosFiltrados = fiosCache.filter((fio) => {
      // 1. Busca por termo
      if (termoBusca) {
        const nome = (fio.nome || "").toLowerCase();
        const marca = (fio.marca || "").toLowerCase();
        const corNome = (fio.cor_nome || "").toLowerCase();
        const corCodigo = (fio.cor_codigo || "").toLowerCase();
        const lote = (fio.lote || "").toLowerCase();

        const bateuBusca =
          nome.includes(termoBusca) ||
          marca.includes(termoBusca) ||
          corNome.includes(termoBusca) ||
          corCodigo.includes(termoBusca) ||
          lote.includes(termoBusca);

        if (!bateuBusca) return false;
      }

      // 2. Filtro por marca
      if (filtroMarca && (fio.marca || "").toLowerCase() !== filtroMarca) {
        return false;
      }

      // 3. Filtro por composição
      if (filtroComposicao && (fio.composicao || "").toLowerCase() !== filtroComposicao) {
        return false;
      }

      // 4. Filtro por faixa de TEX
      if (filtroTex) {
        const faixa = obterFaixaTex(fio.tex);
        if (faixa !== filtroTex) return false;
      }

      // 5. Filtro por status de estoque
      if (filtroStatus) {
        const status = calcularStatus(fio.quantidade);
        if (status.chave !== filtroStatus) return false;
      }

      // 6. Filtro por família cromática (Prateleira de Cores)
      if (filtroFamiliaCor) {
        const familia = classificarFamiliaCor(obterCorRealFio(fio));
        if (familia !== filtroFamiliaCor) return false;
      }

      return true;
    });

    renderizarPaletaCromatica();
    renderizarGradeFios();
    if (atualizarSeletores) {
      atualizarSeletoresDinamicos();
    }
  }

  // Popula dinamicamente os selects com marcas e composições existentes
  function atualizarSeletoresDinamicos() {
    const selectMarca = document.getElementById("filtro-marca");
    const selectComposicao = document.getElementById("filtro-composicao");

    if (selectMarca) {
      const valorAtual = selectMarca.value;
      const marcas = [...new Set(fiosCache.map((f) => (f.marca || "").trim()).filter(Boolean))].sort();
      selectMarca.innerHTML = '<option value="">Todas as marcas</option>';
      marcas.forEach((marca) => {
        const opt = document.createElement("option");
        opt.value = marca;
        opt.textContent = marca;
        if (marca.toLowerCase() === valorAtual.toLowerCase()) opt.selected = true;
        selectMarca.appendChild(opt);
      });
    }

    if (selectComposicao) {
      const valorAtual = selectComposicao.value;
      const composicoes = [...new Set(fiosCache.map((f) => (f.composicao || "").trim()).filter(Boolean))].sort();
      selectComposicao.innerHTML = '<option value="">Todas composições</option>';
      composicoes.forEach((comp) => {
        const opt = document.createElement("option");
        opt.value = comp;
        opt.textContent = comp;
        if (comp.toLowerCase() === valorAtual.toLowerCase()) opt.selected = true;
        selectComposicao.appendChild(opt);
      });
    }
  }

  // Limpa todos os filtros ativos e a busca
  function limparFiltros() {
    const inputBusca = document.getElementById("busca-fios");
    const selectMarca = document.getElementById("filtro-marca");
    const selectComposicao = document.getElementById("filtro-composicao");
    const selectTex = document.getElementById("filtro-tex");
    const selectStatus = document.getElementById("filtro-status");

    if (inputBusca) inputBusca.value = "";
    if (selectMarca) selectMarca.value = "";
    if (selectComposicao) selectComposicao.value = "";
    if (selectTex) selectTex.value = "";
    if (selectStatus) selectStatus.value = "";
    filtroFamiliaCor = "";

    aplicarFiltros();
  }

  // Ajuste rápido de estoque com salvamento imediato (+ e -)
  async function alterarQuantidade(id, delta) {
    const fio = fiosCache.find((f) => f.id === Number(id));
    if (!fio) return;

    const novaQtd = Math.max(0, Math.round(((Number(fio.quantidade) || 0) + delta) * 10) / 10);
    fio.quantidade = novaQtd;

    await dbSalvar(fio);
    atualizarResumoEstoque();
    atualizarCardNoDOM(fio);
    notificarFiosAtualizados("estoque-rapido");

    // Se a tela de detalhes estiver aberta para este fio, sincroniza imediatamente
    if (idFioSelecionado === fio.id) {
      renderizarDetalhesFio(fio);
    }
  }

  // Duplicar especificações técnicas para cadastrar nova cor rapidamente
  function duplicarFio(id) {
    const original = fiosCache.find((f) => f.id === Number(id));
    if (!original) return;

    const copia = {
      id: "", // novo cadastro
      nome: original.nome || "",
      marca: original.marca || "",
      cor_nome: "",
      cor_codigo: "",
      cor_hex: "",
      lote: "",
      imagem_url: null,
      tex: original.tex || "",
      composicao: original.composicao || "",
      peso_novelo_g: original.peso_novelo_g || "",
      metragem_novelo_m: original.metragem_novelo_m || "",
      agulha: original.agulha || "",
      quantidade: 1,
      peso_restante_g: "",
      preco_pago: original.preco_pago || "",
      localizacao: original.localizacao || "",
      observacoes: original.observacoes ? `Cópia de ${original.nome}: ${original.observacoes}` : ""
    };

    fecharModalDetalhes();
    abrirModalCadastro(copia, "Novo Fio (Duplicado)");
  }

  // ==========================================================================
  // EXCLUSÃO DE FIOS (COM MODAL DE CONFIRMAÇÃO ESTILIZADO)
  // ==========================================================================
  let idFioParaExcluir = null;

  // Abre o modal de confirmação de exclusão
  function solicitarExclusaoFio(id) {
    if (id === undefined || id === null) return;
    idFioParaExcluir = id;

    // Busca o fio por igualdade de valor (string ou número)
    const fio = fiosCache.find((f) => String(f.id) === String(id) || Number(f.id) === Number(id));
    if (!fio) {
      console.warn("Fio não encontrado para exclusão:", id);
      return;
    }

    const modal = document.getElementById("modal-confirmar-exclusao-fio");
    const textoEl = document.getElementById("texto-confirmar-exclusao");

    if (modal && textoEl) {
      textoEl.innerHTML = `Tem certeza que deseja excluir o fio <strong>${escapeHtml(fio.nome)} - ${escapeHtml(fio.cor_nome)}</strong> (${escapeHtml(fio.marca || "")})?<br><span style="font-size: 12px; color: rgba(252,241,208,0.6); display: inline-block; margin-top: 6px;">Esta ação removerá o novelo do seu estoque e não pode ser desfeita.</span>`;
      modal.style.display = "flex";
    } else {
      // Fallback para window.confirm caso o modal não esteja presente
      const confirmou = window.confirm(
        `Deseja realmente excluir o fio "${fio.nome} - ${fio.cor_nome}" do seu inventário?`
      );
      if (confirmou) {
        executarExclusaoFio(fio.id);
      }
    }
  }

  // Fecha o modal de confirmação de exclusão
  function fecharModalConfirmarExclusao() {
    const modal = document.getElementById("modal-confirmar-exclusao-fio");
    if (modal) modal.style.display = "none";
    idFioParaExcluir = null;
  }

  // Executa a remoção definitiva do fio do IndexedDB e da interface
  async function executarExclusaoFio(id = null) {
    try {
      const idAlvo = id !== null && id !== undefined ? id : idFioParaExcluir;
      if (idAlvo === null || idAlvo === undefined) return;

      const fio = fiosCache.find((f) => String(f.id) === String(idAlvo) || Number(f.id) === Number(idAlvo));
      const idParaExcluir = fio ? fio.id : idAlvo;

      await dbExcluir(idParaExcluir);

      // Remove da memória cache filtrando tanto por string quanto por número
      fiosCache = fiosCache.filter(
        (f) => String(f.id) !== String(idParaExcluir) && Number(f.id) !== Number(idParaExcluir)
      );
      idsSimulador = idsSimulador.filter((sid) => Number(sid) !== Number(idParaExcluir));

      fecharModalConfirmarExclusao();
      fecharModalDetalhes();
      aplicarFiltros(true);
      atualizarResumoEstoque();
      atualizarDockSimulador();
      notificarFiosAtualizados("excluir-fio");
    } catch (err) {
      console.error("Erro ao excluir fio:", err);
      alert("Ocorreu um erro ao excluir o fio do inventário.");
    }
  }

  // Exportar inventário completo em formato JSON
  function exportarBackupJSON() {
    if (!fiosCache || fiosCache.length === 0) {
      alert("Não há fios cadastrados no inventário para exportar.");
      return;
    }
    const dadosStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fiosCache, null, 2));
    const linkDownload = document.createElement("a");
    const dataHoje = new Date().toISOString().slice(0, 10);
    linkDownload.setAttribute("href", dadosStr);
    linkDownload.setAttribute("download", `ponto-e-trama-inventario-fios-${dataHoje}.json`);
    document.body.appendChild(linkDownload);
    linkDownload.click();
    linkDownload.remove();

    // Fecha menu de backup
    fecharMenuBackup();
  }

  // Importar backup de arquivo JSON
  function importarBackupJSON(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = async (evento) => {
      try {
        const conteudo = JSON.parse(evento.target.result);
        if (!Array.isArray(conteudo)) {
          alert("Arquivo de backup inválido! O conteúdo deve ser uma lista de fios.");
          return;
        }

        const confirmou = window.confirm(
          `Foram encontrados ${conteudo.length} fios no arquivo. Deseja importá-los para o seu inventário?`
        );
        if (!confirmou) return;

        if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.salvarEmLote === "function") {
          const limpos = conteudo.map(({ id, ...fioLimpo }) => fioLimpo);
          fiosCache = await BancoDadosPT.salvarEmLote(STORE_FIOS, limpos);
        }
        aplicarFiltros(true);
        atualizarResumoEstoque();
        atualizarDockSimulador();
        notificarFiosAtualizados("importar-backup");
        fecharMenuBackup();
        alert("Backup importado com sucesso!");
      } catch (err) {
        console.error("Erro na importação do backup:", err);
        alert("Erro ao ler arquivo de backup JSON: " + err.message);
      }
    };
    leitor.readAsText(arquivo);
  }

  // ==========================================================================
  // PARTE 2: ANIMAÇÕES, MODAIS E EFEITOS (DOM, Modais, Cards e Transições)
  // ==========================================================================

  // Renderiza a grade de cards com os fios filtrados
  function renderizarGradeFios() {
    const grade = document.getElementById("grade-cards-fios");
    const estadoVazio = document.getElementById("estado-vazio-fios");
    if (!grade) return;

    grade.innerHTML = "";

    if (fiosFiltrados.length === 0) {
      if (estadoVazio) estadoVazio.style.display = "flex";
      return;
    }

    if (estadoVazio) estadoVazio.style.display = "none";

    const frag = document.createDocumentFragment();
    fiosFiltrados.forEach((fio) => {
      frag.appendChild(criarCardElement(fio));
    });
    grade.appendChild(frag);
  }

  // Criação de um card individual de fio estilo Amostra Pantone / Etiqueta de Novelo
  function criarCardElement(fio) {
    const card = document.createElement("article");
    const estaSelecionado = idsSimulador.some((sid) => Number(sid) === Number(fio.id));
    card.className = `card-fio card-fio-pantone${estaSelecionado ? " selecionado-paleta" : ""}${fio.imagem_url ? " tem-foto" : " sem-foto"}`;
    card.id = `card-fio-${fio.id}`;
    card.dataset.id = fio.id;

    const status = calcularStatus(fio.quantidade);
    const corHex = obterCorRealFio(fio);
    const corTexto = obterCorTextoContraste(corHex);
    const nivel = calcularNivelNovelo(fio);
    card.style.setProperty("--cor-swatch", corHex);
    card.style.setProperty("--cor-swatch-texto", corTexto);

    const texTexto = fio.tex ? `${fio.tex}` : "—";
    const agulhaTexto = fio.agulha ? `${fio.agulha}` : "—";
    const codigoTexto = fio.cor_codigo ? `#${fio.cor_codigo}` : corHex;
    const loteTexto = fio.lote ? `Lote ${fio.lote}` : "Sem lote";

    const topoVisualHtml = fio.imagem_url
      ? `
        <div class="card-fio-etiqueta-foto">
          <img src="${fio.imagem_url}" alt="${escapeHtml(fio.nome)} ${escapeHtml(fio.cor_nome)}" class="card-fio-img" loading="lazy" decoding="async" />
          <div class="etiqueta-faixa-inferior">
            <span class="etiqueta-cor-nome">${escapeHtml(fio.cor_nome || "Cor")}</span>
            <span class="etiqueta-cor-cod">${escapeHtml(codigoTexto)}</span>
          </div>
        </div>
      `
      : `
        <div class="card-fio-swatch-bloco">
          <span class="swatch-trama-overlay" aria-hidden="true"></span>
          <div class="swatch-pantone-rodape">
            <span class="swatch-pantone-codigo">${escapeHtml(codigoTexto)}</span>
            <span class="swatch-pantone-cor">${escapeHtml(fio.cor_nome || "Cor")}</span>
          </div>
        </div>
      `;

    card.innerHTML = `
      <div class="card-fio-foto-wrapper card-fio-swatch-topo">
        ${topoVisualHtml}
        <button
          type="button"
          class="btn-selecionar-simulador${estaSelecionado ? " ativo" : ""}"
          id="card-sim-btn-${fio.id}"
          data-id="${fio.id}"
          title="${estaSelecionado ? "Remover da paleta de combinação" : "Adicionar ao Simulador de Cores"}"
          aria-pressed="${estaSelecionado ? "true" : "false"}"
        >
          <span>${estaSelecionado ? "✓ Na paleta" : "🎨 Combinar"}</span>
        </button>
        <span class="badge-status-card ${status.classe}" id="card-status-${fio.id}">${status.rotulo}</span>
      </div>
      <div class="card-fio-corpo">
        <div class="card-fio-header">
          <div class="card-fio-titulos">
            <span class="card-fio-marca">${escapeHtml(fio.marca || "Marca")}</span>
            <h3 class="card-fio-nome">${escapeHtml(fio.nome || "Sem nome")}</h3>
          </div>
          <span class="card-fio-pastilha-mini" style="background-color: ${corHex};" title="${escapeHtml(fio.cor_nome || corHex)}"></span>
        </div>

        <div class="card-fio-tags">
          <span class="tag-fio">${escapeHtml(fio.cor_nome || "Cor")}${fio.cor_codigo ? ` #${escapeHtml(fio.cor_codigo)}` : ""}</span>
          <span class="tag-fio tag-fio-lote">${escapeHtml(loteTexto)}</span>
        </div>

        <!-- Indicador Visual de Quanto Resta do Novelo -->
        <div class="card-fio-nivel-novelo ${nivel.classe}" id="card-nivel-${fio.id}" title="Nível do estoque: ${nivel.rotulo} (${nivel.detalhe})">
          <div class="nivel-novelo-cabecalho">
            <span class="nivel-novelo-status">
              <span class="nivel-novelo-ico" aria-hidden="true">${nivel.icone}</span>
              <strong id="card-nivel-rotulo-${fio.id}">${nivel.rotulo}</strong>
            </span>
            <span class="nivel-novelo-detalhe" id="card-nivel-detalhe-${fio.id}">${escapeHtml(nivel.detalhe)}</span>
          </div>
          <div class="nivel-novelo-trilha" aria-hidden="true">
            <div class="nivel-novelo-fill" id="card-nivel-fill-${fio.id}" style="width: ${nivel.percentual}%;"></div>
          </div>
        </div>

        <div class="card-fio-specs">
          <span class="spec-item">TEX: <strong>${escapeHtml(texTexto)}</strong></span>
          <span class="spec-item">Agulha: <strong>${escapeHtml(agulhaTexto)}</strong></span>
        </div>

        <div class="card-fio-rodape">
          <div class="card-controle-estoque" title="Ajuste rápido de estoque">
            <button type="button" class="btn-qtd-card btn-menos" data-id="${fio.id}" aria-label="Diminuir 0.5 novelo">−</button>
            <span class="card-qtd-numero" id="card-qtd-val-${fio.id}">${formatarQuantidade(fio.quantidade)}</span>
            <button type="button" class="btn-qtd-card btn-mais" data-id="${fio.id}" aria-label="Aumentar 0.5 novelo">+</button>
          </div>

          <div class="card-acoes-rapidas">
            <button type="button" class="btn-acao-card btn-editar-card" data-id="${fio.id}" title="Editar fio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-acao-card btn-duplicar-card" data-id="${fio.id}" title="Duplicar especificações">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button type="button" class="btn-acao-card btn-excluir-card" data-id="${fio.id}" title="Excluir fio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Clique no corpo do card abre a Tela de Detalhes
    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".card-controle-estoque") ||
        e.target.closest(".card-acoes-rapidas") ||
        e.target.closest(".btn-selecionar-simulador")
      ) {
        return;
      }
      abrirModalDetalhesPorId(fio.id);
    });

    // Botão de seleção para o Simulador de Cores
    const btnSim = card.querySelector(".btn-selecionar-simulador");
    if (btnSim) {
      btnSim.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarSelecaoSimulador(fio.id);
      });
    }

    // Botões de estoque no card
    const btnMenos = card.querySelector(".btn-menos");
    const btnMais = card.querySelector(".btn-mais");
    btnMenos.addEventListener("click", (e) => {
      e.stopPropagation();
      alterarQuantidade(fio.id, -0.5);
    });
    btnMais.addEventListener("click", (e) => {
      e.stopPropagation();
      alterarQuantidade(fio.id, 0.5);
    });

    // Botões de ação rápida no card
    const btnEditar = card.querySelector(".btn-editar-card");
    btnEditar.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalCadastro(fio, "Editar Fio");
    });

    const btnDuplicar = card.querySelector(".btn-duplicar-card");
    btnDuplicar.addEventListener("click", (e) => {
      e.stopPropagation();
      duplicarFio(fio.id);
    });

    const btnExcluir = card.querySelector(".btn-excluir-card");
    btnExcluir.addEventListener("click", (e) => {
      e.stopPropagation();
      solicitarExclusaoFio(fio.id);
    });

    return card;
  }

  // Atualização atômica do card no DOM após alteração de quantidade
  function atualizarCardNoDOM(fio) {
    const elQtd = document.getElementById(`card-qtd-val-${fio.id}`);
    const elStatus = document.getElementById(`card-status-${fio.id}`);
    const elNivel = document.getElementById(`card-nivel-${fio.id}`);
    const elNivelRotulo = document.getElementById(`card-nivel-rotulo-${fio.id}`);
    const elNivelDetalhe = document.getElementById(`card-nivel-detalhe-${fio.id}`);
    const elNivelFill = document.getElementById(`card-nivel-fill-${fio.id}`);

    if (elQtd) {
      elQtd.textContent = formatarQuantidade(fio.quantidade);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elQtd);
      }
    }

    if (elStatus) {
      const status = calcularStatus(fio.quantidade);
      elStatus.className = `badge-status-card ${status.classe}`;
      elStatus.textContent = status.rotulo;
    }

    if (elNivel) {
      const nivel = calcularNivelNovelo(fio);
      elNivel.className = `card-fio-nivel-novelo ${nivel.classe}`;
      elNivel.title = `Nível do estoque: ${nivel.rotulo} (${nivel.detalhe})`;
      const icoEl = elNivel.querySelector(".nivel-novelo-ico");
      if (icoEl) icoEl.textContent = nivel.icone;
      if (elNivelRotulo) elNivelRotulo.textContent = nivel.rotulo;
      if (elNivelDetalhe) elNivelDetalhe.textContent = nivel.detalhe;
      if (elNivelFill) elNivelFill.style.width = `${nivel.percentual}%`;
    }
  }

  // Abertura do Modal de Detalhes por ID do Fio
  function abrirModalDetalhesPorId(id) {
    idFioSelecionado = Number(id);
    indexFioAtual = fiosFiltrados.findIndex((f) => f.id === idFioSelecionado);

    let fio = null;
    if (indexFioAtual !== -1) {
      fio = fiosFiltrados[indexFioAtual];
    } else {
      fio = fiosCache.find((f) => f.id === idFioSelecionado);
    }

    if (!fio) return;
    renderizarDetalhesFio(fio);

    const modal = document.getElementById("modal-detalhes-fio");
    if (modal) modal.style.display = "flex";
  }

  // Popula todos os campos da Tela de Detalhes (Modal Grande)
  function renderizarDetalhesFio(fio) {
    if (!fio) return;
    idFioSelecionado = fio.id;
    indexFioAtual = fiosFiltrados.findIndex((f) => f.id === fio.id);

    // Controles de Navegação Anterior / Próximo
    const btnAnt = document.getElementById("btn-fio-anterior");
    const btnProx = document.getElementById("btn-fio-proximo");
    const indPosicao = document.getElementById("det-indicador-posicao");

    if (indPosicao) {
      if (indexFioAtual >= 0 && fiosFiltrados.length > 0) {
        indPosicao.textContent = `${indexFioAtual + 1} de ${fiosFiltrados.length}`;
      } else {
        indPosicao.textContent = "1 de 1";
      }
    }

    if (btnAnt) {
      btnAnt.disabled = indexFioAtual <= 0;
    }
    if (btnProx) {
      btnProx.disabled = indexFioAtual < 0 || indexFioAtual >= fiosFiltrados.length - 1;
    }

    // Marca, Nome e Status
    const elMarca = document.getElementById("det-fio-marca");
    const elNome = document.getElementById("det-fio-nome");
    const elStatusBadge = document.getElementById("det-fio-status-badge");

    if (elMarca) elMarca.textContent = fio.marca || "Marca";
    if (elNome) elNome.textContent = fio.nome || "Fio sem nome";

    const status = calcularStatus(fio.quantidade);
    if (elStatusBadge) {
      elStatusBadge.className = `badge-status-fio ${status.classe}`;
      elStatusBadge.textContent = status.rotulo;
    }

    // Foto Ampliada ou Placeholder
    const imgFoto = document.getElementById("det-fio-foto");
    const placeholderFoto = document.getElementById("det-foto-placeholder");
    if (fio.imagem_url) {
      if (imgFoto) {
        imgFoto.src = fio.imagem_url;
        imgFoto.style.display = "block";
      }
      if (placeholderFoto) placeholderFoto.style.display = "none";
    } else {
      if (imgFoto) imgFoto.style.display = "none";
      if (placeholderFoto) placeholderFoto.style.display = "flex";
    }

    // Bloco 1: Cor e Lote
    const elCor = document.getElementById("det-fio-cor");
    const elCorSwatch = document.getElementById("det-fio-cor-swatch");
    const elCodigo = document.getElementById("det-fio-codigo");
    const elLote = document.getElementById("det-fio-lote");

    const corReal = obterCorRealFio(fio);
    if (elCor) elCor.textContent = fio.cor_nome || "—";
    if (elCorSwatch) {
      elCorSwatch.style.backgroundColor = corReal;
      elCorSwatch.title = corReal;
    }
    if (elCodigo) elCodigo.textContent = fio.cor_codigo ? `Cód: ${fio.cor_codigo} • ${corReal}` : corReal;
    if (elLote) elLote.textContent = fio.lote || "Não especificado";

    // Bloco 2: Estoque e Rendimento Estimado
    const elQtd = document.getElementById("det-fio-qtd");
    const elPesoDisp = document.getElementById("det-fio-peso-disp");
    const elMetragemDisp = document.getElementById("det-fio-metragem-disp");

    const qtd = Number(fio.quantidade) || 0;
    if (elQtd) elQtd.textContent = formatarQuantidade(qtd);

    const pesoUn = Number(fio.peso_novelo_g) || 0;
    const pesoEstimado = pesoUn > 0 && qtd > 0 ? qtd * pesoUn : fio.peso_restante_g ? Number(fio.peso_restante_g) : 0;
    if (elPesoDisp) elPesoDisp.textContent = pesoEstimado > 0 ? formatarPeso(pesoEstimado) : "—";

    const metragemUn = Number(fio.metragem_novelo_m) || 0;
    const metragemEstimada = metragemUn > 0 && qtd > 0 ? qtd * metragemUn : 0;
    if (elMetragemDisp) elMetragemDisp.textContent = metragemEstimada > 0 ? formatarMetragem(metragemEstimada) : "—";

    // Bloco 3: Ficha Técnica
    const elTex = document.getElementById("det-fio-tex");
    const elAgulha = document.getElementById("det-fio-agulha");
    const elComposicao = document.getElementById("det-fio-composicao");
    const elPesoUn = document.getElementById("det-fio-peso-un");
    const elMetragemUn = document.getElementById("det-fio-metragem-un");

    if (elTex) elTex.textContent = fio.tex ? `${fio.tex}` : "—";
    if (elAgulha) elAgulha.textContent = fio.agulha || "—";
    if (elComposicao) elComposicao.textContent = fio.composicao || "—";
    if (elPesoUn) elPesoUn.textContent = pesoUn > 0 ? `${pesoUn}g` : "—";
    if (elMetragemUn) elMetragemUn.textContent = metragemUn > 0 ? `${metragemUn}m` : "—";

    // Bloco 4: Organização & Valores
    const elLoc = document.getElementById("det-fio-localizacao");
    const elPrecoUn = document.getElementById("det-fio-preco-un");
    const elPrecoTotal = document.getElementById("det-fio-preco-total");
    const elObs = document.getElementById("det-fio-obs");
    const blocoObs = document.getElementById("det-bloco-observacoes");

    if (elLoc) elLoc.textContent = fio.localizacao || "—";

    const precoUn = Number(fio.preco_pago) || 0;
    if (elPrecoUn) elPrecoUn.textContent = precoUn > 0 ? formatarMoeda(precoUn) : "—";

    const valorTotalEstoque = precoUn > 0 && qtd > 0 ? precoUn * qtd : 0;
    if (elPrecoTotal) elPrecoTotal.textContent = valorTotalEstoque > 0 ? formatarMoeda(valorTotalEstoque) : formatarMoeda(0);

    if (elObs) {
      if (fio.observacoes && fio.observacoes.trim()) {
        elObs.textContent = fio.observacoes;
        if (blocoObs) blocoObs.style.display = "block";
      } else {
        elObs.textContent = "—";
        if (blocoObs) blocoObs.style.display = "none";
      }
    }
  }

  // Fechar Modal de Detalhes
  function fecharModalDetalhes() {
    const modal = document.getElementById("modal-detalhes-fio");
    if (modal) modal.style.display = "none";
    idFioSelecionado = null;
    indexFioAtual = -1;
  }

  // Navegação entre fios na tela de detalhes
  function navegarDetalhes(direcao) {
    if (fiosFiltrados.length === 0) return;
    const novoIndex = indexFioAtual + direcao;
    if (novoIndex >= 0 && novoIndex < fiosFiltrados.length) {
      renderizarDetalhesFio(fiosFiltrados[novoIndex]);
    }
  }

  // Abertura do Modal de Cadastro ou Edição
  function abrirModalCadastro(dadosIniciais = null, titulo = "Novo Fio") {
    const modal = document.getElementById("modal-cadastro-fio");
    const tituloEl = document.getElementById("modal-fio-titulo");
    const form = document.getElementById("form-fio");
    if (!modal || !form) return;

    if (tituloEl) tituloEl.textContent = titulo;

    // Reseta formulário e posiciona na primeira aba
    form.reset();
    alternarAbaFormulario("identificacao");

    // Preenche campos
    document.getElementById("fio-id").value = dadosIniciais?.id || "";
    document.getElementById("fio-nome").value = dadosIniciais?.nome || "";
    document.getElementById("fio-marca").value = dadosIniciais?.marca || "";
    document.getElementById("fio-cor-nome").value = dadosIniciais?.cor_nome || "";
    document.getElementById("fio-cor-codigo").value = dadosIniciais?.cor_codigo || "";
    document.getElementById("fio-lote").value = dadosIniciais?.lote || "";

    const corHexInicial = normalizarHex(dadosIniciais?.cor_hex) ||
      (dadosIniciais?.cor_nome ? inferirCorHexDoNome(dadosIniciais.cor_nome) : "#D9B99B");
    corHexEditadaManualmente = Boolean(normalizarHex(dadosIniciais?.cor_hex));
    definirCorHexFormulario(corHexInicial);
    renderizarSugestoesCoresRapidas();

    document.getElementById("fio-tex").value = dadosIniciais?.tex || "";
    document.getElementById("fio-composicao").value = dadosIniciais?.composicao || "";
    document.getElementById("fio-peso-novelo").value = dadosIniciais?.peso_novelo_g || "";
    document.getElementById("fio-metragem-novelo").value = dadosIniciais?.metragem_novelo_m || "";
    document.getElementById("fio-agulha").value = dadosIniciais?.agulha || "";

    document.getElementById("fio-quantidade").value = dadosIniciais?.quantidade ?? 1;
    document.getElementById("fio-peso-restante").value = dadosIniciais?.peso_restante_g || "";
    document.getElementById("fio-preco").value = dadosIniciais?.preco_pago || "";
    document.getElementById("fio-localizacao").value = dadosIniciais?.localizacao || "";
    document.getElementById("fio-observacoes").value = dadosIniciais?.observacoes || "";

    // Foto
    imagemAtualBase64 = dadosIniciais?.imagem_url || null;
    atualizarPreviewImagem(imagemAtualBase64);

    modal.style.display = "flex";
    setTimeout(() => {
      document.getElementById("fio-nome")?.focus();
    }, 100);
  }

  // Fechar Modal de Cadastro
  function fecharModalCadastro() {
    const modal = document.getElementById("modal-cadastro-fio");
    if (modal) modal.style.display = "none";
    imagemAtualBase64 = null;
    atualizarPreviewImagem(null);
  }

  // Alternância de abas no Modal de Cadastro
  function alternarAbaFormulario(nomeAba) {
    const abas = document.querySelectorAll(".abas-modal-fio .aba-item");
    const secoes = document.querySelectorAll(".secao-form-aba");

    abas.forEach((aba) => {
      if (aba.dataset.aba === nomeAba) {
        aba.classList.add("ativa");
      } else {
        aba.classList.remove("ativa");
      }
    });

    secoes.forEach((secao) => {
      if (secao.id === `aba-conteudo-${nomeAba}`) {
        secao.style.display = "block";
      } else {
        secao.style.display = "none";
      }
    });
  }

  function definirCorHexFormulario(hex) {
    const norm = normalizarHex(hex);
    if (!norm) return;
    const inputCor = document.getElementById("fio-cor-hex");
    const inputHexTxt = document.getElementById("fio-cor-hex-texto");
    if (inputCor) inputCor.value = norm.toLowerCase();
    if (inputHexTxt) inputHexTxt.value = norm;
  }

  function renderizarSugestoesCoresRapidas() {
    const box = document.getElementById("sugestoes-cores-rapidas");
    if (!box || box.childElementCount > 0) return;
    SUGESTOES_CORES_RAPIDAS.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-sugestao-cor-rapida";
      btn.style.backgroundColor = item.hex;
      btn.title = `${item.nome} (${item.hex})`;
      btn.setAttribute("aria-label", `Selecionar cor ${item.nome}`);
      btn.addEventListener("click", () => {
        corHexEditadaManualmente = true;
        definirCorHexFormulario(item.hex);
      });
      box.appendChild(btn);
    });
  }

  // Atualização do preview visual de imagem no formulário
  function atualizarPreviewImagem(dataUrl) {
    const placeholder = document.getElementById("upload-placeholder");
    const containerPreview = document.getElementById("upload-preview-container");
    const imgPreview = document.getElementById("upload-preview-img");
    const btnExtrair = document.getElementById("btn-extrair-cor-foto");

    if (dataUrl) {
      if (imgPreview) imgPreview.src = dataUrl;
      if (containerPreview) containerPreview.style.display = "flex";
      if (placeholder) placeholder.style.display = "none";
      if (btnExtrair) btnExtrair.style.display = "inline-flex";
    } else {
      if (imgPreview) imgPreview.src = "";
      if (containerPreview) containerPreview.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
      if (btnExtrair) btnExtrair.style.display = "none";
      const fileInput = document.getElementById("fio-imagem-input");
      if (fileInput) fileInput.value = "";
    }
  }

  // Otimização e compressão de imagem via Canvas para economizar armazenamento no IndexedDB
  function redimensionarEComprimirImagem(arquivo, maxDimensao = 600, qualidade = 0.82) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = (eventoLeitura) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimensao || height > maxDimensao) {
            if (width > height) {
              height = Math.round((height * maxDimensao) / width);
              width = maxDimensao;
            } else {
              width = Math.round((width * maxDimensao) / height);
              height = maxDimensao;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Tenta exportar para webp; se o navegador não suportar, fallback para jpeg
          let dataUrl = canvas.toDataURL("image/webp", qualidade);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", qualidade);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Erro ao carregar imagem para compressão"));
        img.src = eventoLeitura.target.result;
      };
      leitor.onerror = () => reject(new Error("Erro ao ler arquivo"));
      leitor.readAsDataURL(arquivo);
    });
  }

  // Leitura de arquivo de imagem com compressão automática
  async function processarArquivoImagem(arquivo) {
    const ehImagem =
      arquivo &&
      ((arquivo.type && arquivo.type.startsWith("image/")) ||
        /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(arquivo.name || ""));
    if (!ehImagem) {
      alert("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }

    try {
      imagemAtualBase64 = await redimensionarEComprimirImagem(arquivo, 600, 0.82);
      atualizarPreviewImagem(imagemAtualBase64);
      if (!corHexEditadaManualmente) {
        const corFoto = await extrairCorDominanteDaImagem(imagemAtualBase64);
        if (corFoto) definirCorHexFormulario(corFoto);
      }
    } catch (err) {
      console.warn("Falha ao otimizar imagem, usando original:", err);
      const leitor = new FileReader();
      leitor.onload = async (e) => {
        imagemAtualBase64 = e.target.result;
        atualizarPreviewImagem(imagemAtualBase64);
        if (!corHexEditadaManualmente) {
          const corFoto = await extrairCorDominanteDaImagem(imagemAtualBase64);
          if (corFoto) definirCorHexFormulario(corFoto);
        }
      };
      leitor.readAsDataURL(arquivo);
    }
  }

  let salvandoFio = false;

  // Submissão do formulário de cadastro / edição
  async function salvarFormularioFio(e) {
    e.preventDefault();
    if (salvandoFio) return;

    const idVal = document.getElementById("fio-id").value;
    const nome = document.getElementById("fio-nome").value.trim();
    const marca = document.getElementById("fio-marca").value.trim();
    const corNome = document.getElementById("fio-cor-nome").value.trim();
    const corCodigo = document.getElementById("fio-cor-codigo").value.trim();
    const corHexInput =
      normalizarHex(document.getElementById("fio-cor-hex-texto")?.value) ||
      normalizarHex(document.getElementById("fio-cor-hex")?.value) ||
      inferirCorHexDoNome(corNome);
    const lote = document.getElementById("fio-lote").value.trim();

    const tex = parseFloat(document.getElementById("fio-tex").value) || null;
    const composicao = document.getElementById("fio-composicao").value.trim();
    const pesoNovelo = parseFloat(document.getElementById("fio-peso-novelo").value) || null;
    const metragemNovelo = parseFloat(document.getElementById("fio-metragem-novelo").value) || null;
    const agulha = document.getElementById("fio-agulha").value.trim();

    const quantidade = parseFloat(document.getElementById("fio-quantidade").value);
    const pesoRestante = parseFloat(document.getElementById("fio-peso-restante").value) || null;
    const precoPago = parseFloat(document.getElementById("fio-preco").value) || null;
    const localizacao = document.getElementById("fio-localizacao").value.trim();
    const observacoes = document.getElementById("fio-observacoes").value.trim();

    // Validação de campos obrigatórios
    if (!nome || !marca || !corNome || isNaN(quantidade)) {
      alert("Por favor, preencha os campos obrigatórios (*): Nome da linha, Marca, Cor e Quantidade.");
      if (!nome || !marca || !corNome) {
        alternarAbaFormulario("identificacao");
      } else {
        alternarAbaFormulario("estoque");
      }
      return;
    }

    const fio = {
      nome,
      marca,
      cor_nome: corNome,
      cor_codigo: corCodigo,
      cor_hex: corHexInput,
      lote,
      imagem_url: imagemAtualBase64 || null,
      tex,
      composicao,
      peso_novelo_g: pesoNovelo,
      metragem_novelo_m: metragemNovelo,
      agulha,
      quantidade: Math.max(0, quantidade),
      peso_restante_g: pesoRestante,
      preco_pago: precoPago,
      localizacao,
      observacoes,
      atualizado_em: new Date().toISOString()
    };

    if (idVal) {
      fio.id = Number(idVal);
    } else {
      fio.criado_em = new Date().toISOString();
    }

    salvandoFio = true;
    let salvo;
    try {
      salvo = await dbSalvar(fio);
    } finally {
      salvandoFio = false;
    }

    const idxExistente = fiosCache.findIndex((f) => Number(f.id) === Number(salvo.id));
    if (idxExistente !== -1) {
      fiosCache[idxExistente] = salvo;
    } else {
      fiosCache.unshift(salvo);
    }

    fecharModalCadastro();
    aplicarFiltros(true);
    atualizarResumoEstoque();
    atualizarDockSimulador();
    notificarFiosAtualizados("salvar-fio");

    // Se o modal de detalhes estiver aberto para este fio, re-renderiza
    if (idFioSelecionado === salvo.id) {
      renderizarDetalhesFio(salvo);
    }
  }

  // Copiar número do lote para a área de transferência com feedback visual
  function copiarLote() {
    const elLote = document.getElementById("det-fio-lote");
    const btnCopiar = document.getElementById("btn-copiar-lote");
    const loteValor = elLote?.textContent || "";

    if (!loteValor || loteValor === "—" || loteValor === "Não especificado") {
      return;
    }

    navigator.clipboard
      .writeText(loteValor)
      .then(() => {
        if (btnCopiar) {
          const textoOriginal = btnCopiar.innerHTML;
          btnCopiar.innerHTML = "<span>✓ Copiado!</span>";
          btnCopiar.classList.add("copiado");
          setTimeout(() => {
            btnCopiar.innerHTML = textoOriginal;
            btnCopiar.classList.remove("copiado");
          }, 2000);
        }
      })
      .catch(() => {
        alert("Número do lote: " + loteValor);
      });
  }

  // Controle do menu dropdown de backup
  function alternarMenuBackup() {
    const menu = document.getElementById("menu-backup-fios");
    if (!menu) return;
    const estaVisivel = menu.style.display === "flex" || menu.style.display === "block";
    menu.style.display = estaVisivel ? "none" : "flex";
  }

  function fecharMenuBackup() {
    const menu = document.getElementById("menu-backup-fios");
    if (menu) menu.style.display = "none";
  }

  // ==========================================================================
  // PARTE 2.5: SIMULADOR DE COMBINAÇÃO DE CORES (2 A 5 FIOS — RF04)
  // ==========================================================================

  function obterFiosSelecionadosSimulador() {
    return idsSimulador
      .map((id) => fiosCache.find((f) => Number(f.id) === Number(id)))
      .filter(Boolean);
  }

  function alternarSelecaoSimulador(id) {
    const numId = Number(id);
    const idx = idsSimulador.findIndex((sid) => Number(sid) === numId);

    if (idx !== -1) {
      idsSimulador.splice(idx, 1);
    } else {
      if (idsSimulador.length >= 5) {
        alert("Você já selecionou o máximo de 5 fios para combinar. Remova um para adicionar outro.");
        return;
      }
      idsSimulador.push(numId);
    }

    sincronizarBotoesSelecaoCards();
    atualizarDockSimulador();

    const modalSim = document.getElementById("modal-simulador-cores");
    if (modalSim && modalSim.style.display === "flex") {
      renderizarSimulador();
    }
  }

  function sincronizarBotoesSelecaoCards() {
    const setIds = new Set(idsSimulador.map(Number));
    document.querySelectorAll(".card-fio[data-id]").forEach((card) => {
      const id = Number(card.dataset.id);
      const sel = setIds.has(id);
      card.classList.toggle("selecionado-paleta", sel);
      const btn = card.querySelector(".btn-selecionar-simulador");
      if (btn) {
        btn.classList.toggle("ativo", sel);
        btn.setAttribute("aria-pressed", String(sel));
        btn.title = sel ? "Remover da paleta de combinação" : "Adicionar ao Simulador de Cores";
        btn.innerHTML = `<span>${sel ? "✓ Na paleta" : "🎨 Combinar"}</span>`;
      }
    });
  }

  function atualizarDockSimulador() {
    // Limpa IDs que já não existem no cache
    const validos = new Set(fiosCache.map((f) => Number(f.id)));
    idsSimulador = idsSimulador.filter((id) => validos.has(Number(id)));

    const selecionados = obterFiosSelecionadosSimulador();
    const qtd = selecionados.length;

    const badgeTopo = document.getElementById("badge-qtd-simulador");
    if (badgeTopo) {
      badgeTopo.textContent = String(qtd);
      badgeTopo.style.display = qtd > 0 ? "inline-flex" : "none";
    }

    const dock = document.getElementById("dock-simulador-cores");
    const contEl = document.getElementById("dock-sim-contador");
    const bolinhasEl = document.getElementById("dock-sim-bolinhas");
    const btnAbrir = document.getElementById("btn-dock-abrir-sim");

    if (!dock) return;
    if (qtd === 0) {
      dock.style.display = "none";
      return;
    }

    dock.style.display = "flex";
    if (contEl) contEl.textContent = String(qtd);
    if (btnAbrir) {
      btnAbrir.disabled = false;
      btnAbrir.innerHTML =
        qtd >= 2 ? "<span>🎨 Abrir Simulador</span>" : "<span>🎨 Escolher +1 no Simulador</span>";
    }

    if (bolinhasEl) {
      bolinhasEl.innerHTML = "";
      selecionados.forEach((fio) => {
        const cor = obterCorRealFio(fio);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "dock-sim-bolinha";
        chip.style.backgroundColor = cor;
        chip.title = `${fio.nome} - ${fio.cor_nome} (clique para remover)`;
        chip.setAttribute("aria-label", `Remover ${fio.nome} ${fio.cor_nome}`);
        chip.innerHTML = `<span class="dock-bolinha-x" aria-hidden="true">×</span>`;
        chip.addEventListener("click", () => alternarSelecaoSimulador(fio.id));
        bolinhasEl.appendChild(chip);
      });
    }
  }

  function abrirSimuladorCores() {
    const modal = document.getElementById("modal-simulador-cores");
    if (!modal) return;

    // Se o usuário ainda não escolheu 2 fios mas há estoque, pré-seleciona uma amostra agradável
    if (idsSimulador.length < 2 && fiosCache.length >= 2) {
      sugerirHarmoniaEstoque(false);
    }

    modal.style.display = "flex";
    renderizarSimulador();
  }

  function fecharSimuladorCores() {
    const modal = document.getElementById("modal-simulador-cores");
    if (modal) modal.style.display = "none";
  }

  // Sugere automaticamente 3 ou 4 fios harmoniosos do próprio estoque (baseado em matiz HSL)
  function sugerirHarmoniaEstoque(renderizarDepois = true) {
    if (fiosCache.length < 2) {
      if (renderizarDepois) renderizarSimulador();
      return;
    }

    const candidatos = fiosCache.filter((f) => (Number(f.quantidade) || 0) > 0);
    const pool = candidatos.length >= 2 ? candidatos : fiosCache;
    const enriquecidos = pool.map((f) => {
      const hex = obterCorRealFio(f);
      return { fio: f, hex, hsl: hexParaHsl(hex) };
    });

    // Escolhe um fio âncora diferente do primeiro atual quando possível
    const basePool =
      idsSimulador.length > 0 && enriquecidos.length > 2
        ? enriquecidos.filter((x) => Number(x.fio.id) !== Number(idsSimulador[0]))
        : enriquecidos;
    const base = basePool[Math.floor(Math.random() * basePool.length)] || enriquecidos[0];

    const restantes = enriquecidos
      .filter((x) => Number(x.fio.id) !== Number(base.fio.id))
      .map((x) => {
        const diffH = Math.min(Math.abs(x.hsl.h - base.hsl.h), 360 - Math.abs(x.hsl.h - base.hsl.h));
        const diffL = Math.abs(x.hsl.l - base.hsl.l);
        const neutro = x.hsl.s <= 20 || x.hsl.l >= 85;
        // Pontua bem cores análogas (20–55°), complementares (145–180°) ou neutros contrastantes
        let score = 0;
        if (neutro && diffL >= 20) score += 28;
        if (diffH >= 20 && diffH <= 60) score += 32;
        if (diffH >= 145 && diffH <= 180) score += 30;
        if (diffL >= 18) score += 16;
        // Bônus leve por TEX compatível
        if (base.fio.tex && x.fio.tex && Math.abs(Number(base.fio.tex) - Number(x.fio.tex)) <= 120) {
          score += 14;
        }
        return { ...x, score: score + Math.random() * 8 };
      })
      .sort((a, b) => b.score - a.score);

    const alvoQtd = Math.min(4, Math.max(2, Math.min(3, pool.length)));
    const escolhidos = [base, ...restantes.slice(0, alvoQtd - 1)];
    idsSimulador = escolhidos.map((x) => Number(x.fio.id));

    sincronizarBotoesSelecaoCards();
    atualizarDockSimulador();
    if (renderizarDepois) renderizarSimulador();
  }

  function girarCoresSimulador() {
    if (idsSimulador.length < 2) return;
    const primeiro = idsSimulador.shift();
    idsSimulador.push(primeiro);
    atualizarDockSimulador();
    renderizarSimulador();
  }

  function inverterCoresSimulador() {
    if (idsSimulador.length < 2) return;
    idsSimulador.reverse();
    atualizarDockSimulador();
    renderizarSimulador();
  }

  function moverCorSimulador(index, direcao) {
    const destino = index + direcao;
    if (destino < 0 || destino >= idsSimulador.length) return;
    const temp = idsSimulador[index];
    idsSimulador[index] = idsSimulador[destino];
    idsSimulador[destino] = temp;
    atualizarDockSimulador();
    renderizarSimulador();
  }

  // Gera um SVG artesanal de Granny Square (Quadradinho da Vovó) com voltas concêntricas
  function gerarSvgGrannySquare(fios) {
    const n = fios.length;
    const totalVoltas = Math.max(4, n);
    const coresVoltas = [];
    for (let i = 0; i < totalVoltas; i++) {
      coresVoltas.push(obterCorRealFio(fios[i % n]));
    }

    const tamanho = 320;
    const centro = tamanho / 2;
    const camadas = [];

    // Desenha de fora para dentro (camada externa = última cor; miolo = primeira cor)
    const margemExt = 16;
    const passo = (centro - margemExt - 24) / totalVoltas;

    for (let v = totalVoltas - 1; v >= 0; v--) {
      const cor = coresVoltas[v];
      const contraste = obterCorTextoContraste(cor);
      const meiaLargura = 24 + (v + 1) * passo;
      const x = centro - meiaLargura;
      const y = centro - meiaLargura;
      const w = meiaLargura * 2;
      const rx = v === 0 ? 18 : 14;
      const blocosPorLado = v + 2;

      camadas.push(`
        <rect
          x="${x.toFixed(1)}" y="${y.toFixed(1)}"
          width="${w.toFixed(1)}" height="${w.toFixed(1)}"
          rx="${rx}" ry="${rx}"
          fill="${cor}"
          stroke="rgba(12, 16, 30, 0.28)"
          stroke-width="2"
        />
      `);

      // Pontos estilizados (clusters de 3 pontos altos) ao longo da borda da carreira
      const espacamento = (w - 22) / blocosPorLado;
      const offsetBorda = Math.max(5.5, passo * 0.48);
      for (let b = 0; b < blocosPorLado; b++) {
        const pos = x + 11 + espacamento * (b + 0.5);
        const rPonto = Math.min(4.2, Math.max(2.3, passo * 0.16));
        const op = contraste === "#161B2E" ? "0.18" : "0.24";
        // Topo e base
        camadas.push(
          `<circle cx="${pos.toFixed(1)}" cy="${(y + offsetBorda).toFixed(1)}" r="${rPonto.toFixed(1)}" fill="${contraste}" opacity="${op}" />`,
          `<circle cx="${pos.toFixed(1)}" cy="${(y + w - offsetBorda).toFixed(1)}" r="${rPonto.toFixed(1)}" fill="${contraste}" opacity="${op}" />`,
          // Esquerda e direita
          `<circle cx="${(x + offsetBorda).toFixed(1)}" cy="${pos.toFixed(1)}" r="${rPonto.toFixed(1)}" fill="${contraste}" opacity="${op}" />`,
          `<circle cx="${(x + w - offsetBorda).toFixed(1)}" cy="${pos.toFixed(1)}" r="${rPonto.toFixed(1)}" fill="${contraste}" opacity="${op}" />`
        );
      }
    }

    // Miolo mágico central
    const corMiolo = coresVoltas[0];
    const contrasteMiolo = obterCorTextoContraste(corMiolo);
    camadas.push(`
      <circle cx="${centro}" cy="${centro}" r="16" fill="${corMiolo}" stroke="${contrasteMiolo}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="4 3" />
      <circle cx="${centro}" cy="${centro}" r="5" fill="${contrasteMiolo}" opacity="0.28" />
    `);

    return `
      <svg viewBox="0 0 ${tamanho} ${tamanho}" class="granny-square-svg" role="img" aria-label="Pré-visualização em Quadradinho da Vovó (Granny Square)">
        ${camadas.join("")}
      </svg>
    `;
  }

  function renderizarSimulador() {
    const selecionados = obterFiosSelecionadosSimulador();
    const palco = document.getElementById("simulador-preview-palco");
    const listaSel = document.getElementById("simulador-lista-selecionados");
    const gradeEst = document.getElementById("simulador-grade-estoque");
    const qtdAtualEl = document.getElementById("sim-qtd-atual");
    const alertaTex = document.getElementById("simulador-alerta-tex");
    const espessuraWrap = document.getElementById("sim-espessura-wrap");

    if (qtdAtualEl) qtdAtualEl.textContent = String(selecionados.length);
    if (espessuraWrap) {
      espessuraWrap.style.display = modoSimulador === "listras" ? "flex" : "none";
    }

    // Atualiza estado das abas de modo
    document.querySelectorAll(".btn-sim-modo[data-sim-modo]").forEach((btn) => {
      const ativo = btn.dataset.simModo === modoSimulador;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-selected", String(ativo));
    });

    // Alerta inteligente de diferença de TEX
    if (alertaTex) {
      const texVals = selecionados.map((f) => Number(f.tex)).filter((t) => t > 0);
      if (texVals.length >= 2) {
        const minT = Math.min(...texVals);
        const maxT = Math.max(...texVals);
        if (maxT - minT >= 200) {
          alertaTex.style.display = "flex";
          alertaTex.textContent = `⚠️ Diferença de espessura (TEX) entre os fios escolhidos: de ${minT} até ${maxT}. Considere trabalhar com fio duplo nos mais finos.`;
        } else {
          alertaTex.style.display = "none";
        }
      } else {
        alertaTex.style.display = "none";
      }
    }

    // Renderização do Palco de Preview
    if (palco) {
      const svgPaletaVazia = `
        <span class="svg-vazio-artesanal compacto" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="22" cy="36" r="11"></circle>
            <circle cx="42" cy="36" r="11"></circle>
            <circle cx="32" cy="21" r="10"></circle>
            <path d="M14 48c9 5 27 5 36 0" stroke-dasharray="3 3"></path>
          </svg>
        </span>
      `;
      if (fiosCache.length < 2) {
        palco.innerHTML = `
          <div class="sim-palco-vazio">
            ${svgPaletaVazia}
            <p>Cadastre pelo menos <strong>2 fios</strong> no seu inventário para testar combinações de cores.</p>
          </div>
        `;
      } else if (selecionados.length < 2) {
        palco.innerHTML = `
          <div class="sim-palco-vazio">
            ${svgPaletaVazia}
            <p>Selecione pelo menos <strong>2 fios</strong> abaixo (até 5) ou clique em <strong>✨ Harmonia</strong> para gerar uma paleta automática.</p>
          </div>
        `;
      } else if (modoSimulador === "listras") {
        const repeticoes = espessuraListra === "fina" ? 3 : espessuraListra === "larga" ? 1 : 2;
        const faixasHtml = [];
        for (let r = 0; r < repeticoes; r++) {
          selecionados.forEach((f) => {
            const hex = obterCorRealFio(f);
            const txt = obterCorTextoContraste(hex);
            faixasHtml.push(`
              <div class="sim-listra-faixa esp-${espessuraListra}" style="background-color: ${hex}; color: ${txt};" title="${escapeHtml(f.nome)} — ${escapeHtml(f.cor_nome)}">
                <span class="sim-listra-trama" aria-hidden="true"></span>
                ${r === 0 ? `<span class="sim-listra-rotulo">${escapeHtml(f.cor_nome || f.nome)}</span>` : ""}
              </div>
            `);
          });
        }
        palco.innerHTML = `<div class="sim-preview-listras">${faixasHtml.join("")}</div>`;
      } else if (modoSimulador === "granny") {
        const legendaVoltas = selecionados
          .map((f, i) => {
            const hex = obterCorRealFio(f);
            const papel = i === 0 ? "Miolo (1ª volta)" : i === selecionados.length - 1 ? `Borda (${i + 1}ª volta)` : `${i + 1}ª volta`;
            return `
              <div class="sim-granny-legenda-item">
                <span class="sim-legenda-bolinha" style="background-color: ${hex};"></span>
                <div>
                  <strong>${papel}</strong>
                  <span>${escapeHtml(f.nome)} — ${escapeHtml(f.cor_nome)}</span>
                </div>
              </div>
            `;
          })
          .join("");

        palco.innerHTML = `
          <div class="sim-preview-granny">
            <div class="sim-granny-quadro">
              ${gerarSvgGrannySquare(selecionados)}
            </div>
            <div class="sim-granny-legenda">
              ${legendaVoltas}
            </div>
          </div>
        `;
      } else {
        // Modo Pantone / Coolors (colunas verticais lado a lado)
        const colunasHtml = selecionados
          .map((f) => {
            const hex = obterCorRealFio(f);
            const txt = obterCorTextoContraste(hex);
            const qtd = Number(f.quantidade) || 0;
            return `
              <div class="sim-pantone-coluna" style="background-color: ${hex}; color: ${txt};">
                <div class="sim-pantone-topo">
                  <span class="sim-pantone-hex">${escapeHtml(f.cor_codigo ? `#${f.cor_codigo}` : hex)}</span>
                  ${qtd <= 0 ? `<span class="sim-pantone-alerta-qtd">Zerado</span>` : ""}
                </div>
                <div class="sim-pantone-base">
                  <strong class="sim-pantone-cor-nome">${escapeHtml(f.cor_nome || "Cor")}</strong>
                  <span class="sim-pantone-fio-nome">${escapeHtml(f.nome || "")}</span>
                  <span class="sim-pantone-meta">${f.tex ? `TEX ${f.tex} • ` : ""}${formatarQuantidade(qtd)} nov.</span>
                </div>
              </div>
            `;
          })
          .join("");
        palco.innerHTML = `<div class="sim-preview-pantone">${colunasHtml}</div>`;
      }
    }

    // Lista de fios selecionados (com reordenação ← → e remover)
    if (listaSel) {
      if (selecionados.length === 0) {
        listaSel.innerHTML = `<span class="sim-hint-vazio">Nenhum fio selecionado ainda.</span>`;
      } else {
        listaSel.innerHTML = "";
        selecionados.forEach((f, idx) => {
          const cor = obterCorRealFio(f);
          const chip = document.createElement("div");
          chip.className = "sim-chip-selecionado";
          chip.innerHTML = `
            <span class="sim-chip-bolinha" style="background-color: ${cor};"></span>
            <div class="sim-chip-textos">
              <strong>${escapeHtml(f.cor_nome || "Cor")}</strong>
              <span>${escapeHtml(f.nome || "")}</span>
            </div>
            <div class="sim-chip-controles">
              <button type="button" class="btn-sim-mover" data-dir="-1" title="Mover para esquerda" ${idx === 0 ? "disabled" : ""}>‹</button>
              <button type="button" class="btn-sim-mover" data-dir="1" title="Mover para direita" ${idx === selecionados.length - 1 ? "disabled" : ""}>›</button>
              <button type="button" class="btn-sim-remover" title="Remover da paleta">×</button>
            </div>
          `;
          chip.querySelectorAll(".btn-sim-mover").forEach((b) => {
            b.addEventListener("click", () => moverCorSimulador(idx, Number(b.dataset.dir)));
          });
          chip.querySelector(".btn-sim-remover")?.addEventListener("click", () => alternarSelecaoSimulador(f.id));
          listaSel.appendChild(chip);
        });
      }
    }

    // Grade rápida do estoque para adicionar/remover
    if (gradeEst) {
      const setSel = new Set(idsSimulador.map(Number));
      gradeEst.innerHTML = "";
      if (fiosCache.length === 0) {
        gradeEst.innerHTML = `<span class="sim-hint-vazio">Seu inventário está vazio.</span>`;
      } else {
        fiosCache.forEach((f) => {
          const cor = obterCorRealFio(f);
          const ativo = setSel.has(Number(f.id));
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `sim-item-estoque${ativo ? " ativo" : ""}`;
          btn.setAttribute("aria-pressed", String(ativo));
          btn.innerHTML = `
            <span class="sim-est-swatch" style="background-color: ${cor};"></span>
            <div class="sim-est-info">
              <strong>${escapeHtml(f.cor_nome || "Cor")}</strong>
              <span>${escapeHtml(f.nome || "")} • ${formatarQuantidade(f.quantidade)} nov.</span>
            </div>
            <span class="sim-est-check">${ativo ? "✓" : "+"}</span>
          `;
          btn.addEventListener("click", () => alternarSelecaoSimulador(f.id));
          gradeEst.appendChild(btn);
        });
      }
    }
  }

  function copiarListaSimulador() {
    const selecionados = obterFiosSelecionadosSimulador();
    if (selecionados.length === 0) return;

    const linhas = [
      "🎨 Combinação de Fios — Ponto & Trama",
      ...selecionados.map((f, i) => {
        const hex = obterCorRealFio(f);
        const cod = f.cor_codigo ? ` (Cód. ${f.cor_codigo})` : "";
        const tex = f.tex ? ` | TEX ${f.tex}` : "";
        const lote = f.lote ? ` | Lote ${f.lote}` : "";
        return `${i + 1}. ${f.nome} (${f.marca}) — ${f.cor_nome}${cod} [${hex}]${tex}${lote} — Estoque: ${formatarQuantidade(f.quantidade)} nov.`;
      })
    ];

    const texto = linhas.join("\n");
    const btn = document.getElementById("btn-sim-copiar-lista");
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = "✓ Lista Copiada!";
          setTimeout(() => {
            btn.textContent = orig;
          }, 2000);
        }
      })
      .catch(() => {
        alert(texto);
      });
  }

  // Exporta a combinação atual (Listras, Granny Square ou Pantone) como imagem PNG
  function exportarPaletaPNG() {
    const selecionados = obterFiosSelecionadosSimulador();
    if (selecionados.length < 2) {
      alert("Selecione pelo menos 2 fios para exportar a imagem da combinação.");
      return;
    }

    const W = 1080;
    const H = 740;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Fundo creme elegante
    ctx.fillStyle = "#111C42";
    ctx.fillRect(0, 0, W, H);

    // Título
    ctx.fillStyle = "#FCF1D0";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("Ponto & Trama — Combinação de Cores", 48, 56);
    ctx.fillStyle = "rgba(252, 241, 208, 0.72)";
    ctx.font = "16px sans-serif";
    const subModo =
      modoSimulador === "granny"
        ? "Prévia em Granny Square (Quadradinho da Vovó)"
        : modoSimulador === "pantone"
          ? "Paleta Pantone / Amostras lado a lado"
          : "Prévia em Listras";
    ctx.fillText(subModo, 48, 84);

    // Área do Preview (y: 108 até 540)
    const px = 48;
    const py = 108;
    const pw = W - 96;
    const ph = 420;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 18);
    ctx.clip();

    if (modoSimulador === "pantone") {
      const colW = pw / selecionados.length;
      selecionados.forEach((f, idx) => {
        const hex = obterCorRealFio(f);
        const txt = obterCorTextoContraste(hex);
        const cx = px + idx * colW;
        ctx.fillStyle = hex;
        ctx.fillRect(cx, py, colW + 1, ph);
        ctx.fillStyle = txt;
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(f.cor_nome || "Cor", cx + 18, py + ph - 52);
        ctx.font = "15px monospace";
        ctx.fillText(f.cor_codigo ? `#${f.cor_codigo}` : hex, cx + 18, py + ph - 24);
      });
    } else if (modoSimulador === "granny") {
      ctx.fillStyle = "#0A1230";
      ctx.fillRect(px, py, pw, ph);
      const totalVoltas = Math.max(4, selecionados.length);
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      const maxMeia = 186;
      const passo = (maxMeia - 26) / totalVoltas;
      for (let v = totalVoltas - 1; v >= 0; v--) {
        const cor = obterCorRealFio(selecionados[v % selecionados.length]);
        const meia = 26 + (v + 1) * passo;
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.roundRect(cx - meia, cy - meia, meia * 2, meia * 2, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(10, 14, 30, 0.28)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    } else {
      const reps = espessuraListra === "fina" ? 3 : espessuraListra === "larga" ? 1 : 2;
      const totalFaixas = selecionados.length * reps;
      const fh = ph / totalFaixas;
      let idxFaixa = 0;
      for (let r = 0; r < reps; r++) {
        selecionados.forEach((f) => {
          const hex = obterCorRealFio(f);
          ctx.fillStyle = hex;
          ctx.fillRect(px, py + idxFaixa * fh, pw, fh + 1);
          idxFaixa++;
        });
      }
    }
    ctx.restore();

    // Legenda inferior dos fios
    const ly = 562;
    const itemW = pw / selecionados.length;
    selecionados.forEach((f, idx) => {
      const hex = obterCorRealFio(f);
      const ix = px + idx * itemW;

      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(ix + 16, ly + 22, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#FCF1D0";
      ctx.font = "bold 16px sans-serif";
      const corCurta = (f.cor_nome || "Cor").slice(0, 18);
      ctx.fillText(corCurta, ix + 38, ly + 19);

      ctx.fillStyle = "rgba(252, 241, 208, 0.72)";
      ctx.font = "13px sans-serif";
      const linhaCurta = `${f.nome || ""} ${f.cor_codigo ? `#${f.cor_codigo}` : ""}`.trim().slice(0, 22);
      ctx.fillText(linhaCurta, ix + 38, ly + 40);

      ctx.fillStyle = "rgba(252, 241, 208, 0.55)";
      ctx.font = "12px monospace";
      ctx.fillText(`${hex} • ${formatarQuantidade(f.quantidade)} nov.`, ix + 38, ly + 60);
    });

    const dataUrl = canvas.toDataURL("image/png");
    const nomeArquivo = `ponto-e-trama-paleta-${new Date().toISOString().slice(0, 10)}.png`;
    if (
      typeof window !== "undefined" &&
      window.PontoETramaAndroid &&
      typeof window.PontoETramaAndroid.salvarArquivoBase64 === "function"
    ) {
      const base64 = dataUrl.split(",")[1] || "";
      window.PontoETramaAndroid.salvarArquivoBase64(nomeArquivo, "image/png", base64);
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // ==========================================================================
  // PARTE 3: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================
  function vincularEventos() {
    // 1. Botão + Novo Fio (Barra de ferramentas e Estado Vazio)
    const btnNovoFio = document.getElementById("btn-novo-fio");
    const btnVazioNovoFio = document.getElementById("btn-vazio-novo-fio");
    if (btnNovoFio) {
      btnNovoFio.addEventListener("click", () => abrirModalCadastro(null, "Novo Fio"));
    }
    if (btnVazioNovoFio) {
      btnVazioNovoFio.addEventListener("click", () => abrirModalCadastro(null, "Novo Fio"));
    }

    // 2. Dropdown de Backup
    const btnMenuBackup = document.getElementById("btn-menu-backup-fios");
    if (btnMenuBackup) {
      btnMenuBackup.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarMenuBackup();
      });
    }

    const btnExportar = document.getElementById("btn-exportar-fios");
    if (btnExportar) {
      btnExportar.addEventListener("click", (e) => {
        e.stopPropagation();
        exportarBackupJSON();
      });
    }

    const inputImportar = document.getElementById("input-importar-fios");
    if (inputImportar) {
      inputImportar.addEventListener("change", (e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) importarBackupJSON(arquivo);
        e.target.value = "";
      });
    }

    // Fecha dropdown de backup ao clicar fora
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown-backup-fios")) {
        fecharMenuBackup();
      }
    });

    // 3. Busca Instantânea (com debounce leve) e Filtros
    const inputBusca = document.getElementById("busca-fios");
    if (inputBusca) {
      const filtrarDebounced =
        typeof BancoDadosPT !== "undefined" ? BancoDadosPT.debounce(() => aplicarFiltros(false), 80) : () => aplicarFiltros(false);
      inputBusca.addEventListener("input", filtrarDebounced);
    }

    const selectMarca = document.getElementById("filtro-marca");
    if (selectMarca) {
      selectMarca.addEventListener("change", () => aplicarFiltros());
    }

    const selectComposicao = document.getElementById("filtro-composicao");
    if (selectComposicao) {
      selectComposicao.addEventListener("change", () => aplicarFiltros());
    }

    const selectTex = document.getElementById("filtro-tex");
    if (selectTex) {
      selectTex.addEventListener("change", () => aplicarFiltros());
    }

    const selectStatus = document.getElementById("filtro-status");
    if (selectStatus) {
      selectStatus.addEventListener("change", () => aplicarFiltros());
    }

    const btnLimparFiltros = document.getElementById("btn-limpar-filtros-fios");
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener("click", () => limparFiltros());
    }

    // 3.5 Alternador de Visualização (Prateleira Pantone vs Compacto)
    document.getElementById("btn-modo-pantone")?.addEventListener("click", () => aplicarModoVisualizacao("pantone"));
    document.getElementById("btn-modo-compacto")?.addEventListener("click", () => aplicarModoVisualizacao("compacto"));

    // 3.6 Simulador de Combinação de Cores (Botão topo, Dock flutuante e Modal)
    document.getElementById("btn-abrir-simulador-cores")?.addEventListener("click", abrirSimuladorCores);
    document.getElementById("btn-dock-abrir-sim")?.addEventListener("click", abrirSimuladorCores);
    document.getElementById("btn-dock-limpar-sim")?.addEventListener("click", () => {
      idsSimulador = [];
      sincronizarBotoesSelecaoCards();
      atualizarDockSimulador();
    });

    document.getElementById("btn-fechar-simulador-cores")?.addEventListener("click", fecharSimuladorCores);
    const modalSim = document.getElementById("modal-simulador-cores");
    if (modalSim) {
      modalSim.addEventListener("click", (e) => {
        if (e.target === modalSim) fecharSimuladorCores();
      });
    }

    document.querySelectorAll(".btn-sim-modo[data-sim-modo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        modoSimulador = btn.dataset.simModo || "listras";
        renderizarSimulador();
      });
    });

    document.getElementById("sim-espessura-listra")?.addEventListener("change", (e) => {
      espessuraListra = e.target.value || "media";
      renderizarSimulador();
    });

    document.getElementById("btn-sim-harmonia")?.addEventListener("click", () => sugerirHarmoniaEstoque(true));
    document.getElementById("btn-sim-embaralhar")?.addEventListener("click", girarCoresSimulador);
    document.getElementById("btn-sim-inverter")?.addEventListener("click", inverterCoresSimulador);
    document.getElementById("btn-sim-limpar-todos")?.addEventListener("click", () => {
      idsSimulador = [];
      sincronizarBotoesSelecaoCards();
      atualizarDockSimulador();
      renderizarSimulador();
    });
    document.getElementById("btn-sim-copiar-lista")?.addEventListener("click", copiarListaSimulador);
    document.getElementById("btn-sim-baixar-png")?.addEventListener("click", exportarPaletaPNG);

    // 3.7 Sincronização do Seletor de Cor Real (Swatch Pantone) no Modal de Cadastro
    const inputCorHex = document.getElementById("fio-cor-hex");
    const inputCorHexTxt = document.getElementById("fio-cor-hex-texto");
    const inputCorNome = document.getElementById("fio-cor-nome");
    const btnExtrairCorFoto = document.getElementById("btn-extrair-cor-foto");

    if (inputCorHex) {
      inputCorHex.addEventListener("input", () => {
        corHexEditadaManualmente = true;
        definirCorHexFormulario(inputCorHex.value);
      });
    }
    if (inputCorHexTxt) {
      inputCorHexTxt.addEventListener("input", () => {
        const norm = normalizarHex(inputCorHexTxt.value);
        if (norm) {
          corHexEditadaManualmente = true;
          if (inputCorHex) inputCorHex.value = norm.toLowerCase();
        }
      });
      inputCorHexTxt.addEventListener("blur", () => {
        const norm = normalizarHex(inputCorHexTxt.value);
        if (norm) definirCorHexFormulario(norm);
        else if (inputCorHex) definirCorHexFormulario(inputCorHex.value);
      });
    }
    if (inputCorNome) {
      inputCorNome.addEventListener("input", () => {
        if (!corHexEditadaManualmente && inputCorNome.value.trim().length >= 3) {
          definirCorHexFormulario(inferirCorHexDoNome(inputCorNome.value));
        }
      });
    }
    if (btnExtrairCorFoto) {
      btnExtrairCorFoto.addEventListener("click", async () => {
        if (!imagemAtualBase64) return;
        const corFoto = await extrairCorDominanteDaImagem(imagemAtualBase64);
        if (corFoto) {
          corHexEditadaManualmente = true;
          definirCorHexFormulario(corFoto);
        }
      });
    }

    // 4. Modal de Cadastro: Fechar, Abas, Upload e Salvar
    const btnFecharModalFio = document.getElementById("btn-fechar-modal-fio");
    const btnCancelarModalFio = document.getElementById("btn-cancelar-modal-fio");
    if (btnFecharModalFio) btnFecharModalFio.addEventListener("click", fecharModalCadastro);
    if (btnCancelarModalFio) btnCancelarModalFio.addEventListener("click", fecharModalCadastro);

    const abasForm = document.querySelectorAll(".abas-modal-fio .aba-item");
    abasForm.forEach((aba) => {
      aba.addEventListener("click", () => {
        const nomeAba = aba.dataset.aba;
        if (nomeAba) alternarAbaFormulario(nomeAba);
      });
    });

    const formFio = document.getElementById("form-fio");
    if (formFio) {
      formFio.addEventListener("submit", salvarFormularioFio);
    }

    // Upload de Imagem no Formulário
    const uploadArea = document.getElementById("upload-area-fio");
    const inputImagem = document.getElementById("fio-imagem-input");
    const btnRemoverFoto = document.getElementById("btn-remover-foto");

    if (uploadArea && inputImagem) {
      inputImagem.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      uploadArea.addEventListener("click", (e) => {
        if (e.target === inputImagem || e.target.closest("#btn-remover-foto")) return;
        inputImagem.click();
      });

      inputImagem.addEventListener("change", (e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) processarArquivoImagem(arquivo);
        e.target.value = "";
      });

      // Suporte a Drag & Drop
      uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
      });

      uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
      });

      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        const arquivo = e.dataTransfer?.files?.[0];
        if (arquivo) processarArquivoImagem(arquivo);
      });
    }

    if (btnRemoverFoto) {
      btnRemoverFoto.addEventListener("click", (e) => {
        e.stopPropagation();
        imagemAtualBase64 = null;
        atualizarPreviewImagem(null);
      });
    }

    // Fechar modal de cadastro ao clicar no overlay
    const modalCadastro = document.getElementById("modal-cadastro-fio");
    if (modalCadastro) {
      modalCadastro.addEventListener("click", (e) => {
        if (e.target === modalCadastro) fecharModalCadastro();
      });
    }

    // 5. Modal de Detalhes: Fechar, Navegação, Copiar Lote, Estoque e Ações de Rodapé
    const btnFecharDetalhes = document.getElementById("btn-fechar-detalhes-fio");
    if (btnFecharDetalhes) btnFecharDetalhes.addEventListener("click", fecharModalDetalhes);

    const btnNavAnt = document.getElementById("btn-fio-anterior");
    const btnNavProx = document.getElementById("btn-fio-proximo");
    if (btnNavAnt) btnNavAnt.addEventListener("click", () => navegarDetalhes(-1));
    if (btnNavProx) btnNavProx.addEventListener("click", () => navegarDetalhes(1));

    const btnCopiarLote = document.getElementById("btn-copiar-lote");
    if (btnCopiarLote) btnCopiarLote.addEventListener("click", copiarLote);

    const btnMenosDet = document.getElementById("det-btn-menos");
    const btnMaisDet = document.getElementById("det-btn-mais");
    if (btnMenosDet) {
      btnMenosDet.addEventListener("click", () => {
        if (idFioSelecionado) alterarQuantidade(idFioSelecionado, -0.5);
      });
    }
    if (btnMaisDet) {
      btnMaisDet.addEventListener("click", () => {
        if (idFioSelecionado) alterarQuantidade(idFioSelecionado, 0.5);
      });
    }

    const btnExcluirDet = document.getElementById("btn-excluir-fio");
    if (btnExcluirDet) {
      btnExcluirDet.addEventListener("click", () => {
        if (idFioSelecionado !== null && idFioSelecionado !== undefined) {
          solicitarExclusaoFio(idFioSelecionado);
        }
      });
    }

    // Modal de Confirmação de Exclusão de Fio
    const btnCancelarExclusao = document.getElementById("btn-cancelar-exclusao-fio");
    const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao-fio");
    const modalConfirmarExclusao = document.getElementById("modal-confirmar-exclusao-fio");

    if (btnCancelarExclusao) {
      btnCancelarExclusao.addEventListener("click", fecharModalConfirmarExclusao);
    }

    if (btnConfirmarExclusao) {
      btnConfirmarExclusao.addEventListener("click", () => executarExclusaoFio());
    }

    if (modalConfirmarExclusao) {
      modalConfirmarExclusao.addEventListener("click", (e) => {
        if (e.target === modalConfirmarExclusao) fecharModalConfirmarExclusao();
      });
    }

    const btnDuplicarDet = document.getElementById("btn-duplicar-fio");
    if (btnDuplicarDet) {
      btnDuplicarDet.addEventListener("click", () => {
        if (idFioSelecionado) duplicarFio(idFioSelecionado);
      });
    }

    const btnEditarDet = document.getElementById("btn-editar-fio");
    if (btnEditarDet) {
      btnEditarDet.addEventListener("click", () => {
        if (idFioSelecionado) {
          const fio = fiosCache.find((f) => f.id === idFioSelecionado);
          if (fio) {
            fecharModalDetalhes();
            abrirModalCadastro(fio, "Editar Fio");
          }
        }
      });
    }

    // Fechar modal de detalhes ao clicar no overlay
    const modalDetalhes = document.getElementById("modal-detalhes-fio");
    if (modalDetalhes) {
      modalDetalhes.addEventListener("click", (e) => {
        if (e.target === modalDetalhes) fecharModalDetalhes();
      });
    }

    // 6. Atalhos de Teclado Globais (ESC para fechar modais, setas para navegar detalhes)
    document.addEventListener("keydown", (e) => {
      const modalDet = document.getElementById("modal-detalhes-fio");
      const modalCad = document.getElementById("modal-cadastro-fio");

      const detAberto = modalDet && (modalDet.style.display === "flex" || modalDet.style.display === "block");
      const cadAberto = modalCad && (modalCad.style.display === "flex" || modalCad.style.display === "block");

      if (e.key === "Escape") {
        const modalConf = document.getElementById("modal-confirmar-exclusao-fio");
        if (modalConf && (modalConf.style.display === "flex" || modalConf.style.display === "block")) {
          fecharModalConfirmarExclusao();
          return;
        }
        const modalSimEsc = document.getElementById("modal-simulador-cores");
        if (modalSimEsc && (modalSimEsc.style.display === "flex" || modalSimEsc.style.display === "block")) {
          fecharSimuladorCores();
          return;
        }
        if (cadAberto) fecharModalCadastro();
        else if (detAberto) fecharModalDetalhes();
        else fecharMenuBackup();
      }

      if (detAberto && !cadAberto) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          navegarDetalhes(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          navegarDetalhes(1);
        }
      }
    });
  }

  async function recarregar() {
    try {
      await carregarDadosIniciais();
      aplicarFiltros(true);
      atualizarResumoEstoque();
    } catch (erro) {
      console.error("Falha ao recarregar Inventário de Fios:", erro);
    }
  }

  let jaInicializado = false;

  // Inicialização do módulo
  async function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    try {
      const modoSalvo = localStorage.getItem("ponto_trama_fios_modo_vis") || "pantone";
      aplicarModoVisualizacao(modoSalvo);
      vincularEventos();
      await carregarDadosIniciais();
      aplicarFiltros(true);
      atualizarResumoEstoque();
      atualizarDockSimulador();
      window.addEventListener("ponto-trama:configuracoes-atualizadas", () => {
        aplicarFiltros(false);
        atualizarResumoEstoque();
      });
    } catch (erro) {
      console.error("Falha ao inicializar o Inventário de Fios:", erro);
    }
  }

  // API pública do módulo
  return {
    init,
    recarregar,
    alterarQuantidade,
    duplicarFio,
    excluirFio: solicitarExclusaoFio,
    solicitarExclusaoFio,
    executarExclusaoFio,
    exportarBackupJSON,
    importarBackupJSON,
    abrirSimuladorCores,
    obterCorRealFio,
    abrirModalDetalhesPorId
  };
})();
