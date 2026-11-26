// ==========================================================================
// PONTO & TRAMA — GERADOR DE LISTRAS & PLANEJADOR DE MANTA
// (Stripe Generator & Temperature Blanket Planner)
// Seleciona 2 a 6 fios do estoque (ou paleta livre), define carreiras,
// estilo (Aleatórias Harmônicas, Degradê, Escocês ou Manta da Temperatura),
// gera visualização em Canvas, sequência exata de carreiras, consumo em
// gramas/novelos, exportação PNG (Web/Ubuntu/Android) e envio para Receitas.
// ==========================================================================

const PlanejadorManta = (() => {
  let jaInicializado = false;
  let fiosDisponiveis = [];
  let sequenciaCarreiras = []; // array de índices em coresSelecionadas
  let receitaTextoAtual = "";

  const CORES_PADRAO_ATELIE = [
    { id: "preset-1", nome: "Crú Natural", cor_hex: "#EFE7D6", peso_novelo_g: 100, quantidade: null },
    { id: "preset-2", nome: "Terracota", cor_hex: "#C86A4B", peso_novelo_g: 100, quantidade: null },
    { id: "preset-3", nome: "Verde Sálvia", cor_hex: "#7D9B84", peso_novelo_g: 100, quantidade: null },
    { id: "preset-4", nome: "Mostarda Mel", cor_hex: "#D6A246", peso_novelo_g: 100, quantidade: null },
    { id: "preset-5", nome: "Azul Índigo", cor_hex: "#2D4B7A", peso_novelo_g: 100, quantidade: null },
    { id: "preset-6", nome: "Ameixa Suave", cor_hex: "#6F3F5E", peso_novelo_g: 100, quantidade: null }
  ];

  const MODELOS_PECA = {
    bebe: { nome: "Manta de Bebê (80×100 cm)", carreiras: 90, gramasCarreira: 3.8 },
    sofa: { nome: "Manta de Sofá (130×170 cm)", carreiras: 140, gramasCarreira: 6.8 },
    cachecol: { nome: "Cachecol (25×180 cm)", carreiras: 150, gramasCarreira: 1.7 },
    anual: { nome: "Manta Anual da Temperatura (365 dias)", carreiras: 365, gramasCarreira: 4.5 },
    personalizado: { nome: "Personalizado", carreiras: 80, gramasCarreira: 4.5 }
  };

  const CLIMAS_TEMP = {
    sudeste: { media: 22, amp: 8.5, ruido: 3.2 },
    nordeste: { media: 27.5, amp: 3.5, ruido: 1.8 },
    sul: { media: 17.5, amp: 10.5, ruido: 3.8 }
  };

  const estado = {
    coresSelecionadas: [],
    estilo: "harmonicas", // "harmonicas" | "degrade" | "escoces" | "temperatura"
    modelo: "sofa",
    totalCarreiras: 120,
    gramasPorCarreira: 6.5,
    semente: 42,
    climaTemp: "sudeste",
    faixasTemp: [14, 18, 22, 26, 30] // divisores em °C
  };

  function escapeHtml(txt) {
    return String(txt || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function prng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  async function carregarFiosEstoque() {
    let lista = [];
    if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.obterTodos === "function") {
      try {
        const fios = await BancoDadosPT.obterTodos("fios");
        lista = (fios || []).map((f) => {
          const hex =
            typeof InventarioFios !== "undefined" && typeof InventarioFios.obterCorRealFio === "function"
              ? InventarioFios.obterCorRealFio(f)
              : f.cor_hex || "#BFA893";
          return {
            id: `fio-${f.id}`,
            nome: `${f.nome || "Fio"}${f.cor_nome ? ` — ${f.cor_nome}` : ""}`,
            cor_hex: hex,
            peso_novelo_g: Number(f.peso_novelo_g) || 100,
            quantidade: Number(f.quantidade) || 0
          };
        });
      } catch {
        lista = [];
      }
    }

    fiosDisponiveis = lista.length >= 2 ? [...lista, ...CORES_PADRAO_ATELIE] : [...lista, ...CORES_PADRAO_ATELIE];

    if (estado.coresSelecionadas.length < 2) {
      estado.coresSelecionadas = fiosDisponiveis.slice(0, Math.min(4, fiosDisponiveis.length));
    }
  }

  function gerarSequencia() {
    const cores = estado.coresSelecionadas;
    const nCores = cores.length;
    const total = Math.max(12, Math.min(365, parseInt(estado.totalCarreiras, 10) || 120));
    if (nCores < 2) return [];

    const seq = [];
    const rand = prng(estado.semente);

    if (estado.estilo === "harmonicas") {
      // Listras aleatórias harmônicas sem repetição consecutiva, com larguras equilibradas (1, 2, 3, 4, 6)
      const larguras = [1, 2, 2, 3, 4, 4, 6];
      let ultima = -1;
      while (seq.length < total) {
        let idx = Math.floor(rand() * nCores);
        if (idx === ultima) idx = (idx + 1 + Math.floor(rand() * (nCores - 1))) % nCores;
        const larg = larguras[Math.floor(rand() * larguras.length)];
        for (let k = 0; k < larg && seq.length < total; k++) {
          seq.push(idx);
        }
        ultima = idx;
      }
      return seq;
    }

    if (estado.estilo === "degrade") {
      // Degradê gradual (ombré com transição entrelaçada entre cores vizinhas)
      const segmentos = nCores - 1;
      for (let i = 0; i < total; i++) {
        const pos = (i / Math.max(1, total - 1)) * segmentos;
        const base = Math.min(segmentos - 1, Math.floor(pos));
        const frac = pos - base;
        // Dithering determinístico suave para criar transição orgânica em faixas finas
        const limiar = ((i * 37) % 100) / 100;
        const escolha = frac > 0.15 && frac < 0.85 ? (limiar < frac ? base + 1 : base) : (frac >= 0.85 ? base + 1 : base);
        seq.push(Math.min(nCores - 1, escolha));
      }
      return seq;
    }

    if (estado.estilo === "escoces") {
      // Padrão escocês / bandas simétricas clássicas
      const bloco = [];
      for (let c = 0; c < nCores; c++) {
        const principal = c === 0 ? 6 : 4;
        const filete = (c + 1) % nCores;
        for (let k = 0; k < principal; k++) bloco.push(c);
        bloco.push(filete);
        bloco.push(c);
        bloco.push(filete);
      }
      for (let i = 0; i < total; i++) {
        seq.push(bloco[i % bloco.length]);
      }
      return seq;
    }

    // Manta da Temperatura (curva sazonal anual simulada mapeada às faixas °C)
    const clima = CLIMAS_TEMP[estado.climaTemp] || CLIMAS_TEMP.sudeste;
    const limiares = obterLimiaresTemp(nCores);
    for (let i = 0; i < total; i++) {
      // Hemisfério Sul: início do ano quente (verão), meio do ano frio (inverno), fim quente
      const fase = (i / Math.max(1, total)) * Math.PI * 2;
      const onda = Math.cos(fase) * clima.amp;
      const variacao = (rand() - 0.5) * 2 * clima.ruido;
      const tempC = clima.media + onda + variacao;

      let idx = nCores - 1;
      for (let b = 0; b < limiares.length; b++) {
        if (tempC < limiares[b]) {
          idx = b;
          break;
        }
      }
      seq.push(idx);
    }
    return seq;
  }

  function obterLimiaresTemp(nCores) {
    // Gera nCores - 1 divisores ordenados em °C
    const minT = 13;
    const maxT = 31;
    const qtdDiv = Math.max(1, nCores - 1);
    if (estado.faixasTemp.length !== qtdDiv) {
      const passo = (maxT - minT) / nCores;
      estado.faixasTemp = [];
      for (let i = 1; i <= qtdDiv; i++) {
        estado.faixasTemp.push(Math.round(minT + passo * i));
      }
    }
    return [...estado.faixasTemp].sort((a, b) => a - b);
  }

  function agruparSequencia(seq) {
    const grupos = [];
    let atualIdx = -1;
    let ini = 1;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i] !== atualIdx) {
        if (atualIdx !== -1) {
          grupos.push({ corIdx: atualIdx, inicio: ini, fim: i, qtd: i - ini + 1 });
        }
        atualIdx = seq[i];
        ini = i + 1;
      }
    }
    if (atualIdx !== -1) {
      grupos.push({ corIdx: atualIdx, inicio: ini, fim: seq.length, qtd: seq.length - ini + 1 });
    }
    return grupos;
  }

  function desenharCanvas(seq) {
    const canvas = document.getElementById("canvas-planejador-manta");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 760;
    const H = 360;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#121a30";
    ctx.fillRect(0, 0, W, H);

    const n = seq.length;
    if (n === 0) return;

    const margemEsq = 44;
    const margemDir = 16;
    const margemTop = 14;
    const margemBot = 14;
    const areaW = W - margemEsq - margemDir;
    const areaH = H - margemTop - margemBot;
    const altLinha = areaH / n;

    for (let i = 0; i < n; i++) {
      const corObj = estado.coresSelecionadas[seq[i]];
      const hex = corObj ? corObj.cor_hex : "#cccccc";
      const y = margemTop + i * altLinha;
      ctx.fillStyle = hex;
      ctx.fillRect(margemEsq, y, areaW, Math.ceil(altLinha + 0.4));

      // Textura sutil de pontos de crochê/tricô
      if (altLinha >= 2.2) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(margemEsq, y, areaW, Math.max(0.8, altLinha * 0.28));
      }
    }

    // Borda elegante ao redor da manta
    ctx.strokeStyle = "rgba(252,241,208,0.45)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margemEsq, margemTop, areaW, areaH);

    // Régua lateral de carreiras
    ctx.fillStyle = "rgba(252,241,208,0.85)";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const passos = 5;
    for (let p = 0; p <= passos; p++) {
      const carr = Math.max(1, Math.round((p / passos) * n));
      const y = margemTop + (p / passos) * areaH;
      ctx.fillText(`C${carr}`, margemEsq - 7, y);
    }
  }

  function renderizarSeletorCores() {
    const cont = document.getElementById("manta-lista-cores");
    if (!cont) return;

    const idsSel = new Set(estado.coresSelecionadas.map((c) => c.id));
    cont.innerHTML = fiosDisponiveis
      .map((fio) => {
        const sel = idsSel.has(fio.id);
        return `
          <button type="button" class="manta-swatch-btn ${sel ? "selecionado" : ""}" data-manta-fio-id="${escapeHtml(fio.id)}" title="${escapeHtml(fio.nome)}">
            <span class="manta-bolinha-cor" style="background:${escapeHtml(fio.cor_hex)}"></span>
            <span>${escapeHtml(fio.nome.slice(0, 22))}</span>
          </button>`;
      })
      .join("");

    cont.querySelectorAll("[data-manta-fio-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.mantaFioId;
        const jaTem = estado.coresSelecionadas.findIndex((c) => c.id === id);
        if (jaTem >= 0) {
          if (estado.coresSelecionadas.length <= 2) return; // mínimo 2 cores
          estado.coresSelecionadas.splice(jaTem, 1);
        } else {
          if (estado.coresSelecionadas.length >= 6) return; // máximo 6 cores
          const found = fiosDisponiveis.find((f) => f.id === id);
          if (found) estado.coresSelecionadas.push(found);
        }
        atualizarTudo();
      });
    });

    const lblQtd = document.getElementById("manta-qtd-cores-sel");
    if (lblQtd) lblQtd.textContent = `${estado.coresSelecionadas.length} de 6 cores selecionadas (mín. 2)`;
  }

  function renderizarFaixasTemperatura() {
    const box = document.getElementById("manta-box-temperatura");
    if (!box) return;
    box.style.display = estado.estilo === "temperatura" ? "flex" : "none";
    if (estado.estilo !== "temperatura") return;

    const lista = document.getElementById("manta-faixas-temp-lista");
    if (!lista) return;
    const cores = estado.coresSelecionadas;
    const limiares = obterLimiaresTemp(cores.length);

    lista.innerHTML = cores
      .map((cor, i) => {
        let textoFaixa = "";
        if (i === 0) textoFaixa = `Abaixo de ${limiares[0]}°C`;
        else if (i === cores.length - 1) textoFaixa = `Acima de ${limiares[i - 1]}°C`;
        else textoFaixa = `${limiares[i - 1]}°C a ${limiares[i]}°C`;

        const inputDiv =
          i < limiares.length
            ? `<input type="text" inputmode="numeric" data-temp-div="${i}" value="${limiares[i]}" aria-label="Limite superior em graus Celsius" title="Limite em °C" /> °C`
            : "";

        return `
          <div class="manta-temp-linha">
            <span class="manta-bolinha-cor" style="background:${escapeHtml(cor.cor_hex)}"></span>
            <strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(cor.nome)}</strong>
            <span>${escapeHtml(textoFaixa)}</span>
            ${inputDiv}
          </div>`;
      })
      .join("");

    lista.querySelectorAll("[data-temp-div]").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const idx = parseInt(inp.dataset.tempDiv, 10);
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          estado.faixasTemp[idx] = val;
          atualizarTudo();
        }
      });
    });
  }

  function atualizarTudo() {
    renderizarSeletorCores();
    renderizarFaixasTemperatura();

    document.querySelectorAll("#modal-planejador-manta [data-manta-estilo]").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.mantaEstilo === estado.estilo);
    });
    const btnSortear = document.getElementById("btn-manta-sortear");
    if (btnSortear) {
      btnSortear.style.display = estado.estilo === "harmonicas" || estado.estilo === "temperatura" ? "inline-flex" : "none";
      btnSortear.textContent = estado.estilo === "temperatura" ? "🌡️ Simular Outro Ano" : "🎲 Sortear Listras";
    }

    sequenciaCarreiras = gerarSequencia();
    desenharCanvas(sequenciaCarreiras);

    const grupos = agruparSequencia(sequenciaCarreiras);
    const totalCarr = sequenciaCarreiras.length;
    const gPorCarr = Math.max(0.5, Number(estado.gramasPorCarreira) || 4.5);

    // Consumo por cor
    const contagem = new Array(estado.coresSelecionadas.length).fill(0);
    sequenciaCarreiras.forEach((idx) => {
      if (contagem[idx] !== undefined) contagem[idx]++;
    });

    const elConsumo = document.getElementById("manta-tabela-consumo");
    const linhasReceita = [
      `🧣 Planejamento de Manta — ${totalCarr} carreiras (${estado.estilo === "temperatura" ? "Manta da Temperatura" : estado.estilo === "degrade" ? "Degradê" : estado.estilo === "escoces" ? "Padrão Escocês" : "Listras Harmônicas"})`
    ];

    if (elConsumo) {
      elConsumo.innerHTML = estado.coresSelecionadas
        .map((cor, i) => {
          const qtdCarr = contagem[i] || 0;
          const pct = totalCarr > 0 ? Math.round((qtdCarr / totalCarr) * 100) : 0;
          const gramas = Math.round(qtdCarr * gPorCarr);
          const pesoNov = cor.peso_novelo_g || 100;
          const novelosNec = Math.max(1, Math.ceil(gramas / pesoNov));
          let statusEstoque = "";
          if (cor.quantidade !== null && cor.quantidade !== undefined) {
            if (cor.quantidade >= novelosNec) {
              statusEstoque = `<span class="manta-consumo-ok">✓ ${cor.quantidade} nov. em estoque</span>`;
            } else {
              const falta = Math.ceil(novelosNec - cor.quantidade);
              statusEstoque = `<span class="manta-consumo-alerta">⚠️ Faltam ${falta} nov.</span>`;
            }
          }
          linhasReceita.push(`• ${cor.nome}: ${qtdCarr} carr. (~${gramas} g / ${novelosNec} nov.)`);
          return `
            <div class="manta-consumo-row">
              <span class="manta-bolinha-cor" style="background:${escapeHtml(cor.cor_hex)}"></span>
              <strong>${escapeHtml(cor.nome)}</strong>
              <span>${qtdCarr} carr. (${pct}%) • ~${gramas} g (${novelosNec} nov.)</span>
              ${statusEstoque || "<span></span>"}
            </div>`;
        })
        .join("");
    }

    // Sequência agrupada carreira por carreira
    linhasReceita.push("Ordem das carreiras:");
    const elSeq = document.getElementById("manta-lista-sequencia");
    const htmlSeq = grupos
      .map((g) => {
        const cor = estado.coresSelecionadas[g.corIdx];
        const faixa = g.inicio === g.fim ? `Carr ${g.inicio}` : `Carr ${g.inicio}-${g.fim}`;
        const texto = `${faixa}: ${cor ? cor.nome : "Cor"} (${g.qtd} ${g.qtd === 1 ? "carreira" : "carreiras"})`;
        linhasReceita.push(texto);
        return `
          <div class="pro-linha-receita">
            <span style="display:inline-flex;align-items:center;gap:7px">
              <span class="manta-bolinha-cor" style="background:${escapeHtml(cor ? cor.cor_hex : "#ccc")}"></span>
              <strong>${faixa}:</strong> ${escapeHtml(cor ? cor.nome : "")}
            </span>
            <span class="pro-badge-pts">${g.qtd} carr.</span>
          </div>`;
      })
      .join("");

    if (elSeq) elSeq.innerHTML = htmlSeq;
    receitaTextoAtual = linhasReceita.join("\n");
  }

  function exportarPng() {
    const canvas = document.getElementById("canvas-planejador-manta");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const nomeArq = `ponto-e-trama-manta-${estado.estilo}.png`;

    if (window.PontoETramaAndroid && typeof window.PontoETramaAndroid.salvarArquivoBase64 === "function") {
      const base64 = dataUrl.split(",")[1] || "";
      window.PontoETramaAndroid.salvarArquivoBase64(nomeArq, "image/png", base64);
      return;
    }

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = nomeArq;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function enviarParaReceitas() {
    if (!receitaTextoAtual) return;
    if (typeof PontoTramaApp !== "undefined") PontoTramaApp.garantirModulo("receitas");
    if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.definirTexto === "function") {
      LeitorReceitas.definirTexto(receitaTextoAtual);
    }
    fechar();
    const btnRec = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="receitas"]');
    if (btnRec && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
      BarraLateral.alternarFerramenta(btnRec);
    }
  }

  function copiarSequencia() {
    if (!receitaTextoAtual) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(receitaTextoAtual).catch(() => {});
    }
  }

  async function abrir() {
    if (!jaInicializado) init();
    await carregarFiosEstoque();
    const modal = document.getElementById("modal-planejador-manta");
    if (modal) {
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    }
    atualizarTudo();
  }

  function fechar() {
    const modal = document.getElementById("modal-planejador-manta");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;

    document.getElementById("btn-abrir-planejador-manta")?.addEventListener("click", abrir);
    document.getElementById("btn-fechar-planejador-manta")?.addEventListener("click", fechar);

    const modal = document.getElementById("modal-planejador-manta");
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) fechar();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.style.display === "flex") {
        fechar();
      }
    });

    document.querySelectorAll("#modal-planejador-manta [data-manta-estilo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.estilo = btn.dataset.mantaEstilo;
        if (estado.estilo === "temperatura" && estado.totalCarreiras < 90) {
          estado.totalCarreiras = 365;
          const inpC = document.getElementById("manta-input-carreiras");
          if (inpC) inpC.value = "365";
        }
        atualizarTudo();
      });
    });

    document.getElementById("manta-select-modelo")?.addEventListener("change", (e) => {
      const m = MODELOS_PECA[e.target.value];
      estado.modelo = e.target.value;
      if (m) {
        estado.totalCarreiras = m.carreiras;
        estado.gramasPorCarreira = m.gramasCarreira;
        const inpC = document.getElementById("manta-input-carreiras");
        const inpG = document.getElementById("manta-input-gramas-carr");
        if (inpC) inpC.value = String(m.carreiras);
        if (inpG) inpG.value = String(m.gramasCarreira);
      }
      atualizarTudo();
    });

    document.getElementById("manta-input-carreiras")?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 12) {
        estado.totalCarreiras = Math.min(365, v);
        atualizarTudo();
      }
    });

    document.getElementById("manta-input-gramas-carr")?.addEventListener("input", (e) => {
      const v = parseFloat(String(e.target.value).replace(",", "."));
      if (!isNaN(v) && v > 0) {
        estado.gramasPorCarreira = Math.min(50, v);
        atualizarTudo();
      }
    });

    document.getElementById("manta-select-clima")?.addEventListener("change", (e) => {
      estado.climaTemp = e.target.value;
      atualizarTudo();
    });

    document.getElementById("btn-manta-sortear")?.addEventListener("click", () => {
      estado.semente = Math.floor(Math.random() * 99999) + 1;
      atualizarTudo();
    });

    document.getElementById("btn-manta-add-cor")?.addEventListener("click", () => {
      const picker = document.getElementById("manta-picker-cor");
      const nomeInp = document.getElementById("manta-nome-cor");
      const hex = picker?.value || "#88AACC";
      const nome = (nomeInp?.value || "").trim() || `Cor ${hex.toUpperCase()}`;
      const nova = {
        id: `custom-${Date.now()}`,
        nome,
        cor_hex: hex,
        peso_novelo_g: 100,
        quantidade: null
      };
      fiosDisponiveis.unshift(nova);
      if (estado.coresSelecionadas.length < 6) {
        estado.coresSelecionadas.push(nova);
      }
      if (nomeInp) nomeInp.value = "";
      atualizarTudo();
    });

    document.getElementById("btn-manta-exportar-png")?.addEventListener("click", exportarPng);
    document.getElementById("btn-manta-copiar")?.addEventListener("click", copiarSequencia);
    document.getElementById("btn-manta-enviar-receitas")?.addEventListener("click", enviarParaReceitas);
  }

  return {
    init,
    abrir,
    fechar
  };
})();
