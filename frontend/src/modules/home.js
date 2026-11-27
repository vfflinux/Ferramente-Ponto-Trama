// ==========================================================================
// PONTO & TRAMA — TELA INICIAL ("BANCADA DO ATELIÊ") (RF01–RF07, RN01–RN03)
// Saudação contextual, cartão Hero "Continue de Onde Parou" com anel SVG e
// +1 Carreira direto, métricas reais do estoque/tempo, alertas discretos,
// atalhos de 1 toque e lista de projetos recentes — 100% offline e reativo.
// ==========================================================================

const Home = (() => {
  let jaInicializado = false;
  let projetoDestaqueAtual = null;
  let salvandoIncremento = false;

  const ROTULOS_STATUS = {
    na_fila: "Na fila",
    em_andamento: "Em andamento",
    pausado: "Pausado",
    concluido: "Concluído",
    arquivado: "Arquivado"
  };

  const ICONES_CATEGORIA = {
    amigurumi: "🧸",
    vestuario: "🧥",
    acessorios: "🧣",
    decoracao: "🏡",
    bolsas: "👜",
    bebe: "👶",
    outro: "🧶"
  };

  const ROTULOS_CATEGORIA = {
    amigurumi: "Amigurumi",
    vestuario: "Vestuário",
    acessorios: "Acessórios",
    decoracao: "Decoração",
    bolsas: "Bolsas",
    bebe: "Bebê",
    outro: "Artesanato"
  };

  function escapeHtml(txt) {
    return String(txt == null ? "" : txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function irParaFerramenta(chave) {
    const botao = document.querySelector(`.barraLateral .botaoFerramenta[data-ferramenta="${chave}"]`);
    if (botao && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
      BarraLateral.alternarFerramenta(botao);
    }
  }

  function abrirNovoProjeto() {
    irParaFerramenta("projetos");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("ponto-trama:novo-projeto"));
    }, 35);
  }

  function abrirProjetoNoWorkspace(projetoId) {
    irParaFerramenta("projetos");
    setTimeout(() => {
      if (typeof GerenciadorProjetos !== "undefined" && typeof GerenciadorProjetos.abrirWorkspacePorId === "function") {
        GerenciadorProjetos.abrirWorkspacePorId(projetoId);
      }
    }, 50);
  }

  function abrirContadorTelaToda(projetoOpcional = null) {
    if (
      projetoOpcional &&
      typeof ProjetoContexto !== "undefined" &&
      typeof ProjetoContexto.retirarProjeto === "function"
    ) {
      const ativo = ProjetoContexto.obterProjetoAtivo?.();
      if (!ativo || Number(ativo.id) !== Number(projetoOpcional.id)) {
        ProjetoContexto.retirarProjeto(projetoOpcional, { origem: "home" });
      }
    }
    irParaFerramenta("contador-carreiras");
    setTimeout(() => {
      if (typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.abrirTelaToda === "function") {
        ContadorCarreiras.abrirTelaToda();
      }
    }, 50);
  }

  // ==========================================================================
  // FORMATAÇÕES E CÁLCULOS (RF01, RF02, RF03, RF06, RN01)
  // ==========================================================================

  function atualizarSaudacao() {
    const hora = new Date().getHours();
    const periodo = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const nomeAtelie =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function"
        ? (Configuracoes.obter("nomeAtelie") || "Ponto & Trama").trim() || "Ponto & Trama"
        : "Ponto & Trama";

    const tituloEl = document.getElementById("home-saudacao-titulo");
    const subEl = document.getElementById("home-saudacao-subtitulo");
    const dataEl = document.getElementById("home-data-hoje");

    if (tituloEl) tituloEl.textContent = `${periodo}, ${nomeAtelie}`;
    if (subEl) {
      const tec =
        typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function"
          ? Configuracoes.obter("tecnicaPrincipal")
          : "croche";
      const textoTec =
        tec === "trico"
          ? "Sua bancada de tricô — 100% local e offline"
          : tec === "ambos"
            ? "Sua bancada de crochê e tricô — 100% local e offline"
            : "Sua bancada de crochê — 100% local e offline";
      subEl.textContent = textoTec;
    }

    if (dataEl) {
      try {
        const fmt = new Intl.DateTimeFormat("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "short"
        }).format(new Date());
        dataEl.textContent = fmt.charAt(0).toUpperCase() + fmt.slice(1);
      } catch {
        dataEl.textContent = new Date().toLocaleDateString("pt-BR");
      }
    }
  }

  function calcularProgressoProjeto(p) {
    if (!p) return 0;
    if (p.status === "concluido") return 100;
    if (typeof p.progresso_manual === "number" && !Number.isNaN(p.progresso_manual)) {
      return Math.max(0, Math.min(100, Math.round(p.progresso_manual)));
    }
    const etapas = Array.isArray(p.etapas) ? p.etapas : [];
    if (etapas.length > 0) {
      const feitas = etapas.filter((e) => e && e.concluida).length;
      return Math.round((feitas / etapas.length) * 100);
    }
    const c0 = Array.isArray(p.contadores) && p.contadores[0] ? p.contadores[0] : null;
    if (c0 && Number(c0.meta) > 0) {
      return Math.max(0, Math.min(100, Math.round(((Number(c0.carreiras) || 0) / Number(c0.meta)) * 100)));
    }
    return 0;
  }

  function formatarTempo(segTotal) {
    const s = Math.max(0, Math.floor(Number(segTotal) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function calcularDiasPrazo(prazoStr) {
    if (!prazoStr) return null;
    const partes = String(prazoStr).split("-");
    if (partes.length !== 3) return null;
    const alvo = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    if (Number.isNaN(alvo.getTime())) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  }

  function formatarTextoPrazo(prazoStr) {
    const dias = calcularDiasPrazo(prazoStr);
    if (dias === null) return null;
    if (dias < 0) return { texto: `Atrasado há ${Math.abs(dias)}d`, classe: "urgente", dias };
    if (dias === 0) return { texto: "Entrega hoje", classe: "urgente", dias };
    if (dias <= 5) return { texto: `Entrega em ${dias}d`, classe: "atencao", dias };
    return { texto: `Prazo em ${dias}d`, classe: "normal", dias };
  }

  function timestampProjeto(p) {
    const t = Date.parse(p?.atualizado_em || p?.criado_em || "");
    return Number.isNaN(t) ? Number(p?.id) || 0 : t;
  }

  // RN01: Prioridade de escolha do projeto em destaque
  function escolherProjetoDestaque(projetos) {
    const ativos = (projetos || []).filter((p) => p && p.status !== "arquivado");
    if (ativos.length === 0) return null;

    const naBancada =
      typeof ProjetoContexto !== "undefined" && typeof ProjetoContexto.obterProjetoAtivo === "function"
        ? ProjetoContexto.obterProjetoAtivo()
        : null;
    if (naBancada && naBancada.id !== undefined) {
      const match = ativos.find((p) => Number(p.id) === Number(naBancada.id));
      if (match) return { projeto: match, estaNaBancada: true };
    }

    const ordenarRecentes = (lista) => [...lista].sort((a, b) => timestampProjeto(b) - timestampProjeto(a));

    const emAndamento = ordenarRecentes(ativos.filter((p) => p.status === "em_andamento"));
    if (emAndamento.length > 0) return { projeto: emAndamento[0], estaNaBancada: false };

    const naFila = ordenarRecentes(ativos.filter((p) => p.status === "na_fila" || p.status === "pausado"));
    if (naFila.length > 0) return { projeto: naFila[0], estaNaBancada: false };

    const todos = ordenarRecentes(ativos);
    return { projeto: todos[0], estaNaBancada: false };
  }

  // ==========================================================================
  // RENDERIZAÇÃO DOS BLOCOS (HERO, ALERTAS, MÉTRICAS, RECENTES)
  // ==========================================================================

  // Ornamentos vetoriais detalhados do símbolo Ñanduobyeté (teia rendada + aranha tecelã geométrica animada)
  const SVG_TEIA_HERO = `
    <svg class="teia-hero-decor" viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
      <path d="M160 0 L2 0 M160 0 L12 46 M160 0 L38 92 M160 0 L76 128 M160 0 L118 150 M160 0 L160 158"></path>
      <path d="M132 0 Q135 12 142 18 Q150 24 160 26"></path>
      <path d="M104 0 Q109 24 123 37 Q138 48 160 52"></path>
      <path d="M74 0 Q82 38 103 58 Q126 74 160 80"></path>
      <path d="M42 0 Q54 54 83 82 Q114 104 160 112"></path>
      <path d="M12 0 Q28 70 64 106 Q104 134 160 144"></path>
      <circle cx="123" cy="37" r="2" fill="currentColor" opacity="0.65"></circle>
      <circle cx="103" cy="58" r="2" fill="currentColor" opacity="0.65"></circle>
      <circle cx="83" cy="82" r="2.2" fill="currentColor" opacity="0.55"></circle>
      <circle cx="138" cy="48" r="1.6" fill="currentColor" opacity="0.55"></circle>
    </svg>
    <svg class="aranha-fio-pendente" viewBox="0 0 64 120" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <!-- Fio de seda pontilhado contínuo -->
      <line class="aranha-fio-linha" x1="32" y1="0" x2="32" y2="58" stroke-dasharray="3 3" stroke-width="1.5"></line>
      <!-- 4 Patas esquerdas articuladas em 2 segmentos -->
      <g class="aranha-patas-esq">
        <path d="M26 70 L13 58 L8 46"></path>
        <path d="M24 75 L10 70 L4 62"></path>
        <path d="M24 81 L11 85 L6 96"></path>
        <path d="M26 86 L15 96 L12 108"></path>
      </g>
      <!-- 4 Patas direitas articuladas em 2 segmentos -->
      <g class="aranha-patas-dir">
        <path d="M38 70 L51 58 L56 46"></path>
        <path d="M40 75 L54 70 L60 62"></path>
        <path d="M40 81 L53 85 L58 96"></path>
        <path d="M38 86 L49 96 L52 108"></path>
      </g>
      <!-- Abdômen geométrico com grafismos em chevron / losango (estilo Ñanduobyeté) -->
      <path d="M32 58 L41 68 L39 81 L32 88 L25 81 L23 68 Z" fill="currentColor" fill-opacity="0.2"></path>
      <path d="M26.5 70 L32 64.5 L37.5 70" stroke-width="1.5"></path>
      <polygon points="32,71 36,75.5 32,80 28,75.5" fill="currentColor" fill-opacity="0.32" stroke-width="1.2"></polygon>
      <path d="M27.5 81.5 L32 78.5 L36.5 81.5" stroke-width="1.3"></path>
      <!-- Cefalotórax, quelíceras e olhinhos piscando -->
      <path d="M27 89 L32 86.5 L37 89 L36 96 L32 98.5 L28 96 Z" fill="currentColor" fill-opacity="0.26"></path>
      <path d="M29.5 98 L28 102.5 M34.5 98 L36 102.5" stroke-width="1.5"></path>
      <g class="aranha-olhos">
        <circle cx="30" cy="94" r="1.2" fill="currentColor" stroke="none"></circle>
        <circle cx="34" cy="94" r="1.2" fill="currentColor" stroke="none"></circle>
      </g>
    </svg>
  `;

  function renderizarHero(destaque) {
    const slot = document.getElementById("home-hero-slot");
    if (!slot) return;

    if (!destaque || !destaque.projeto) {
      projetoDestaqueAtual = null;
      slot.innerHTML = `
        <article class="home-boas-vindas">
          ${SVG_TEIA_HERO}
          <div class="home-bv-ilustra" aria-hidden="true">
            <svg viewBox="0 0 112 112" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 86 85 24" stroke-width="2.3"></path>
              <path d="M85 24c3-3 7.5-2.6 8.6.5s-1.2 6.2-4.8 6.8" stroke-width="2.2"></path>
              <path d="M19 89l11-11" stroke-width="5.2" opacity="0.45"></path>
              <circle cx="52" cy="57" r="27" fill="currentColor" fill-opacity="0.12"></circle>
              <path d="M28 46c13-8 30-8 46 0M26 56c15-7 33-5 50 5M29 68c14 7 29 7 44-2" stroke-width="1.8"></path>
              <path d="M37 34c12 9 20 22 23 47M47 31c11 10 18 22 21 43M59 32c8 9 13 18 15 32" stroke-width="1.6" opacity="0.8"></path>
              <path d="M77 68c8 5 16 5 20-2s-1-12-7-9c-4.5 2.5-2.5 11 4 16" stroke-dasharray="3.2 3.2" stroke-width="1.7"></path>
            </svg>
          </div>
          <div class="home-bv-conteudo">
            <span class="home-eyebrow">SEU ATELIÊ COMEÇA AQUI</span>
            <h2 class="home-bv-titulo">Pronto para iniciar sua próxima peça?</h2>
            <p class="home-bv-desc">
              Crie uma pasta de projeto para conectar automaticamente contadores, receita, fios, amostra, gráfico e precificação em um só lugar.
            </p>
            <div class="home-bv-acoes">
              <button type="button" class="btn-home-primario" id="btn-home-hero-novo">
                <span>＋ Criar meu primeiro projeto</span>
              </button>
              <button type="button" class="btn-home-secundario" id="btn-home-hero-fios">
                <span>🧶 Cadastrar meus fios</span>
              </button>
            </div>
          </div>
        </article>
      `;

      document.getElementById("btn-home-hero-novo")?.addEventListener("click", abrirNovoProjeto);
      document.getElementById("btn-home-hero-fios")?.addEventListener("click", () => irParaFerramenta("fios"));
      return;
    }

    const { projeto, estaNaBancada } = destaque;
    projetoDestaqueAtual = projeto;

    const progresso = calcularProgressoProjeto(projeto);
    const raio = 30;
    const circunferencia = 2 * Math.PI * raio;
    const offset = circunferencia * (1 - progresso / 100);

    const c0 = Array.isArray(projeto.contadores) && projeto.contadores[0] ? projeto.contadores[0] : null;
    const carreirasAtual = c0 ? Number(c0.carreiras) || 0 : 0;
    const metaCarreiras = c0 && Number(c0.meta) > 0 ? Number(c0.meta) : 0;
    const tempoFmt = formatarTempo(projeto.tempo_gasto_seg || 0);
    const tecnicaTxt = projeto.tecnica === "trico" ? "Tricô" : "Crochê";
    const catTxt = ROTULOS_CATEGORIA[projeto.categoria] || "Artesanato";
    const catIco = ICONES_CATEGORIA[projeto.categoria] || "🧶";
    const statusTxt = ROTULOS_STATUS[projeto.status] || "Em andamento";
    const prazoInfo = projeto.status !== "concluido" ? formatarTextoPrazo(projeto.prazo_estimado) : null;

    const capaHtml = projeto.foto_capa
      ? `<img src="${projeto.foto_capa}" alt="Capa de ${escapeHtml(projeto.nome)}" class="home-hero-capa-img" />`
      : `<div class="home-hero-capa-placeholder" aria-hidden="true"><span>${catIco}</span></div>`;

    const seloTopo = estaNaBancada
      ? `<span class="home-eyebrow bancada etiqueta-tecido-atelie">📂 NA BANCADA AGORA</span>`
      : `<span class="home-eyebrow etiqueta-tecido-atelie">CONTINUE DE ONDE PAROU</span>`;

    const badgePrazo = prazoInfo
      ? `<span class="home-chip-prazo ${prazoInfo.classe}">${escapeHtml(prazoInfo.texto)}</span>`
      : "";

    // Previsão inteligente de término baseada no ritmo real do projeto
    let etaProjetoHtml = "";
    if (projeto.tempo_gasto_seg > 60 && carreirasAtual > 0 && metaCarreiras > carreirasAtual) {
      const segPorCarr = projeto.tempo_gasto_seg / carreirasAtual;
      const faltaSeg = Math.round((metaCarreiras - carreirasAtual) * segPorCarr);
      etaProjetoHtml = `<span class="home-stat-pill">⏳ Faltam ~${escapeHtml(formatarTempo(faltaSeg))}</span>`;
    }

    // Última linha da Receita onde parou na Bancada Aberta
    let resumoReceitaHtml = "";
    if (projeto.receita && typeof projeto.receita.texto === "string" && projeto.receita.texto.trim()) {
      const linhasRec = projeto.receita.texto.split("\n").map((l) => l.trim()).filter(Boolean);
      if (linhasRec.length > 0) {
        const idxRec = Math.max(0, Math.min(Number(projeto.receita.linha_atual) || 0, linhasRec.length - 1));
        const trecho = linhasRec[idxRec].slice(0, 72) + (linhasRec[idxRec].length > 72 ? "…" : "");
        resumoReceitaHtml = `
          <div class="home-bancada-receita-preview" id="btn-home-ir-receita-direto" title="Clique para abrir direto no Leitor Interativo de Receitas">
            <span class="home-rec-tag">📜 Onde parei (${idxRec + 1}/${linhasRec.length}):</span>
            <span class="home-rec-trecho">${escapeHtml(trecho)}</span>
          </div>
        `;
      }
    }

    slot.innerHTML = `
      <article class="home-hero-card">
        ${SVG_TEIA_HERO}
        <div class="home-hero-capa">
          ${capaHtml}
        </div>

        <div class="home-hero-corpo">
          <div class="home-hero-topo-linha">
            <div class="home-hero-titulos">
              ${seloTopo}
              <h2 class="home-hero-nome">${escapeHtml(projeto.nome || "Projeto sem nome")}</h2>
              <div class="home-hero-tags">
                <span class="home-tag">${escapeHtml(tecnicaTxt)}</span>
                <span class="home-tag">${escapeHtml(catTxt)}</span>
                <span class="home-tag status-${escapeHtml(projeto.status || "em_andamento")}">${escapeHtml(statusTxt)}</span>
                ${badgePrazo}
              </div>
            </div>

            <div class="home-anel-progresso" aria-label="Progresso do projeto: ${progresso}%">
              <svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true">
                <circle class="home-anel-trilha" cx="38" cy="38" r="${raio}"></circle>
                <circle
                  class="home-anel-valor"
                  cx="38"
                  cy="38"
                  r="${raio}"
                  stroke-dasharray="${circunferencia.toFixed(2)}"
                  stroke-dashoffset="${offset.toFixed(2)}"
                ></circle>
              </svg>
              <span class="home-anel-texto">${progresso}%</span>
            </div>
          </div>

          <div class="home-hero-stats">
            <span class="home-stat-pill" id="home-hero-carreira-pill">
              <strong>Carreira ${carreirasAtual}</strong>${metaCarreiras ? ` / ${metaCarreiras}` : ""}
            </span>
            <span class="home-stat-pill">⏱️ ${escapeHtml(tempoFmt)}</span>
            ${etaProjetoHtml}
            ${projeto.cliente ? `<span class="home-stat-pill">👤 ${escapeHtml(projeto.cliente)}</span>` : ""}
          </div>

          ${resumoReceitaHtml}

          <div class="home-hero-acoes">
            <button type="button" class="btn-home-hero-primario" id="btn-home-retomar-ws">
              <span>▶ Retomar Workspace</span>
            </button>
            <button type="button" class="btn-home-hero-sec destaque-mais" id="btn-home-mais-carreira" title="Somar 1 carreira neste projeto">
              <span>＋1 Carreira</span>
            </button>
            <button type="button" class="btn-home-hero-sec" id="btn-home-hero-tela-toda" title="Abrir contador em Tela Toda para este projeto">
              <span>⛶ Tela Toda</span>
            </button>
            <button type="button" class="btn-home-hero-sec" id="btn-home-hero-ficha-pdf" title="Gerar Ficha Técnica e Orçamento em PDF para este projeto">
              <span>📄 Ficha PDF</span>
            </button>
          </div>
        </div>
      </article>
    `;

    document.getElementById("btn-home-retomar-ws")?.addEventListener("click", () => {
      abrirProjetoNoWorkspace(projeto.id);
    });
    document.getElementById("btn-home-mais-carreira")?.addEventListener("click", incrementarCarreiraDestaque);
    document.getElementById("btn-home-hero-tela-toda")?.addEventListener("click", () => {
      abrirContadorTelaToda(projeto);
    });
    document.getElementById("btn-home-ir-receita-direto")?.addEventListener("click", () => {
      if (typeof ProjetoContexto !== "undefined" && ProjetoContexto.retirarProjeto) {
        ProjetoContexto.retirarProjeto(projeto, { origem: "home" });
      }
      irParaFerramenta("receitas");
    });
    document.getElementById("btn-home-hero-ficha-pdf")?.addEventListener("click", () => {
      if (typeof HistoricoAcoes !== "undefined" && HistoricoAcoes.gerarFichaOrcamentoPDF) {
        const fiosNomes = (projeto.materiais?.fios || []).map((f) => `${f.nome || "Fio"} (${f.quantidade || 1} un)`);
        const valorHora = (typeof Configuracoes !== "undefined" && Number(Configuracoes.obter("valorHora"))) || 25;
        const horas = (Number(projeto.tempo_gasto_seg) || 0) / 3600;
        const maoObra = Math.max(25, horas * valorHora);
        HistoricoAcoes.gerarFichaOrcamentoPDF({
          nomePeca: projeto.nome,
          cliente: projeto.cliente || "Sob encomenda",
          categoria: `${tecnicaTxt} • ${catTxt}`,
          prazo: prazoInfo ? prazoInfo.texto : projeto.prazo_estimado || "A combinar",
          tempoFmt,
          fios: fiosNomes,
          agulha: projeto.materiais?.agulha_mm || projeto.materiais?.agulha_nome || "—",
          custoMaoObra: maoObra,
          precoFinal: Number(projeto.precificacao?.preco_final) || maoObra * 1.35,
          observacoes: projeto.observacoes || "Peça artesanal exclusiva tecida no ateliê.",
          fotoCapa: projeto.foto_capa || ""
        });
      }
    });
  }

  // RN02: +1 Carreira direto na Home com persistência e sincronização
  async function incrementarCarreiraDestaque() {
    if (!projetoDestaqueAtual || salvandoIncremento) return;
    salvandoIncremento = true;

    try {
      const p = projetoDestaqueAtual;
      const contadores =
        Array.isArray(p.contadores) && p.contadores.length > 0
          ? p.contadores.map((c) => ({ ...c }))
          : [{ id: "1", nome: "Contador Principal", carreiras: 0, pontosPorCarreira: 0, meta: 0 }];

      const novaCarreira = (Number(contadores[0].carreiras) || 0) + 1;
      contadores[0].carreiras = novaCarreira;
      p.contadores = contadores;
      p.atualizado_em = new Date().toISOString();

      const ativo =
        typeof ProjetoContexto !== "undefined" && typeof ProjetoContexto.obterProjetoAtivo === "function"
          ? ProjetoContexto.obterProjetoAtivo()
          : null;

      if (ativo && Number(ativo.id) === Number(p.id)) {
        ProjetoContexto.atualizarSecaoAtiva("contadores", contadores, { origem: "home" });
        if (typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.definirCarreiraPrincipal === "function") {
          ContadorCarreiras.definirCarreiraPrincipal(novaCarreira, "home");
        }
      } else if (typeof BancoDadosPT !== "undefined") {
        await BancoDadosPT.salvar("projetos", p);
        window.dispatchEvent(
          new CustomEvent("ponto-trama:projeto-atualizado", {
            detail: { projeto: p, secao: "contadores", origem: "home" }
          })
        );
      }

      if (typeof Configuracoes !== "undefined" && typeof Configuracoes.vibrar === "function") {
        Configuracoes.vibrar(14);
      }

      const pill = document.getElementById("home-hero-carreira-pill");
      if (pill) {
        const meta = Number(contadores[0].meta) > 0 ? ` / ${Number(contadores[0].meta)}` : "";
        pill.innerHTML = `<strong>Carreira ${novaCarreira}</strong>${meta}`;
        pill.classList.remove("pulso-carreira");
        void pill.offsetWidth;
        pill.classList.add("pulso-carreira");
      }

      const novoProg = calcularProgressoProjeto(p);
      const anelVal = document.querySelector("#home-hero-slot .home-anel-valor");
      const anelTxt = document.querySelector("#home-hero-slot .home-anel-texto");
      const anelBox = document.querySelector("#home-hero-slot .home-anel-progresso");
      if (anelVal) {
        const circ = 2 * Math.PI * 30;
        anelVal.setAttribute("stroke-dashoffset", (circ * (1 - novoProg / 100)).toFixed(2));
      }
      if (anelTxt) anelTxt.textContent = `${novoProg}%`;
      if (anelBox) anelBox.setAttribute("aria-label", `Progresso do projeto: ${novoProg}%`);
    } catch (erro) {
      console.error("Erro ao somar carreira na Home:", erro);
    } finally {
      salvandoIncremento = false;
    }
  }

  function renderizarMetricasEAlertas(projetos, fios) {
    const listaProj = Array.isArray(projetos) ? projetos : [];
    const listaFios = Array.isArray(fios) ? fios : [];

    const emAndamento = listaProj.filter((p) => p && p.status === "em_andamento").length;
    const totalNovelos = listaFios.reduce((acc, f) => acc + (Number(f?.quantidade) || 0), 0);
    const novelosFmt = Number.isInteger(totalNovelos)
      ? String(totalNovelos)
      : totalNovelos.toFixed(1).replace(".", ",");
    const tempoSeg = listaProj.reduce((acc, p) => acc + (Number(p?.tempo_gasto_seg) || 0), 0);

    const elAnd = document.getElementById("home-qtd-andamento");
    const elFios = document.getElementById("home-qtd-fios");
    const elLblFios = document.getElementById("home-lbl-fios");
    const elTempo = document.getElementById("home-tempo-total");

    if (elAnd) elAnd.textContent = String(emAndamento);
    if (elFios) elFios.textContent = novelosFmt;
    if (elLblFios) {
      elLblFios.textContent =
        listaFios.length > 0 ? `Novelos (${listaFios.length} cor${listaFios.length > 1 ? "es" : ""})` : "Novelos no estoque";
    }
    if (elTempo) elTempo.textContent = formatarTempo(tempoSeg);

    // RF06: Alertas discretos somente quando houver prazo próximo ou fio zerado
    const faixaAlerta = document.getElementById("home-alerta-faixa");
    if (!faixaAlerta) return;

    const alertas = [];
    const prazosProximos = listaProj
      .filter((p) => p && p.status !== "concluido" && p.status !== "arquivado" && p.prazo_estimado)
      .map((p) => ({ projeto: p, info: formatarTextoPrazo(p.prazo_estimado) }))
      .filter((x) => x.info && x.info.dias <= 5)
      .sort((a, b) => a.info.dias - b.info.dias);

    if (prazosProximos.length > 0) {
      const top = prazosProximos[0];
      alertas.push({
        texto: `⏰ ${top.projeto.nome}: ${top.info.texto}`,
        acao: () => abrirProjetoNoWorkspace(top.projeto.id),
        tipo: top.info.classe
      });
    }

    const fiosZerados = listaFios.filter((f) => (Number(f?.quantidade) || 0) <= 0).length;
    if (fiosZerados > 0) {
      alertas.push({
        texto: `🧶 ${fiosZerados} fio${fiosZerados > 1 ? "s" : ""} com estoque zerado`,
        acao: () => irParaFerramenta("fios"),
        tipo: "atencao"
      });
    }

    if (alertas.length === 0) {
      faixaAlerta.style.display = "none";
      faixaAlerta.innerHTML = "";
      return;
    }

    faixaAlerta.style.display = "flex";
    faixaAlerta.innerHTML = "";
    alertas.forEach((al) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `home-alerta-chip ${al.tipo}`;
      btn.textContent = al.texto;
      btn.addEventListener("click", al.acao);
      faixaAlerta.appendChild(btn);
    });
  }

  function renderizarRecentes(projetos, destaque) {
    const secao = document.getElementById("home-secao-recentes");
    const grade = document.getElementById("home-recentes-grid");
    if (!secao || !grade) return;

    const idDestaque = destaque?.projeto?.id;
    const outros = (projetos || [])
      .filter((p) => p && p.status !== "arquivado" && Number(p.id) !== Number(idDestaque))
      .sort((a, b) => timestampProjeto(b) - timestampProjeto(a))
      .slice(0, 3);

    if (outros.length === 0) {
      secao.style.display = "none";
      grade.innerHTML = "";
      return;
    }

    secao.style.display = "flex";
    grade.innerHTML = "";
    outros.forEach((p) => {
      const prog = calcularProgressoProjeto(p);
      const ico = ICONES_CATEGORIA[p.categoria] || "🧶";
      const statusTxt = ROTULOS_STATUS[p.status] || "Em andamento";
      const card = document.createElement("button");
      card.type = "button";
      card.className = "home-recente-card";
      card.innerHTML = `
        <div class="home-recente-topo">
          <span class="home-recente-ico" aria-hidden="true">${ico}</span>
          <div class="home-recente-info">
            <strong>${escapeHtml(p.nome || "Projeto")}</strong>
            <span>${escapeHtml(statusTxt)} • ${prog}%</span>
          </div>
        </div>
        <div class="home-recente-barra">
          <div class="home-recente-fill" style="width:${prog}%"></div>
        </div>
      `;
      card.addEventListener("click", () => abrirProjetoNoWorkspace(p.id));
      grade.appendChild(card);
    });
  }

  async function atualizarPainel() {
    atualizarSaudacao();
    let projetos = [];
    let fios = [];
    if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.obterTodos === "function") {
      try {
        [projetos, fios] = await Promise.all([
          BancoDadosPT.obterTodos("projetos").catch(() => []),
          BancoDadosPT.obterTodos("fios").catch(() => [])
        ]);
      } catch {
        projetos = [];
        fios = [];
      }
    }

    const destaque = escolherProjetoDestaque(projetos);
    renderizarHero(destaque);
    renderizarMetricasEAlertas(projetos, fios);
    renderizarRecentes(projetos, destaque);
  }

  // ==========================================================================
  // EVENTOS E INICIALIZAÇÃO (RF04, RF07)
  // ==========================================================================

  function vincularEventos() {
    const logoArea = document.querySelector(".barraLateral .logoArea");
    if (logoArea) {
      logoArea.style.cursor = "pointer";
      logoArea.title = "Voltar ao Início";
      logoArea.addEventListener("click", () => irParaFerramenta("home"));
    }

    document.getElementById("btn-home-novo-projeto")?.addEventListener("click", abrirNovoProjeto);
    document.getElementById("btn-home-ver-projetos")?.addEventListener("click", () => irParaFerramenta("projetos"));
    document.getElementById("btn-home-ver-todos-recentes")?.addEventListener("click", () => irParaFerramenta("projetos"));
    document.getElementById("btn-home-tela-toda")?.addEventListener("click", () => abrirContadorTelaToda(null));
    document.getElementById("btn-home-tabelas")?.addEventListener("click", () => irParaFerramenta("tabelas-conversao"));
    document.getElementById("btn-home-graficos")?.addEventListener("click", () => irParaFerramenta("editor-graficos"));

    document.getElementById("home-metrica-projetos")?.addEventListener("click", () => irParaFerramenta("projetos"));
    document.getElementById("home-metrica-fios")?.addEventListener("click", () => irParaFerramenta("fios"));
    document.getElementById("home-metrica-tempo")?.addEventListener("click", () => irParaFerramenta("projetos"));

    // RF07: Atualização reativa em tempo real
    window.addEventListener("ponto-trama:ferramenta-alterada", (e) => {
      if (e.detail?.ferramenta === "home") {
        atualizarPainel();
      }
    });
    window.addEventListener("ponto-trama:configuracoes-atualizadas", atualizarSaudacao);
    window.addEventListener("ponto-trama:projeto-ativo-mudou", () => atualizarPainel());
    window.addEventListener("ponto-trama:projeto-atualizado", (e) => {
      if (e.detail?.origem === "home") return;
      const secHome = document.getElementById("secao-home");
      if (secHome && secHome.style.display !== "none") {
        atualizarPainel();
      }
    });
    window.addEventListener("ponto-trama:fios-atualizados", () => {
      const secHome = document.getElementById("secao-home");
      if (secHome && secHome.style.display !== "none") {
        atualizarPainel();
      }
    });
  }

  function init() {
    if (jaInicializado) {
      atualizarPainel();
      return;
    }
    jaInicializado = true;
    vincularEventos();
    atualizarPainel();
  }

  return { init, atualizarPainel };
})();
