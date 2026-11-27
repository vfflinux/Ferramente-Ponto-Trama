// ==========================================================================
// PONTO & TRAMA — FACILITADORES PROFISSIONAIS DO ATELIÊ (HISTÓRICO, SNAPSHOTS,
// DRAG & DROP UNIVERSAL, FICHA TÉCNICA / ORÇAMENTO PDF E MINI-JANELA NO TOPO)
// - Desfazer / Refazer Global (Ctrl+Z / Ctrl+Y) + Toast interativo com botão "↩ Desfazer"
// - Snapshots Automáticos Locais (Backup Rotativo dos últimos 5 pontos de restauração)
// - Drag & Drop Nativo (Fotos, PDFs, Receitas .txt/.md e Backups .json soltos na janela)
// - Exportador de Ficha Técnica & Orçamento em PDF Limpo (pronto p/ WhatsApp / Impressão)
// - Mini-Janela "Sempre no Topo" (integração nativa com GTK3 no Ubuntu Desktop + modo compacto)
// ==========================================================================

const HistoricoAcoes = (() => {
  const CHAVE_SNAPSHOTS = "ponto_trama_snapshots_v1";
  const MAX_UNDO = 25;
  const MAX_SNAPSHOTS = 5;

  const pilhaUndo = [];
  const pilhaRedo = [];
  let timerToast = null;
  let ultimoSnapshotAutoTs = 0;
  let miniJanelaAtiva = false;
  let jaInicializado = false;

  function escapeHtml(txt) {
    return String(txt == null ? "" : txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================================
  // 1. DESFAZER / REFAZER GLOBAL (Ctrl+Z / Ctrl+Y) + TOAST COM "↩ DESFAZER"
  // ==========================================================================
  function garantirToastDOM() {
    let el = document.getElementById("toast-historico-global");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast-historico-global";
      el.className = "toast-historico-global";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }

  function mostrarToastAcao(mensagem, comBotaoDesfazer = false) {
    const el = garantirToastDOM();
    if (timerToast) clearTimeout(timerToast);

    el.innerHTML = `
      <span class="toast-hist-msg">${escapeHtml(mensagem)}</span>
      ${
        comBotaoDesfazer && pilhaUndo.length > 0
          ? `<button type="button" class="btn-toast-desfazer" id="btn-toast-desfazer-agora">↩ Desfazer <kbd>Ctrl+Z</kbd></button>`
          : ""
      }
    `;
    el.classList.add("visivel");

    document.getElementById("btn-toast-desfazer-agora")?.addEventListener("click", () => {
      desfazer();
    });

    timerToast = setTimeout(() => {
      el.classList.remove("visivel");
    }, comBotaoDesfazer ? 5200 : 3000);
  }

  function registrar(acao) {
    if (!acao || typeof acao.desfazer !== "function") return;
    pilhaUndo.push({
      titulo: acao.titulo || "Ação realizada",
      desfazer: acao.desfazer,
      refazer: typeof acao.refazer === "function" ? acao.refazer : null,
      ts: Date.now()
    });
    if (pilhaUndo.length > MAX_UNDO) pilhaUndo.shift();
    pilhaRedo.length = 0;

    if (acao.mostrarToast !== false) {
      mostrarToastAcao(acao.titulo || "Alteração salva", true);
    }
    // Aproveita alterações relevantes para manter snapshot rotativo atualizado
    if (acao.criarSnapshot) {
      salvarSnapshotAutomatico(acao.titulo || "Alteração no ateliê", false);
    }
  }

  async function desfazer() {
    if (pilhaUndo.length === 0) {
      mostrarToastAcao("Nada para desfazer no momento.", false);
      return false;
    }
    const item = pilhaUndo.pop();
    try {
      await item.desfazer();
      if (item.refazer) pilhaRedo.push(item);
      if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(14);
      mostrarToastAcao(`↩ Desfeito: ${item.titulo}`, false);
      return true;
    } catch (e) {
      console.warn("[HistoricoAcoes] Erro ao desfazer:", e);
      mostrarToastAcao("Não foi possível desfazer esta ação.", false);
      return false;
    }
  }

  async function refazer() {
    if (pilhaRedo.length === 0) return false;
    const item = pilhaRedo.pop();
    try {
      if (item.refazer) {
        await item.refazer();
        pilhaUndo.push(item);
        mostrarToastAcao(`↪ Refeito: ${item.titulo}`, false);
        return true;
      }
    } catch (e) {
      console.warn("[HistoricoAcoes] Erro ao refazer:", e);
    }
    return false;
  }

  // ==========================================================================
  // 2. SNAPSHOTS AUTOMÁTICOS LOCAIS (BACKUP ROTATIVO — 5 PONTOS DE RESTAURAÇÃO)
  // ==========================================================================
  function obterSnapshots() {
    try {
      const raw = localStorage.getItem(CHAVE_SNAPSHOTS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async function coletarEstadoCompleto() {
    let fios = [];
    let bib = [];
    let amostras = [];
    let projetos = [];
    if (typeof BancoDadosPT !== "undefined") {
      [fios, bib, amostras, projetos] = await Promise.all([
        BancoDadosPT.obterTodos("fios"),
        BancoDadosPT.obterTodos("itens_biblioteca"),
        BancoDadosPT.obterTodos("banco_amostras"),
        BancoDadosPT.obterTodos("projetos")
      ]);
    }
    let contadores = [];
    try {
      contadores = JSON.parse(localStorage.getItem("ponto_trama_contadores") || "[]");
    } catch {
      contadores = [];
    }
    const receitaAvulsa = localStorage.getItem("ponto_trama_receita_avulsa") || "";
    return {
      fios: fios || [],
      itens_biblioteca: bib || [],
      banco_amostras: amostras || [],
      projetos: projetos || [],
      contadores: Array.isArray(contadores) ? contadores : [],
      receita_avulsa: receitaAvulsa
    };
  }

  async function salvarSnapshotAutomatico(motivo = "Ponto automático", forcar = false) {
    const agora = Date.now();
    if (!forcar && agora - ultimoSnapshotAutoTs < 45000) return null;
    ultimoSnapshotAutoTs = agora;

    try {
      const dados = await coletarEstadoCompleto();
      const totalItens =
        dados.projetos.length + dados.fios.length + dados.itens_biblioteca.length + dados.banco_amostras.length;
      if (!forcar && totalItens === 0 && dados.contadores.length === 0) return null;

      const snap = {
        id: `snap-${agora}`,
        dataIso: new Date().toISOString(),
        motivo: String(motivo || "Ponto de restauração").slice(0, 70),
        resumo: `${dados.projetos.length} proj • ${dados.fios.length} fios • ${dados.itens_biblioteca.length} itens • ${dados.banco_amostras.length} amostras`,
        dados
      };

      const lista = obterSnapshots();
      lista.unshift(snap);
      while (lista.length > MAX_SNAPSHOTS) lista.pop();
      localStorage.setItem(CHAVE_SNAPSHOTS, JSON.stringify(lista));
      renderizarListaSnapshotsSeVisivel();
      return snap;
    } catch (e) {
      console.warn("[Snapshots] Aviso ao gravar snapshot local:", e);
      return null;
    }
  }

  async function restaurarSnapshotPorId(snapId) {
    const lista = obterSnapshots();
    const alvo = lista.find((s) => s && s.id === snapId);
    if (!alvo || !alvo.dados || typeof BancoDadosPT === "undefined") return false;

    try {
      const d = alvo.dados;
      await Promise.all([
        BancoDadosPT.substituirColecao("fios", d.fios || []),
        BancoDadosPT.substituirColecao("itens_biblioteca", d.itens_biblioteca || []),
        BancoDadosPT.substituirColecao("banco_amostras", d.banco_amostras || []),
        BancoDadosPT.substituirColecao("projetos", d.projetos || [])
      ]);
      if (Array.isArray(d.contadores)) {
        localStorage.setItem("ponto_trama_contadores", JSON.stringify(d.contadores));
      }
      if (typeof d.receita_avulsa === "string" && d.receita_avulsa) {
        localStorage.setItem("ponto_trama_receita_avulsa", d.receita_avulsa);
      }

      if (typeof Home !== "undefined" && Home.atualizar) Home.atualizar();
      if (typeof GerenciadorProjetos !== "undefined" && GerenciadorProjetos.recarregar) GerenciadorProjetos.recarregar();
      if (typeof InventarioFios !== "undefined" && InventarioFios.recarregar) InventarioFios.recarregar();
      window.dispatchEvent(new CustomEvent("ponto-trama:dados-restaurados"));
      mostrarToastAcao(`✅ Ponto de restauração aplicado (${alvo.motivo})!`, false);
      return true;
    } catch (e) {
      console.error("[Snapshots] Erro ao restaurar snapshot:", e);
      mostrarToastAcao("Erro ao restaurar ponto de backup.", false);
      return false;
    }
  }

  function renderizarListaSnapshotsSeVisivel() {
    const cont = document.getElementById("lista-snapshots-locais");
    if (!cont) return;
    const lista = obterSnapshots();
    if (lista.length === 0) {
      cont.innerHTML = `<div class="snapshot-vazio">Nenhum ponto automático gravado ainda. Clique em "Criar Ponto Agora" para salvar o estado atual.</div>`;
      return;
    }
    cont.innerHTML = lista
      .map((s) => {
        const dt = new Date(s.dataIso);
        const dataFmt = Number.isNaN(dt.getTime())
          ? s.dataIso
          : dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `
          <div class="snapshot-item-linha">
            <div class="snapshot-item-info">
              <strong>${escapeHtml(s.motivo)}</strong>
              <span>🕒 ${escapeHtml(dataFmt)} • ${escapeHtml(s.resumo)}</span>
            </div>
            <button type="button" class="btn-restaurar-snapshot" data-snap-id="${escapeHtml(s.id)}">↺ Restaurar</button>
          </div>
        `;
      })
      .join("");

    cont.querySelectorAll("[data-snap-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-snap-id");
        restaurarSnapshotPorId(id);
      });
    });
  }

  function abrirModalSnapshots() {
    let modal = document.getElementById("modal-snapshots-atelie");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-snapshots-atelie";
      modal.className = "modal-overlay-atelie-pro";
      modal.innerHTML = `
        <div class="modal-box-atelie-pro" style="max-width:600px" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-snapshots">
          <div class="modal-topo-atelie-pro">
            <div>
              <span class="etiqueta-tecido-atelie">PROTEÇÃO LOCAL</span>
              <h3 id="titulo-modal-snapshots">Snapshots Automáticos ( últimos 5 pontos )</h3>
            </div>
            <button type="button" class="btn-fechar-atelie-pro" id="btn-fechar-modal-snapshots" aria-label="Fechar">✕</button>
          </div>
          <div class="modal-corpo-atelie-pro" style="display:flex;flex-direction:column;gap:12px">
            <p style="font-size:13px;opacity:0.85">
              O Ponto &amp; Trama salva pontos de restauração locais automaticamente antes de exclusões ou baixas de estoque. Você também pode criar um ponto manual a qualquer momento.
            </p>
            <div style="display:flex;justify-content:flex-end">
              <button type="button" class="btn-acao-primaria-pro" id="btn-criar-snapshot-manual">📸 Criar Ponto de Restauração Agora</button>
            </div>
            <div id="lista-snapshots-locais" class="lista-snapshots-locais"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("btn-fechar-modal-snapshots")?.addEventListener("click", () => {
        modal.style.display = "none";
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
      });
      document.getElementById("btn-criar-snapshot-manual")?.addEventListener("click", async () => {
        await salvarSnapshotAutomatico("Ponto criado manualmente", true);
        mostrarToastAcao("📸 Ponto de restauração salvo com sucesso!", false);
      });
    }
    renderizarListaSnapshotsSeVisivel();
    modal.style.display = "flex";
  }

  // ==========================================================================
  // 3. DRAG & DROP NATIVO UNIVERSAL (FOTOS, PDFs, RECEITAS .TXT/.MD, BACKUP .JSON)
  // ==========================================================================
  function configurarDragAndDropUniversal() {
    let dropOverlay = null;
    let dragCounter = 0;

    const garantirOverlay = () => {
      if (!dropOverlay) {
        dropOverlay = document.createElement("div");
        dropOverlay.className = "dropzone-universal-atelie";
        dropOverlay.innerHTML = `
          <div class="dropzone-universal-card">
            <span class="etiqueta-tecido-atelie">SOLTE NO ATELIÊ</span>
            <h3>Solte o arquivo para abrir automaticamente</h3>
            <p>📸 Foto ou PDF de Receita • 📜 Receita em Texto (.txt / .md) • 💾 Backup (.json)</p>
          </div>
        `;
        document.body.appendChild(dropOverlay);
      }
      return dropOverlay;
    };

    window.addEventListener("dragenter", (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      dragCounter++;
      garantirOverlay().classList.add("ativo");
    });

    window.addEventListener("dragover", (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    window.addEventListener("dragleave", () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0 && dropOverlay) {
        dropOverlay.classList.remove("ativo");
      }
    });

    window.addEventListener("drop", async (e) => {
      dragCounter = 0;
      if (dropOverlay) dropOverlay.classList.remove("ativo");
      const arq = e.dataTransfer?.files?.[0];
      if (!arq) return;
      // Se soltou diretamente num input[type=file], deixa o comportamento nativo
      if (e.target && e.target.tagName === "INPUT" && e.target.type === "file") return;
      e.preventDefault();

      const nome = (arq.name || "").toLowerCase();
      const tipo = (arq.type || "").toLowerCase();

      // Caso 1: Receita em texto (.txt / .md) -> Abre direto no Leitor Interativo Ribblr!
      if (nome.endsWith(".txt") || nome.endsWith(".md") || tipo === "text/plain") {
        const texto = await arq.text();
        const btnRec = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="receitas"]');
        if (btnRec && typeof BarraLateral !== "undefined") BarraLateral.alternarFerramenta(btnRec);
        setTimeout(() => {
          if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.definirTexto === "function") {
            LeitorReceitas.definirTexto(texto);
            mostrarToastAcao(`📜 Receita "${arq.name}" aberta no Leitor Interativo!`, false);
          }
        }, 60);
        return;
      }

      // Caso 2: Backup (.json) -> Salva snapshot de segurança e restaura!
      if (nome.endsWith(".json") || tipo.includes("json")) {
        try {
          const bruto = await arq.text();
          const json = JSON.parse(bruto);
          const d = json.dados || json;
          if (d && (Array.isArray(d.projetos) || Array.isArray(d.fios))) {
            await salvarSnapshotAutomatico("Antes de importar JSON arrastado", true);
            await Promise.all([
              BancoDadosPT.substituirColecao("fios", d.fios || []),
              BancoDadosPT.substituirColecao("itens_biblioteca", d.itens_biblioteca || []),
              BancoDadosPT.substituirColecao("banco_amostras", d.banco_amostras || []),
              BancoDadosPT.substituirColecao("projetos", d.projetos || [])
            ]);
            if (typeof Home !== "undefined" && Home.atualizar) Home.atualizar();
            if (typeof GerenciadorProjetos !== "undefined" && GerenciadorProjetos.recarregar) GerenciadorProjetos.recarregar();
            mostrarToastAcao(`💾 Backup "${arq.name}" importado com sucesso!`, false);
          }
        } catch {
          mostrarToastAcao("Arquivo JSON inválido para backup.", false);
        }
        return;
      }

      // Caso 3: Imagem ou PDF -> Encaminha para o Leitor de Receitas (Modo PDF/Foto com régua!)
      if (tipo.startsWith("image/") || tipo === "application/pdf" || nome.endsWith(".pdf")) {
        const btnRec = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="receitas"]');
        if (btnRec && typeof BarraLateral !== "undefined") BarraLateral.alternarFerramenta(btnRec);
        setTimeout(() => {
          const inpArq = document.getElementById("input-arquivo-receita-global");
          if (inpArq) {
            const dt = new DataTransfer();
            dt.items.add(arq);
            inpArq.files = dt.files;
            inpArq.dispatchEvent(new Event("change", { bubbles: true }));
            mostrarToastAcao(`📎 "${arq.name}" aberto no Visualizador com Régua!`, false);
          }
        }, 80);
      }
    });
  }

  // ==========================================================================
  // 4. EXPORTAÇÃO DE ORÇAMENTO / FICHA TÉCNICA EM PDF LIMPO (PRONTO P/ WHATSAPP)
  // ==========================================================================
  function gerarFichaOrcamentoPDF(opcoes = {}) {
    const nomeAtelie =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function"
        ? (Configuracoes.obter("nomeAtelie") || "Ateliê Ponto & Trama").trim()
        : "Ateliê Ponto & Trama";
    const moedaFmt = (v) =>
      typeof Configuracoes !== "undefined" && typeof Configuracoes.formatarMoeda === "function"
        ? Configuracoes.formatarMoeda(v)
        : (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const tituloPeca = opcoes.nomePeca || "Peça Artesanal Sob Encomenda";
    const cliente = opcoes.cliente || "Cliente Especial";
    const categoria = opcoes.categoria || "Crochê / Tricô Artesanal";
    const prazo = opcoes.prazo || "A combinar";
    const tempoFmt = opcoes.tempoFmt || "—";
    const fiosLista = Array.isArray(opcoes.fios) && opcoes.fios.length > 0 ? opcoes.fios : ["Fios selecionados do ateliê"];
    const agulha = opcoes.agulha || "—";
    const custoMateriais = Number(opcoes.custoMateriais) || 0;
    const custoMaoObra = Number(opcoes.custoMaoObra) || 0;
    const precoFinal = Number(opcoes.precoFinal) || custoMateriais + custoMaoObra;
    const observacoes = opcoes.observacoes || "Peça 100% feita à mão com acabamento artesanal.";
    const fotoCapa = opcoes.fotoCapa || "";
    const dataHoje = new Date().toLocaleDateString("pt-BR");

    // Cria área de impressão limpa na própria página (funciona em Web, Ubuntu WebKit2GTK e Android!)
    let printArea = document.getElementById("ficha-orcamento-print-area");
    if (!printArea) {
      printArea = document.createElement("div");
      printArea.id = "ficha-orcamento-print-area";
      printArea.className = "ficha-orcamento-print-overlay";
      document.body.appendChild(printArea);
    }

    printArea.innerHTML = `
      <div class="ficha-orcamento-folha">
        <div class="ficha-acoes-topo no-print">
          <button type="button" class="btn-acao-primaria-pro" id="btn-imprimir-ficha-pdf">🖨️ Imprimir / Salvar PDF</button>
          <button type="button" class="btn-fechar-atelie-pro" id="btn-fechar-ficha-pdf">✕ Fechar</button>
        </div>
        <header class="ficha-cabecalho">
          <div>
            <span class="ficha-selo-atelie">FICHA TÉCNICA &amp; ORÇAMENTO ARTESANAL</span>
            <h1>${escapeHtml(nomeAtelie)}</h1>
            <p>Emitido em ${escapeHtml(dataHoje)} • Produção 100% artesanal</p>
          </div>
          ${fotoCapa ? `<img src="${fotoCapa}" alt="" class="ficha-foto-peca" />` : ""}
        </header>

        <section class="ficha-grade-dados">
          <div class="ficha-campo"><span>Peça / Projeto</span><strong>${escapeHtml(tituloPeca)}</strong></div>
          <div class="ficha-campo"><span>Cliente</span><strong>${escapeHtml(cliente)}</strong></div>
          <div class="ficha-campo"><span>Técnica / Categoria</span><strong>${escapeHtml(categoria)}</strong></div>
          <div class="ficha-campo"><span>Prazo Estimado</span><strong>${escapeHtml(prazo)}</strong></div>
          <div class="ficha-campo"><span>Tempo Dedicado</span><strong>${escapeHtml(tempoFmt)}</strong></div>
          <div class="ficha-campo"><span>Agulha Utilizada</span><strong>${escapeHtml(agulha)}</strong></div>
        </section>

        <section class="ficha-secao-box">
          <h3>🧶 Materiais &amp; Fios Selecionados</h3>
          <ul>
            ${fiosLista.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
        </section>

        <section class="ficha-secao-box">
          <h3>📝 Especificações &amp; Cuidados</h3>
          <p>${escapeHtml(observacoes)}</p>
        </section>

        <footer class="ficha-resumo-valores">
          ${
            custoMateriais > 0 || custoMaoObra > 0
              ? `<div class="ficha-subvalores">
                  <span>Materiais: ${escapeHtml(moedaFmt(custoMateriais))}</span>
                  <span>Mão de obra artesanal: ${escapeHtml(moedaFmt(custoMaoObra))}</span>
                </div>`
              : ""
          }
          <div class="ficha-preco-final">
            <span>VALOR TOTAL DO ORÇAMENTO</span>
            <strong>${escapeHtml(moedaFmt(precoFinal))}</strong>
          </div>
        </footer>
      </div>
    `;

    printArea.style.display = "flex";
    document.getElementById("btn-fechar-ficha-pdf")?.addEventListener("click", () => {
      printArea.style.display = "none";
    });
    document.getElementById("btn-imprimir-ficha-pdf")?.addEventListener("click", () => {
      window.print();
    });
  }

  // ==========================================================================
  // 5. MINI-JANELA "SEMPRE NO TOPO" (UBUNTU DESKTOP GTK3 + MODO COMPACTO)
  // ==========================================================================
  async function alternarMiniJanelaTopo() {
    miniJanelaAtiva = !miniJanelaAtiva;
    document.documentElement.classList.toggle("modo-mini-janela-topo", miniJanelaAtiva);

    // Se estiver no App Desktop Ubuntu (ou servidor local), aciona set_keep_above + resize na janela GTK3!
    try {
      await fetch("/api/desktop/mini-topo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: miniJanelaAtiva })
      });
    } catch {
      // No navegador comum/Android, aplica apenas o layout compacto focado no contador
    }

    document.querySelectorAll(".btn-mini-janela-topo").forEach((btn) => {
      btn.classList.toggle("ativo", miniJanelaAtiva);
      btn.setAttribute("aria-pressed", miniJanelaAtiva ? "true" : "false");
    });

    mostrarToastAcao(
      miniJanelaAtiva
        ? "📌 Mini-Contador ativado (F10 para restaurar tamanho normal)"
        : "🗖 Janela restaurada ao tamanho completo do ateliê",
      false
    );
    return miniJanelaAtiva;
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;

    configurarDragAndDropUniversal();

    // Atalhos globais: Ctrl+Z (Desfazer), Ctrl+Y / Ctrl+Shift+Z (Refazer), F10 (Mini-Janela no Topo)
    document.addEventListener("keydown", (e) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      const editando = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;

      if (e.key === "F10") {
        e.preventDefault();
        alternarMiniJanelaTopo();
        return;
      }

      if (editando) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        if (pilhaUndo.length > 0) {
          e.preventDefault();
          desfazer();
        }
      } else if ((ctrl && (e.key === "y" || e.key === "Y")) || (ctrl && e.shiftKey && (e.key === "z" || e.key === "Z"))) {
        if (pilhaRedo.length > 0) {
          e.preventDefault();
          refazer();
        }
      }
    });

    // Cria um snapshot inicial discreto após carregar o banco
    setTimeout(() => {
      salvarSnapshotAutomatico("Sessão iniciada", false);
    }, 3500);
  }

  return {
    init,
    registrar,
    desfazer,
    refazer,
    mostrarToastAcao,
    salvarSnapshotAutomatico,
    obterSnapshots,
    restaurarSnapshotPorId,
    abrirModalSnapshots,
    gerarFichaOrcamentoPDF,
    alternarMiniJanelaTopo
  };
})();

if (typeof window !== "undefined") {
  window.HistoricoAcoes = HistoricoAcoes;
}
