// ==========================================================================
// PONTO & TRAMA — GERADOR DE ESFERA (AMIGURUMI) & CÍRCULO PLANO PERFEITO
// Gera receitas carreira por carreira com opção de aumentos escalonados
// (evita quinas hexagonais no amigurumi e embabadamento em sousplats),
// leitura opcional da tensão atual da Calculadora de Amostra e envio
// em 1 clique para Receitas ou para o Projeto Ativo.
// ==========================================================================

const GeradorEsferaCirculo = (() => {
  let jaInicializado = false;
  let receitaTextoAtual = "";

  const estado = {
    forma: "esfera", // "esfera" | "circulo"
    ponto: "pb", // "pb" (6) | "mpa" (8) | "pa" (12)
    modoMedida: "carreiras", // "carreiras" | "diametro"
    carreirasAum: 6, // número de carreiras de aumento (esfera) ou total de carreiras (círculo)
    diametroCm: 8,
    carreirasRetas: 4, // somente esfera
    escalonado: true,
    acabamentoCirculo: false,
    pts10cm: 22
  };

  const INC_POR_PONTO = {
    pb: { inc: 6, sigla: "pb", nome: "Ponto Baixo (pb)", corrInicio: 1 },
    mpa: { inc: 8, sigla: "mpa", nome: "Meio Ponto Alto (mpa)", corrInicio: 2 },
    pa: { inc: 12, sigla: "pa", nome: "Ponto Alto (pa)", corrInicio: 3 }
  };

  function lerTensaoDaAmostra() {
    const inpPts = document.getElementById("input-amostra-pontos");
    const inpLarg = document.getElementById("input-amostra-largura");
    const pts = parseFloat(String(inpPts?.value || "").replace(",", "."));
    const larg = parseFloat(String(inpLarg?.value || "").replace(",", "."));
    if (pts > 0 && larg > 0) {
      return Math.round(((pts / larg) * 10) * 10) / 10;
    }
    return estado.pts10cm || 22;
  }

  function calcularCarreirasPorDiametro() {
    const cfg = INC_POR_PONTO[estado.ponto] || INC_POR_PONTO.pb;
    const ptsPorCm = Math.max(0.5, (estado.pts10cm || 22) / 10);
    const diametro = Math.max(2, Number(estado.diametroCm) || 8);

    if (estado.forma === "esfera") {
      // Circunferência da esfera = pi * diametro; maxPts = inc * R
      const circunfPts = Math.PI * diametro * ptsPorCm;
      return Math.max(2, Math.min(24, Math.round(circunfPts / cfg.inc)));
    }
    // Círculo plano: circunferência na borda = pi * diametro
    const circunfPts = Math.PI * diametro * ptsPorCm;
    return Math.max(2, Math.min(30, Math.round(circunfPts / cfg.inc)));
  }

  function calcularDiametroEstimado(carreirasAum) {
    const cfg = INC_POR_PONTO[estado.ponto] || INC_POR_PONTO.pb;
    const ptsPorCm = Math.max(0.5, (estado.pts10cm || 22) / 10);
    const maxPts = carreirasAum * cfg.inc;
    const diam = maxPts / (Math.PI * ptsPorCm);
    return Math.max(1, Math.round(diam * 10) / 10);
  }

  function formatarCarreiraAumento(numCarr, entre, rep, sigla, escalonado) {
    const total = (entre + 2) * rep;
    if (entre === 0) {
      return {
        texto: `Carr ${numCarr}: ${rep} aum [${total}]`,
        total
      };
    }
    if (escalonado && entre >= 2 && entre % 2 === 0) {
      const metade = entre / 2;
      return {
        texto: `Carr ${numCarr}: ${metade} ${sigla}, 1 aum, (${entre} ${sigla}, 1 aum) x${rep - 1}, ${metade} ${sigla} [${total}]`,
        total
      };
    }
    return {
      texto: `Carr ${numCarr}: (${entre} ${sigla}, 1 aum) x${rep} [${total}]`,
      total
    };
  }

  function formatarCarreiraDiminuicao(numCarr, entre, rep, sigla, escalonado) {
    const total = (entre + 1) * rep;
    if (entre === 0) {
      return {
        texto: `Carr ${numCarr}: ${rep} dim [${total}]`,
        total
      };
    }
    if (escalonado && entre >= 2 && entre % 2 === 0) {
      const metade = entre / 2;
      return {
        texto: `Carr ${numCarr}: ${metade} ${sigla}, 1 dim, (${entre} ${sigla}, 1 dim) x${rep - 1}, ${metade} ${sigla} [${total}]`,
        total
      };
    }
    return {
      texto: `Carr ${numCarr}: (${entre} ${sigla}, 1 dim) x${rep} [${total}]`,
      total
    };
  }

  function gerarReceita() {
    const cfg = INC_POR_PONTO[estado.ponto] || INC_POR_PONTO.pb;
    const rep = cfg.inc;
    const sigla = cfg.sigla;
    const nAum =
      estado.modoMedida === "diametro"
        ? calcularCarreirasPorDiametro()
        : Math.max(2, Math.min(30, parseInt(estado.carreirasAum, 10) || 6));

    const maxPts = nAum * rep;
    const diamEst = calcularDiametroEstimado(nAum);
    const linhas = [];

    if (estado.forma === "esfera") {
      const retas = Math.max(1, Math.min(20, parseInt(estado.carreirasRetas, 10) || Math.max(2, Math.round(nAum * 0.7))));
      const totalCarreiras = nAum + retas + (nAum - 1);

      linhas.push({
        tipo: "secao",
        texto: `⚪ Esfera Amigurumi (${sigla}) • ~${diamEst.toLocaleString("pt-BR")} cm${estado.escalonado ? " • Escalonada" : ""}`
      });

      // Carreira 1: Anel Mágico
      linhas.push({
        tipo: "carreira",
        texto: `Carr 1: ${rep} ${sigla} no am [${rep}]`,
        total: rep
      });

      // Carreiras 2..nAum: Aumentos
      for (let r = 2; r <= nAum; r++) {
        const entre = r - 2;
        const item = formatarCarreiraAumento(r, entre, rep, sigla, estado.escalonado);
        linhas.push({ tipo: "carreira", texto: item.texto, total: item.total });
      }

      // Corpo reto
      const iniReta = nAum + 1;
      const fimReta = nAum + retas;
      if (retas === 1) {
        linhas.push({
          tipo: "carreira",
          texto: `Carr ${iniReta}: ${maxPts} ${sigla} [${maxPts}]`,
          total: maxPts
        });
      } else {
        linhas.push({
          tipo: "secao",
          texto: `Corpo reto (${retas} carreiras sem aumento)`
        });
        for (let c = iniReta; c <= fimReta; c++) {
          linhas.push({
            tipo: "carreira",
            texto: `Carr ${c}: ${maxPts} ${sigla} [${maxPts}]`,
            total: maxPts
          });
        }
      }

      // Diminuições
      linhas.push({ tipo: "secao", texto: "Fechamento (diminuições)" });
      let carrAtual = fimReta;
      const carrEnchimento = Math.max(fimReta + 1, totalCarreiras - 2);
      for (let entre = nAum - 2; entre >= 0; entre--) {
        carrAtual++;
        if (carrAtual === carrEnchimento) {
          linhas.push({
            tipo: "dica",
            texto: "☁️ Dica: comece a preencher com fibra siliconada antes de fechar a abertura."
          });
        }
        const item = formatarCarreiraDiminuicao(carrAtual, entre, rep, sigla, estado.escalonado);
        linhas.push({ tipo: "carreira", texto: item.texto, total: item.total });
      }
      linhas.push({
        tipo: "dica",
        texto: "🧵 Arremate com anel mágico invertido passando pelas alças da frente dos últimos pontos."
      });

      return {
        linhas,
        totalCarreiras,
        maxPts,
        diamEst,
        nAum
      };
    }

    // CÍRCULO PLANO PERFEITO (SOUSPLAT / BASE / TAPETE)
    linhas.push({
      tipo: "secao",
      texto: `🟣 Círculo Plano Perfeito (${cfg.nome}) • ~${diamEst.toLocaleString("pt-BR")} cm${estado.escalonado ? " • Escalonado" : ""}`
    });

    const prefixoSubida = cfg.corrInicio > 1 ? `Suba ${cfg.corrInicio} corr, ` : "";
    linhas.push({
      tipo: "carreira",
      texto: `Carr 1: ${prefixoSubida}${rep} ${sigla} no am, feche com pbx [${rep}]`,
      total: rep
    });

    for (let r = 2; r <= nAum; r++) {
      const entre = r - 2;
      const item = formatarCarreiraAumento(r, entre, rep, sigla, estado.escalonado);
      const sufixo = cfg.corrInicio > 1 ? " (feche com pbx)" : "";
      linhas.push({
        tipo: "carreira",
        texto: `${item.texto.replace(/\s*\[\d+\]$/, "")}${sufixo} [${item.total}]`,
        total: item.total
      });
    }

    if (estado.acabamentoCirculo) {
      linhas.push({
        tipo: "carreira",
        texto: `Carr ${nAum + 1}: ${maxPts} pbx (ou ponto caranguejo) para firmar a borda [${maxPts}]`,
        total: maxPts
      });
    }

    return {
      linhas,
      totalCarreiras: nAum + (estado.acabamentoCirculo ? 1 : 0),
      maxPts,
      diamEst,
      nAum
    };
  }

  function renderizarSvgPreview(dados) {
    const cont = document.getElementById("svg-preview-esfera-circulo");
    if (!cont) return;

    const aneis = Math.min(9, Math.max(3, dados.nAum));
    if (estado.forma === "esfera") {
      let arcos = "";
      for (let i = 1; i <= aneis; i++) {
        const t = i / (aneis + 1);
        const y = 20 + t * 140;
        const rx = Math.sin(t * Math.PI) * 68;
        const ry = Math.max(4, rx * 0.22);
        const destaque = Math.abs(t - 0.5) < 0.14 ? 'stroke-width="2" opacity="0.95"' : 'stroke-width="1.2" opacity="0.55"';
        arcos += `<ellipse cx="90" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="currentColor" ${destaque} />`;
      }
      cont.innerHTML = `
        <svg viewBox="0 0 180 180" aria-hidden="true">
          <defs>
            <radialGradient id="gradEsferaPT" cx="38%" cy="32%" r="65%">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.24" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0.04" />
            </radialGradient>
          </defs>
          <circle cx="90" cy="90" r="70" fill="url(#gradEsferaPT)" stroke="currentColor" stroke-width="2" />
          ${arcos}
          <ellipse cx="90" cy="90" rx="28" ry="70" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.45" />
          <line x1="20" y1="168" x2="160" y2="168" stroke="currentColor" stroke-width="1.2" opacity="0.7" />
          <text x="90" y="178" text-anchor="middle" fill="currentColor" font-size="10" font-weight="700">Ø ~${dados.diamEst.toLocaleString("pt-BR")} cm • ${dados.maxPts} pts máx.</text>
        </svg>`;
      return;
    }

    // Círculo plano com marcação dos aumentos escalonados vs alinhados
    const cfg = INC_POR_PONTO[estado.ponto] || INC_POR_PONTO.pb;
    const pontosRep = Math.min(12, cfg.inc);
    let circulos = "";
    let marcas = "";
    for (let i = 1; i <= aneis; i++) {
      const r = 10 + (i / aneis) * 66;
      circulos += `<circle cx="90" cy="86" r="${r.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${i === aneis ? 2 : 1.1}" opacity="${i === aneis ? 0.95 : 0.48}" />`;
      const offsetAng = estado.escalonado && i % 2 === 0 ? Math.PI / pontosRep : 0;
      for (let k = 0; k < pontosRep; k++) {
        const ang = (k / pontosRep) * Math.PI * 2 + offsetAng;
        const px = 90 + Math.cos(ang) * r;
        const py = 86 + Math.sin(ang) * r;
        marcas += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="currentColor" opacity="0.85" />`;
      }
    }
    cont.innerHTML = `
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="86" r="76" fill="currentColor" fill-opacity="0.06" />
        ${circulos}
        ${marcas}
        <circle cx="90" cy="86" r="3.5" fill="currentColor" />
        <text x="90" y="176" text-anchor="middle" fill="currentColor" font-size="10" font-weight="700">${estado.escalonado ? "Aumentos escalonados (redondo)" : "Aumentos alinhados"} • ~${dados.diamEst.toLocaleString("pt-BR")} cm</text>
      </svg>`;
  }

  function atualizarUI() {
    const dados = gerarReceita();
    receitaTextoAtual = dados.linhas.map((l) => l.texto).join("\n");

    const elTotalCarr = document.getElementById("ec-metrica-carreiras");
    const elMaxPts = document.getElementById("ec-metrica-maxpts");
    const elDiam = document.getElementById("ec-metrica-diametro");
    if (elTotalCarr) elTotalCarr.textContent = String(dados.totalCarreiras);
    if (elMaxPts) elMaxPts.textContent = `${dados.maxPts} pts`;
    if (elDiam) elDiam.textContent = `~${dados.diamEst.toLocaleString("pt-BR")} cm`;

    // Visibilidade condicional de campos
    const grpRetas = document.getElementById("ec-grupo-retas");
    const grpAcab = document.getElementById("ec-grupo-acabamento");
    const grpCarr = document.getElementById("ec-grupo-carreiras");
    const grpDiam = document.getElementById("ec-grupo-diametro");
    const lblCarr = document.getElementById("ec-label-carreiras");

    if (grpRetas) grpRetas.style.display = estado.forma === "esfera" ? "flex" : "none";
    if (grpAcab) grpAcab.style.display = estado.forma === "circulo" ? "flex" : "none";
    if (grpCarr) grpCarr.style.display = estado.modoMedida === "carreiras" ? "flex" : "none";
    if (grpDiam) grpDiam.style.display = estado.modoMedida === "diametro" ? "flex" : "none";
    if (lblCarr) {
      lblCarr.textContent = estado.forma === "esfera"
        ? "Carreiras de aumento (raio)"
        : "Total de carreiras do círculo";
    }

    // Atualiza botões segmentados
    document.querySelectorAll("#modal-esfera-circulo [data-ec-forma]").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.ecForma === estado.forma);
    });
    document.querySelectorAll("#modal-esfera-circulo [data-ec-modo]").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.ecModo === estado.modoMedida);
    });

    renderizarSvgPreview(dados);

    // Lista carreira por carreira
    const lista = document.getElementById("ec-lista-receita");
    if (lista) {
      lista.innerHTML = dados.linhas
        .map((item) => {
          if (item.tipo === "secao") {
            return `<div class="pro-linha-receita secao-div"><span>${escapeHtml(item.texto)}</span></div>`;
          }
          if (item.tipo === "dica") {
            return `<div class="pro-linha-receita dica-enchimento"><span>${escapeHtml(item.texto)}</span></div>`;
          }
          const semColchete = item.texto.replace(/\s*\[\d+\]$/, "");
          return `<div class="pro-linha-receita"><span>${escapeHtml(semColchete)}</span><span class="pro-badge-pts">${item.total} pts</span></div>`;
        })
        .join("");
    }
  }

  function escapeHtml(txt) {
    return String(txt || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function avisar(msg) {
    const toast = document.getElementById("toast-amostra") || document.getElementById("toast-projetos");
    if (toast) {
      toast.textContent = msg;
      toast.classList.add("visivel");
      setTimeout(() => toast.classList.remove("visivel"), 2600);
    }
  }

  function abrir(formaInicial) {
    if (!jaInicializado) init();
    if (formaInicial === "esfera" || formaInicial === "circulo") {
      estado.forma = formaInicial;
    }
    estado.pts10cm = lerTensaoDaAmostra();
    const inpTensao = document.getElementById("ec-input-tensao");
    if (inpTensao) inpTensao.value = String(estado.pts10cm);

    const modal = document.getElementById("modal-esfera-circulo");
    if (modal) {
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    }
    atualizarUI();
  }

  function fechar() {
    const modal = document.getElementById("modal-esfera-circulo");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
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

  function enviarParaProjetoAtivo() {
    if (!receitaTextoAtual) return;
    const proj = typeof ProjetoContexto !== "undefined" ? ProjetoContexto.obterProjetoAtivo() : null;
    if (!proj) {
      enviarParaReceitas();
      return;
    }
    const textoAtual = (proj.receita && proj.receita.texto) ? `${proj.receita.texto}\n\n` : "";
    const combinado = `${textoAtual}${receitaTextoAtual}`;
    if (typeof PontoTramaApp !== "undefined") PontoTramaApp.garantirModulo("receitas");
    if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.definirTexto === "function") {
      LeitorReceitas.definirTexto(combinado);
    }
    avisar(`✓ Receita anexada ao projeto "${proj.nome || "Ativo"}"!`);
    fechar();
  }

  function copiarReceita() {
    if (!receitaTextoAtual) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(receitaTextoAtual).then(() => avisar("📋 Receita copiada!")).catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = receitaTextoAtual;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      avisar("📋 Receita copiada!");
    }
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;

    document.getElementById("btn-abrir-esfera-circulo")?.addEventListener("click", () => abrir());
    document.getElementById("btn-fechar-esfera-circulo")?.addEventListener("click", fechar);

    const modal = document.getElementById("modal-esfera-circulo");
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) fechar();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.style.display === "flex") {
        fechar();
      }
    });

    document.querySelectorAll("#modal-esfera-circulo [data-ec-forma]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.forma = btn.dataset.ecForma;
        if (estado.forma === "esfera" && estado.ponto === "pa") {
          estado.ponto = "pb";
          const sel = document.getElementById("ec-select-ponto");
          if (sel) sel.value = "pb";
        }
        atualizarUI();
      });
    });

    document.querySelectorAll("#modal-esfera-circulo [data-ec-modo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.modoMedida = btn.dataset.ecModo;
        atualizarUI();
      });
    });

    document.getElementById("ec-select-ponto")?.addEventListener("change", (e) => {
      estado.ponto = e.target.value;
      atualizarUI();
    });

    document.getElementById("ec-input-carreiras")?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 2) {
        estado.carreirasAum = Math.min(30, v);
        if (estado.forma === "esfera") {
          estado.carreirasRetas = Math.max(2, Math.round(estado.carreirasAum * 0.7));
          const inpR = document.getElementById("ec-input-retas");
          if (inpR) inpR.value = String(estado.carreirasRetas);
        }
        atualizarUI();
      }
    });

    document.getElementById("ec-input-diametro")?.addEventListener("input", (e) => {
      const v = parseFloat(String(e.target.value).replace(",", "."));
      if (!isNaN(v) && v >= 2) {
        estado.diametroCm = Math.min(180, v);
        atualizarUI();
      }
    });

    document.getElementById("ec-input-retas")?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v >= 0) {
        estado.carreirasRetas = Math.min(20, v);
        atualizarUI();
      }
    });

    document.getElementById("ec-input-tensao")?.addEventListener("input", (e) => {
      const v = parseFloat(String(e.target.value).replace(",", "."));
      if (!isNaN(v) && v >= 4) {
        estado.pts10cm = Math.min(60, v);
        atualizarUI();
      }
    });

    document.getElementById("ec-chk-escalonado")?.addEventListener("change", (e) => {
      estado.escalonado = Boolean(e.target.checked);
      atualizarUI();
    });

    document.getElementById("ec-chk-acabamento")?.addEventListener("change", (e) => {
      estado.acabamentoCirculo = Boolean(e.target.checked);
      atualizarUI();
    });

    document.getElementById("btn-ec-copiar")?.addEventListener("click", copiarReceita);
    document.getElementById("btn-ec-enviar-receitas")?.addEventListener("click", enviarParaReceitas);
    document.getElementById("btn-ec-enviar-projeto")?.addEventListener("click", enviarParaProjetoAtivo);
  }

  return {
    init,
    abrir,
    fechar
  };
})();
