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
    tema: "classico", // 'classico' | 'noite' | 'claro' | 'linho' | 'salvia' | 'ameixa' | 'mel' | 'floresta'
    tamanhoFonte: "padrao", // 'compacto' | 'padrao' | 'grande'
    reduzirAnimacoes: false,
    aranhasAtelie: "discreto", // 'desligado' | 'raro' | 'discreto' | 'vivo'
    aranhasReagirCursor: true,
    sidebarInicial: "expandido", // 'expandido' | 'recolhido'
    ferramentasBarraLateral: [
      "projetos",
      "contador-carreiras",
      "receitas",
      "precificacao",
      "fios"
    ],
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

  // Estado da Sincronização via Wi-Fi (RF01-RF06, RNF01-RNF05)
  const STORAGE_ROLLBACK_LOCAL = "ponto_trama_backup_pre_sync_v1";
  let syncDirecaoSelecionada = "mesclar";
  let syncPollTimer = null;
  let syncServidorAtivo = false;
  let syncConcluidoTratado = false;
  let syncUrlAtual = "";
  let syncPortaAtual = 0;

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
      const temasValidos = new Set(["classico", "noite", "claro", "linho", "salvia", "ameixa", "mel", "floresta"]);
      const temaEfetivo = temasValidos.has(prefs.tema) ? prefs.tema : "classico";
      const ehBaseClara = temaEfetivo === "claro" || temaEfetivo === "linho" || temaEfetivo === "salvia";
      const ehBaseEscuraCustom = temaEfetivo === "ameixa" || temaEfetivo === "mel" || temaEfetivo === "floresta";

      if (temaEfetivo === "classico") root.removeAttribute("data-tema");
      else root.setAttribute("data-tema", temaEfetivo);

      if (ehBaseClara) root.setAttribute("data-tema-base", "claro");
      else if (ehBaseEscuraCustom) root.setAttribute("data-tema-base", "escuro-custom");
      else root.removeAttribute("data-tema-base");

      const CORES_BARRA_TEMA = {
        classico: "#010736",
        noite: "#050812",
        claro: "#1b2e5a",
        linho: "#6e3222",
        salvia: "#243b32",
        ameixa: "#2b063d",
        mel: "#331b00",
        floresta: "#051711"
      };
      const corBarra = CORES_BARRA_TEMA[temaEfetivo] || "#010736";
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute("content", corBarra);

      if (typeof window !== "undefined" && window.PontoETramaAndroid && typeof window.PontoETramaAndroid.atualizarTema === "function") {
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

    if (!chaveAlterada || chaveAlterada === "ferramentasBarraLateral") {
      if (typeof BarraLateral !== "undefined" && typeof BarraLateral.aplicarFerramentasVisiveis === "function") {
        BarraLateral.aplicarFerramentasVisiveis(prefs.ferramentasBarraLateral);
      }
      if (jaInicializado) {
        renderizarListaFerramentasSidebar();
      }
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
    setChk("cfg-aranhas-reagir-cursor", prefs.aranhasReagirCursor !== false);
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
    const DESCRICOES_MODO_ARANHAS = {
      desligado: "Desligado — Nenhuma aranha ou presa aparece na tela (0% de uso em segundo plano).",
      raro: "Raro — Aparições bem espaçadas (a cada 1m35s–3m15s, máx. 1 na tela), quase sempre pelas bordas/teias, caçadas raríssimas (~4,6%) e Tarântula Golias lendária.",
      discreto: "Discreto (Padrão) — Ritmo calmo (a cada 38s–78s, máx. 1 na tela), passeios suaves com caçadas ocasionais (~8,4%) e Tarântula Golias lendária.",
      vivo: "Ateliê Vivo — Mais frequente (a cada 14s–30s, até 2 na tela), encontros entre aranhas, caçadas mais ativas (~13,4%) e maior chance de eventos raros."
    };

    const atualizarDescAranhas = (modo) => {
      const el = document.getElementById("cfg-desc-modo-aranhas");
      if (!el) return;
      const chave = DESCRICOES_MODO_ARANHAS[modo] ? modo : "discreto";
      el.textContent = DESCRICOES_MODO_ARANHAS[chave];
      el.dataset.modo = chave;
    };

    ativarSegmented("cfg-tecnica-principal", prefs.tecnicaPrincipal);
    ativarSegmented("cfg-tamanho-fonte", prefs.tamanhoFonte);
    ativarSegmented("cfg-aranhas-atelie", prefs.aranhasAtelie || "discreto");
    atualizarDescAranhas(prefs.aranhasAtelie || "discreto");
    ativarSegmented("cfg-sidebar-inicial", prefs.sidebarInicial);
    ativarSegmented("cfg-unidade-medida", prefs.unidadeMedida);

    document.querySelectorAll("#cfg-grade-temas .card-tema-cfg").forEach((card) => {
      const ativo = card.dataset.temaVal === prefs.tema;
      card.classList.toggle("ativo", ativo);
      card.setAttribute("aria-checked", ativo ? "true" : "false");
    });

    renderizarListaFerramentasSidebar();
  }

  function renderizarListaFerramentasSidebar() {
    const grade = document.getElementById("cfg-lista-ferramentas-sidebar");
    const resumo = document.getElementById("cfg-resumo-sidebar-ferramentas");
    if (!grade || typeof BarraLateral === "undefined" || typeof BarraLateral.obterListaCatalogoFerramentas !== "function") {
      return;
    }

    const catalogo = BarraLateral.obterListaCatalogoFerramentas();
    const selecionadas = new Set(
      Array.isArray(prefs.ferramentasBarraLateral)
        ? prefs.ferramentasBarraLateral
        : PADROES.ferramentasBarraLateral
    );

    grade.innerHTML = "";
    catalogo.forEach((item) => {
      const marcada = selecionadas.has(item.chave);
      const label = document.createElement("label");
      label.className = `item-ferramenta-sidebar-cfg${marcada ? " ativa" : ""}`;
      label.innerHTML = `
        <span class="info-item-ferramenta-sidebar">
          <span class="icone-item-ferramenta-sidebar">${item.svgHtml}</span>
          <span class="nome-item-ferramenta-sidebar">${item.nome}</span>
        </span>
        <span class="switch-cfg compacto">
          <input type="checkbox" class="chk-ferramenta-sidebar-cfg" value="${item.chave}" ${marcada ? "checked" : ""} />
          <span class="trilha-switch"></span>
        </span>
      `;
      const chk = label.querySelector("input");
      chk?.addEventListener("change", () => {
        const atualLista = Array.isArray(prefs.ferramentasBarraLateral)
          ? [...prefs.ferramentasBarraLateral]
          : [...PADROES.ferramentasBarraLateral];
        let novaLista;
        if (chk.checked) {
          novaLista = atualLista.includes(item.chave) ? atualLista : [...atualLista, item.chave];
        } else {
          novaLista = atualLista.filter((k) => k !== item.chave);
        }
        atualizar("ferramentasBarraLateral", novaLista);
      });
      grade.appendChild(label);
    });

    const totalVis = catalogo.filter((c) => selecionadas.has(c.chave)).length;
    atualizarResumoFerramentasSidebar(catalogo.length, totalVis);
  }

  function atualizarResumoFerramentasSidebar(total, naBarra) {
    const resumo = document.getElementById("cfg-resumo-sidebar-ferramentas");
    if (!resumo) return;
    const noPopup = Math.max(0, total - naBarra);
    resumo.textContent =
      noPopup === 0
        ? `${naBarra} na barra • Todas visíveis`
        : `${naBarra} na barra • ${noPopup} em Ferramentas`;
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

  // ==========================================================================
  // PARTE 3B: VALIDAÇÃO DE SCHEMA (RNF03), MERGE POR updatedAt E ROLLBACK (RF06)
  // ==========================================================================

  function extrairTimestampMs(item) {
    if (!item || typeof item !== "object") return 0;
    const candidatos = [item.updatedAt, item.atualizado_em, item.updated_at, item.criado_em, item.createdAt];
    for (const val of candidatos) {
      if (!val) continue;
      if (typeof val === "number" && !Number.isNaN(val)) return val;
      const ms = Date.parse(String(val));
      if (!Number.isNaN(ms)) return ms;
    }
    return 0;
  }

  function validarSchemaBackupJson(json) {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return { ok: false, erro: "O arquivo não contém um objeto JSON válido." };
    }
    const ehEnvelope = "dados" in json;
    if (ehEnvelope) {
      if (!json.dados || typeof json.dados !== "object" || Array.isArray(json.dados)) {
        return { ok: false, erro: "Campo obrigatório 'dados' ausente ou inválido." };
      }
      if (json.preferencias !== undefined && json.preferencias !== null && typeof json.preferencias !== "object") {
        return { ok: false, erro: "Campo 'preferencias' está corrompido." };
      }
    }
    const dados = ehEnvelope ? json.dados : json;
    const colecoes = ["projetos", "fios", "itens_biblioteca", "banco_amostras"];
    const temAlguma = colecoes.some((c) => c in dados);
    if (!temAlguma && !json.preferencias) {
      return { ok: false, erro: "Arquivo JSON não pertence ao formato do Ponto & Trama." };
    }

    const dadosNorm = {};
    for (const col of colecoes) {
      const lista = dados[col] === undefined || dados[col] === null ? [] : dados[col];
      if (!Array.isArray(lista)) {
        return { ok: false, erro: `A coleção '${col}' deve ser uma lista.` };
      }
      for (let i = 0; i < lista.length; i++) {
        const it = lista[i];
        if (!it || typeof it !== "object" || Array.isArray(it)) {
          return { ok: false, erro: `Registro #${i + 1} em '${col}' inválido.` };
        }
        if (typeof it.nome !== "string" || !it.nome.trim()) {
          return { ok: false, erro: `Registro #${i + 1} em '${col}' está sem nome obrigatório.` };
        }
        if (col === "projetos") {
          for (const k of ["contadores", "etapas", "galeria"]) {
            if (it[k] !== undefined && it[k] !== null && !Array.isArray(it[k])) {
              return { ok: false, erro: `Projeto '${it.nome}' possui '${k}' inválido.` };
            }
          }
          for (const k of ["receita", "materiais", "amostra", "precificacao"]) {
            if (it[k] !== undefined && it[k] !== null && typeof it[k] !== "object") {
              return { ok: false, erro: `Projeto '${it.nome}' possui '${k}' inválido.` };
            }
          }
        } else if (col === "fios") {
          if (it.quantidade !== undefined && it.quantidade !== null && (Number.isNaN(Number(it.quantidade)) || Number(it.quantidade) < 0)) {
            return { ok: false, erro: `Fio '${it.nome}' possui quantidade inválida.` };
          }
        } else if (col === "itens_biblioteca") {
          const cat = it.categoria || "agulha";
          if (!["agulha", "ferramenta", "aviamento"].includes(cat)) {
            return { ok: false, erro: `Item '${it.nome}' possui categoria inválida.` };
          }
        }
      }
      dadosNorm[col] = lista;
    }

    return {
      ok: true,
      pacote: {
        app: "Ponto & Trama",
        versao: String(json.versao || "1.0.0"),
        exportado_em: String(json.exportado_em || new Date().toISOString()),
        preferencias: json.preferencias && typeof json.preferencias === "object" ? json.preferencias : null,
        dados: dadosNorm
      }
    };
  }

  function chaveNaturalItem(col, item) {
    const nome = String(item.nome || "").trim().toLowerCase();
    if (col === "fios") {
      return `fio|${nome}|${String(item.marca || "").trim().toLowerCase()}|${String(item.cor_nome || "").trim().toLowerCase()}|${String(item.lote || "").trim().toLowerCase()}`;
    }
    if (col === "itens_biblioteca") {
      const mm = String(item.atributos?.espessura_mm || "").trim().toLowerCase();
      return `bib|${String(item.categoria || "agulha").toLowerCase()}|${nome}|${mm}`;
    }
    if (col === "banco_amostras") {
      return `am|${String(item.tecnica || "croche").toLowerCase()}|${nome}|${String(item.fio || "").trim().toLowerCase()}`;
    }
    const criado = String(item.criado_em || "").trim().slice(0, 19);
    return criado ? `proj|${nome}|${String(item.categoria || "").toLowerCase()}|${criado}` : `proj|${nome}|${String(item.categoria || "").toLowerCase()}`;
  }

  function mesclarDadosPorData(dadosLocais, dadosRemotos) {
    const saida = {};
    for (const col of ["fios", "itens_biblioteca", "banco_amostras", "projetos"]) {
      const mapa = new Map();
      const ordem = [];
      for (const it of dadosLocais[col] || []) {
        const ch = chaveNaturalItem(col, it);
        const ts = extrairTimestampMs(it);
        if (!mapa.has(ch)) {
          ordem.push(ch);
          mapa.set(ch, { item: { ...it }, ts });
        } else if (ts >= mapa.get(ch).ts) {
          mapa.set(ch, { item: { ...it }, ts });
        }
      }
      for (const it of dadosRemotos[col] || []) {
        const ch = chaveNaturalItem(col, it);
        const tsRem = extrairTimestampMs(it);
        if (!mapa.has(ch)) {
          ordem.push(ch);
          mapa.set(ch, { item: { ...it }, ts: tsRem });
        } else {
          const prev = mapa.get(ch);
          if (tsRem > prev.ts) {
            mapa.set(ch, { item: { ...it }, ts: tsRem });
          }
        }
      }
      saida[col] = ordem.map((k) => mapa.get(k).item);
    }
    return saida;
  }

  async function salvarBackupPreSyncLocal(origem = "importacao") {
    if (typeof BancoDadosPT === "undefined") return;
    try {
      const dados = await BancoDadosPT.exportarTudo();
      const snap = {
        app: "Ponto & Trama",
        versao: "1.0.0",
        tipo: "backup_pre_sync",
        origem_acao: origem,
        criado_em: new Date().toISOString(),
        preferencias: { ...prefs },
        dados
      };
      localStorage.setItem(STORAGE_ROLLBACK_LOCAL, JSON.stringify(snap));
    } catch {
      // ignora se exceder quota do localStorage
    }
  }

  function temBackendLocalSync() {
    if (typeof window === "undefined") return false;
    if (window.PontoETramaAndroid) return false;
    if (typeof BancoDadosPT !== "undefined" && BancoDadosPT.obterModo() === "sqlite") return true;
    return window.__PONTO_TRAMA_DESKTOP__ === true || window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  }

  async function atualizarEstadoRollbackUI() {
    const linha = document.getElementById("linha-cfg-rollback-sync");
    const txt = document.getElementById("texto-cfg-rollback-info");
    if (!linha || !txt) return;

    let info = null;
    if (temBackendLocalSync()) {
      try {
        const r = await fetch("/api/sync/rollback-info", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j && j.disponivel) info = { origem: "servidor", ...j };
        }
      } catch {
        // fallback local
      }
    }

    if (!info) {
      try {
        const raw = localStorage.getItem(STORAGE_ROLLBACK_LOCAL);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.dados) {
            info = {
              origem: "local",
              criado_em: parsed.criado_em || "",
              contagem: {
                projetos: (parsed.dados.projetos || []).length,
                fios: (parsed.dados.fios || []).length,
                itens_biblioteca: (parsed.dados.itens_biblioteca || []).length,
                banco_amostras: (parsed.dados.banco_amostras || []).length
              }
            };
          }
        }
      } catch {
        info = null;
      }
    }

    if (!info) {
      linha.style.display = "none";
      return;
    }

    const dtStr = info.criado_em
      ? new Date(info.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "recente";
    const c = info.contagem || {};
    txt.textContent = `backup_pre_sync.json (${dtStr}) — ${c.projetos || 0} proj., ${c.fios || 0} fios, ${c.itens_biblioteca || 0} acess., ${c.banco_amostras || 0} amostras`;
    linha.style.display = "flex";
  }

  async function executarRollbackSync() {
    if (temBackendLocalSync()) {
      try {
        const r = await fetch("/api/sync/rollback", { method: "POST" });
        const j = await r.json();
        if (r.ok && j.ok) {
          if (j.preferencias && typeof j.preferencias === "object") {
            prefs = { ...PADROES, ...j.preferencias };
            aplicarNoDOM(null);
            salvarPrefsStorage(true);
            preencherFormularioComPrefs();
          }
          if (typeof BancoDadosPT !== "undefined") BancoDadosPT.invalidarCache();
          await atualizarDiagnosticoBanco();
          await recarregarModulosAposDados();
          mostrarToast("↩️ Sincronização desfeita! Dados restaurados de backup_pre_sync.json.");
          return;
        }
      } catch {
        // tenta rollback local
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_ROLLBACK_LOCAL);
      if (!raw) {
        mostrarToast("Nenhum backup pré-sincronização disponível.");
        return;
      }
      const parsed = JSON.parse(raw);
      const val = validarSchemaBackupJson(parsed);
      if (!val.ok) {
        mostrarToast(`Rollback inválido: ${val.erro}`);
        return;
      }
      await BancoDadosPT.importarTudo(val.pacote.dados, "substituir");
      if (val.pacote.preferencias) {
        prefs = { ...PADROES, ...val.pacote.preferencias };
        aplicarNoDOM(null);
        salvarPrefsStorage(true);
        preencherFormularioComPrefs();
      }
      await atualizarDiagnosticoBanco();
      await recarregarModulosAposDados();
      mostrarToast("↩️ Sincronização desfeita! Versão anterior restaurada.");
    } catch (err) {
      console.error("Erro no rollback:", err);
      mostrarToast("Não foi possível desfazer a sincronização.");
    }
  }

  // ==========================================================================
  // PARTE 3C: MODAL DE SINCRONIZAÇÃO VIA WI-FI (RF01-RF05, RNF01-RNF05)
  // ==========================================================================

  function formatarContagemRegressiva(seg) {
    const s = Math.max(0, Math.floor(Number(seg) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function atualizarBotoesDirecaoSync(dir) {
    syncDirecaoSelecionada = dir;
    document.querySelectorAll("#sync-direcao-grid .btn-sync-dir").forEach((b) => {
      const ativo = b.dataset.syncDir === dir;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-checked", ativo ? "true" : "false");
    });
  }

  async function renderizarEstadoSyncPC(st) {
    if (!st) return;
    syncServidorAtivo = Boolean(st.ativo);
    syncUrlAtual = st.url || "";
    syncPortaAtual = Number(st.porta) || 0;

    if (st.direcao) atualizarBotoesDirecaoSync(st.direcao);

    const barra = document.getElementById("sync-status-barra");
    const txt = document.getElementById("sync-status-texto");
    const timerEl = document.getElementById("sync-timer-pill");
    const qrBox = document.getElementById("sync-qr-box");
    const urlEl = document.getElementById("sync-url-texto");
    const qrGrid = document.getElementById("sync-qr-grid");
    const diagBox = document.getElementById("sync-diagnostico-box");
    const cmdUfw = document.getElementById("sync-cmd-ufw");
    const btnRenovar = document.getElementById("btn-sync-renovar");

    if (barra) barra.className = `sync-status-barra ${st.status || "aguardando"}`;
    if (txt) txt.textContent = st.mensagem || "Aguardando conexão...";
    if (timerEl) {
      timerEl.textContent = st.ativo ? formatarContagemRegressiva(st.expira_em_seg) : st.status === "concluido" ? "✓" : "Encerrado";
    }
    if (qrBox && st.qr_svg && qrBox.dataset.url !== st.url) {
      qrBox.innerHTML = st.qr_svg;
      qrBox.dataset.url = st.url || "";
    }
    if (urlEl) urlEl.textContent = st.url || "Servidor encerrado";
    if (qrGrid) qrGrid.style.opacity = st.ativo ? "1" : "0.55";
    if (cmdUfw && syncPortaAtual > 0) cmdUfw.textContent = `sudo ufw allow ${syncPortaAtual}/tcp`;
    if (diagBox) diagBox.style.display = st.mostrar_diagnostico_rede ? "block" : "none";
    if (btnRenovar) btnRenovar.style.display = (!st.ativo || st.status === "expirado" || st.status === "erro") ? "inline-flex" : "none";

    if (st.status === "concluido" && !syncConcluidoTratado) {
      syncConcluidoTratado = true;
      pararPollingSync();
      if (st.preferencias_recebidas && typeof st.preferencias_recebidas === "object") {
        prefs = { ...PADROES, ...st.preferencias_recebidas };
        aplicarNoDOM(null);
        salvarPrefsStorage(true);
        preencherFormularioComPrefs();
      }
      if (typeof BancoDadosPT !== "undefined") BancoDadosPT.invalidarCache();
      await atualizarDiagnosticoBanco();
      await recarregarModulosAposDados();
      await atualizarEstadoRollbackUI();
      mostrarToast(`✅ ${st.mensagem || "Sincronização concluída!"}`);
    } else if (st.status === "expirado" && !st.ativo) {
      pararPollingSync();
    }
  }

  function pararPollingSync() {
    if (syncPollTimer) {
      clearInterval(syncPollTimer);
      syncPollTimer = null;
    }
  }

  function iniciarPollingSync() {
    pararPollingSync();
    syncPollTimer = setInterval(async () => {
      try {
        const resp = await fetch("/api/sync/status", { cache: "no-store" });
        if (!resp.ok) return;
        const st = await resp.json();
        await renderizarEstadoSyncPC(st);
      } catch {
        // ignora falha transitória
      }
    }, 1000);
  }

  async function iniciarSessaoSyncWifi() {
    syncConcluidoTratado = false;
    const qrBox = document.getElementById("sync-qr-box");
    if (qrBox) {
      qrBox.innerHTML = `<span style="font-size:12px;color:#16264d">Gerando QR...</span>`;
      qrBox.dataset.url = "";
    }
    try {
      const resp = await fetch("/api/sync/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direcao: syncDirecaoSelecionada, preferencias: { ...prefs } })
      });
      if (!resp.ok) throw new Error("Servidor de sincronização indisponível.");
      const st = await resp.json();
      await renderizarEstadoSyncPC(st);
      iniciarPollingSync();
    } catch (err) {
      console.error("Erro ao iniciar Sync Wi-Fi:", err);
      // Fallback para o modo guia (caso esteja rodando sem backend Python)
      const pPc = document.getElementById("sync-painel-pc");
      const pMob = document.getElementById("sync-painel-mobile");
      if (pPc) pPc.style.display = "none";
      if (pMob) pMob.style.display = "block";
    }
  }

  async function abrirModalSyncWifi() {
    const modal = document.getElementById("modal-cfg-sync-wifi");
    const pPc = document.getElementById("sync-painel-pc");
    const pMob = document.getElementById("sync-painel-mobile");
    if (!modal) return;

    modal.style.display = "flex";

    if (temBackendLocalSync()) {
      if (pPc) pPc.style.display = "flex";
      if (pMob) pMob.style.display = "none";
      await iniciarSessaoSyncWifi();
    } else {
      if (pPc) pPc.style.display = "none";
      if (pMob) pMob.style.display = "block";
    }
  }

  async function fecharModalSyncWifi() {
    pararPollingSync();
    fecharModal("modal-cfg-sync-wifi");
    if (syncServidorAtivo && temBackendLocalSync()) {
      syncServidorAtivo = false;
      try {
        await fetch("/api/sync/encerrar", { method: "POST" });
      } catch {
        // ignora
      }
    }
    await atualizarEstadoRollbackUI();
  }

  function prepararImportacaoArquivo(arquivo) {
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || "{}"));
        const validacao = validarSchemaBackupJson(json);
        if (!validacao.ok) {
          mostrarToast(`⚠️ Backup rejeitado: ${validacao.erro}`);
          return;
        }
        const pkg = validacao.pacote;
        const proj = pkg.dados.projetos;
        const fios = pkg.dados.fios;
        const bib = pkg.dados.itens_biblioteca;
        const am = pkg.dados.banco_amostras;

        if (proj.length + fios.length + bib.length + am.length === 0 && !pkg.preferencias) {
          mostrarToast("Arquivo JSON sem dados reconhecidos do Ponto & Trama.");
          return;
        }

        backupPendente = {
          preferencias: pkg.preferencias,
          dados: pkg.dados
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
      // RF06: Salva backup pré-sync automático antes de sobrescrever/mesclar
      await salvarBackupPreSyncLocal(`import_${modo}`);

      let dadosAplicar = backupPendente.dados;
      let modoDb = modo;
      if (modo === "mesclar") {
        const atuais = await BancoDadosPT.exportarTudo();
        dadosAplicar = mesclarDadosPorData(atuais, backupPendente.dados);
        modoDb = "substituir";
      }

      const resumo = await BancoDadosPT.importarTudo(dadosAplicar, modoDb);
      if (backupPendente.preferencias && typeof backupPendente.preferencias === "object") {
        prefs = { ...PADROES, ...backupPendente.preferencias };
        aplicarNoDOM(null);
        salvarPrefsStorage(true);
        preencherFormularioComPrefs();
      }
      fecharModal("modal-cfg-importar");
      backupPendente = null;
      await atualizarDiagnosticoBanco();
      await atualizarEstadoRollbackUI();
      await recarregarModulosAposDados();
      const total = resumo.projetos + resumo.fios + resumo.itens_biblioteca + resumo.banco_amostras;
      mostrarToast(`✓ Backup restaurado (${total} registros)! Rollback salvo automaticamente.`);
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
    ligarSwitch("cfg-aranhas-reagir-cursor", "aranhasReagirCursor");
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
          if (chave === "aranhasAtelie") {
            const descEl = document.getElementById("cfg-desc-modo-aranhas");
            const mapasDesc = {
              desligado: "Desligado — Nenhuma aranha ou presa aparece na tela (0% de uso em segundo plano).",
              raro: "Raro — Aparições bem espaçadas (a cada 1m35s–3m15s, máx. 1 na tela), quase sempre pelas bordas/teias, caçadas raríssimas (~4,6%) e Tarântula Golias lendária.",
              discreto: "Discreto (Padrão) — Ritmo calmo (a cada 38s–78s, máx. 1 na tela), passeios suaves com caçadas ocasionais (~8,4%) e Tarântula Golias lendária.",
              vivo: "Ateliê Vivo — Mais frequente (a cada 14s–30s, até 2 na tela), encontros entre aranhas, caçadas mais ativas (~13,4%) e maior chance de eventos raros."
            };
            const m = mapasDesc[btn.dataset.valor] ? btn.dataset.valor : "discreto";
            if (descEl) {
              descEl.textContent = mapasDesc[m];
              descEl.dataset.modo = m;
            }
          }
          if (chave === "sidebarInicial" && window.innerWidth > 768) {
            const chk = document.getElementById("opcao-menu");
            if (chk) chk.checked = btn.dataset.valor === "recolhido";
          }
        });
      });
    };
    ligarSegmented("cfg-tecnica-principal", "tecnicaPrincipal");
    ligarSegmented("cfg-tamanho-fonte", "tamanhoFonte");
    ligarSegmented("cfg-aranhas-atelie", "aranhasAtelie");
    ligarSegmented("cfg-sidebar-inicial", "sidebarInicial");
    ligarSegmented("cfg-unidade-medida", "unidadeMedida");

    document.getElementById("btn-cfg-chamar-aranha")?.addEventListener("click", () => {
      if (typeof AranhasAtelie === "undefined") return;
      const val = document.getElementById("cfg-especie-aranha-teste")?.value || "";
      if (val.startsWith("cena:") && typeof AranhasAtelie.invocarCena === "function") {
        const cena = AranhasAtelie.invocarCena(val.slice(5));
        if (cena && cena.titulo) {
          mostrarToast(`🕷️ ${cena.titulo}`);
        }
      } else if (typeof AranhasAtelie.invocarAgora === "function") {
        const inst = AranhasAtelie.invocarAgora(val || null);
        if (inst && inst.especie) {
          mostrarToast(`🕷️ ${inst.especie.nome} apareceu no ateliê!`);
        }
      }
    });

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

    // Diagnóstico, Sincronização Wi-Fi & Backup
    document.getElementById("btn-cfg-sidebar-enxuto")?.addEventListener("click", () => {
      atualizar("ferramentasBarraLateral", [...PADROES.ferramentasBarraLateral]);
      renderizarListaFerramentasSidebar();
      mostrarToast("✨ Barra lateral ajustada para o padrão enxuto.");
    });

    document.getElementById("btn-cfg-sidebar-todas")?.addEventListener("click", () => {
      const todas =
        typeof BarraLateral !== "undefined" && Array.isArray(BarraLateral.FERRAMENTAS_PERSONALIZAVEIS)
          ? [...BarraLateral.FERRAMENTAS_PERSONALIZAVEIS]
          : [...PADROES.ferramentasBarraLateral];
      atualizar("ferramentasBarraLateral", todas);
      renderizarListaFerramentasSidebar();
      mostrarToast("📋 Todas as ferramentas exibidas na barra lateral.");
    });

    document.getElementById("btn-cfg-atualizar-diag")?.addEventListener("click", () => {
      atualizarDiagnosticoBanco();
      atualizarEstadoRollbackUI();
      mostrarToast("↻ Contagem de registros atualizada.");
    });
    document.getElementById("btn-cfg-abrir-sync-wifi")?.addEventListener("click", abrirModalSyncWifi);
    document.getElementById("btn-cfg-desfazer-sync")?.addEventListener("click", executarRollbackSync);
    document.getElementById("btn-fechar-sync-wifi")?.addEventListener("click", fecharModalSyncWifi);
    document.getElementById("btn-sync-encerrar")?.addEventListener("click", fecharModalSyncWifi);
    document.getElementById("btn-sync-renovar")?.addEventListener("click", iniciarSessaoSyncWifi);
    document.getElementById("modal-cfg-sync-wifi")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-cfg-sync-wifi") fecharModalSyncWifi();
    });

    document.querySelectorAll("#sync-direcao-grid .btn-sync-dir").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const novaDir = btn.dataset.syncDir || "mesclar";
        atualizarBotoesDirecaoSync(novaDir);
        if (syncServidorAtivo && temBackendLocalSync()) {
          try {
            const resp = await fetch("/api/sync/direcao", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ direcao: novaDir })
            });
            if (resp.ok) await renderizarEstadoSyncPC(await resp.json());
          } catch {
            // ignora
          }
        }
      });
    });

    document.getElementById("btn-sync-copiar-url")?.addEventListener("click", () => {
      if (!syncUrlAtual) return;
      navigator.clipboard?.writeText(syncUrlAtual).then(() => mostrarToast("📋 Link de sincronização copiado!")).catch(() => {});
    });

    document.getElementById("btn-sync-copiar-ufw")?.addEventListener("click", () => {
      const cmd = document.getElementById("sync-cmd-ufw")?.textContent || "";
      if (!cmd) return;
      navigator.clipboard?.writeText(cmd).then(() => mostrarToast("📋 Comando UFW copiado!")).catch(() => {});
    });

    document.getElementById("btn-sync-mob-exportar")?.addEventListener("click", exportarBackupCompleto);
    document.getElementById("btn-sync-mob-importar")?.addEventListener("click", () => fecharModal("modal-cfg-sync-wifi"));

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
        const modalSync = document.getElementById("modal-cfg-sync-wifi");
        if (modalSync && modalSync.style.display === "flex") fecharModalSyncWifi();
        fecharModal("modal-cfg-importar");
        fecharModal("modal-cfg-padroes");
        fecharModal("modal-cfg-limpar");
      }
    });

    // Encerra servidor temporário ao fechar a aba/janela do navegador (RNF04)
    window.addEventListener("beforeunload", () => {
      if (syncServidorAtivo && temBackendLocalSync() && navigator.sendBeacon) {
        navigator.sendBeacon("/api/sync/encerrar", "{}");
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
        atualizarEstadoRollbackUI();
      }
    });
  }

  function init() {
    if (jaInicializado) {
      atualizarDiagnosticoBanco();
      atualizarEstadoRollbackUI();
      return;
    }
    jaInicializado = true;
    preencherFormularioComPrefs();
    vincularEventos();
    atualizarDiagnosticoBanco();
    atualizarEstadoRollbackUI();
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
