// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: RECEITAS E ANOTAÇÕES
// - Modo Texto & Passos: editor + Leitor Interativo estilo Ribblr
//   (checklist por carreira que soma +1 no Contador, badge de pontos
//    esperados e popover instantâneo ao tocar em siglas de pontos)
// - Modo PDF / Foto: visualizador + régua destacada "Onde parei"
// - Ligado automaticamente ao Projeto Ativo via ProjetoContexto
// ==========================================================================

const LeitorReceitas = (() => {
  const STORAGE_AVULSO = "ponto_trama_receita_avulsa";

  let jaInicializado = false;
  let mapaSiglas = new Map();
  let regexSiglas = null;
  let dicionarioCarregado = false;

  let estado = {
    modo: "texto",
    texto: "",
    linha_atual: 0,
    concluidas: [],
    sync_contador: true,
    arquivo_nome: "",
    arquivo_tipo: "",
    arquivo_url: "",
    regua_pct: 18
  };

  // Zoom / Pan tátil na foto da receita (pinça + toque duplo + arraste)
  const zoomImg = { escala: 1, x: 0, y: 0 };
  let timerBadgeZoomRec = null;

  function aplicarTransformImgReceita(mostrarBadge = false) {
    const imgEl = document.getElementById("img-receita-global");
    const palco = document.getElementById("palco-arquivo-receita-global");
    if (!imgEl) return;
    if (zoomImg.escala <= 1.01) {
      zoomImg.escala = 1;
      zoomImg.x = 0;
      zoomImg.y = 0;
      imgEl.style.transform = "";
      palco?.classList.remove("img-com-zoom");
    } else {
      imgEl.style.transform = `translate3d(${Math.round(zoomImg.x)}px, ${Math.round(zoomImg.y)}px, 0) scale(${zoomImg.escala.toFixed(3)})`;
      palco?.classList.add("img-com-zoom");
    }

    if (mostrarBadge && palco) {
      let badge = document.getElementById("badge-zoom-receita-touch");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "badge-zoom-receita-touch";
        badge.className = "badge-zoom-receita-touch";
        badge.setAttribute("aria-live", "polite");
        palco.appendChild(badge);
      }
      badge.textContent = `${Math.round(zoomImg.escala * 100)}%`;
      badge.classList.add("visivel");
      clearTimeout(timerBadgeZoomRec);
      timerBadgeZoomRec = setTimeout(() => badge.classList.remove("visivel"), 900);
    }
  }

  function resetarZoomImgReceita() {
    zoomImg.escala = 1;
    zoomImg.x = 0;
    zoomImg.y = 0;
    aplicarTransformImgReceita(false);
  }

  function escapeHtml(texto) {
    return String(texto || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ==========================================================================
  // BASE DE SIGLAS PARA POPOVER INSTANTÂNEO (ESTILO RIBBLR)
  // ==========================================================================
  const SIGLAS_IGNORADAS = new Set([
    "c", "v", "m", "t", "p", "k", "r", "l", "f", "b", "a", "e", "o", "x", "de", "em", "no", "na", "por"
  ]);

  function montarMapaSiglas(termos) {
    if (!Array.isArray(termos) || termos.length === 0) return;
    const novoMapa = new Map();
    const chaves = [];

    termos.forEach((termo) => {
      if (!termo || !termo.siglas) return;
      ["pt", "us", "uk", "es"].forEach((lang) => {
        const arr = termo.siglas[lang];
        if (!Array.isArray(arr)) return;
        arr.forEach((raw) => {
          const limpo = String(raw || "").trim().replace(/\.$/, "");
          const key = limpo.toLowerCase();
          if (key.length < 2 || SIGLAS_IGNORADAS.has(key)) return;
          if (!novoMapa.has(key)) {
            novoMapa.set(key, termo);
            chaves.push(limpo);
          }
        });
      });
    });

    // Ordena do mais longo ao mais curto para casar "sl st" / "sc2tog" antes de "sc"
    chaves.sort((a, b) => b.length - a.length);
    const escapadas = chaves.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (escapadas.length > 0) {
      mapaSiglas = novoMapa;
      regexSiglas = new RegExp(`(^|[^a-zA-ZÀ-ÿ0-9_])(${escapadas.join("|")})(?=$|[^a-zA-ZÀ-ÿ0-9_])`, "gi");
    }
  }

  async function garantirDicionarioSiglas() {
    if (dicionarioCarregado && mapaSiglas.size > 0) return;
    dicionarioCarregado = true;
    try {
      let termos = [];
      if (typeof TradutorReceitas !== "undefined" && typeof TradutorReceitas.garantirBaseDicionario === "function") {
        termos = await TradutorReceitas.garantirBaseDicionario();
      } else {
        const resp = await fetch("data/dicionario-pontos.json");
        if (resp.ok) {
          const json = await resp.json();
          termos = json.termos || [];
        }
      }
      if (Array.isArray(termos) && termos.length > 0) {
        montarMapaSiglas(termos);
        renderizar();
      }
    } catch {
      // ignora silenciosamente se offline sem cache ainda
    }
  }

  function formatarTextoComSiglas(texto) {
    const seguro = escapeHtml(texto);
    if (!regexSiglas || mapaSiglas.size === 0) return seguro;
    regexSiglas.lastIndex = 0;
    return seguro.replace(regexSiglas, (match, prefixo, token) => {
      const key = String(token || "").toLowerCase();
      const termo = mapaSiglas.get(key);
      if (!termo) return match;
      return `${prefixo}<button type="button" class="chip-sigla-receita" data-sigla-chave="${escapeHtml(key)}" title="Ver explicação de ${escapeHtml(token)}">${token}</button>`;
    });
  }

  function analisarLinhaReceita(linhaBruta) {
    let restante = String(linhaBruta || "").trim();
    let badgeCarreira = "";
    let badgePontos = "";

    // Reconhece cabeçalho de carreira: "Carr 4:", "Carreira 4-8:", "R4:", "Row 4:", "Rnd 4:", "Vta 4:"
    const mCarr = restante.match(/^((?:carr(?:eira)?s?|r(?:ow|nd)?|vta|volta|fila)\s*\d+(?:\s*[-–a]\s*\d+)?)\s*[:.-]\s*/i);
    if (mCarr) {
      badgeCarreira = mCarr[1].trim();
      restante = restante.slice(mCarr[0].length).trim();
    }

    // Reconhece total esperado de pontos no fim: "[24]", "[24 pts]", "(24)", "(24 pts)", "= 24 pts"
    const mPts = restante.match(/(?:\[(\d+)\s*(?:pts?|pontos?|sts?)?\]|\((\d+)\s*(?:pts?|pontos?|sts?)?\)|=\s*(\d+)\s*(?:pts?|pontos?|sts?))\s*$/i);
    if (mPts) {
      const num = mPts[1] || mPts[2] || mPts[3];
      if (num) {
        badgePontos = `${num} pts`;
        restante = restante.slice(0, mPts.index).trim();
      }
    }

    return { badgeCarreira, badgePontos, corpo: restante || linhaBruta };
  }

  function abrirPopoverPonto(chave, ancoraEl) {
    const pop = document.getElementById("popover-ponto-receita");
    const termo = mapaSiglas.get(String(chave || "").toLowerCase());
    if (!pop || !termo) return;

    const nomePt = termo.nomes?.pt || termo.id;
    const tec = termo.tecnica === "trico" ? "Tricô" : termo.tecnica === "ambos" ? "Crochê / Tricô" : "Crochê";
    const ptS = (termo.siglas?.pt || []).slice(0, 3).join(", ");
    const usS = (termo.siglas?.us || []).slice(0, 3).join(", ");
    const ukS = (termo.siglas?.uk || []).slice(0, 3).join(", ");
    const esS = (termo.siglas?.es || []).slice(0, 3).join(", ");

    const elTit = document.getElementById("popover-ponto-titulo");
    const elTec = document.getElementById("popover-ponto-tecnica");
    const elDesc = document.getElementById("popover-ponto-desc");
    const elIdiomas = document.getElementById("popover-ponto-idiomas");

    if (elTit) elTit.textContent = nomePt;
    if (elTec) elTec.textContent = tec;
    if (elDesc) elDesc.textContent = termo.descricao || termo.nomes?.us || "";
    if (elIdiomas) {
      elIdiomas.innerHTML = [
        ptS ? `<span><strong>PT:</strong> ${escapeHtml(ptS)}</span>` : "",
        usS ? `<span><strong>US:</strong> ${escapeHtml(usS)}</span>` : "",
        ukS ? `<span><strong>UK:</strong> ${escapeHtml(ukS)}</span>` : "",
        esS ? `<span><strong>ES:</strong> ${escapeHtml(esS)}</span>` : ""
      ].filter(Boolean).join("");
    }

    pop.style.display = "flex";
    pop.setAttribute("aria-hidden", "false");

    // Posiciona próximo ao chip clicado sem sair da janela
    if (ancoraEl && typeof ancoraEl.getBoundingClientRect === "function") {
      const rect = ancoraEl.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(12, Math.min(vw - popRect.width - 12, left));
      let top = rect.bottom + 8;
      if (top + popRect.height > vh - 12) {
        top = Math.max(12, rect.top - popRect.height - 8);
      }
      pop.style.left = `${Math.round(left)}px`;
      pop.style.top = `${Math.round(top)}px`;
    }
  }

  function fecharPopoverPonto() {
    const pop = document.getElementById("popover-ponto-receita");
    if (pop) {
      pop.style.display = "none";
      pop.setAttribute("aria-hidden", "true");
    }
  }

  function persistir() {
    if (typeof ProjetoContexto !== "undefined" && ProjetoContexto.estaHidratando()) return;

    if (typeof ProjetoContexto !== "undefined" && ProjetoContexto.obterProjetoAtivo()) {
      ProjetoContexto.atualizarSecaoAtiva("receita", { ...estado }, { origem: "receitas" });
      return;
    }

    try {
      localStorage.setItem(STORAGE_AVULSO, JSON.stringify(estado));
    } catch {
      // ignora limite de quota em arquivos muito grandes
    }
  }

  function alternarConclusaoLinha(idx, totalLinhas) {
    if (!Array.isArray(estado.concluidas)) estado.concluidas = [];
    const set = new Set(estado.concluidas);
    const marcando = !set.has(idx);

    if (marcando) {
      set.add(idx);
      if (idx + 1 < totalLinhas) {
        estado.linha_atual = idx + 1;
      } else {
        estado.linha_atual = idx;
      }
      if (estado.sync_contador && typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.incrementarPrincipal === "function") {
        ContadorCarreiras.incrementarPrincipal("receitas");
      }
    } else {
      set.delete(idx);
      estado.linha_atual = idx;
      if (estado.sync_contador && typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.decrementarPrincipal === "function") {
        ContadorCarreiras.decrementarPrincipal("receitas");
      }
    }

    estado.concluidas = Array.from(set).filter((n) => n >= 0 && n < totalLinhas).sort((a, b) => a - b);
    if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(marcando ? 16 : 10);
    renderizar();
    persistir();
  }

  function renderizar() {
    const modo = ["texto", "arquivo", "tradutor", "dicionario"].includes(estado.modo) ? estado.modo : "texto";
    document.querySelectorAll("#secao-receitas .btn-modo-receita").forEach((btn) => {
      const ativo = btn.dataset.modoReceita === modo;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-selected", ativo ? "true" : "false");
    });

    const pTexto = document.getElementById("painel-receita-texto");
    const pArq = document.getElementById("painel-receita-arquivo");
    const pTrad = document.getElementById("painel-receita-tradutor");
    const pDic = document.getElementById("painel-receita-dicionario");
    if (pTexto) pTexto.style.display = modo === "texto" ? "grid" : "none";
    if (pArq) pArq.style.display = modo === "arquivo" ? "flex" : "none";
    if (pTrad) pTrad.style.display = modo === "tradutor" ? "flex" : "none";
    if (pDic) pDic.style.display = modo === "dicionario" ? "flex" : "none";

    if ((modo === "tradutor" || modo === "dicionario") && typeof TradutorReceitas !== "undefined") {
      TradutorReceitas.init();
    }

    // Texto e linhas clicáveis estilo Ribblr
    const ta = document.getElementById("input-receita-texto-global");
    if (ta && ta.value !== estado.texto) ta.value = estado.texto;

    const chkSync = document.getElementById("chk-ribblr-sync-contador");
    if (chkSync) {
      chkSync.checked = estado.sync_contador !== false;
      // Injeta botão "🧶 Conferir Estoque" ao lado do controle do Leitor Ribblr
      const barraSync = chkSync.closest("label")?.parentElement;
      if (barraSync && !document.getElementById("btn-conferir-estoque-receita")) {
        const btnEst = document.createElement("button");
        btnEst.type = "button";
        btnEst.id = "btn-conferir-estoque-receita";
        btnEst.className = "btn-conferir-estoque-receita";
        btnEst.title = "Comparar fios pedidos na receita com seu Estoque de Fios";
        btnEst.innerHTML = "🧶 Conferir Estoque";
        btnEst.addEventListener("click", abrirModalConferenciaEstoque);
        barraSync.appendChild(btnEst);
      }
    }

    const lista = document.getElementById("lista-linhas-receita-global");
    const info = document.getElementById("info-linha-atual-global");
    const progTxt = document.getElementById("ribblr-progresso-texto");
    const progFill = document.getElementById("ribblr-progresso-fill");
    const linhas = (estado.texto || "").split("\n").filter((l) => l.trim() !== "");

    if (!Array.isArray(estado.concluidas)) estado.concluidas = [];
    const setConcluidas = new Set(estado.concluidas.filter((n) => n >= 0 && n < linhas.length));

    if (lista) {
      lista.innerHTML = "";
      if (linhas.length === 0) {
        lista.innerHTML = `<div class="vazio-linhas-receita">Cole ou escreva sua receita ao lado: cada carreira vira um checklist interativo com siglas clicáveis.</div>`;
        if (info) info.textContent = "Toque em ✓ para riscar a carreira ou clique em qualquer sigla (pb, mpa, aum...)";
        if (progTxt) progTxt.textContent = "0 / 0 carreiras (0%)";
        if (progFill) progFill.style.width = "0%";
      } else {
        const atual = Math.max(0, Math.min(estado.linha_atual || 0, linhas.length - 1));
        estado.linha_atual = atual;
        const pct = Math.round((setConcluidas.size / linhas.length) * 100);
        if (info) info.textContent = `Linha atual: ${atual + 1} de ${linhas.length} • Toque nas siglas para ver o ponto`;
        if (progTxt) progTxt.textContent = `${setConcluidas.size} / ${linhas.length} concluídas (${pct}%)`;
        if (progFill) progFill.style.width = `${pct}%`;

        linhas.forEach((linhaTxt, idx) => {
          const feita = setConcluidas.has(idx);
          const analisada = analisarLinhaReceita(linhaTxt);

          const item = document.createElement("div");
          item.className = `linha-receita-item ribblr-item ${idx === atual ? "atual" : ""} ${feita ? "concluida riscada" : ""}`;
          item.setAttribute("role", "button");
          item.setAttribute("tabindex", "0");

          const badgeCarrHtml = analisada.badgeCarreira
            ? `<span class="ribblr-badge-carreira">${escapeHtml(analisada.badgeCarreira)}</span>`
            : `<span class="linha-receita-num">${idx + 1}.</span>`;
          const badgePtsHtml = analisada.badgePontos
            ? `<span class="ribblr-badge-pontos">${escapeHtml(analisada.badgePontos)}</span>`
            : "";

          item.innerHTML = `
            <button type="button" class="ribblr-check-btn ${feita ? "marcado" : ""}" aria-label="${feita ? "Desmarcar carreira" : "Marcar carreira como concluída"}" title="${feita ? "Desmarcar" : "Concluir carreira (+1 no Contador)"}">${feita ? "✓" : ""}</button>
            <div class="ribblr-linha-conteudo">
              ${badgeCarrHtml}
              <span class="ribblr-linha-texto">${formatarTextoComSiglas(analisada.corpo)}</span>
              ${badgePtsHtml}
            </div>
          `;

          const btnCheck = item.querySelector(".ribblr-check-btn");
          btnCheck?.addEventListener("click", (e) => {
            e.stopPropagation();
            alternarConclusaoLinha(idx, linhas.length);
          });

          item.querySelectorAll(".chip-sigla-receita").forEach((chip) => {
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              abrirPopoverPonto(chip.dataset.siglaChave, chip);
            });
          });

          item.addEventListener("click", () => {
            estado.linha_atual = idx;
            renderizar();
            persistir();
          });

          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              alternarConclusaoLinha(idx, linhas.length);
            }
          });

          lista.appendChild(item);
        });
      }
    }

    // Arquivo (PDF / Imagem + Régua)
    const nomeEl = document.getElementById("nome-arquivo-receita-global");
    const ctrlRegua = document.getElementById("controle-regua-global");
    const sliderRegua = document.getElementById("slider-regua-receita-global");
    const vazioViewer = document.getElementById("vazio-viewer-receita-global");
    const palco = document.getElementById("palco-arquivo-receita-global");
    const imgEl = document.getElementById("img-receita-global");
    const pdfEl = document.getElementById("pdf-receita-global");
    const reguaEl = document.getElementById("regua-marcadora-global");

    if (nomeEl) nomeEl.textContent = estado.arquivo_nome || "Nenhum arquivo carregado";
    if (sliderRegua) sliderRegua.value = Math.round(estado.regua_pct || 18);
    if (reguaEl) reguaEl.style.top = `${estado.regua_pct || 18}%`;

    const temArquivo = Boolean(estado.arquivo_url);
    if (ctrlRegua) ctrlRegua.style.display = temArquivo ? "flex" : "none";
    if (vazioViewer) vazioViewer.style.display = temArquivo ? "none" : "flex";
    if (palco) palco.style.display = temArquivo ? "flex" : "none";

    if (temArquivo) {
      const isPdf = (estado.arquivo_tipo || "").includes("pdf") || estado.arquivo_url.startsWith("data:application/pdf");
      if (imgEl) {
        imgEl.style.display = isPdf ? "none" : "block";
        if (!isPdf) imgEl.src = estado.arquivo_url;
      }
      if (pdfEl) {
        pdfEl.style.display = isPdf ? "block" : "none";
        if (isPdf) pdfEl.src = estado.arquivo_url;
      }
    }
  }

  function carregarDoProjeto(projeto) {
    if (!projeto) return;
    const rec = projeto.receita || {};
    estado = {
      modo: rec.modo === "arquivo" ? "arquivo" : "texto",
      texto: String(rec.texto || ""),
      linha_atual: Math.max(0, parseInt(rec.linha_atual, 10) || 0),
      concluidas: Array.isArray(rec.concluidas) ? rec.concluidas : [],
      sync_contador: rec.sync_contador !== false,
      arquivo_nome: String(rec.arquivo_nome || ""),
      arquivo_tipo: String(rec.arquivo_tipo || ""),
      arquivo_url: String(rec.arquivo_url || ""),
      regua_pct: rec.regua_pct !== undefined ? Number(rec.regua_pct) : 18
    };
    renderizar();
  }

  function vincularEventos() {
    document.querySelectorAll("#secao-receitas .btn-modo-receita").forEach((btn) => {
      btn.addEventListener("click", () => {
        const alvo = btn.dataset.modoReceita || "texto";
        estado.modo = ["texto", "arquivo", "tradutor", "dicionario"].includes(alvo) ? alvo : "texto";
        fecharPopoverPonto();
        renderizar();
        if (estado.modo === "texto" || estado.modo === "arquivo") {
          persistir();
        }
      });
    });

    document.getElementById("input-receita-texto-global")?.addEventListener("input", (e) => {
      estado.texto = e.target.value;
      renderizar();
      persistir();
    });

    document.getElementById("btn-receita-limpar-texto")?.addEventListener("click", () => {
      estado.texto = "";
      estado.linha_atual = 0;
      estado.concluidas = [];
      fecharPopoverPonto();
      renderizar();
      persistir();
    });

    document.getElementById("chk-ribblr-sync-contador")?.addEventListener("change", (e) => {
      estado.sync_contador = Boolean(e.target.checked);
      persistir();
    });

    document.getElementById("btn-ribblr-reiniciar-checks")?.addEventListener("click", () => {
      estado.concluidas = [];
      estado.linha_atual = 0;
      renderizar();
      persistir();
    });

    document.getElementById("btn-receita-linha-ant")?.addEventListener("click", () => {
      estado.linha_atual = Math.max(0, (estado.linha_atual || 0) - 1);
      renderizar();
      persistir();
    });

    document.getElementById("btn-receita-linha-prox")?.addEventListener("click", () => {
      const total = (estado.texto || "").split("\n").filter((l) => l.trim() !== "").length;
      if (total <= 0) return;
      const atual = Math.max(0, Math.min(estado.linha_atual || 0, total - 1));
      if (!Array.isArray(estado.concluidas)) estado.concluidas = [];
      if (!estado.concluidas.includes(atual)) {
        alternarConclusaoLinha(atual, total);
      } else {
        estado.linha_atual = Math.min(total - 1, atual + 1);
        renderizar();
        persistir();
      }
    });

    document.getElementById("btn-fechar-popover-ponto")?.addEventListener("click", fecharPopoverPonto);
    document.addEventListener("click", (e) => {
      const pop = document.getElementById("popover-ponto-receita");
      if (!pop || pop.style.display !== "flex") return;
      if (!pop.contains(e.target) && !e.target.closest?.(".chip-sigla-receita")) {
        fecharPopoverPonto();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharPopoverPonto();
    });

    document.getElementById("input-receita-arquivo-global")?.addEventListener("change", (e) => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      const reader = new FileReader();
      reader.onload = () => {
        estado.modo = "arquivo";
        estado.arquivo_nome = arq.name;
        estado.arquivo_tipo = arq.type || "";
        estado.arquivo_url = reader.result;
        renderizar();
        persistir();
      };
      reader.readAsDataURL(arq);
      e.target.value = "";
    });

    document.getElementById("slider-regua-receita-global")?.addEventListener("input", (e) => {
      estado.regua_pct = Number(e.target.value) || 18;
      const reguaEl = document.getElementById("regua-marcadora-global");
      if (reguaEl) reguaEl.style.top = `${estado.regua_pct}%`;
      persistir();
    });

    // Arrastar a régua "Onde parei" diretamente com o dedo ou mouse
    const reguaEl = document.getElementById("regua-marcadora-global");
    const palcoEl = document.getElementById("palco-arquivo-receita-global");
    if (reguaEl && palcoEl) {
      let arrastandoRegua = false;
      const atualizarPosicaoRegua = (clientY) => {
        const rect = palcoEl.getBoundingClientRect();
        if (rect.height <= 0) return;
        const pct = Math.max(2, Math.min(94, ((clientY - rect.top - 18) / rect.height) * 100));
        estado.regua_pct = Math.round(pct * 10) / 10;
        reguaEl.style.top = `${estado.regua_pct}%`;
        const slider = document.getElementById("slider-regua-receita-global");
        if (slider) slider.value = String(Math.round(estado.regua_pct));
      };

      reguaEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        arrastandoRegua = true;
        reguaEl.classList.add("arrastando");
        reguaEl.setPointerCapture?.(e.pointerId);
        atualizarPosicaoRegua(e.clientY);
      });
      reguaEl.addEventListener("pointermove", (e) => {
        if (!arrastandoRegua) return;
        e.preventDefault();
        atualizarPosicaoRegua(e.clientY);
      });
      const encerrarRegua = () => {
        if (!arrastandoRegua) return;
        arrastandoRegua = false;
        reguaEl.classList.remove("arrastando");
        persistir();
      };
      reguaEl.addEventListener("pointerup", encerrarRegua);
      reguaEl.addEventListener("pointercancel", encerrarRegua);
    }

    // Pinça para Zoom (2 dedos) + Pan + Toque Duplo na foto da receita
    const imgEl = document.getElementById("img-receita-global");
    if (imgEl) {
      const toques = new Map();
      let pinchIni = null;
      let panIni = null;
      let ultimoToqueImgMs = 0;

      imgEl.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") return;
        toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
        imgEl.setPointerCapture?.(e.pointerId);

        if (toques.size === 2) {
          const [a, b] = Array.from(toques.values());
          pinchIni = {
            dist: Math.max(12, Math.hypot(b.x - a.x, b.y - a.y)),
            midX: (a.x + b.x) / 2,
            midY: (a.y + b.y) / 2,
            escala: zoomImg.escala,
            x: zoomImg.x,
            y: zoomImg.y
          };
          panIni = null;
        } else if (toques.size === 1) {
          const agora = Date.now();
          if (agora - ultimoToqueImgMs < 300) {
            ultimoToqueImgMs = 0;
            if (zoomImg.escala > 1.1) {
              resetarZoomImgReceita();
            } else {
              zoomImg.escala = 2.2;
              zoomImg.x = 0;
              zoomImg.y = 0;
              aplicarTransformImgReceita(true);
            }
            if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(12);
            return;
          }
          ultimoToqueImgMs = agora;
          if (zoomImg.escala > 1.05) {
            panIni = { x: e.clientX, y: e.clientY, ox: zoomImg.x, oy: zoomImg.y };
          }
        }
      });

      imgEl.addEventListener("pointermove", (e) => {
        if (!toques.has(e.pointerId)) return;
        toques.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (toques.size === 2 && pinchIni) {
          e.preventDefault();
          const [a, b] = Array.from(toques.values());
          const dist = Math.max(12, Math.hypot(b.x - a.x, b.y - a.y));
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          zoomImg.escala = Math.max(1, Math.min(4, pinchIni.escala * (dist / pinchIni.dist)));
          zoomImg.x = pinchIni.x + (midX - pinchIni.midX);
          zoomImg.y = pinchIni.y + (midY - pinchIni.midY);
          aplicarTransformImgReceita(true);
        } else if (toques.size === 1 && panIni && zoomImg.escala > 1.05) {
          e.preventDefault();
          zoomImg.x = panIni.ox + (e.clientX - panIni.x);
          zoomImg.y = panIni.oy + (e.clientY - panIni.y);
          aplicarTransformImgReceita(false);
        }
      });

      const soltarImg = (e) => {
        toques.delete(e.pointerId);
        if (toques.size < 2) pinchIni = null;
        if (toques.size === 0) panIni = null;
      };
      imgEl.addEventListener("pointerup", soltarImg);
      imgEl.addEventListener("pointercancel", soltarImg);
    }

    document.getElementById("btn-remover-arquivo-receita-global")?.addEventListener("click", () => {
      estado.arquivo_nome = "";
      estado.arquivo_tipo = "";
      estado.arquivo_url = "";
      resetarZoomImgReceita();
      renderizar();
      persistir();
    });
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    vincularEventos();
    garantirDicionarioSiglas();

    const ativo = typeof ProjetoContexto !== "undefined" ? ProjetoContexto.obterProjetoAtivo() : null;
    if (ativo) {
      carregarDoProjeto(ativo);
      return;
    }

    try {
      const salvo = localStorage.getItem(STORAGE_AVULSO);
      if (salvo) estado = { ...estado, ...JSON.parse(salvo) };
    } catch {
      // ignora
    }
    renderizar();
  }

  function definirTexto(novoTexto) {
    estado.texto = String(novoTexto || "");
    estado.linha_atual = 0;
    estado.concluidas = [];
    estado.modo = "texto";
    garantirDicionarioSiglas();
    renderizar();
    persistir();
  }

  async function abrirModalConferenciaEstoque() {
    const fios = typeof BancoDadosPT !== "undefined" ? await BancoDadosPT.obterTodos("fios") : [];
    const txt = (estado.texto || "").toLowerCase();
    // Extrai menções a gramas, metros, tex ou nomes de cores/fios na receita
    const matchGramas = txt.match(/(\d+)\s*g\b/);
    const matchMetros = txt.match(/(\d+)\s*m(?:etros)?\b/);
    const matchTex = txt.match(/tex\s*(\d+)/i);
    const gramasPedidas = matchGramas ? Number(matchGramas[1]) : 0;
    const metrosPedidos = matchMetros ? Number(matchMetros[1]) : 0;
    const texPedido = matchTex ? Number(matchTex[1]) : 0;

    const disponiveis = (fios || []).filter((f) => (Number(f.quantidade) || 0) > 0);
    const compativeis = disponiveis.filter((f) => {
      const nomeMatch = f.nome && txt.includes(String(f.nome).toLowerCase());
      const corMatch = f.cor_nome && txt.includes(String(f.cor_nome).toLowerCase());
      const texMatch = texPedido > 0 && f.tex && Math.abs(Number(f.tex) - texPedido) <= 120;
      return nomeMatch || corMatch || texMatch;
    });
    const exibir = compativeis.length > 0 ? compativeis : disponiveis.slice(0, 8);

    let modal = document.getElementById("modal-conferir-estoque-rec");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-conferir-estoque-rec";
      modal.className = "modal-overlay-atelie-pro";
      document.body.appendChild(modal);
    }

    const resumoRequisitos = [
      gramasPedidas ? `~${gramasPedidas}g detectados` : null,
      metrosPedidos ? `~${metrosPedidos}m detectados` : null,
      texPedido ? `TEX ~${texPedido}` : null
    ].filter(Boolean).join(" • ") || "Comparação rápida com os fios disponíveis na sua prateleira";

    modal.innerHTML = `
      <div class="modal-box-atelie-pro" style="max-width:560px" role="dialog" aria-modal="true">
        <div class="modal-topo-atelie-pro">
          <div>
            <span class="etiqueta-tecido-atelie">CONFERÊNCIA DE MATERIAIS</span>
            <h3>🧶 Fios do Estoque para esta Receita</h3>
          </div>
          <button type="button" class="btn-fechar-atelie-pro" id="btn-fechar-conf-estoque">✕</button>
        </div>
        <div class="modal-corpo-atelie-pro" style="display:flex;flex-direction:column;gap:10px">
          <p style="font-size:12.5px;opacity:0.86">${escapeHtml(resumoRequisitos)}</p>
          ${
            exibir.length === 0
              ? `<div class="snapshot-vazio">Seu estoque de fios está vazio no momento. Cadastre seus novelos na aba Fios!</div>`
              : exibir
                  .map((f) => {
                    const gTotal = Math.round((Number(f.quantidade) || 0) * (Number(f.peso_novelo_g) || 100));
                    const suficiente = !gramasPedidas || gTotal >= gramasPedidas;
                    return `
                      <div class="snapshot-item-linha">
                        <div class="snapshot-item-info">
                          <strong>${escapeHtml(f.nome || "Fio")} — ${escapeHtml(f.cor_nome || "")} (${escapeHtml(f.marca || "")})</strong>
                          <span>Estoque: ${Number(f.quantidade) || 0} un (~${gTotal}g) ${f.tex ? `• TEX ${escapeHtml(f.tex)}` : ""}</span>
                        </div>
                        <span class="etiqueta-tecido-atelie" style="opacity:${suficiente ? 1 : 0.7}">${suficiente ? "✓ Suficiente" : "⚠ Pouco saldo"}</span>
                      </div>
                    `;
                  })
                  .join("")
          }
        </div>
      </div>
    `;
    modal.style.display = "flex";
    document.getElementById("btn-fechar-conf-estoque")?.addEventListener("click", () => {
      modal.style.display = "none";
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }

  function alternarModo(novoModo) {
    estado.modo = ["texto", "arquivo", "tradutor", "dicionario"].includes(novoModo) ? novoModo : "texto";
    fecharPopoverPonto();
    renderizar();
    if (estado.modo === "texto" || estado.modo === "arquivo") {
      persistir();
    }
  }

  return {
    init,
    carregarDoProjeto,
    definirTexto,
    alternarModo
  };
})();
