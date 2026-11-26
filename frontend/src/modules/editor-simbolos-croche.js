// ==========================================================================
// PONTO & TRAMA — EDITOR DE GRÁFICO COM SÍMBOLOS DE CROCHÊ (FILEIRAS & CIRCULAR)
// Modo complementar vetorial (SVG) ao Editor de Gráficos Pixel Art.
// Desenhe sousplats, mandalas, flores e barrados usando 14 símbolos padrão CYC,
// simetria radial (1×/4×/6×/8×/12×), cores por carreira, templates prontos,
// Desfazer/Refazer, legenda automática e exportação SVG + PNG (Web/Ubuntu/Android).
// ==========================================================================

const EditorSimbolosCroche = (() => {
  const STORAGE_KEY = "ponto_trama_simbolos_croche_v1";
  const MAX_HISTORICO = 40;

  let jaInicializado = false;
  let modoAtivo = false;
  let historicoUndo = [];
  let historicoRedo = [];

  // 14 símbolos vetoriais oficiais CYC (coordenadas centralizadas em 0,0 numa caixa 24×24)
  const SIMBOLOS = [
    {
      id: "corr",
      sigla: "corr",
      nome: "Correntinha",
      svg: `<ellipse cx="0" cy="0" rx="6.5" ry="3.8" fill="none" stroke="currentColor" stroke-width="2" />`
    },
    {
      id: "pbx",
      sigla: "pbx",
      nome: "Ponto Baixíssimo",
      svg: `<circle cx="0" cy="0" r="3.8" fill="currentColor" />`
    },
    {
      id: "pb",
      sigla: "pb",
      nome: "Ponto Baixo",
      svg: `<path d="M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" />`
    },
    {
      id: "mpa",
      sigla: "mpa",
      nome: "Meio Ponto Alto",
      svg: `<path d="M-6 -8 L6 -8 M0 -8 L0 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`
    },
    {
      id: "pa",
      sigla: "pa",
      nome: "Ponto Alto",
      svg: `<path d="M-6 -9 L6 -9 M0 -9 L0 9 M-4.2 1 L4.2 -3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`
    },
    {
      id: "pad",
      sigla: "pad",
      nome: "Ponto Alto Duplo",
      svg: `<path d="M-6 -9.5 L6 -9.5 M0 -9.5 L0 9.5 M-4.2 -1 L4.2 -4.5 M-4.2 3.5 L4.2 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />`
    },
    {
      id: "aum",
      sigla: "aum",
      nome: "Aumento (2 pts juntos)",
      svg: `<path d="M-7 -9 L-1 -9 M1 -9 L7 -9 M-4 -9 L0 9 L4 -9 M-5.5 -1 L-0.5 -3.5 M0.5 -1 L5.5 -3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`
    },
    {
      id: "dim",
      sigla: "dim",
      nome: "Diminuição (2 pts fech. juntos)",
      svg: `<path d="M-6 -9 L6 -9 M0 -9 L-5 9 M0 -9 L5 9 M-5.2 0.5 L-0.5 -1.8 M0.5 0.5 L5.2 -1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`
    },
    {
      id: "leque",
      sigla: "3pa",
      nome: "Leque (3 pa)",
      svg: `<path d="M-8 -9 L-3.5 -9 M-2.2 -9 L2.2 -9 M3.5 -9 L8 -9 M-5.8 -9 L0 9 L5.8 -9 M0 -9 L0 9 M-6 -1.5 L6 -4" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" />`
    },
    {
      id: "pipoca",
      sigla: "pipoca",
      nome: "Ponto Pipoca / Cluster",
      svg: `<ellipse cx="0" cy="0" rx="6.2" ry="8.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M0 -8.5 L0 8.5 M-4.5 1.5 L4.5 -2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />`
    },
    {
      id: "pico",
      sigla: "picô",
      nome: "Picô (3 corr)",
      svg: `<circle cx="0" cy="-4.5" r="4.8" fill="none" stroke="currentColor" stroke-width="1.9" /><circle cx="0" cy="4.2" r="2.5" fill="currentColor" />`
    },
    {
      id: "rpa_f",
      sigla: "rpa-f",
      nome: "Relevo pela Frente",
      svg: `<path d="M-5.5 -9 L5.5 -9 M0 -9 L0 5 Q0 9 4.5 8.5 M-4 0 L4 -3.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />`
    },
    {
      id: "rpa_t",
      sigla: "rpa-t",
      nome: "Relevo por Trás",
      svg: `<path d="M-5.5 -9 L5.5 -9 M0 -9 L0 5 Q0 9 -4.5 8.5 M-4 0 L4 -3.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />`
    },
    {
      id: "am",
      sigla: "am",
      nome: "Anel Mágico",
      svg: `<path d="M0 -7 A7 7 0 1 1 -6.5 2.6 A4.2 4.2 0 1 1 2.5 -2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`
    },
    {
      id: "vazio",
      sigla: "limpar",
      nome: "Borracha",
      svg: `<path d="M-6 5 L1 -4 L7 1 L1 8 L-6 8 Z M-2 8 L7 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />`
    }
  ];

  const MAPA_SIMBOLOS = Object.fromEntries(SIMBOLOS.map((s) => [s.id, s]));

  const CORES_CARREIRA_PADRAO = [
    "#1B2F5E",
    "#B84A39",
    "#2F7A5B",
    "#B87E1E",
    "#6B3A7A",
    "#2A6D8F",
    "#8C4A27",
    "#3B5998"
  ];

  function criarEstadoSousplat() {
    return {
      titulo: "Sousplat Clássico",
      tipo: "circular", // "circular" | "fileiras"
      simboloAtivo: "pa",
      simetria: 6, // 1, 4, 6, 8, 12
      anelMagicoCentro: true,
      carreiras: [
        { cor: "#1B2F5E", slots: Array(12).fill("pa") },
        { cor: "#B84A39", slots: Array(18).fill("aum") },
        { cor: "#2F7A5B", slots: Array(24).fill("").map((_, i) => (i % 2 === 0 ? "pa" : "corr")) },
        { cor: "#B87E1E", slots: Array(24).fill("").map((_, i) => (i % 2 === 0 ? "leque" : "pb")) }
      ]
    };
  }

  function criarEstadoFlor() {
    return {
      titulo: "Flor 6 Pétalas",
      tipo: "circular",
      simboloAtivo: "leque",
      simetria: 6,
      anelMagicoCentro: true,
      carreiras: [
        { cor: "#B87E1E", slots: Array(6).fill("pb") },
        { cor: "#B84A39", slots: Array(12).fill("").map((_, i) => (i % 2 === 0 ? "pb" : "corr")) },
        { cor: "#B84A39", slots: Array(18).fill("").map((_, i) => (i % 3 === 1 ? "leque" : i % 3 === 0 ? "corr" : "pb")) },
        { cor: "#6B3A7A", slots: Array(18).fill("").map((_, i) => (i % 3 === 1 ? "pico" : "pbx")) }
      ]
    };
  }

  function criarEstadoBarrado() {
    return {
      titulo: "Barrado Leque",
      tipo: "fileiras",
      simboloAtivo: "pa",
      simetria: 1,
      anelMagicoCentro: false,
      carreiras: [
        { cor: "#1B2F5E", slots: Array(15).fill("corr") },
        { cor: "#1B2F5E", slots: Array(15).fill("pb") },
        { cor: "#2F7A5B", slots: Array(15).fill("").map((_, i) => (i % 3 === 1 ? "corr" : "pa")) },
        { cor: "#B84A39", slots: Array(15).fill("").map((_, i) => (i % 4 === 2 ? "leque" : i % 2 === 0 ? "pb" : "")) },
        { cor: "#B87E1E", slots: Array(15).fill("").map((_, i) => (i % 4 === 2 ? "pico" : "")) }
      ]
    };
  }

  let estado = criarEstadoSousplat();

  function clonarEstado() {
    return JSON.parse(JSON.stringify(estado));
  }

  function salvarUndo() {
    historicoUndo.push(clonarEstado());
    if (historicoUndo.length > MAX_HISTORICO) historicoUndo.shift();
    historicoRedo = [];
  }

  function persistirLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // ignora
    }
  }

  function restaurarLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carreiras) && parsed.carreiras.length > 0) {
        estado = { ...criarEstadoSousplat(), ...parsed };
      }
    } catch {
      // ignora
    }
  }

  function pintarSlot(carrIdx, slotIdx) {
    const carr = estado.carreiras[carrIdx];
    if (!carr || slotIdx < 0 || slotIdx >= carr.slots.length) return;
    salvarUndo();

    const valor = estado.simboloAtivo === "vazio" ? "" : estado.simboloAtivo;
    const total = carr.slots.length;
    const sim = Math.max(1, parseInt(estado.simetria, 10) || 1);

    if (estado.tipo === "circular" && sim > 1) {
      const passo = total / sim;
      if (passo >= 1) {
        for (let k = 0; k < sim; k++) {
          const alvo = Math.round(slotIdx + k * passo) % total;
          carr.slots[alvo] = valor;
        }
      } else {
        carr.slots[slotIdx] = valor;
      }
    } else if (estado.tipo === "fileiras" && sim === 2) {
      carr.slots[slotIdx] = valor;
      const espelho = total - 1 - slotIdx;
      if (espelho >= 0 && espelho < total) {
        carr.slots[espelho] = valor;
      }
    } else {
      carr.slots[slotIdx] = valor;
    }

    persistirLocal();
    renderizarTudo();
  }

  function gerarSvgGrafico(paraExportacao = false) {
    const nCarr = estado.carreiras.length;

    if (estado.tipo === "circular") {
      const raioBase = 48;
      const passoRaio = 46;
      const raioMax = raioBase + nCarr * passoRaio + 32;
      const dim = Math.max(460, raioMax * 2);
      const cx = dim / 2;
      const cy = dim / 2;

      let guias = "";
      let simbolosSvg = "";

      // Anel mágico central
      if (estado.anelMagicoCentro) {
        guias += `<circle cx="${cx}" cy="${cy}" r="16" fill="none" stroke="#1B2F5E" stroke-width="2" />`;
        guias += `<path d="M${cx} ${cy - 10} A10 10 0 1 1 ${cx - 9} ${cy + 4} A6 6 0 1 1 ${cx + 4} ${cy - 3}" fill="none" stroke="#1B2F5E" stroke-width="1.8" stroke-linecap="round" />`;
      }

      estado.carreiras.forEach((carr, rIdx) => {
        const raio = raioBase + rIdx * passoRaio;
        const cor = carr.cor || "#1B2F5E";
        const nSlots = carr.slots.length;

        // Círculo guia da carreira
        guias += `<circle cx="${cx}" cy="${cy}" r="${raio}" fill="none" stroke="${cor}" stroke-opacity="${paraExportacao ? "0.2" : "0.24"}" stroke-width="1" stroke-dasharray="3 4" />`;
        // Número da carreira
        guias += `<text x="${cx + 4}" y="${cy - raio - 4}" fill="${cor}" font-size="11" font-weight="700" opacity="0.78">C${rIdx + 1}</text>`;

        for (let s = 0; s < nSlots; s++) {
          const angRad = (s / nSlots) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angRad) * raio;
          const y = cy + Math.sin(angRad) * raio;
          const deg = (angRad * 180) / Math.PI + 90;
          const simbId = carr.slots[s];
          const simb = MAPA_SIMBOLOS[simbId];

          if (!paraExportacao) {
            simbolosSvg += `<circle class="simb-slot-hit" data-carr="${rIdx}" data-slot="${s}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="${simb ? "transparent" : "rgba(27,47,94,0.06)"}" stroke="${simb ? "transparent" : "rgba(27,47,94,0.22)"}" stroke-width="1" />`;
          }

          if (simb) {
            simbolosSvg += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(1.05)" style="color:${cor};pointer-events:none">${simb.svg}</g>`;
          }
        }
      });

      return {
        width: dim,
        height: dim,
        markup: `
          <svg id="${paraExportacao ? "svg-export-simb" : "svg-palco-simbolos"}" xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">
            <rect width="${dim}" height="${dim}" fill="#fcfaf3" rx="12" />
            ${guias}
            ${simbolosSvg}
          </svg>`
      };
    }

    // MODO FILEIRAS (RETO / BARRADO) — de baixo para cima (C1 na base)
    const maxSlots = Math.max(8, ...estado.carreiras.map((c) => c.slots.length));
    const cellW = 36;
    const cellH = 44;
    const padX = 52;
    const padY = 38;
    const width = Math.max(460, padX * 2 + maxSlots * cellW);
    const height = Math.max(320, padY * 2 + nCarr * cellH);

    let guias = "";
    let simbolosSvg = "";

    estado.carreiras.forEach((carr, rIdx) => {
      const y = height - padY - rIdx * cellH - cellH / 2;
      const cor = carr.cor || "#1B2F5E";
      const nSlots = carr.slots.length;
      const offsetX = padX + ((maxSlots - nSlots) * cellW) / 2;

      guias += `<line x1="${padX - 8}" y1="${y + cellH / 2}" x2="${width - padX + 8}" y2="${y + cellH / 2}" stroke="${cor}" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="3 4" />`;
      // Numeração alternada (ímpar à direita, par à esquerda, padrão internacional de gráficos)
      const numX = rIdx % 2 === 0 ? width - padX + 18 : padX - 24;
      guias += `<text x="${numX}" y="${y + 4}" text-anchor="middle" fill="${cor}" font-size="12" font-weight="700">C${rIdx + 1}</text>`;

      for (let s = 0; s < nSlots; s++) {
        const x = offsetX + s * cellW + cellW / 2;
        const simbId = carr.slots[s];
        const simb = MAPA_SIMBOLOS[simbId];

        if (!paraExportacao) {
          simbolosSvg += `<rect class="simb-slot-hit" data-carr="${rIdx}" data-slot="${s}" x="${(x - 16).toFixed(1)}" y="${(y - 18).toFixed(1)}" width="32" height="36" rx="5" fill="${simb ? "transparent" : "rgba(27,47,94,0.05)"}" stroke="${simb ? "transparent" : "rgba(27,47,94,0.18)"}" stroke-width="1" />`;
        }

        if (simb) {
          simbolosSvg += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(1.1)" style="color:${cor};pointer-events:none">${simb.svg}</g>`;
        }
      }
    });

    return {
      width,
      height,
      markup: `
        <svg id="${paraExportacao ? "svg-export-simb" : "svg-palco-simbolos"}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect width="${width}" height="${height}" fill="#fcfaf3" rx="12" />
          ${guias}
          ${simbolosSvg}
        </svg>`
    };
  }

  function renderizarPaletaSimbolos() {
    const cont = document.getElementById("simb-grid-ferramentas");
    if (!cont) return;
    cont.innerHTML = SIMBOLOS.map((s) => `
      <button type="button" class="btn-simb-ponto ${estado.simboloAtivo === s.id ? "ativo" : ""}" data-simb-id="${s.id}" title="${s.nome} (${s.sigla})">
        <svg viewBox="-14 -14 28 28" aria-hidden="true">${s.svg}</svg>
        <span>${s.sigla}</span>
      </button>
    `).join("");

    cont.querySelectorAll("[data-simb-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.simboloAtivo = btn.dataset.simbId;
        renderizarPaletaSimbolos();
      });
    });
  }

  function renderizarCarreirasPainel() {
    const cont = document.getElementById("simb-lista-carreiras");
    if (!cont) return;
    cont.innerHTML = estado.carreiras
      .map((carr, idx) => `
        <div class="simb-carr-item">
          <div style="display:flex;align-items:center;gap:6px">
            <input type="color" value="${carr.cor || "#1B2F5E"}" data-simb-cor="${idx}" title="Cor da carreira ${idx + 1}" />
            <strong>C${idx + 1}</strong>
          </div>
          <div class="simb-carr-qtd">
            <button type="button" data-simb-menos="${idx}" title="Diminuir pontos na carreira">−</button>
            <span>${carr.slots.length} pts</span>
            <button type="button" data-simb-mais="${idx}" title="Adicionar pontos na carreira">+</button>
          </div>
        </div>
      `)
      .join("");

    cont.querySelectorAll("[data-simb-cor]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const idx = parseInt(inp.dataset.simbCor, 10);
        if (estado.carreiras[idx]) {
          estado.carreiras[idx].cor = e.target.value;
          persistirLocal();
          renderizarPalco();
        }
      });
    });

    cont.querySelectorAll("[data-simb-menos]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.simbMenos, 10);
        const c = estado.carreiras[idx];
        if (!c || c.slots.length <= 4) return;
        salvarUndo();
        const passo = estado.tipo === "circular" ? Math.min(2, c.slots.length - 4) : 1;
        c.slots.splice(c.slots.length - passo, passo);
        persistirLocal();
        renderizarTudo();
      });
    });

    cont.querySelectorAll("[data-simb-mais]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.simbMais, 10);
        const c = estado.carreiras[idx];
        if (!c || c.slots.length >= 60) return;
        salvarUndo();
        const passo = estado.tipo === "circular" ? 2 : 1;
        for (let k = 0; k < passo; k++) c.slots.push("");
        persistirLocal();
        renderizarTudo();
      });
    });
  }

  function renderizarLegenda() {
    const cont = document.getElementById("simb-legenda-lista");
    if (!cont) return;
    const usados = new Set();
    if (estado.tipo === "circular" && estado.anelMagicoCentro) usados.add("am");
    estado.carreiras.forEach((c) => c.slots.forEach((s) => { if (s && MAPA_SIMBOLOS[s]) usados.add(s); }));

    if (usados.size === 0) {
      cont.innerHTML = `<small style="opacity:0.7">Clique nos círculos do gráfico para adicionar pontos.</small>`;
      return;
    }

    cont.innerHTML = Array.from(usados)
      .map((id) => {
        const s = MAPA_SIMBOLOS[id];
        if (!s) return "";
        return `
          <div class="simb-legenda-item">
            <svg viewBox="-14 -14 28 28" aria-hidden="true">${s.svg}</svg>
            <span><strong>${s.sigla}</strong> — ${s.nome}</span>
          </div>`;
      })
      .join("");
  }

  function renderizarPalco() {
    const box = document.getElementById("simb-canvas-box");
    if (!box) return;
    const { markup } = gerarSvgGrafico(false);
    box.innerHTML = markup;

    box.querySelectorAll(".simb-slot-hit").forEach((el) => {
      el.addEventListener("click", () => {
        const cIdx = parseInt(el.dataset.carr, 10);
        const sIdx = parseInt(el.dataset.slot, 10);
        pintarSlot(cIdx, sIdx);
      });
    });
  }

  function renderizarTudo() {
    renderizarPaletaSimbolos();
    renderizarPalco();
    renderizarCarreirasPainel();
    renderizarLegenda();

    const inpTit = document.getElementById("simb-input-titulo");
    if (inpTit && inpTit.value !== estado.titulo) inpTit.value = estado.titulo;

    document.querySelectorAll("#painel-simbolos-croche [data-simb-geom]").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.simbGeom === estado.tipo);
    });

    const selSim = document.getElementById("simb-select-simetria");
    if (selSim) {
      selSim.innerHTML =
        estado.tipo === "circular"
          ? `<option value="1">1× Livre</option><option value="4">4× Quadrado</option><option value="6">6× Hexágono / Flor</option><option value="8">8× Mandala</option><option value="12">12× Sousplat</option>`
          : `<option value="1">1× Livre</option><option value="2">2× Espelho Horizontal</option>`;
      selSim.value = String(estado.simetria);
    }

    const chkAm = document.getElementById("simb-chk-anel-magico-wrap");
    if (chkAm) chkAm.style.display = estado.tipo === "circular" ? "inline-flex" : "none";
    const chkAmInput = document.getElementById("simb-chk-anel-magico");
    if (chkAmInput) chkAmInput.checked = Boolean(estado.anelMagicoCentro);
  }

  function exportarSvg() {
    const { markup } = gerarSvgGrafico(true);
    const nome = `${(estado.titulo || "grafico-croche").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;

    if (window.PontoETramaAndroid && typeof window.PontoETramaAndroid.salvarArquivoBase64 === "function") {
      const b64 = btoa(unescape(encodeURIComponent(markup)));
      window.PontoETramaAndroid.salvarArquivoBase64(nome, "image/svg+xml", b64);
      return;
    }

    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportarPng() {
    const { width, height, markup } = gerarSvgGrafico(true);
    const nome = `${(estado.titulo || "grafico-croche").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const escala = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * escala;
      canvas.height = (height + 44) * escala;
      const ctx = canvas.getContext("2d");
      ctx.scale(escala, escala);
      ctx.fillStyle = "#fcfaf3";
      ctx.fillRect(0, 0, width, height + 44);
      ctx.fillStyle = "#1B2F5E";
      ctx.font = "700 16px system-ui, sans-serif";
      ctx.fillText(`✿ ${estado.titulo || "Gráfico de Crochê"} — Ponto & Trama`, 18, 28);
      ctx.drawImage(img, 0, 40);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL("image/png");
      if (window.PontoETramaAndroid && typeof window.PontoETramaAndroid.salvarArquivoBase64 === "function") {
        window.PontoETramaAndroid.salvarArquivoBase64(nome, "image/png", dataUrl.split(",")[1] || "");
        return;
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    img.src = url;
  }

  function ativarModoSimbolos(ativar) {
    if (!jaInicializado) init();
    modoAtivo = Boolean(ativar);
    const layoutPixel = document.getElementById("layout-editor-graficos");
    const painelSimb = document.getElementById("painel-simbolos-croche");
    const btnSimb = document.getElementById("btn-graf-modo-simbolos");
    const btnEd = document.getElementById("btn-graf-modo-edicao");
    const btnEx = document.getElementById("btn-graf-modo-execucao");

    if (layoutPixel) layoutPixel.style.display = modoAtivo ? "none" : "";
    if (painelSimb) painelSimb.style.display = modoAtivo ? "grid" : "none";

    if (btnSimb) {
      btnSimb.classList.toggle("ativo", modoAtivo);
      btnSimb.setAttribute("aria-selected", modoAtivo ? "true" : "false");
    }
    if (modoAtivo) {
      btnEd?.classList.remove("ativo");
      btnEx?.classList.remove("ativo");
      renderizarTudo();
    }
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    restaurarLocal();

    document.getElementById("btn-graf-modo-simbolos")?.addEventListener("click", () => {
      ativarModoSimbolos(true);
    });
    document.getElementById("btn-graf-modo-edicao")?.addEventListener("click", () => {
      if (modoAtivo) ativarModoSimbolos(false);
    });
    document.getElementById("btn-graf-modo-execucao")?.addEventListener("click", () => {
      if (modoAtivo) ativarModoSimbolos(false);
    });

    document.querySelectorAll("#painel-simbolos-croche [data-simb-geom]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const novoTipo = btn.dataset.simbGeom;
        if (novoTipo === estado.tipo) return;
        salvarUndo();
        if (novoTipo === "circular") {
          estado = criarEstadoSousplat();
        } else {
          estado = criarEstadoBarrado();
        }
        persistirLocal();
        renderizarTudo();
      });
    });

    document.getElementById("simb-select-simetria")?.addEventListener("change", (e) => {
      estado.simetria = parseInt(e.target.value, 10) || 1;
      persistirLocal();
    });

    document.getElementById("simb-chk-anel-magico")?.addEventListener("change", (e) => {
      salvarUndo();
      estado.anelMagicoCentro = Boolean(e.target.checked);
      persistirLocal();
      renderizarTudo();
    });

    document.getElementById("simb-input-titulo")?.addEventListener("input", (e) => {
      estado.titulo = e.target.value;
      persistirLocal();
    });

    document.getElementById("btn-simb-add-carreira")?.addEventListener("click", () => {
      if (estado.carreiras.length >= 12) return;
      salvarUndo();
      const ult = estado.carreiras[estado.carreiras.length - 1];
      const qtd = estado.tipo === "circular"
        ? Math.min(60, (ult ? ult.slots.length : 6) + 6)
        : (ult ? ult.slots.length : 15);
      const cor = CORES_CARREIRA_PADRAO[estado.carreiras.length % CORES_CARREIRA_PADRAO.length];
      estado.carreiras.push({ cor, slots: Array(qtd).fill("") });
      persistirLocal();
      renderizarTudo();
    });

    document.getElementById("btn-simb-rem-carreira")?.addEventListener("click", () => {
      if (estado.carreiras.length <= 1) return;
      salvarUndo();
      estado.carreiras.pop();
      persistirLocal();
      renderizarTudo();
    });

    document.getElementById("btn-simb-limpar")?.addEventListener("click", () => {
      salvarUndo();
      estado.carreiras.forEach((c) => c.slots.fill(""));
      persistirLocal();
      renderizarTudo();
    });

    document.getElementById("btn-simb-undo")?.addEventListener("click", () => {
      if (historicoUndo.length === 0) return;
      historicoRedo.push(clonarEstado());
      estado = historicoUndo.pop();
      persistirLocal();
      renderizarTudo();
    });

    document.getElementById("btn-simb-redo")?.addEventListener("click", () => {
      if (historicoRedo.length === 0) return;
      historicoUndo.push(clonarEstado());
      estado = historicoRedo.pop();
      persistirLocal();
      renderizarTudo();
    });

    document.querySelectorAll("#painel-simbolos-croche [data-simb-template]").forEach((btn) => {
      btn.addEventListener("click", () => {
        salvarUndo();
        const t = btn.dataset.simbTemplate;
        if (t === "sousplat") estado = criarEstadoSousplat();
        else if (t === "flor") estado = criarEstadoFlor();
        else if (t === "barrado") estado = criarEstadoBarrado();
        persistirLocal();
        renderizarTudo();
      });
    });

    document.getElementById("btn-simb-exportar-svg")?.addEventListener("click", exportarSvg);
    document.getElementById("btn-simb-exportar-png")?.addEventListener("click", exportarPng);
  }

  return {
    init,
    ativarModoSimbolos
  };
})();
