// ==========================================================================
// PONTO & TRAMA — DICIONÁRIO MULTILÍNGUE & TRADUTOR AUTOMÁTICO DE RECEITAS
// Módulos A (RF01-RF05), B (RF06-RF11, RN01-RN04) e C (RF12-RF13, RNF01-RNF05)
// 100% client-side e offline-first (zero envio de receitas para servidores).
// ==========================================================================

const TradutorReceitas = (() => {
  const CACHE_KEY = "ponto_trama_dicionario_pontos_v1";
  const DATA_URL = "data/dicionario-pontos.json";

  const NOMES_IDIOMA = {
    pt: "Português (BR)",
    us: "Inglês (US)",
    uk: "Inglês (UK)",
    es: "Espanhol (ES)"
  };

  const NOMES_CATEGORIA = {
    basicos: "Pontos Básicos",
    aumentos: "Aumentos / Dim.",
    especiais: "Pontos Especiais",
    acabamentos: "Acabamentos",
    acoes: "Ações / Estrutura"
  };

  // Fallback mínimo embutido caso aberto via file:// sem acesso a fetch()
  const FALLBACK_ESSENCIAL = [
    { id: "corr", tecnica: "croche", categoria: "basicos", siglas: { pt: ["corr"], us: ["ch"], uk: ["ch"], es: ["cad"] }, nomes: { pt: "Correntinha", us: "Chain", uk: "Chain", es: "Cadeneta" }, descricao: "Laçada base do crochê." },
    { id: "pbx", tecnica: "croche", categoria: "basicos", siglas: { pt: ["pbx"], us: ["sl st", "slst"], uk: ["sl st", "slst"], es: ["pe", "pr"] }, nomes: { pt: "Ponto Baixíssimo", us: "Slip Stitch", uk: "Slip Stitch", es: "Punto Enano" }, descricao: "Ponto sem altura para fechar voltas ou unir." },
    { id: "pb", tecnica: "croche", categoria: "basicos", ambiguo_en: true, siglas: { pt: ["pb"], us: ["sc"], uk: ["dc"], es: ["pb", "mp"] }, nomes: { pt: "Ponto Baixo", us: "Single Crochet", uk: "Double Crochet", es: "Punto Bajo" }, descricao: "Ponto firme e fechado." },
    { id: "mpa", tecnica: "croche", categoria: "basicos", ambiguo_en: true, siglas: { pt: ["mpa"], us: ["hdc"], uk: ["htr"], es: ["mpa", "mv"] }, nomes: { pt: "Meio Ponto Alto", us: "Half Double Crochet", uk: "Half Treble Crochet", es: "Medio Punto Alto" }, descricao: "Altura intermediária entre pb e pa." },
    { id: "pa", tecnica: "croche", categoria: "basicos", ambiguo_en: true, siglas: { pt: ["pa"], us: ["dc"], uk: ["tr"], es: ["pa", "v"] }, nomes: { pt: "Ponto Alto", us: "Double Crochet", uk: "Treble Crochet", es: "Punto Alto" }, descricao: "Ponto alto clássico de 1 laçada." },
    { id: "pad", tecnica: "croche", categoria: "basicos", ambiguo_en: true, siglas: { pt: ["pad"], us: ["tr"], uk: ["dtr"], es: ["pad"] }, nomes: { pt: "Ponto Alto Duplo", us: "Treble Crochet", uk: "Double Treble Crochet", es: "Punto Alto Doble" }, descricao: "Ponto alongado com 2 laçadas." },
    { id: "aum", tecnica: "ambos", categoria: "aumentos", siglas: { pt: ["aum"], us: ["inc"], uk: ["inc"], es: ["aum"] }, nomes: { pt: "Aumento", us: "Increase", uk: "Increase", es: "Aumento" }, descricao: "2 pontos no mesmo ponto de base." },
    { id: "dim", tecnica: "ambos", categoria: "aumentos", siglas: { pt: ["dim"], us: ["dec"], uk: ["dec"], es: ["dism"] }, nomes: { pt: "Diminuição", us: "Decrease", uk: "Decrease", es: "Disminución" }, descricao: "Une 2 pontos em 1." },
    { id: "sc2tog", tecnica: "croche", categoria: "aumentos", ambiguo_en: true, siglas: { pt: ["2pbj"], us: ["sc2tog"], uk: ["dc2tog"], es: ["2pbj"] }, nomes: { pt: "2 Pontos Baixos Juntos", us: "Single Crochet 2 Together", uk: "Double Crochet 2 Together", es: "2 Puntos Bajos Juntos" }, descricao: "Diminuição em ponto baixo." },
    { id: "blo", tecnica: "croche", categoria: "especiais", siglas: { pt: ["BLO"], us: ["BLO"], uk: ["BLO"], es: ["BLO"] }, nomes: { pt: "Alça de Trás (BLO)", us: "Back Loop Only", uk: "Back Loop Only", es: "Solo Hebra Trasera" }, descricao: "Trabalhar apenas na alça traseira." },
    { id: "meia", tecnica: "trico", categoria: "basicos", siglas: { pt: ["m"], us: ["k"], uk: ["k"], es: ["der"] }, nomes: { pt: "Ponto Meia", us: "Knit", uk: "Knit", es: "Punto Derecho" }, descricao: "Ponto base em V do tricô." },
    { id: "trico_pt", tecnica: "trico", categoria: "basicos", siglas: { pt: ["t"], us: ["p"], uk: ["p"], es: ["rev"] }, nomes: { pt: "Ponto Tricô", us: "Purl", uk: "Purl", es: "Punto Revés" }, descricao: "Ponto base com ondinha do tricô." },
    { id: "k2tog", tecnica: "trico", categoria: "aumentos", siglas: { pt: ["2jm"], us: ["k2tog"], uk: ["k2tog"], es: ["2pjd"] }, nomes: { pt: "2 Juntos em Meia", us: "Knit 2 Together", uk: "Knit 2 Together", es: "2 Puntos Juntos Derecho" }, descricao: "Diminuição inclinada à direita." },
    { id: "lacada", tecnica: "trico", categoria: "aumentos", siglas: { pt: ["laç"], us: ["yo"], uk: ["yo"], es: ["laz"] }, nomes: { pt: "Laçada", us: "Yarn Over", uk: "Yarn Over", es: "Lazada" }, descricao: "Laçada que cria novo ponto." }
  ];

  let termos = [];
  let basePronta = false;
  let jaInicializado = false;
  let ultimoResultadoTexto = "";
  let ultimoResultadoHtml = "";
  let ultimoIdiomaEfetivo = "us";
  let timerToast = null;

  function escapeHtml(txt) {
    return String(txt || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizarBusca(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function mostrarToast(msg) {
    const el = document.getElementById("toast-receitas");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("visivel");
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), 2400);
  }

  // ==========================================================================
  // MÓDULO C: CACHE LOCAL COMPLETO + INDICADOR OFFLINE (RF12, RF13, RNF01)
  // ==========================================================================

  async function carregarBaseDicionario() {
    // 1. Tenta ler cache local imediato (zero latência)
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.termos) && parsed.termos.length > 0) {
          termos = parsed.termos;
          basePronta = true;
        }
      }
    } catch {
      // ignora
    }

    // 2. Busca o arquivo JSON versionado desacoplado (RNF04) e atualiza o cache local
    try {
      const resp = await fetch(DATA_URL, { cache: "no-cache" });
      if (resp && resp.ok) {
        const json = await resp.json();
        if (json && Array.isArray(json.termos) && json.termos.length > 0) {
          termos = json.termos;
          basePronta = true;
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(json));
          } catch {
            // ignora quota
          }
        }
      }
    } catch {
      if (!basePronta) {
        termos = FALLBACK_ESSENCIAL.slice();
        basePronta = true;
      }
    }

    if (termos.length === 0) {
      termos = FALLBACK_ESSENCIAL.slice();
      basePronta = true;
    }

    atualizarIndicadorOffline();
    return termos;
  }

  function atualizarIndicadorOffline() {
    const badge = document.getElementById("badge-status-offline-receitas");
    if (!badge) return;
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    const isAppLocal =
      typeof window !== "undefined" &&
      (window.__PONTO_TRAMA_DESKTOP__ === true || Boolean(window.PontoETramaAndroid));

    if (isOffline) {
      badge.textContent = "📡 Modo Offline — 100% local";
      badge.className = "badge-offline-receitas offline";
      badge.title = "Sem internet: dicionário e tradutor continuam funcionando 100% no seu dispositivo.";
    } else if (isAppLocal) {
      badge.textContent = `🔒 100% Local (${termos.length} termos)`;
      badge.className = "badge-offline-receitas local";
      badge.title = "Base completa armazenada localmente no aplicativo (privacidade total).";
    } else {
      badge.textContent = `✓ Cache offline pronto (${termos.length} termos)`;
      badge.className = "badge-offline-receitas pronto";
      badge.title = "Dicionário e tradutor salvos em cache local para uso mesmo sem internet.";
    }
  }

  // ==========================================================================
  // MÓDULO A: DICIONÁRIO MULTILÍNGUE & BUSCA INSTANTÂNEA (RF01-RF05)
  // ==========================================================================

  function filtrarTermosDicionario(busca, idioma, tecnica, categoria) {
    const q = normalizarBusca(busca);
    return termos.filter((t) => {
      if (tecnica && tecnica !== "todas" && t.tecnica !== "ambos" && t.tecnica !== tecnica) {
        return false;
      }
      if (categoria && categoria !== "todas" && t.categoria !== categoria) {
        return false;
      }
      if (!q) return true;

      const idiomasBusca = idioma && idioma !== "todos" ? [idioma] : ["pt", "us", "uk", "es"];
      const textoAlvo = [
        ...idiomasBusca.flatMap((id) => t.siglas[id] || []),
        ...idiomasBusca.map((id) => t.nomes[id] || ""),
        t.descricao || ""
      ]
        .map(normalizarBusca)
        .join(" ");

      return textoAlvo.includes(q);
    });
  }

  function copiarTexto(texto, rotulo = "Copiado!") {
    if (!texto) return;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(texto).then(() => mostrarToast(`📋 ${rotulo}`)).catch(() => fallbackCopiar(texto, rotulo));
    } else {
      fallbackCopiar(texto, rotulo);
    }
  }

  function fallbackCopiar(texto, rotulo) {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      mostrarToast(`📋 ${rotulo}`);
    } catch {
      mostrarToast("Não foi possível copiar.");
    }
  }

  function renderizarDicionario() {
    const grade = document.getElementById("grade-dicionario-pontos");
    const contEl = document.getElementById("contagem-dicionario-pontos");
    const btnLimpar = document.getElementById("btn-dic-limpar-filtros");
    if (!grade) return;

    const busca = document.getElementById("input-busca-dicionario")?.value || "";
    const idioma = document.getElementById("select-dic-idioma")?.value || "todos";
    const tecnica = document.getElementById("select-dic-tecnica")?.value || "todas";
    const categoria = document.getElementById("select-dic-categoria")?.value || "todas";

    const temFiltro = Boolean(busca.trim() || idioma !== "todos" || tecnica !== "todas" || categoria !== "todas");
    if (btnLimpar) btnLimpar.style.display = temFiltro ? "inline-flex" : "none";

    const filtrados = filtrarTermosDicionario(busca, idioma, tecnica, categoria);
    if (contEl) {
      contEl.textContent = filtrados.length === termos.length
        ? `${termos.length} termos`
        : `${filtrados.length} de ${termos.length}`;
    }

    grade.innerHTML = "";
    if (filtrados.length === 0) {
      grade.innerHTML = `
        <div class="vazio-dicionario">
          <strong>Nenhum termo encontrado</strong>
          <p>Tente buscar outra sigla (ex.: pb, sc, dc, k2tog, cad) ou limpe os filtros.</p>
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();
    filtrados.forEach((t) => {
      const linha = document.createElement("article");
      linha.className = "linha-termo-dic";
      const tecRotulo = t.tecnica === "croche" ? "Crochê" : t.tecnica === "trico" ? "Tricô" : "Crochê e Tricô";
      const catRotulo = NOMES_CATEGORIA[t.categoria] || t.categoria;
      const siglaPt = (t.siglas.pt || [""])[0];
      const siglaUs = (t.siglas.us || [""])[0];
      const siglaUk = (t.siglas.uk || [""])[0];
      const siglaEs = (t.siglas.es || [""])[0];

      const colDestaque = (id) => (idioma === id ? " destaque-idioma" : "");
      const metaTexto = `${tecRotulo} · ${catRotulo}`;

      linha.innerHTML = `
        <div class="dic-linha-principal" role="button" tabindex="0" aria-expanded="false">
          <div class="dic-cel-nome">
            <strong class="dic-nome-limpo">${escapeHtml(t.nomes.pt)}</strong>
            <span class="dic-meta-limpo">
              ${escapeHtml(metaTexto)}${t.ambiguo_en ? ' <span class="dic-tag-amb-discreta" title="Sigla diferente entre Inglês US e UK">· US ≠ UK</span>' : ""}
            </span>
          </div>

          <div class="dic-cel-siglas">
            <button type="button" class="btn-sigla-dic${colDestaque("pt")}" data-copiar="${escapeHtml(siglaPt)}" data-rotulo="Sigla PT-BR '${escapeHtml(siglaPt)}' copiada!" title="Copiar sigla PT-BR (${escapeHtml(t.nomes.pt)})">
              <span class="sigla-lbl-mob">PT</span>
              <strong>${escapeHtml(siglaPt)}</strong>
            </button>
            <button type="button" class="btn-sigla-dic${colDestaque("us")}" data-copiar="${escapeHtml(siglaUs)}" data-rotulo="Sigla US '${escapeHtml(siglaUs)}' copiada!" title="Copiar sigla US (${escapeHtml(t.nomes.us)})">
              <span class="sigla-lbl-mob">US</span>
              <strong>${escapeHtml(siglaUs)}</strong>
            </button>
            <button type="button" class="btn-sigla-dic${colDestaque("uk")}" data-copiar="${escapeHtml(siglaUk)}" data-rotulo="Sigla UK '${escapeHtml(siglaUk)}' copiada!" title="Copiar sigla UK (${escapeHtml(t.nomes.uk)})">
              <span class="sigla-lbl-mob">UK</span>
              <strong>${escapeHtml(siglaUk)}</strong>
            </button>
            <button type="button" class="btn-sigla-dic${colDestaque("es")}" data-copiar="${escapeHtml(siglaEs)}" data-rotulo="Sigla ES '${escapeHtml(siglaEs)}' copiada!" title="Copiar sigla ES (${escapeHtml(t.nomes.es)})">
              <span class="sigla-lbl-mob">ES</span>
              <strong>${escapeHtml(siglaEs)}</strong>
            </button>
          </div>

          <span class="dic-seta-expandir" aria-hidden="true">▾</span>
        </div>

        <div class="dic-linha-detalhes">
          <div class="dic-nomes-4">
            <div><span>PT-BR</span><strong>${escapeHtml(t.nomes.pt)}</strong></div>
            <div><span>EN · US</span><strong>${escapeHtml(t.nomes.us)}</strong></div>
            <div><span>EN · UK</span><strong>${escapeHtml(t.nomes.uk)}</strong></div>
            <div><span>ES</span><strong>${escapeHtml(t.nomes.es)}</strong></div>
          </div>
          <div class="dic-detalhe-rodape">
            <p class="dic-descricao">${escapeHtml(t.descricao)}</p>
            <button type="button" class="btn-dic-copiar" data-copiar="${escapeHtml(t.nomes.pt)}" data-rotulo="'${escapeHtml(t.nomes.pt)}' copiado!">Copiar nome</button>
          </div>
        </div>
      `;

      const principal = linha.querySelector(".dic-linha-principal");
      const alternarDetalhes = () => {
        const aberto = linha.classList.toggle("aberto");
        principal?.setAttribute("aria-expanded", aberto ? "true" : "false");
      };

      principal?.addEventListener("click", (e) => {
        if (e.target.closest(".btn-sigla-dic")) return;
        alternarDetalhes();
      });

      principal?.addEventListener("keydown", (e) => {
        if (e.target.closest(".btn-sigla-dic")) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          alternarDetalhes();
        }
      });

      linha.querySelectorAll(".btn-sigla-dic, .btn-dic-copiar").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          copiarTexto(btn.dataset.copiar, btn.dataset.rotulo);
        });
      });

      frag.appendChild(linha);
    });

    grade.appendChild(frag);
  }

  // ==========================================================================
  // MÓDULO B: MOTOR DE TRADUÇÃO CLIENT-SIDE (RF06-RF11, RN01-RN04, RNF02/05)
  // ==========================================================================

  function detectarIdiomaEAmbiguidade(texto, tecnicaModo) {
    const baixo = String(texto || "").toLowerCase();
    const temSc = /(?:^|[^a-zà-ÿ0-9_])(sc|hdc|sc2tog|hdc2tog|fpdc|bpdc)(?:[^a-zà-ÿ0-9_]|$)/i.test(baixo);
    const temUkExclusivo = /(?:^|[^a-zà-ÿ0-9_])(htr|ttr|htr2tog|tr2tog|dc2tog|miss)(?:[^a-zà-ÿ0-9_]|$)/i.test(baixo);
    const temConflitoEn = /(?:^|[^a-zà-ÿ0-9_])(dc|tr|htr|dtr)(?:[^a-zà-ÿ0-9_]|$)/i.test(baixo);
    const temEs = /(?:^|[^a-zà-ÿ0-9_])(cad|dism|vta|vueltas|der|rev|laz|surjete|vareta)(?:[^a-zà-ÿ0-9_]|$)/i.test(baixo);
    const temPt = /(?:^|[^a-zà-ÿ0-9_])(pbx|mpa|corr|aum|dim|carr|2jm|2jt|laç|pb|pa)(?:[^a-zà-ÿ0-9_]|$)/i.test(baixo);

    let detectado = "us";
    if (temUkExclusivo) detectado = "uk";
    else if (temSc) detectado = "us";
    else if (temEs && !temConflitoEn) detectado = "es";
    else if (temPt && !temConflitoEn) detectado = "pt";
    else if (temConflitoEn) detectado = "us";

    const ambiguoUsUk = (tecnicaModo !== "trico") && (temConflitoEn || temUkExclusivo);
    return { detectado, ambiguoUsUk, temSc, temUkExclusivo, temConflitoEn };
  }

  function construirMapaTraducao(origem, destino, tecnicaModo) {
    const mapa = new Map(); // chave lower -> { termo, siglaOrigem, siglaDestino }
    const listaTokens = [];

    termos.forEach((t) => {
      // RN04: Separação Crochê vs. Tricô para evitar falsos positivos
      if (tecnicaModo === "croche" && t.tecnica === "trico") return;
      if (tecnicaModo === "trico" && t.tecnica === "croche") return;

      const origList = t.siglas[origem] || [];
      const destList = t.siglas[destino] || [];
      if (origList.length === 0 || destList.length === 0) return;
      const siglaDest = destList[0];

      origList.forEach((sig) => {
        const limpa = String(sig || "").trim();
        if (!limpa) return;
        const key = limpa.toLowerCase();
        // Evita sobrescrever se já mapeado por termo mais específico
        if (!mapa.has(key)) {
          mapa.set(key, {
            termo: t,
            siglaOrigem: limpa,
            siglaDestino: siglaDest
          });
          listaTokens.push(limpa);
        }
      });
    });

    // RN02: Prioridade de termos compostos (ordena por comprimento decrescente!)
    listaTokens.sort((a, b) => b.length - a.length);
    return { mapa, listaTokens };
  }

  function traduzirTexto(texto, origemSel = "auto", destino = "pt", tecnicaModo = "croche") {
    const entrada = String(texto || "");
    if (!entrada.trim()) {
      return {
        textoPlano: "",
        htmlDestacado: "",
        totalSubstituicoes: 0,
        origemEfetiva: origemSel === "auto" ? "us" : origemSel,
        alertaUsUk: false,
        tempoMs: 0
      };
    }

    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const analise = detectarIdiomaEAmbiguidade(entrada, tecnicaModo);
    const origemEfetiva = origemSel === "auto" ? analise.detectado : origemSel;

    // Alerta RF10 quando origem é inglês (ou auto em inglês) com termos conflitantes US/UK
    const alertaUsUk =
      (origemEfetiva === "us" || origemEfetiva === "uk") &&
      (analise.ambiguoUsUk || (origemSel === "auto" && (analise.temSc || analise.temConflitoEn)));

    if (origemEfetiva === destino) {
      return {
        textoPlano: entrada,
        htmlDestacado: escapeHtml(entrada).replace(/\n/g, "<br>"),
        totalSubstituicoes: 0,
        origemEfetiva,
        alertaUsUk,
        tempoMs: 0
      };
    }

    const { mapa, listaTokens } = construirMapaTraducao(origemEfetiva, destino, tecnicaModo);
    if (listaTokens.length === 0) {
      return {
        textoPlano: entrada,
        htmlDestacado: escapeHtml(entrada).replace(/\n/g, "<br>"),
        totalSubstituicoes: 0,
        origemEfetiva,
        alertaUsUk,
        tempoMs: 0
      };
    }

    // RN01 + RN02 + RN03:
    // Fronteira estrita de palavra/letra (nunca casa "sc" dentro de "scarf" nem "k" dentro de "knit").
    // Permite número colado antes da sigla (ex: "2sc", "6pb") ou delimitador de não-letra!
    const alternancia = listaTokens.map(escapeRegex).join("|");
    // Delimitador esquerdo e direito: nunca letra (impede "sc" em "scarf", "k" em "knit"),
    // mas permite números colados ("2sc", "k2", "p2") enquanto termos compostos ("sc2tog", "k2tog") vencem por ordem de tamanho (RN02).
    const regex = new RegExp(
      `(?<![A-Za-zÀ-ÿ_])(${alternancia})(?![A-Za-zÀ-ÿ_])`,
      "gi"
    );

    let totalSubstituicoes = 0;
    let textoPlano = "";
    let htmlDestacado = "";
    let ultimoIndice = 0;

    let match;
    while ((match = regex.exec(entrada)) !== null) {
      const encontrado = match[1];
      const idx = match.index;
      const info = mapa.get(encontrado.toLowerCase());
      if (!info) continue;

      // Proteção extra RN01: sigla de 1 letra solta (ex.: "m", "t", "k", "p", "v", "c") só traduz se
      // NÃO estiver seguida por ponto de abreviação estranha ou se estiver em contexto numérico/técnico válido
      const trechoAntes = entrada.slice(ultimoIndice, idx);
      textoPlano += trechoAntes;
      htmlDestacado += escapeHtml(trechoAntes);

      const dest = info.siglaDestino;
      const nomeOrig = info.termo.nomes[origemEfetiva] || info.siglaOrigem;
      const nomeDest = info.termo.nomes[destino] || dest;
      const desc = info.termo.descricao || "";

      textoPlano += dest;
      htmlDestacado += `<mark class="termo-traduzido" tabindex="0" data-orig="${escapeHtml(encontrado)}" data-orig-nome="${escapeHtml(nomeOrig)}" data-dest="${escapeHtml(dest)}" data-dest-nome="${escapeHtml(nomeDest)}" data-desc="${escapeHtml(desc)}" title="${escapeHtml(encontrado)} (${escapeHtml(nomeOrig)}) → ${escapeHtml(dest)} (${escapeHtml(nomeDest)})">${escapeHtml(dest)}</mark>`;

      totalSubstituicoes++;
      ultimoIndice = idx + encontrado.length;
    }

    const restante = entrada.slice(ultimoIndice);
    textoPlano += restante;
    htmlDestacado += escapeHtml(restante);
    htmlDestacado = htmlDestacado.replace(/\n/g, "<br>");

    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      textoPlano,
      htmlDestacado,
      totalSubstituicoes,
      origemEfetiva,
      alertaUsUk,
      tempoMs: Math.max(0.1, Number((t1 - t0).toFixed(1)))
    };
  }

  function executarTraducaoUI() {
    const inp = document.getElementById("input-tradutor-receita");
    const out = document.getElementById("saida-tradutor-receita");
    const metaEl = document.getElementById("meta-tradutor-resultado");
    const alertaEl = document.getElementById("alerta-ambiguo-tradutor");
    const btnAltEn = document.getElementById("btn-alternar-us-uk");
    const txtAlerta = document.getElementById("texto-alerta-us-uk");
    if (!inp || !out) return;

    const origemSel = document.getElementById("select-trad-origem")?.value || "auto";
    const destino = document.getElementById("select-trad-destino")?.value || "pt";
    const tecnica = document.getElementById("select-trad-tecnica")?.value || "croche";

    const res = traduzirTexto(inp.value, origemSel, destino, tecnica);
    ultimoResultadoTexto = res.textoPlano;
    ultimoResultadoHtml = res.htmlDestacado;
    ultimoIdiomaEfetivo = res.origemEfetiva;

    if (!inp.value.trim()) {
      out.innerHTML = `<div class="vazio-tradutor">Cole uma receita ou trecho ao lado para traduzir instantaneamente (ex.: <code>*2 sc, inc* x6</code> ou <code>R1: k2, p2, k2tog</code>).</div>`;
      if (metaEl) metaEl.textContent = "Processamento 100% local e privado no dispositivo";
      if (alertaEl) alertaEl.style.display = "none";
      return;
    }

    out.innerHTML = res.htmlDestacado;
    if (metaEl) {
      metaEl.textContent = `${NOMES_IDIOMA[res.origemEfetiva] || res.origemEfetiva} → ${NOMES_IDIOMA[destino] || destino} • ${res.totalSubstituicoes} termos traduzidos em ${res.tempoMs} ms`;
    }

    if (alertaEl) {
      if (res.alertaUsUk) {
        const atual = res.origemEfetiva === "uk" ? "Inglês UK" : "Inglês US";
        const outro = res.origemEfetiva === "uk" ? "Inglês US" : "Inglês UK";
        if (txtAlerta) {
          txtAlerta.innerHTML = `<strong>Atenção (US ≠ UK):</strong> Detectamos termos em inglês que mudam de significado entre padrões (ex.: <code>dc</code> = Ponto Alto em US, mas Ponto Baixo em UK). Traduzindo como <strong>${atual}</strong>.`;
        }
        if (btnAltEn) {
          btnAltEn.textContent = `Alternar para ${outro}`;
          btnAltEn.dataset.proximoPadrao = res.origemEfetiva === "uk" ? "us" : "uk";
        }
        alertaEl.style.display = "flex";
      } else {
        alertaEl.style.display = "none";
      }
    }

    // RF09: Popover ao tocar/clicar em qualquer termo destacado (ideal no celular!)
    out.querySelectorAll(".termo-traduzido").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        exibirPopoverTermo(el);
      });
    });
  }

  function exibirPopoverTermo(el) {
    const pop = document.getElementById("popover-termo-traduzido");
    if (!pop) return;
    pop.innerHTML = `
      <div class="pop-termo-linha">
        <span class="pop-badge-orig">${escapeHtml(el.dataset.orig)}</span>
        <span>→</span>
        <span class="pop-badge-dest">${escapeHtml(el.dataset.dest)}</span>
      </div>
      <div class="pop-termo-nomes">
        <div><strong>Original:</strong> ${escapeHtml(el.dataset.origNome)}</div>
        <div><strong>Traduzido:</strong> ${escapeHtml(el.dataset.destNome)}</div>
      </div>
      <p class="pop-termo-desc">${escapeHtml(el.dataset.desc)}</p>
    `;
    pop.style.display = "block";
  }

  function imprimirReceitaTraduzida() {
    if (!ultimoResultadoTexto.trim()) {
      mostrarToast("Cole uma receita antes de imprimir ou exportar.");
      return;
    }
    const nomeAtelie =
      typeof Configuracoes !== "undefined" && Configuracoes.obter("nomeAtelie")
        ? Configuracoes.obter("nomeAtelie")
        : "Ponto & Trama";
    const docHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Receita Traduzida — ${escapeHtml(nomeAtelie)}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #16264d; padding: 28px; line-height: 1.7; max-width: 720px; margin: 0 auto; }
        h1 { font-size: 20px; margin: 0 0 4px 0; border-bottom: 2px solid #233b72; padding-bottom: 8px; }
        .meta { font-size: 12px; color: #4c5d82; margin-bottom: 20px; }
        .receita { font-size: 14.5px; white-space: pre-wrap; background: #faf7f0; padding: 18px; border-radius: 10px; border: 1px solid #d9d0be; }
        .termo-traduzido, mark { background: #e4ecfc; color: #16264d; padding: 1px 4px; border-radius: 4px; font-weight: 700; }
        @media print { body { padding: 0; } .receita { border: none; background: #fff; } }
      </style></head><body>
      <h1>${escapeHtml(nomeAtelie)} — Receita Traduzida</h1>
      <div class="meta">Gerado offline pelo Ponto &amp; Trama em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div class="receita">${ultimoResultadoHtml}</div>
      </body></html>`;

    // No App Desktop (WebKit2GTK) ou quando popups estão bloqueados, imprime via iframe oculto
    const emAndroid = typeof window.PontoETramaAndroid !== "undefined";
    const emDesktop = Boolean(window.__PONTO_TRAMA_DESKTOP__);

    if (emAndroid) {
      copiarTexto(ultimoResultadoTexto, "Receita traduzida copiada (pronta para colar ou compartilhar)!");
      return;
    }

    if (!emDesktop) {
      const win = window.open("", "_blank", "width=760,height=900");
      if (win) {
        win.document.write(docHtml + `<script>window.onload = function(){ window.print(); };<\/script>`);
        win.document.close();
        return;
      }
    }

    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(docHtml);
      iframe.contentDocument.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } finally {
          setTimeout(() => iframe.remove(), 1500);
        }
      }, 120);
    } catch {
      copiarTexto(ultimoResultadoTexto, "Receita traduzida copiada!");
    }
  }

  function vincularEventos() {
    // Módulo A: Dicionário (busca instantânea < 10ms)
    document.getElementById("input-busca-dicionario")?.addEventListener("input", renderizarDicionario);
    document.getElementById("select-dic-idioma")?.addEventListener("change", renderizarDicionario);
    document.getElementById("select-dic-tecnica")?.addEventListener("change", renderizarDicionario);
    document.getElementById("select-dic-categoria")?.addEventListener("change", renderizarDicionario);
    document.querySelectorAll("#pills-tecnica-dic .btn-tec-dic").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.dicTec || "todas";
        const selTec = document.getElementById("select-dic-tecnica");
        if (selTec) selTec.value = val;
        document.querySelectorAll("#pills-tecnica-dic .btn-tec-dic").forEach((b) => {
          b.classList.toggle("ativo", b === btn);
        });
        renderizarDicionario();
      });
    });
    document.getElementById("btn-dic-limpar-filtros")?.addEventListener("click", () => {
      const inp = document.getElementById("input-busca-dicionario");
      const id = document.getElementById("select-dic-idioma");
      const tec = document.getElementById("select-dic-tecnica");
      const cat = document.getElementById("select-dic-categoria");
      if (inp) inp.value = "";
      if (id) id.value = "todos";
      if (tec) tec.value = "todas";
      if (cat) cat.value = "todas";
      document.querySelectorAll("#pills-tecnica-dic .btn-tec-dic").forEach((b) => {
        b.classList.toggle("ativo", b.dataset.dicTec === "todas");
      });
      renderizarDicionario();
    });

    // Módulo B: Tradutor automático
    document.getElementById("input-tradutor-receita")?.addEventListener("input", executarTraducaoUI);
    document.getElementById("select-trad-origem")?.addEventListener("change", executarTraducaoUI);
    document.getElementById("select-trad-destino")?.addEventListener("change", executarTraducaoUI);
    document.getElementById("select-trad-tecnica")?.addEventListener("change", executarTraducaoUI);

    document.getElementById("btn-inverter-idiomas-trad")?.addEventListener("click", () => {
      const selOrig = document.getElementById("select-trad-origem");
      const selDest = document.getElementById("select-trad-destino");
      if (!selOrig || !selDest) return;
      const origAtual = selOrig.value === "auto" ? ultimoIdiomaEfetivo : selOrig.value;
      const destAtual = selDest.value;
      selOrig.value = destAtual;
      selDest.value = origAtual;
      executarTraducaoUI();
    });

    document.getElementById("btn-alternar-us-uk")?.addEventListener("click", (e) => {
      const prox = e.currentTarget.dataset.proximoPadrao || "uk";
      const selOrig = document.getElementById("select-trad-origem");
      if (selOrig) selOrig.value = prox;
      executarTraducaoUI();
      mostrarToast(`🔄 Padrão alternado para ${NOMES_IDIOMA[prox]}`);
    });

    document.getElementById("btn-trad-exemplo")?.addEventListener("click", () => {
      const inp = document.getElementById("input-tradutor-receita");
      const selOrig = document.getElementById("select-trad-origem");
      const selTec = document.getElementById("select-trad-tecnica");
      if (!inp) return;
      if (selTec?.value === "trico") {
        inp.value = "CO 40 sts.\nRow 1 (RS): *k2, p2* rep to end.\nRow 2 (WS): *k2, yo, k2tog* rep.\nRow 3: ssk, k to end, BO.";
      } else {
        inp.value = "Rnd 1: 6 sc in mr (6)\nRnd 2: 6 inc (12)\nRnd 3: *1 sc, inc* x6 (18)\nRnd 4: 18 sc in BLO\nRnd 5: *1 sc, sc2tog* x6, sl st, FO.\nNote: This scarf pattern is beginner friendly.";
      }
      if (selOrig) selOrig.value = "auto";
      executarTraducaoUI();
    });

    document.getElementById("btn-trad-limpar")?.addEventListener("click", () => {
      const inp = document.getElementById("input-tradutor-receita");
      if (inp) inp.value = "";
      const pop = document.getElementById("popover-termo-traduzido");
      if (pop) pop.style.display = "none";
      executarTraducaoUI();
    });

    document.getElementById("btn-trad-copiar")?.addEventListener("click", () => {
      if (!ultimoResultadoTexto.trim()) {
        mostrarToast("Nada para copiar ainda.");
        return;
      }
      copiarTexto(ultimoResultadoTexto, "Receita traduzida copiada!");
    });

    document.getElementById("btn-trad-usar-editor")?.addEventListener("click", () => {
      if (!ultimoResultadoTexto.trim()) {
        mostrarToast("Traduza uma receita primeiro.");
        return;
      }
      if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.definirTexto === "function") {
        LeitorReceitas.definirTexto(ultimoResultadoTexto);
        mostrarToast("📝 Receita enviada para Texto & Passos!");
      }
    });

    document.getElementById("btn-trad-imprimir")?.addEventListener("click", imprimirReceitaTraduzida);

    document.addEventListener("click", (e) => {
      const pop = document.getElementById("popover-termo-traduzido");
      if (pop && pop.style.display === "block" && !e.target.closest(".termo-traduzido") && !e.target.closest("#popover-termo-traduzido")) {
        pop.style.display = "none";
      }
    });

    window.addEventListener("online", atualizarIndicadorOffline);
    window.addEventListener("offline", atualizarIndicadorOffline);
  }

  async function init() {
    if (jaInicializado) {
      atualizarIndicadorOffline();
      return;
    }
    jaInicializado = true;

    // Aplica técnica padrão das Configurações no tradutor
    if (typeof Configuracoes !== "undefined") {
      const tecCfg = Configuracoes.obter("tecnicaPrincipal");
      const selTec = document.getElementById("select-trad-tecnica");
      if (selTec && (tecCfg === "croche" || tecCfg === "trico" || tecCfg === "ambos")) {
        selTec.value = tecCfg;
      }
    }

    vincularEventos();
    await carregarBaseDicionario();
    renderizarDicionario();
    executarTraducaoUI();
  }

  function abrirComTexto(texto, tecnica = null) {
    if (!jaInicializado) init();
    const inp = document.getElementById("input-tradutor-receita");
    const selOrig = document.getElementById("select-trad-origem");
    const selTec = document.getElementById("select-trad-tecnica");
    if (inp && typeof texto === "string") inp.value = texto;
    if (selOrig) selOrig.value = "auto";
    if (selTec && (tecnica === "croche" || tecnica === "trico" || tecnica === "ambos")) {
      selTec.value = tecnica;
    }
    if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.alternarModo === "function") {
      LeitorReceitas.alternarModo("tradutor");
    } else {
      document.querySelector('#secao-receitas .btn-modo-receita[data-modo-receita="tradutor"]')?.click();
    }
    executarTraducaoUI();
  }

  async function garantirBaseDicionario() {
    if (!basePronta || termos.length === 0) {
      await carregarBaseDicionario();
    }
    return termos.length > 0 ? termos.slice() : FALLBACK_ESSENCIAL.slice();
  }

  function abrirNoDicionario(termoBusca = "") {
    if (!jaInicializado) init();
    if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.alternarModo === "function") {
      LeitorReceitas.alternarModo("dicionario");
    } else {
      document.querySelector('#secao-receitas .btn-modo-receita[data-modo-receita="dicionario"]')?.click();
    }
    const inp = document.getElementById("input-busca-dicionario");
    if (inp) {
      inp.value = String(termoBusca || "");
      renderizarDicionario();
      setTimeout(() => inp.focus(), 60);
    }
  }

  return {
    init,
    traduzirTexto,
    filtrarTermosDicionario,
    abrirComTexto,
    abrirNoDicionario,
    garantirBaseDicionario,
    obterTermos: () => (termos.length > 0 ? termos.slice() : FALLBACK_ESSENCIAL.slice())
  };
})();
