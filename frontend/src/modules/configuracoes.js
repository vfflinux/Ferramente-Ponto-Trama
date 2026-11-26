// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: CONFIGURAÇÕES
// - Perfil do Ateliê, Temas (Clássico / Noite / Claro), Escala de Fonte,
//   Redução de Animações, Estado Inicial da Barra Lateral
// - Padrões das Ferramentas (Som offline via Web Audio API, Vibração,
//   Wake Lock, Atalhos, Valor/Hora, Margem, Moeda, Unidade, Projetos)
// - Diagnóstico do Banco (SQLite / IndexedDB), Backup Completo (.json) com
//   Mesclar ou Substituir, Restauração de Padrões e Limpeza Seletiva Segura
// ==========================================================================

const Configuracoes = (() => {
  const STORAGE_KEY = "ponto_trama_configuracoes_v1";

  const PADROES = {
    nomeAtelie: "Ponto & Trama",
    assinaturaOrcamento: "",
    tecnicaPrincipal: "croche", // 'croche' | 'trico' | 'ambos'
    tema: "classico", // 'classico' | 'noite' | 'claro'
    tamanhoFonte: "padrao", // 'compacto' | 'padrao' | 'grande'
    reduzirAnimacoes: false,
    sidebarInicial: "expandido", // 'expandido' | 'recolhido'
    somAlarme: true,
    alertaVisual: true,
    vibracao: true,
    manterTelaAcesa: false,
    atalhosTeclado: true,
    valorHoraPadrao: "",
    margemPadrao: 30,
    moeda: "BRL", // 'BRL' | 'USD' | 'EUR'
    unidadeMedida: "cm", // 'cm' | 'pol'
    autoVincularProjeto: true,
    autoAgulhaUso: true,
    confetes: true
  };

  let prefs = carregarPrefsStorage();
  let jaInicializado = false;
  let secaoAtiva = "todas";
  let backupPendente = null;
  let wakeLockSentinela = null;
  let timerBadgeSalvo = null;
  let timerToast = null;

  function carregarPrefsStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...PADROES };
      const parsed = JSON.parse(raw);
      return { ...PADROES, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch {
      return { ...PADROES };
    }
  }

  function salvarPrefsStorage(notificar = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignora erro de quota
    }

    if (notificar) {
      mostrarBadgeSalvo();
      window.dispatchEvent(new CustomEvent("ponto-trama:configuracoes-atualizadas", { detail: { ...prefs } }));
    }
  }

  function obter(chave) {
    if (!chave) return { ...prefs };
    return chave in prefs ? prefs[chave] : PADROES[chave];
  }

  function atualizar(chave, valor) {
    prefs[chave] = valor;
    aplicarNoDOM(chave);
    salvarPrefsStorage(true);
  }

  // ==========================================================================
  // PARTE 1: APLICAÇÃO IMEDIATA NO DOM (TEMA, FONTE, ANIMAÇÕES, WAKE LOCK, SOM)
  // ==========================================================================

  function obterTecnicaEfetiva() {
    return prefs.tecnicaPrincipal === "trico" ? "trico" : "croche";
  }

  function obterSimboloMoeda() {
    if (prefs.moeda === "USD") return "$";
    if (prefs.moeda === "EUR") return "€";
    return "R$";
  }

  function aplicarNoDOM(chaveAlterada = null) {
    const root = document.documentElement;
    if (!root) return;

    if (!chaveAlterada || chaveAlterada === "nomeAtelie") {
      const nome = (prefs.nomeAtelie || "").trim();
      document.title = nome && nome !== "Ponto & Trama" ? `${nome} — Ponto & Trama` : "Ponto & Trama";
    }

    if (!chaveAlterada || chaveAlterada === "tecnicaPrincipal") {
      const isTrico = prefs.tecnicaPrincipal === "trico";
      const inpProjNome = document.getElementById("proj-nome");
      if (inpProjNome) {
        inpProjNome.placeholder = isTrico
          ? "Ex.: Suéter Tricô, Cachecol, Blusa Raglan..."
          : prefs.tecnicaPrincipal === "ambos"
            ? "Ex.: Blusa Tricô, Ursinho Amigurumi, Bolsa..."
            : "Ex.: Ursinho Amigurumi, Blusa Verão, Bolsa...";
      }
      const taRecGlobal = document.getElementById("input-receita-texto-global");
      const taRecWs = document.getElementById("ws-receita-textarea");
      const phRec = isTrico
        ? "Ex:\nMontar 60 pontos na agulha\nCarr 1-6: barra 2x2 (2m, 2t)\nCarr 7: 60 pontos em meia\nCarr 8: 60 pontos em tricô..."
        : "Ex:\nCarr 1: 6 pb no anel mágico (6)\nCarr 2: 6 aum (12)\nCarr 3: (1 pb, 1 aum) x6 (18)\nCarr 4-8: 18 pb...";
      if (taRecGlobal) taRecGlobal.placeholder = phRec;
      if (taRecWs) taRecWs.placeholder = phRec;
    }

    if (!chaveAlterada || chaveAlterada === "tema") {
      if (chaveAlterada === "tema") {
        root.classList.add("transicao-tema");
        setTimeout(() => root.classList.remove("transicao-tema"), 260);
      }
      if (prefs.tema === "classico") root.removeAttribute("data-tema");
      else root.setAttribute("data-tema", prefs.tema);
      if (typeof window !== "undefined" && window.PontoETramaAndroid && typeof window.PontoETramaAndroid.atualizarTema === "function") {
        const corBarra = prefs.tema === "noite" ? "#050812" : prefs.tema === "claro" ? "#1b2e5a" : "#010736";
        window.PontoETramaAndroid.atualizarTema(corBarra);
      }
    }

    if (!chaveAlterada || chaveAlterada === "tamanhoFonte") {
      if (prefs.tamanhoFonte === "padrao") root.removeAttribute("data-fonte");
      else root.setAttribute("data-fonte", prefs.tamanhoFonte);
    }

    if (!chaveAlterada || chaveAlterada === "reduzirAnimacoes") {
      if (prefs.reduzirAnimacoes) root.setAttribute("data-reduzir-animacoes", "true");
      else root.removeAttribute("data-reduzir-animacoes");
    }

    if (!chaveAlterada || chaveAlterada === "manterTelaAcesa") {
      gerenciarWakeLock(Boolean(prefs.manterTelaAcesa));
    }
  }

  function aplicarPreferenciasIniciais() {
    prefs = carregarPrefsStorage();
    aplicarNoDOM(null);

    const chkMenu = document.getElementById("opcao-menu");
    if (chkMenu && window.innerWidth > 768) {
      chkMenu.checked = prefs.sidebarInicial === "recolhido";
    }
  }

  async function gerenciarWakeLock(ativar) {
    if (typeof window !== "undefined" && window.PontoETramaAndroid && typeof window.PontoETramaAndroid.manterTelaAcesa === "function") {
      try {
        window.PontoETramaAndroid.manterTelaAcesa(Boolean(ativar));
      } catch {
        // ignora
      }
    }
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (ativar && !wakeLockSentinela) {
        wakeLockSentinela = await navigator.wakeLock.request("screen");
        wakeLockSentinela.addEventListener("release", () => {
          wakeLockSentinela = null;
        });
      } else if (!ativar && wakeLockSentinela) {
        await wakeLockSentinela.release();
        wakeLockSentinela = null;
      }
    } catch {
      // ignora quando a aba não está visível ou o runtime não suporta WakeLock
    }
  }

  // Som suave offline via Web Audio API (sem arquivos externos)
  function tocarSomAlarme(forcar = false) {
    if (!forcar && !prefs.somAlarme) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        ctx.resume().catch(() => {});
      }
      const agora = ctx.currentTime;
      const notas = [587.33, 880]; // Ré5 -> Lá5 (acorde agradável)
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, agora + i * 0.16);
        ganho.gain.setValueAtTime(0.001, agora + i * 0.16);
        ganho.gain.exponentialRampToValueAtTime(0.18, agora + i * 0.16 + 0.03);
        ganho.gain.exponentialRampToValueAtTime(0.001, agora + i * 0.16 + 0.32);
        osc.connect(ganho);
        ganho.connect(ctx.destination);
        osc.start(agora + i * 0.16);
        osc.stop(agora + i * 0.16 + 0.34);
      });
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 900);
    } catch {
      // ignora se áudio estiver bloqueado
    }
  }

  function vibrar(padrao = 20) {
    if (!prefs.vibracao) return;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(padrao);
      }
    } catch {
      // ignora
    }
  }

  function formatarMoeda(valor) {
    const moeda = prefs.moeda || "BRL";
    const locale = moeda === "USD" ? "en-US" : moeda === "EUR" ? "de-DE" : "pt-BR";
    return (Number(valor) || 0).toLocaleString(locale, {
      style: "currency",
      currency: moeda
    });
  }

  // ==========================================================================
  // PARTE 2: FEEDBACK VISUAL, BUSCA E DIAGNÓSTICO DO BANCO
  // ==========================================================================

  function mostrarBadgeSalvo() {
    const badge = document.getElementById("badge-salvo-config");
    if (!badge) return;
    badge.classList.add("visivel");
    if (timerBadgeSalvo) clearTimeout(timerBadgeSalvo);
    timerBadgeSalvo = setTimeout(() => badge.classList.remove("visivel"), 1700);
  }

  function mostrarToast(msg) {
    const el = document.getElementById("toast-configuracoes");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("visivel");
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), 2800);
  }

  function detectarAmbienteTexto() {
    if (window.__PONTO_TRAMA_DESKTOP__ === true) return "App Desktop Ubuntu (GTK + SQLite)";
    const ua = navigator.userAgent || "";
    if (/Android/i.test(ua)) return "App Android / Mobile";
    return "Web (Navegador Local)";
  }

  function formatarBytes(bytes) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function atualizarDiagnosticoBanco() {
    const modoEl = document.getElementById("cfg-diag-modo");
    const tamEl = document.getElementById("cfg-diag-tamanho");
    const ambEl = document.getElementById("cfg-sobre-ambiente");

    if (ambEl) ambEl.textContent = detectarAmbienteTexto();
    if (typeof BancoDadosPT === "undefined") return;

    try {
      const dados = await BancoDadosPT.exportarTudo();
      const modo = BancoDadosPT.obterModo();

      if (modoEl) {
        modoEl.textContent =
          modo === "sqlite"
            ? "🗄️ SQLite Relacional (SQL Local)"
            : "🌐 IndexedDB / Armazenamento Local";
      }

      const setTxt = (id, n) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(n);
      };
      setTxt("cfg-cont-projetos", dados.projetos.length);
      setTxt("cfg-cont-fios", dados.fios.length);
      setTxt("cfg-cont-biblioteca", dados.itens_biblioteca.length);
      setTxt("cfg-cont-amostras", dados.banco_amostras.length);

      if (tamEl) {
        const bytes = new Blob([JSON.stringify(dados)]).size;
        tamEl.textContent = formatarBytes(bytes);
      }
    } catch {
      if (modoEl) modoEl.textContent = "Armazenamento Local";
    }
  }

  function preencherFormularioComPrefs() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };
    const setChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(val);
    };

    setVal("cfg-nome-atelie", prefs.nomeAtelie);
    setVal("cfg-assinatura-orcamento", prefs.assinaturaOrcamento);
    setVal("cfg-valor-hora-padrao", prefs.valorHoraPadrao);
    setVal("cfg-margem-padrao", prefs.margemPadrao);
    setVal("cfg-moeda", prefs.moeda);

    setChk("cfg-reduzir-animacoes", prefs.reduzirAnimacoes);
    setChk("cfg-som-alarme", prefs.somAlarme);
    setChk("cfg-alerta-visual", prefs.alertaVisual);
    setChk("cfg-vibracao", prefs.vibracao);
    setChk("cfg-manter-tela-acesa", prefs.manterTelaAcesa);
    setChk("cfg-atalhos-teclado", prefs.atalhosTeclado);
    setChk("cfg-auto-vincular-projeto", prefs.autoVincularProjeto);
    setChk("cfg-auto-agulha-uso", prefs.autoAgulhaUso);
    setChk("cfg-confetes", prefs.confetes);

    const ativarSegmented = (containerId, val) => {
      document.querySelectorAll(`#${containerId} .btn-seg-cfg`).forEach((btn) => {
        btn.classList.toggle("ativo", btn.dataset.valor === val);
      });
    };
    ativarSegmented("cfg-tecnica-principal", prefs.tecnicaPrincipal);
    ativarSegmented("cfg-tamanho-fonte", prefs.tamanhoFonte);
    ativarSegmented("cfg-sidebar-inicial", prefs.sidebarInicial);
    ativarSegmented("cfg-unidade-medida", prefs.unidadeMedida);

    document.querySelectorAll("#cfg-grade-temas .card-tema-cfg").forEach((card) => {
      const ativo = card.dataset.temaVal === prefs.tema;
      card.classList.toggle("ativo", ativo);
      card.setAttribute("aria-checked", ativo ? "true" : "false");
    });
  }

  function aplicarFiltroNavegacaoEBusca() {
    const termo = (document.getElementById("busca-configuracoes")?.value || "").trim().toLowerCase();
    const blocos = document.querySelectorAll("#painel-configuracoes .bloco-config");
    let visiveis = 0;

    blocos.forEach((bloco) => {
      const cat = bloco.dataset.categoriaCfg;
      if (!termo && secaoAtiva !== "todas" && cat !== secaoAtiva) {
        bloco.style.display = "none";
        return;
      }

      if (!termo) {
        bloco.style.display = "flex";
        bloco.querySelectorAll("[data-busca]").forEach((el) => {
          el.style.display = "";
        });
        visiveis++;
        return;
      }

      let algumMatch = false;
      bloco.querySelectorAll("[data-busca]").forEach((el) => {
        const alvo = `${el.dataset.busca || ""} ${el.textContent || ""}`.toLowerCase();
        const bate = alvo.includes(termo);
        el.style.display = bate ? "" : "none";
        if (bate) algumMatch = true;
      });

      bloco.style.display = algumMatch ? "flex" : "none";
      if (algumMatch) visiveis++;
    });

    const vazio = document.getElementById("vazio-busca-cfg");
    if (vazio) vazio.style.display = visiveis === 0 ? "flex" : "none";
  }

  // ==========================================================================
  // PARTE 3: BACKUP UNIFICADO (EXPORTAR / IMPORTAR) E LIMPEZA SEGURA
  // ==========================================================================

  async function exportarBackupCompleto() {
    if (typeof BancoDadosPT === "undefined") return;
    const btn = document.getElementById("btn-cfg-exportar-tudo");
    try {
      const dados = await BancoDadosPT.exportarTudo();
      const pacote = {
        app: "Ponto & Trama",
        versao: "1.0.0",
        exportado_em: new Date().toISOString(),
        preferencias: { ...prefs },
        dados
      };
      const jsonTexto = JSON.stringify(pacote, null, 2);
      const dataStr = new Date().toISOString().slice(0, 10);
      const nomeArquivo = `ponto-e-trama-backup-${dataStr}.json`;

      if (typeof window !== "undefined" && window.PontoETramaAndroid && typeof window.PontoETramaAndroid.salvarArquivo === "function") {
        window.PontoETramaAndroid.salvarArquivo(nomeArquivo, jsonTexto);
      } else {
        const blob = new Blob([jsonTexto], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = "<span>✓ Backup gerado!</span>";
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 1800);
      }
      mostrarToast("📥 Backup completo exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar backup:", err);
      mostrarToast("Não foi possível exportar o backup.");
    }
  }

  function prepararImportacaoArquivo(arquivo) {
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || "{}"));
        const dados = json.dados && typeof json.dados === "object" ? json.dados : json;
        const proj = Array.isArray(dados.projetos) ? dados.projetos : [];
        const fios = Array.isArray(dados.fios) ? dados.fios : [];
        const bib = Array.isArray(dados.itens_biblioteca) ? dados.itens_biblioteca : [];
        const am = Array.isArray(dados.banco_amostras) ? dados.banco_amostras : [];

        if (proj.length + fios.length + bib.length + am.length === 0 && !json.preferencias) {
          mostrarToast("Arquivo JSON sem dados reconhecidos do Ponto & Trama.");
          return;
        }

        backupPendente = {
          preferencias: json.preferencias || null,
          dados: { projetos: proj, fios, itens_biblioteca: bib, banco_amostras: am }
        };

        const badges = document.getElementById("badges-import-cfg");
        if (badges) {
          badges.innerHTML = `
            <span class="badge-imp-item">📂 ${proj.length} projetos</span>
            <span class="badge-imp-item">🧶 ${fios.length} fios</span>
            <span class="badge-imp-item">🪡 ${bib.length} agulhas/acess.</span>
            <span class="badge-imp-item">📐 ${am.length} amostras</span>
          `;
        }
        const modal = document.getElementById("modal-cfg-importar");
        if (modal) modal.style.display = "flex";
      } catch {
        mostrarToast("Arquivo inválido. Selecione um backup .json do Ponto & Trama.");
      }
    };
    reader.readAsText(arquivo);
  }

  async function executarImportacao(modo) {
    if (!backupPendente || typeof BancoDadosPT === "undefined") return;
    try {
      const resumo = await BancoDadosPT.importarTudo(backupPendente.dados, modo);
      if (backupPendente.preferencias && typeof backupPendente.preferencias === "object") {
        prefs = { ...PADROES, ...backupPendente.preferencias };
        aplicarNoDOM(null);
        salvarPrefsStorage(true);
        preencherFormularioComPrefs();
      }
      fecharModal("modal-cfg-importar");
      backupPendente = null;
      await atualizarDiagnosticoBanco();
      await recarregarModulosAposDados();
      const total = resumo.projetos + resumo.fios + resumo.itens_biblioteca + resumo.banco_amostras;
      mostrarToast(`✓ Backup restaurado (${total} registros importados)!`);
    } catch (err) {
      console.error("Erro na importação:", err);
      mostrarToast("Erro ao restaurar backup.");
    }
  }

  async function recarregarModulosAposDados() {
    const tarefas = [];
    if (typeof GerenciadorProjetos !== "undefined" && typeof GerenciadorProjetos.recarregar === "function") {
      tarefas.push(Promise.resolve(GerenciadorProjetos.recarregar()).catch(() => {}));
    }
    if (typeof InventarioFios !== "undefined" && typeof InventarioFios.recarregar === "function") {
      tarefas.push(Promise.resolve(InventarioFios.recarregar()).catch(() => {}));
    }
    if (typeof InventarioAgulhas !== "undefined" && typeof InventarioAgulhas.recarregar === "function") {
      tarefas.push(Promise.resolve(InventarioAgulhas.recarregar()).catch(() => {}));
    }
    if (typeof BancoAmostras !== "undefined" && typeof BancoAmostras.recarregar === "function") {
      tarefas.push(Promise.resolve(BancoAmostras.recarregar()).catch(() => {}));
    }
    await Promise.all(tarefas);
    window.dispatchEvent(new CustomEvent("ponto-trama:fios-atualizados", { detail: { origem: "configuracoes" } }));
    window.dispatchEvent(new CustomEvent("ponto-trama:biblioteca-atualizada", { detail: { origem: "configuracoes" } }));
    window.dispatchEvent(new CustomEvent("ponto-trama:banco-amostras-atualizado", { detail: { origem: "configuracoes" } }));
  }

  function restaurarPadroesFabrica() {
    prefs = { ...PADROES };
    aplicarNoDOM(null);
    if (window.innerWidth > 768) {
      const chk = document.getElementById("opcao-menu");
      if (chk) chk.checked = false;
    }
    salvarPrefsStorage(true);
    preencherFormularioComPrefs();
    fecharModal("modal-cfg-padroes");
    mostrarToast("✓ Preferências restauradas para o padrão.");
  }

  function atualizarEstadoBotaoLimpar() {
    const texto = (document.getElementById("input-confirmar-limpar-cfg")?.value || "").trim().toUpperCase();
    const marcados = document.querySelectorAll(".chk-limpar-col:checked").length;
    const btn = document.getElementById("btn-confirmar-limpar-cfg");
    if (btn) btn.disabled = !(texto === "LIMPAR" && marcados > 0);
  }

  async function executarLimpezaDados() {
    if (typeof BancoDadosPT === "undefined") return;
    const selecionados = Array.from(document.querySelectorAll(".chk-limpar-col:checked")).map((c) => c.value);
    if (selecionados.length === 0) return;

    for (const col of selecionados) {
      await BancoDadosPT.limparColecao(col);
      if (col === "projetos" && typeof ProjetoContexto !== "undefined") {
        ProjetoContexto.guardarProjeto();
      }
    }

    fecharModal("modal-cfg-limpar");
    await atualizarDiagnosticoBanco();
    await recarregarModulosAposDados();
    mostrarToast("🗑️ Dados selecionados removidos com sucesso.");
  }

  function fecharModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  // ==========================================================================
  // PARTE 4: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================

  function vincularEventos() {
    // Navegação de abas internas
    document.querySelectorAll("#lista-abas-config .aba-config").forEach((btn) => {
      btn.addEventListener("click", () => {
        secaoAtiva = btn.dataset.secCfg || "todas";
        document.querySelectorAll("#lista-abas-config .aba-config").forEach((b) => {
          b.classList.toggle("ativa", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        const busca = document.getElementById("busca-configuracoes");
        if (busca && busca.value) busca.value = "";
        aplicarFiltroNavegacaoEBusca();
      });
    });

    // Busca instantânea
    const buscaInput = document.getElementById("busca-configuracoes");
    if (buscaInput) {
      const deb =
        typeof BancoDadosPT !== "undefined"
          ? BancoDadosPT.debounce(aplicarFiltroNavegacaoEBusca, 80)
          : aplicarFiltroNavegacaoEBusca;
      buscaInput.addEventListener("input", deb);
    }

    // Inputs de texto/número/select
    const ligarInput = (id, chave, parser = (v) => v) => {
      document.getElementById(id)?.addEventListener("input", (e) => {
        atualizar(chave, parser(e.target.value));
      });
    };
    ligarInput("cfg-nome-atelie", "nomeAtelie", (v) => v.trim());
    ligarInput("cfg-assinatura-orcamento", "assinaturaOrcamento", (v) => v.trim());
    ligarInput("cfg-valor-hora-padrao", "valorHoraPadrao", (v) => (v === "" ? "" : Math.max(0, parseFloat(v) || 0)));
    ligarInput("cfg-margem-padrao", "margemPadrao", (v) => Math.max(0, Math.min(500, parseFloat(v) || 0)));
    document.getElementById("cfg-moeda")?.addEventListener("change", (e) => atualizar("moeda", e.target.value));

    // Switches booleanos
    const ligarSwitch = (id, chave) => {
      document.getElementById(id)?.addEventListener("change", (e) => {
        atualizar(chave, Boolean(e.target.checked));
      });
    };
    ligarSwitch("cfg-reduzir-animacoes", "reduzirAnimacoes");
    ligarSwitch("cfg-som-alarme", "somAlarme");
    ligarSwitch("cfg-alerta-visual", "alertaVisual");
    ligarSwitch("cfg-vibracao", "vibracao");
    ligarSwitch("cfg-manter-tela-acesa", "manterTelaAcesa");
    ligarSwitch("cfg-atalhos-teclado", "atalhosTeclado");
    ligarSwitch("cfg-auto-vincular-projeto", "autoVincularProjeto");
    ligarSwitch("cfg-auto-agulha-uso", "autoAgulhaUso");
    ligarSwitch("cfg-confetes", "confetes");

    // Segmented controls
    const ligarSegmented = (containerId, chave) => {
      document.querySelectorAll(`#${containerId} .btn-seg-cfg`).forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(`#${containerId} .btn-seg-cfg`).forEach((b) => b.classList.toggle("ativo", b === btn));
          atualizar(chave, btn.dataset.valor);
          if (chave === "sidebarInicial" && window.innerWidth > 768) {
            const chk = document.getElementById("opcao-menu");
            if (chk) chk.checked = btn.dataset.valor === "recolhido";
          }
        });
      });
    };
    ligarSegmented("cfg-tecnica-principal", "tecnicaPrincipal");
    ligarSegmented("cfg-tamanho-fonte", "tamanhoFonte");
    ligarSegmented("cfg-sidebar-inicial", "sidebarInicial");
    ligarSegmented("cfg-unidade-medida", "unidadeMedida");

    // Cards de Tema
    document.querySelectorAll("#cfg-grade-temas .card-tema-cfg").forEach((card) => {
      card.addEventListener("click", () => {
        const val = card.dataset.temaVal || "classico";
        document.querySelectorAll("#cfg-grade-temas .card-tema-cfg").forEach((c) => {
          const ativo = c === card;
          c.classList.toggle("ativo", ativo);
          c.setAttribute("aria-checked", ativo ? "true" : "false");
        });
        atualizar("tema", val);
      });
    });

    // Testar Som
    document.getElementById("btn-cfg-testar-som")?.addEventListener("click", () => {
      tocarSomAlarme(true);
      vibrar([60, 40, 60]);
      const sino = document.getElementById("icone-sino-cfg");
      if (sino) {
        sino.classList.remove("tocando");
        void sino.offsetWidth;
        sino.classList.add("tocando");
      }
    });

    // Diagnóstico & Backup
    document.getElementById("btn-cfg-atualizar-diag")?.addEventListener("click", () => {
      atualizarDiagnosticoBanco();
      mostrarToast("↻ Contagem de registros atualizada.");
    });
    document.getElementById("btn-cfg-exportar-tudo")?.addEventListener("click", exportarBackupCompleto);
    document.getElementById("input-cfg-importar-tudo")?.addEventListener("change", (e) => {
      const arq = e.target.files?.[0];
      if (arq) prepararImportacaoArquivo(arq);
      e.target.value = "";
    });

    // Modal Importar
    document.getElementById("btn-fechar-import-cfg")?.addEventListener("click", () => fecharModal("modal-cfg-importar"));
    document.getElementById("btn-cancelar-import-cfg")?.addEventListener("click", () => fecharModal("modal-cfg-importar"));
    document.getElementById("btn-import-mesclar-cfg")?.addEventListener("click", () => executarImportacao("mesclar"));
    document.getElementById("btn-import-substituir-cfg")?.addEventListener("click", () => executarImportacao("substituir"));

    // Modal Restaurar Padrões
    document.getElementById("btn-cfg-restaurar-padroes")?.addEventListener("click", () => {
      const m = document.getElementById("modal-cfg-padroes");
      if (m) m.style.display = "flex";
    });
    document.getElementById("btn-fechar-padroes-cfg")?.addEventListener("click", () => fecharModal("modal-cfg-padroes"));
    document.getElementById("btn-cancelar-padroes-cfg")?.addEventListener("click", () => fecharModal("modal-cfg-padroes"));
    document.getElementById("btn-confirmar-padroes-cfg")?.addEventListener("click", restaurarPadroesFabrica);

    // Modal Limpar Dados
    document.getElementById("btn-cfg-abrir-limpar-dados")?.addEventListener("click", () => {
      const inp = document.getElementById("input-confirmar-limpar-cfg");
      if (inp) inp.value = "";
      document.querySelectorAll(".chk-limpar-col").forEach((c) => {
        c.checked = false;
      });
      atualizarEstadoBotaoLimpar();
      const m = document.getElementById("modal-cfg-limpar");
      if (m) m.style.display = "flex";
    });
    document.getElementById("btn-fechar-limpar-cfg")?.addEventListener("click", () => fecharModal("modal-cfg-limpar"));
    document.getElementById("btn-cancelar-limpar-cfg")?.addEventListener("click", () => fecharModal("modal-cfg-limpar"));
    document.getElementById("input-confirmar-limpar-cfg")?.addEventListener("input", atualizarEstadoBotaoLimpar);
    document.querySelectorAll(".chk-limpar-col").forEach((c) => c.addEventListener("change", atualizarEstadoBotaoLimpar));
    document.getElementById("btn-confirmar-limpar-cfg")?.addEventListener("click", executarLimpezaDados);

    // Fechar modais ao clicar no overlay ou ESC
    ["modal-cfg-importar", "modal-cfg-padroes", "modal-cfg-limpar"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", (e) => {
        if (e.target.id === id) fecharModal(id);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        fecharModal("modal-cfg-importar");
        fecharModal("modal-cfg-padroes");
        fecharModal("modal-cfg-limpar");
      }
    });

    // Reativa Wake Lock automaticamente ao voltar para a aba/app
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && prefs.manterTelaAcesa) {
        gerenciarWakeLock(true);
      }
    });

    // Atualiza diagnóstico sempre que a aba Configurações for aberta
    window.addEventListener("ponto-trama:ferramenta-alterada", (e) => {
      if (e.detail?.ferramenta === "configuracoes") {
        atualizarDiagnosticoBanco();
      }
    });
  }

  function init() {
    if (jaInicializado) {
      atualizarDiagnosticoBanco();
      return;
    }
    jaInicializado = true;
    preencherFormularioComPrefs();
    vincularEventos();
    atualizarDiagnosticoBanco();
  }

  return {
    init,
    aplicarPreferenciasIniciais,
    obter,
    obterTecnicaEfetiva,
    obterSimboloMoeda,
    atualizar,
    tocarSomAlarme,
    vibrar,
    formatarMoeda
  };
})();
