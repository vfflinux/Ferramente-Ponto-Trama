// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: RECEITAS E ANOTAÇÕES
// - Modo Texto & Passos: editor + marcador interativo de linha atual
// - Modo PDF / Foto: visualizador + régua destacada "Onde parei"
// - Ligado automaticamente ao Projeto Ativo via ProjetoContexto
// ==========================================================================

const LeitorReceitas = (() => {
  const STORAGE_AVULSO = "ponto_trama_receita_avulsa";

  let jaInicializado = false;
  let estado = {
    modo: "texto",
    texto: "",
    linha_atual: 0,
    arquivo_nome: "",
    arquivo_tipo: "",
    arquivo_url: "",
    regua_pct: 18
  };

  function escapeHtml(texto) {
    return String(texto || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

    // Texto e linhas clicáveis
    const ta = document.getElementById("input-receita-texto-global");
    if (ta && ta.value !== estado.texto) ta.value = estado.texto;

    const lista = document.getElementById("lista-linhas-receita-global");
    const info = document.getElementById("info-linha-atual-global");
    const linhas = (estado.texto || "").split("\n").filter((l) => l.trim() !== "");

    if (lista) {
      lista.innerHTML = "";
      if (linhas.length === 0) {
        lista.innerHTML = `<div class="vazio-linhas-receita">Digite sua receita ao lado para ativar o marcador interativo de linha.</div>`;
        if (info) info.textContent = "Clique em qualquer linha para marcar seu progresso";
      } else {
        const atual = Math.max(0, Math.min(estado.linha_atual || 0, linhas.length - 1));
        estado.linha_atual = atual;
        if (info) info.textContent = `Linha atual: ${atual + 1} de ${linhas.length}`;

        linhas.forEach((linhaTxt, idx) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `linha-receita-item ${idx === atual ? "atual" : idx < atual ? "concluida" : ""}`;
          btn.innerHTML = `<span class="linha-receita-num">${idx + 1}.</span><span>${escapeHtml(linhaTxt)}</span>`;
          btn.addEventListener("click", () => {
            estado.linha_atual = idx;
            renderizar();
            persistir();
          });
          lista.appendChild(btn);
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
      estado.linha_atual = Math.min(total - 1, (estado.linha_atual || 0) + 1);
      renderizar();
      persistir();
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

    document.getElementById("btn-remover-arquivo-receita-global")?.addEventListener("click", () => {
      estado.arquivo_nome = "";
      estado.arquivo_tipo = "";
      estado.arquivo_url = "";
      renderizar();
      persistir();
    });
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    vincularEventos();

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
    estado.modo = "texto";
    renderizar();
    persistir();
  }

  return {
    init,
    carregarDoProjeto,
    definirTexto
  };
})();
