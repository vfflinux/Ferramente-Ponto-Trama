// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: GERENCIADOR DE PROJETOS
// - Cards em estilo Pasta / Fichário com abas, folhinhas e barra de progresso
// - Animação de abertura da pasta (arquivos saindo formando telinha de dossiê)
// - Botão "Retirar" que distribui todas as informações para as ferramentas
// - Workspace completo em 2 colunas (Execução + Metadados) / Abas no mobile
// - Contadores integrados (+1/-1, atalhos Espaço/↑/↓), Cronômetro Play/Pause,
//   Receita com marcador de linha / PDF+régua, Checklist de Etapas, Ficha
//   Técnica ligada aos inventários, Galeria de Progresso e Confetes sutis.
// ==========================================================================

const GerenciadorProjetos = (() => {
  const STORE_PROJETOS = "projetos";
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  const ETAPAS_SUGERIDAS = {
    amigurumi: ["Cabeça", "Corpo", "Braços e Pernas", "Detalhes / Olhos", "Costura e Acabamento"],
    vestuario: ["Amostra e Medidas", "Frente", "Costas", "Mangas", "Acabamento e Bloqueio"],
    decoracao: ["Base / Centro", "Corpo da Peça", "Bico / Barrado", "Arremates e Bloqueio"],
    acessorios: ["Base", "Corpo / Laterais", "Alça / Fecho", "Forro e Acabamento"]
  };

  let jaInicializado = false;
  let projetosCache = [];
  let projetosFiltrados = [];
  let fiosCache = [];
  let agulhasCache = [];
  let amostrasCache = [];

  // Filtros do Dashboard
  let filtroStatusAtivo = "todos";
  let filtroCategoriaAtivo = "";
  let filtroFioAtivo = "";

  // Estado de UI
  let projetoPastaAbertaId = null;
  let projetoWorkspaceId = null;
  let contadorAtivoIdx = 0;
  let receitaModoEdicaoTexto = false;
  let fotoCapaFormBase64 = "";
  let projetoParaExcluirId = null;

  // Cronômetro em execução
  let cronometroRodando = false;
  let cronometroIntervalId = null;
  let timerToast = null;
  let timerAutoSalvarWs = null;

  function ctx() {
    return typeof ProjetoContexto !== "undefined" ? ProjetoContexto : null;
  }

  function normalizar(p) {
    return ctx() ? ctx().normalizarProjeto(p) : p;
  }

  function calcularProgresso(p) {
    return ctx() ? ctx().calcularProgresso(p) : 0;
  }

  function formatarTempo(seg) {
    return ctx() ? ctx().formatarTempo(seg) : "00:00:00";
  }

  function escapeHtml(texto) {
    return typeof BancoDadosPT !== "undefined" ? BancoDadosPT.escapeHtml(texto) : String(texto ?? "");
  }

  function formatarDataBr(iso) {
    if (!iso) return "";
    const partes = String(iso).slice(0, 10).split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
  }

  function formatarMoeda(v) {
    return typeof Configuracoes !== "undefined" && typeof Configuracoes.formatarMoeda === "function"
      ? Configuracoes.formatarMoeda(v)
      : (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function mostrarToast(msg) {
    const el = document.getElementById("toast-projetos");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("visivel");
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), 2800);
  }

  function comprimirImagem(arquivo, maxDim = 760, qualidade = 0.8) {
    return typeof BancoDadosPT !== "undefined"
      ? BancoDadosPT.comprimirImagem(arquivo, maxDim, qualidade)
      : Promise.reject(new Error("Compressor indisponível"));
  }

  function obterProjetoPorId(id) {
    if (id === null || id === undefined) return null;
    return projetosCache.find((p) => Number(p.id) === Number(id)) || null;
  }

  function irParaFerramenta(chave) {
    const btn = document.querySelector(`.barraLateral .botaoFerramenta[data-ferramenta="${chave}"]`);
    if (btn && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
      BarraLateral.alternarFerramenta(btn);
    }
  }

  // ==========================================================================
  // PARTE 1: CARREGAMENTO E PERSISTÊNCIA
  // ==========================================================================

  async function carregarDependenciasInventarios() {
    if (typeof BancoDadosPT === "undefined") return;
    const [fios, bib, amostras] = await Promise.all([
      BancoDadosPT.obterTodos(STORE_FIOS),
      BancoDadosPT.obterTodos(STORE_BIBLIOTECA),
      BancoDadosPT.obterTodos(STORE_AMOSTRAS)
    ]);
    fiosCache = fios || [];
    agulhasCache = (bib || []).filter((i) => i.categoria === "agulha");
    amostrasCache = amostras || [];
    popularSelectsInventarios();
  }

  async function carregarProjetos(mostrarSkeleton = false) {
    const skel = document.getElementById("projetos-skeleton");
    const grade = document.getElementById("grade-projetos");
    if (mostrarSkeleton && skel && grade) {
      skel.style.display = "grid";
      grade.style.display = "none";
    }

    if (typeof BancoDadosPT !== "undefined") {
      const lista = await BancoDadosPT.obterTodos(STORE_PROJETOS);
      projetosCache = (lista || []).map(normalizar);
    } else {
      projetosCache = [];
    }

    if (skel) skel.style.display = "none";
    atualizarFiltroFiosDisponiveis();
    atualizarContadoresChips();
    aplicarFiltros(false);
  }

  async function salvarProjeto(projeto, opcoes = {}) {
    const norm = normalizar(projeto);
    norm.atualizado_em = new Date().toISOString();
    let salvo = norm;
    if (typeof BancoDadosPT !== "undefined") {
      salvo = normalizar(await BancoDadosPT.salvar(STORE_PROJETOS, norm));
    }

    const idx = projetosCache.findIndex((p) => Number(p.id) === Number(salvo.id));
    if (idx !== -1) projetosCache[idx] = salvo;
    else projetosCache.unshift(salvo);

    if (ctx()) {
      ctx().sincronizarExterno(salvo);
    }

    atualizarFiltroFiosDisponiveis();
    atualizarContadoresChips();

    if (!opcoes.silencioso) {
      aplicarFiltros(false);
    }
    return salvo;
  }

  function agendarSalvarWorkspace(projeto) {
    if (!projeto) return;
    if (ctx() && ctx().obterProjetoAtivoId() !== null && Number(ctx().obterProjetoAtivoId()) === Number(projeto.id)) {
      ctx().sincronizarExterno(projeto);
      ctx().atualizarBarraGlobal(true);
    }
    if (timerAutoSalvarWs) clearTimeout(timerAutoSalvarWs);
    timerAutoSalvarWs = setTimeout(async () => {
      await salvarProjeto(projeto, { silencioso: true });
      if (ctx() && Number(ctx().obterProjetoAtivoId()) === Number(projeto.id)) {
        ctx().atualizarBarraGlobal(false);
      }
    }, 220);
  }

  function popularSelectsInventarios() {
    // Select de agulhas no Drawer Criar/Editar
    const selAg = document.getElementById("proj-agulha-select");
    if (selAg) {
      const atual = selAg.value;
      selAg.innerHTML = '<option value="">Selecionar agulha cadastrada...</option>';
      agulhasCache.forEach((a) => {
        const opt = document.createElement("option");
        opt.value = String(a.id);
        const mm = a.atributos?.espessura_mm ? `${a.atributos.espessura_mm}mm` : "";
        opt.textContent = `${a.nome}${mm ? ` (${mm})` : ""}`;
        if (String(a.id) === atual) opt.selected = true;
        selAg.appendChild(opt);
      });
    }

    // Selects de fios (Drawer + Workspace)
    ["proj-fio-principal-select", "ws-select-fio-estoque"].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const atual = sel.value;
      sel.innerHTML = '<option value="">Selecionar fio do estoque...</option>';
      fiosCache.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = String(f.id);
        opt.textContent = `${f.nome} - ${f.cor_nome || "Sem cor"} (${f.marca || "Marca"})${f.lote ? ` • Lote ${f.lote}` : ""}`;
        if (String(f.id) === atual) opt.selected = true;
        sel.appendChild(opt);
      });
    });

    // Select de Amostras do Banco de Amostras
    const selAm = document.getElementById("proj-amostra-select");
    if (selAm) {
      const atual = selAm.value;
      selAm.innerHTML = '<option value="">Nenhum modelo vinculado</option>';
      amostrasCache.forEach((am) => {
        const opt = document.createElement("option");
        opt.value = String(am.id);
        opt.textContent = `${am.nome} (${am.pontos}×${am.carreiras} • ${am.agulha_mm}mm)`;
        if (String(am.id) === atual) opt.selected = true;
        selAm.appendChild(opt);
      });
    }
  }

  // ==========================================================================
  // PARTE 2: FILTROS, CONTADORES DE CHIPS E RENDERIZAÇÃO DAS PASTAS
  // ==========================================================================

  function atualizarFiltroFiosDisponiveis() {
    const sel = document.getElementById("filtro-fio-projetos");
    if (!sel) return;
    const valorAtual = sel.value;
    const nomesFios = new Set();
    projetosCache.forEach((p) => {
      (p.materiais?.fios || []).forEach((f) => {
        if (f.nome) nomesFios.add(f.nome.trim());
      });
    });

    sel.innerHTML = '<option value="">Todos os fios</option>';
    Array.from(nomesFios)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .forEach((nome) => {
        const opt = document.createElement("option");
        opt.value = nome;
        opt.textContent = `🧶 ${nome}`;
        if (nome === valorAtual) opt.selected = true;
        sel.appendChild(opt);
      });
  }

  function atualizarContadoresChips() {
    const ativos = projetosCache.filter((p) => !p.arquivado);
    const contagens = {
      todos: ativos.length,
      em_andamento: ativos.filter((p) => p.status === "em_andamento").length,
      na_fila: ativos.filter((p) => p.status === "na_fila").length,
      pausado: ativos.filter((p) => p.status === "pausado").length,
      concluido: ativos.filter((p) => p.status === "concluido").length,
      arquivados: projetosCache.filter((p) => p.arquivado).length
    };
    Object.entries(contagens).forEach(([chave, qtd]) => {
      const el = document.querySelector(`#chips-status-projetos .badge-cont-chip[data-cont="${chave}"]`);
      if (el) el.textContent = String(qtd);
    });
  }

  function aplicarFiltros(animarFade = true) {
    const termo = (document.getElementById("busca-projetos")?.value || "").trim().toLowerCase();
    filtroCategoriaAtivo = document.getElementById("filtro-categoria-projetos")?.value || "";
    filtroFioAtivo = document.getElementById("filtro-fio-projetos")?.value || "";

    const temFiltro = Boolean(termo || filtroCategoriaAtivo || filtroFioAtivo || filtroStatusAtivo !== "todos");
    const btnLimpar = document.getElementById("btn-limpar-filtros-projetos");
    if (btnLimpar) btnLimpar.style.display = temFiltro ? "inline-flex" : "none";

    projetosFiltrados = projetosCache
      .filter((p) => {
        if (filtroStatusAtivo === "arquivados") {
          if (!p.arquivado) return false;
        } else {
          if (p.arquivado) return false;
          if (filtroStatusAtivo !== "todos" && p.status !== filtroStatusAtivo) return false;
        }

        if (filtroCategoriaAtivo && p.categoria !== filtroCategoriaAtivo) return false;

        if (filtroFioAtivo) {
          const usaFio = (p.materiais?.fios || []).some(
            (f) => (f.nome || "").trim().toLowerCase() === filtroFioAtivo.toLowerCase()
          );
          if (!usaFio) return false;
        }

        if (termo) {
          const fiosTexto = (p.materiais?.fios || [])
            .map((f) => `${f.nome || ""} ${f.marca || ""} ${f.cor || ""} ${f.lote || ""}`)
            .join(" ");
          const buscaAlvo = [
            p.nome,
            p.cliente,
            p.categoria,
            p.materiais?.agulha_mm,
            p.materiais?.agulha_nome,
            fiosTexto,
            p.observacoes
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!buscaAlvo.includes(termo)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ativoId = ctx()?.obterProjetoAtivoId();
        if (ativoId !== null) {
          const aAtivo = Number(a.id) === Number(ativoId);
          const bAtivo = Number(b.id) === Number(ativoId);
          if (aAtivo !== bAtivo) return aAtivo ? -1 : 1;
        }
        return new Date(b.atualizado_em || 0) - new Date(a.atualizado_em || 0);
      });

    const grade = document.getElementById("grade-projetos");
    if (animarFade && grade) {
      grade.classList.add("filtrando");
      setTimeout(() => {
        renderizarGradePastas(temFiltro);
        grade.classList.remove("filtrando");
      }, 95);
    } else {
      renderizarGradePastas(temFiltro);
    }
  }

  function limparFiltros() {
    const busca = document.getElementById("busca-projetos");
    const cat = document.getElementById("filtro-categoria-projetos");
    const fio = document.getElementById("filtro-fio-projetos");
    if (busca) busca.value = "";
    if (cat) cat.value = "";
    if (fio) fio.value = "";
    filtroStatusAtivo = "todos";
    document.querySelectorAll("#chips-status-projetos .chip-status-proj").forEach((c) => {
      c.classList.toggle("ativo", c.dataset.status === "todos");
    });
    aplicarFiltros(true);
  }

  function renderizarGradePastas(temFiltro = false) {
    const grade = document.getElementById("grade-projetos");
    const vazio = document.getElementById("estado-vazio-projetos");
    const tituloVazio = document.getElementById("titulo-vazio-proj");
    const textoVazio = document.getElementById("texto-vazio-proj");
    if (!grade || !vazio) return;

    grade.innerHTML = "";

    if (projetosFiltrados.length === 0) {
      grade.style.display = "none";
      vazio.style.display = "flex";
      if (temFiltro && projetosCache.length > 0) {
        if (tituloVazio) tituloVazio.textContent = "Nenhuma pasta encontrada";
        if (textoVazio) textoVazio.textContent = "Tente outro filtro ou clique em Limpar para ver todos os seus projetos.";
      } else {
        if (tituloVazio) tituloVazio.textContent = "Sua estante de projetos está vazia";
        if (textoVazio) {
          textoVazio.textContent =
            "Crie seu primeiro fichário de crochê ou tricô. Todas as ferramentas do Ponto & Trama se conectam à pasta e salvam automaticamente!";
        }
      }
      return;
    }

    vazio.style.display = "none";
    grade.style.display = "grid";

    const frag = document.createDocumentFragment();
    projetosFiltrados.forEach((projeto, idx) => {
      frag.appendChild(criarCardPastaProjeto(projeto, idx));
    });
    grade.appendChild(frag);
  }

  function criarCardPastaProjeto(projeto, idx) {
    const metaStatus = ctx()?.METADADOS_STATUS[projeto.status] || { rotulo: "Na Fila", cor: "#7aa2f7" };
    const metaCat = ctx()?.METADADOS_CATEGORIA[projeto.categoria] || { rotulo: "Amigurumi", icone: "🧸" };
    const progresso = calcularProgresso(projeto);
    const ativoId = ctx()?.obterProjetoAtivoId();
    const naBancada = ativoId !== null && Number(ativoId) === Number(projeto.id);

    const fioPrincipal = (projeto.materiais?.fios || [])[0];
    const textoFio = fioPrincipal
      ? `🧶 ${fioPrincipal.nome}${fioPrincipal.cor ? ` (${fioPrincipal.cor})` : ""}`
      : "Fio não vinculado";
    const textoAgulha = projeto.materiais?.agulha_mm
      ? `🪡 ${projeto.materiais.agulha_mm}`
      : projeto.materiais?.agulha_nome
        ? `🪡 ${projeto.materiais.agulha_nome}`
        : "";

    const carrPrincipal = projeto.contadores?.[0]?.carreiras || 0;
    const etapasFeitas = (projeto.etapas || []).filter((e) => e.concluida).length;
    const etapasTotal = (projeto.etapas || []).length;

    const card = document.createElement("article");
    card.className = `card-pasta-projeto ${naBancada ? "projeto-na-bancada" : ""}`;
    card.style.setProperty("--delay-stagger", `${Math.min(idx, 8) * 30}ms`);
    card.dataset.id = projeto.id;

    const midiaHtml = projeto.foto_capa
      ? `<img src="${projeto.foto_capa}" alt="${escapeHtml(projeto.nome)}" class="pasta-capa-img" loading="lazy" decoding="async" />`
      : `<div class="pasta-capa-placeholder"><span class="icone-cat-grande">${metaCat.icone}</span><span>${escapeHtml(metaCat.rotulo)}</span></div>`;

    card.innerHTML = `
      <div class="pasta-aba-topo">
        <span>${naBancada ? "📂 NA BANCADA" : `${metaCat.icone} ${escapeHtml(metaCat.rotulo)}`}</span>
      </div>
      <div class="pasta-folhas-internas" aria-hidden="true">
        <span class="pasta-folha-espia f1"></span>
        <span class="pasta-folha-espia f2"></span>
        <span class="pasta-folha-espia f3"></span>
      </div>
      <div class="pasta-corpo">
        <div class="pasta-midia">
          ${midiaHtml}
          <span class="pasta-badge-status">
            <span class="dot-status" style="background:${metaStatus.cor}"></span>
            <span>${escapeHtml(metaStatus.rotulo)}</span>
          </span>
          <div class="pasta-menu-wrap">
            <button type="button" class="btn-pasta-menu" title="Ações do projeto" aria-label="Mais ações">⋯</button>
            <div class="dropdown-pasta-card" role="menu">
              <button type="button" class="item-dropdown-pasta acao-abrir-ws" role="menuitem">⚡ Abrir Workspace</button>
              <button type="button" class="item-dropdown-pasta acao-retirar" role="menuitem">📤 Retirar p/ Ferramentas</button>
              <button type="button" class="item-dropdown-pasta acao-editar" role="menuitem">✏️ Editar Pasta</button>
              <button type="button" class="item-dropdown-pasta acao-duplicar" role="menuitem">📄 Duplicar</button>
              <button type="button" class="item-dropdown-pasta acao-arquivar" role="menuitem">📦 ${projeto.arquivado ? "Desarquivar" : "Arquivar"}</button>
              <button type="button" class="item-dropdown-pasta perigo acao-excluir" role="menuitem">🗑️ Excluir</button>
            </div>
          </div>
        </div>

        <div class="pasta-info">
          <h3 class="pasta-titulo">${escapeHtml(projeto.nome)}</h3>
          <div class="pasta-meta-linha">
            <span>${escapeHtml(textoFio)}</span>
            ${textoAgulha ? `<span>• ${escapeHtml(textoAgulha)}</span>` : ""}
          </div>
          <div class="pasta-fichas-badges">
            <span class="mini-pill-ficha" title="Carreiras no contador principal">🔢 ${carrPrincipal} carr</span>
            ${etapasTotal > 0 ? `<span class="mini-pill-ficha" title="Etapas concluídas">✅ ${etapasFeitas}/${etapasTotal}</span>` : ""}
            ${projeto.tempo_gasto_seg > 0 ? `<span class="mini-pill-ficha" title="Tempo registrado">⏱️ ${formatarTempo(projeto.tempo_gasto_seg)}</span>` : ""}
            ${projeto.prazo_estimado ? `<span class="mini-pill-ficha" title="Prazo estimado">📅 ${escapeHtml(formatarDataBr(projeto.prazo_estimado))}</span>` : ""}
          </div>
          <div class="pasta-rodape-prog">
            <span>Progresso</span>
            <span>${progresso}%</span>
          </div>
        </div>

        <div class="pasta-progresso-base">
          <div class="pasta-progresso-fill ${progresso >= 100 ? "completo" : ""}" style="width: ${progresso}%"></div>
        </div>
      </div>
    `;

    // Clique na pasta dispara a animação de abrir a pasta e tirar os arquivos de dentro!
    card.addEventListener("click", (e) => {
      if (e.target.closest(".pasta-menu-wrap")) return;
      abrirTelinhaPasta(projeto.id);
    });

    // Menu (...)
    const btnMenu = card.querySelector(".btn-pasta-menu");
    const dropdown = card.querySelector(".dropdown-pasta-card");
    btnMenu?.addEventListener("click", (e) => {
      e.stopPropagation();
      const estavaAberto = dropdown?.classList.contains("aberto");
      fecharTodosDropdownsPasta();
      if (!estavaAberto) dropdown?.classList.add("aberto");
    });

    card.querySelector(".acao-abrir-ws")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdownsPasta();
      abrirWorkspacePorId(projeto.id);
    });

    card.querySelector(".acao-retirar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdownsPasta();
      executarRetirarProjeto(projeto);
    });

    card.querySelector(".acao-editar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdownsPasta();
      abrirDrawerForm(projeto);
    });

    card.querySelector(".acao-duplicar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdownsPasta();
      duplicarProjeto(projeto.id);
    });

    card.querySelector(".acao-arquivar")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      fecharTodosDropdownsPasta();
      projeto.arquivado = !projeto.arquivado;
      await salvarProjeto(projeto);
      mostrarToast(projeto.arquivado ? "📦 Pasta arquivada." : "📂 Pasta restaurada do arquivo.");
    });

    card.querySelector(".acao-excluir")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdownsPasta();
      solicitarExclusao(projeto.id);
    });

    return card;
  }

  function fecharTodosDropdownsPasta() {
    document.querySelectorAll(".dropdown-pasta-card.aberto").forEach((d) => d.classList.remove("aberto"));
  }

  // ==========================================================================
  // PARTE 3: ANIMAÇÃO DE ABRIR A PASTA (ARQUIVOS SAINDO) + BOTÃO "RETIRAR"
  // ==========================================================================

  function abrirTelinhaPasta(id) {
    const p = obterProjetoPorId(id);
    if (!p) return;
    projetoPastaAbertaId = p.id;

    const modal = document.getElementById("modal-pasta-aberta");
    const palco = document.getElementById("palco-pasta-aberta");
    if (!modal || !palco) return;

    palco.classList.remove("animando-retirar");

    const metaStatus = ctx()?.METADADOS_STATUS[p.status] || { rotulo: "Na Fila", cor: "#7aa2f7" };
    const metaCat = ctx()?.METADADOS_CATEGORIA[p.categoria] || { rotulo: "Amigurumi", icone: "🧸" };
    const progresso = calcularProgresso(p);
    const naBancada = ctx()?.obterProjetoAtivoId() !== null && Number(ctx()?.obterProjetoAtivoId()) === Number(p.id);

    const thumb = document.getElementById("dossie-capa-thumb");
    if (thumb) {
      thumb.innerHTML = p.foto_capa
        ? `<img src="${p.foto_capa}" alt="${escapeHtml(p.nome)}" />`
        : `<span>${metaCat.icone}</span>`;
    }

    document.getElementById("dossie-categoria").textContent = `${metaCat.icone} ${metaCat.rotulo}`;
    document.getElementById("dossie-status-dot").style.backgroundColor = metaStatus.cor;
    document.getElementById("dossie-status-texto").textContent = metaStatus.rotulo;
    document.getElementById("dossie-ativo-pill").style.display = naBancada ? "inline-flex" : "none";
    document.getElementById("pasta-aberta-titulo").textContent = p.nome;
    document.getElementById("bolso-pasta-etiqueta").textContent = `PASTA • ${metaCat.rotulo.toUpperCase()}`;

    const partesSub = [];
    if (p.cliente) partesSub.push(`Cliente: ${p.cliente}`);
    if (p.data_inicio) partesSub.push(`Início: ${formatarDataBr(p.data_inicio)}`);
    if (p.prazo_estimado) partesSub.push(`Prazo: ${formatarDataBr(p.prazo_estimado)}`);
    document.getElementById("dossie-subinfo").textContent =
      partesSub.length > 0 ? partesSub.join(" • ") : "Clique em Retirar para distribuir todas as fichas nas ferramentas";

    document.getElementById("dossie-progresso-fill").style.width = `${progresso}%`;
    document.getElementById("dossie-progresso-pct").textContent = `${progresso}%`;

    // Preenche cada ficha / arquivo que saiu de dentro da pasta
    const conts = p.contadores || [];
    const totalCarr = conts.reduce((acc, c) => acc + (Number(c.carreiras) || 0), 0);
    document.getElementById("dossie-ficha-contadores").innerHTML =
      conts.length > 0
        ? `<strong>${conts.length} contador(es)</strong><br>${escapeHtml(conts[0].nome)}: ${conts[0].carreiras} carr (Total: ${totalCarr})`
        : "Pronto para iniciar contagem";

    const linhasRec = (p.receita?.texto || "").split("\n").filter((l) => l.trim() !== "");
    if (p.receita?.arquivo_nome) {
      document.getElementById("dossie-ficha-receita").innerHTML = `<strong>📎 ${escapeHtml(p.receita.arquivo_nome)}</strong><br>Régua salva em ${Math.round(p.receita.regua_pct || 18)}%`;
    } else if (linhasRec.length > 0) {
      const idxL = Math.min(p.receita.linha_atual || 0, linhasRec.length - 1);
      document.getElementById("dossie-ficha-receita").innerHTML = `<strong>Linha ${idxL + 1} de ${linhasRec.length}</strong><br>${escapeHtml(linhasRec[idxL].slice(0, 62))}`;
    } else {
      document.getElementById("dossie-ficha-receita").textContent = "Nenhuma receita ou anotação registrada ainda";
    }

    const fios = p.materiais?.fios || [];
    const agTxt = p.materiais?.agulha_mm || p.materiais?.agulha_nome || "Não informada";
    document.getElementById("dossie-ficha-materiais").innerHTML =
      fios.length > 0
        ? `<strong>${fios.length} fio(s)</strong> • Agulha ${escapeHtml(agTxt)}<br>${escapeHtml(fios[0].nome)}${fios[0].cor ? ` (${escapeHtml(fios[0].cor)})` : ""}`
        : `Agulha: <strong>${escapeHtml(agTxt)}</strong><br>Sem fios vinculados`;

    const feitas = (p.etapas || []).filter((e) => e.concluida).length;
    const totalEt = (p.etapas || []).length;
    document.getElementById("dossie-ficha-etapas").innerHTML =
      totalEt > 0
        ? `<strong>${feitas} de ${totalEt} etapas</strong> concluídas<br>Progresso: ${progresso}%`
        : `Sem checklist cadastrado<br>Progresso: ${progresso}%`;

    const am = p.amostra || {};
    document.getElementById("dossie-ficha-amostra").innerHTML =
      am.pontos && am.carreiras
        ? `<strong>${am.pontos} pts × ${am.carreiras} carr</strong><br>${am.largura || 10}×${am.altura || 10} ${am.unidade || "cm"}`
        : "Sem tensão registrada ainda";

    const prec = p.precificacao || {};
    document.getElementById("dossie-ficha-precificacao").innerHTML = `<strong>⏱️ ${formatarTempo(p.tempo_gasto_seg)}</strong><br>${
      prec.precoVenda > 0 ? `Venda sugerida: ${formatarMoeda(prec.precoVenda)}` : "Pronto para precificar"
    }`;

    // Reinicia animação dos arquivos saindo da pasta
    const telinha = document.getElementById("telinha-dossie-pasta");
    if (telinha) {
      telinha.style.animation = "none";
      void telinha.offsetWidth;
      telinha.style.animation = "";
    }
    palco.querySelectorAll(".ficha-arquivo").forEach((f) => {
      f.style.animation = "none";
      void f.offsetWidth;
      f.style.animation = "";
    });

    modal.style.display = "flex";
  }

  function fecharTelinhaPasta() {
    const modal = document.getElementById("modal-pasta-aberta");
    if (modal) modal.style.display = "none";
    projetoPastaAbertaId = null;
  }

  // Botão "Retirar": anima as fichas saindo para fora e distribui para TODAS as ferramentas
  async function executarRetirarProjeto(projeto, comAnimacaoModal = false) {
    if (!projeto) return;
    if (comAnimacaoModal) {
      const palco = document.getElementById("palco-pasta-aberta");
      if (palco) palco.classList.add("animando-retirar");
      await new Promise((r) => setTimeout(r, 420));
      fecharTelinhaPasta();
    }

    if (ctx()) {
      await ctx().retirarProjeto(projeto, { origem: "botao-retirar" });
    }

    aplicarFiltros(false);
    if (projetoWorkspaceId && Number(projetoWorkspaceId) === Number(projeto.id)) {
      atualizarBotaoRetirarWorkspace(projeto);
    }
    mostrarToast(`📤 "${projeto.nome}" retirado! Dados distribuídos para todas as ferramentas.`);
  }

  // ==========================================================================
  // PARTE 4: WORKSPACE COMPLETO DO PROJETO (2 COLUNAS / ABAS MOBILE)
  // ==========================================================================

  function atualizarBotaoRetirarWorkspace(projeto) {
    const btn = document.getElementById("btn-ws-retirar");
    if (!btn || !projeto) return;
    const naBancada = ctx()?.obterProjetoAtivoId() !== null && Number(ctx()?.obterProjetoAtivoId()) === Number(projeto.id);
    btn.classList.toggle("ativo", naBancada);
    btn.innerHTML = naBancada
      ? `<span aria-hidden="true">✓</span><span>Retirado nas Ferramentas</span>`
      : `<span aria-hidden="true">📤</span><span>Retirar</span>`;
  }

  function abrirWorkspacePorId(id) {
    const p = obterProjetoPorId(id);
    if (!p) return;

    pararCronometro(false);
    projetoWorkspaceId = p.id;
    contadorAtivoIdx = 0;
    receitaModoEdicaoTexto = false;

    fecharTelinhaPasta();

    const dash = document.getElementById("projetos-visao-dashboard");
    const ws = document.getElementById("projetos-visao-workspace");
    if (dash) dash.style.display = "none";
    if (ws) ws.style.display = "flex";

    renderizarWorkspace(p);
  }

  function voltarParaDashboard() {
    pararCronometro(true);
    projetoWorkspaceId = null;
    const dash = document.getElementById("projetos-visao-dashboard");
    const ws = document.getElementById("projetos-visao-workspace");
    if (ws) ws.style.display = "none";
    if (dash) dash.style.display = "flex";
    aplicarFiltros(false);
  }

  function renderizarWorkspace(projeto) {
    if (!projeto) return;
    const metaStatus = ctx()?.METADADOS_STATUS[projeto.status] || { rotulo: "Na Fila", cor: "#7aa2f7" };
    const metaCat = ctx()?.METADADOS_CATEGORIA[projeto.categoria] || { rotulo: "Amigurumi", icone: "🧸" };

    document.getElementById("ws-nome-projeto").textContent = projeto.nome;
    document.getElementById("ws-categoria-badge").textContent = `${metaCat.icone} ${metaCat.rotulo}`;
    document.getElementById("ws-status-dot").style.backgroundColor = metaStatus.cor;
    document.getElementById("ws-status-texto").textContent = metaStatus.rotulo;

    const datas = [];
    if (projeto.cliente) datas.push(`👤 ${projeto.cliente}`);
    if (projeto.data_inicio) datas.push(`Início ${formatarDataBr(projeto.data_inicio)}`);
    if (projeto.prazo_estimado) datas.push(`Prazo ${formatarDataBr(projeto.prazo_estimado)}`);
    document.getElementById("ws-datas-resumo").textContent = datas.join(" • ");

    atualizarBotaoRetirarWorkspace(projeto);
    atualizarProgressoWorkspace(projeto, false);
    renderizarContadoresWorkspace(projeto);
    atualizarVisorCronometro(projeto);
    renderizarReceitaWorkspace(projeto);
    renderizarEtapasWorkspace(projeto);
    renderizarMateriaisWorkspace(projeto);
    renderizarGaleriaWorkspace(projeto);
  }

  function atualizarProgressoWorkspace(projeto, dispararCelebracaoSe100 = false) {
    const pct = calcularProgresso(projeto);
    const fill = document.getElementById("ws-progresso-fill");
    const txt = document.getElementById("ws-progresso-pct");
    const badgeFin = document.getElementById("ws-badge-finalizado");

    if (fill) {
      fill.style.width = `${pct}%`;
      fill.classList.toggle("completo", pct >= 100);
    }
    if (txt) txt.textContent = `${pct}%`;

    const finalizado = pct >= 100 || projeto.status === "concluido";
    if (badgeFin) badgeFin.style.display = finalizado ? "inline-flex" : "none";

    if (dispararCelebracaoSe100 && finalizado) {
      dispararConfetesSutis();
    }
  }

  function dispararConfetesSutis() {
    if (typeof Configuracoes !== "undefined" && Configuracoes.obter("confetes") === false) return;
    if (typeof Configuracoes !== "undefined" && Configuracoes.obter("reduzirAnimacoes") === true) return;
    const camada = document.getElementById("camada-confetes-projeto");
    if (!camada) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cores = ["#fcf1d0", "#3dd68c", "#7aa2f7", "#f6c945", "#d8a8ff"];
    camada.innerHTML = "";
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "confete-particula";
      p.style.left = `${10 + Math.random() * 80}%`;
      p.style.backgroundColor = cores[i % cores.length];
      p.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
      p.style.setProperty("--rot", `${260 + Math.random() * 380}deg`);
      p.style.setProperty("--dur", `${1.1 + Math.random() * 0.9}s`);
      p.style.animationDelay = `${Math.random() * 0.25}s`;
      camada.appendChild(p);
    }
    setTimeout(() => {
      camada.innerHTML = "";
    }, 2400);
  }

  // --- Contadores Integrados (RF07) ---
  function renderizarContadoresWorkspace(projeto) {
    if (!Array.isArray(projeto.contadores) || projeto.contadores.length === 0) {
      projeto.contadores = [{ id: "1", nome: "Carreiras", carreiras: 0, pontosPorCarreira: 0, meta: 0 }];
    }
    if (contadorAtivoIdx >= projeto.contadores.length) contadorAtivoIdx = 0;

    const tabs = document.getElementById("ws-tabs-contadores");
    if (tabs) {
      tabs.innerHTML = "";
      projeto.contadores.forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `ws-tab-contador ${idx === contadorAtivoIdx ? "ativo" : ""}`;
        btn.textContent = `${c.nome || `Contador ${idx + 1}`} (${c.carreiras})`;
        btn.addEventListener("click", () => {
          contadorAtivoIdx = idx;
          renderizarContadoresWorkspace(projeto);
        });
        tabs.appendChild(btn);
      });
    }

    const atual = projeto.contadores[contadorAtivoIdx];
    document.getElementById("ws-contador-nome").value = atual.nome || "";
    document.getElementById("ws-contador-numero").textContent = String(atual.carreiras || 0);
    document.getElementById("ws-contador-pts-carr").value = atual.pontosPorCarreira || 0;
    document.getElementById("ws-contador-meta").value = atual.meta > 0 ? atual.meta : "";
    const totalPts = (atual.carreiras || 0) * (atual.pontosPorCarreira || 0);
    document.getElementById("ws-contador-total-pts").textContent = `${totalPts.toLocaleString("pt-BR")} pts`;

    const btnRem = document.getElementById("ws-remover-contador") || document.getElementById("btn-ws-remover-contador");
    if (btnRem) btnRem.style.display = projeto.contadores.length > 1 ? "inline-flex" : "none";
  }

  function alterarContadorWorkspace(delta, animar = true) {
    const p = obterProjetoPorId(projetoWorkspaceId);
    if (!p) return;
    const c = p.contadores[contadorAtivoIdx];
    if (!c) return;

    c.carreiras = Math.max(0, (parseInt(c.carreiras, 10) || 0) + delta);
    renderizarContadoresWorkspace(p);
    if (typeof Configuracoes !== "undefined") {
      Configuracoes.vibrar(delta > 0 ? 18 : 12);
    }

    if (animar) {
      const numEl = document.getElementById("ws-contador-numero");
      if (numEl) {
        numEl.classList.remove("animar-tick");
        void numEl.offsetWidth;
        numEl.classList.add("animar-tick");
      }
    }

    if (c.meta > 0 && c.carreiras === c.meta) {
      if (typeof Configuracoes !== "undefined") {
        Configuracoes.tocarSomAlarme(false);
        Configuracoes.vibrar([100, 60, 100]);
      }
      mostrarToast(`🔔 Meta atingida em "${c.nome}": ${c.meta} carreiras!`);
    }

    sincronizarContadoresDoWorkspace(p);
  }

  function sincronizarContadoresDoWorkspace(projeto) {
    agendarSalvarWorkspace(projeto);
    if (ctx() && Number(ctx().obterProjetoAtivoId()) === Number(projeto.id)) {
      if (typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.carregarDoProjeto === "function") {
        ContadorCarreiras.carregarDoProjeto(projeto);
      }
    }
  }

  // --- Cronômetro de Trabalho (RF04) ---
  function atualizarVisorCronometro(projeto) {
    const visor = document.getElementById("ws-cronometro-visor");
    const btn = document.getElementById("btn-ws-cronometro-toggle");
    const icone = document.getElementById("ws-crono-icone");
    const texto = document.getElementById("ws-crono-texto");

    if (visor) visor.textContent = formatarTempo(projeto?.tempo_gasto_seg || 0);
    if (btn) {
      btn.classList.toggle("rodando", cronometroRodando);
      btn.setAttribute("aria-pressed", cronometroRodando ? "true" : "false");
    }
    if (icone) icone.textContent = cronometroRodando ? "⏸" : "▶";
    if (texto) texto.textContent = cronometroRodando ? "Pausar" : "Iniciar";
  }

  function alternarCronometro() {
    const p = obterProjetoPorId(projetoWorkspaceId);
    if (!p) return;
    if (cronometroRodando) {
      pararCronometro(true);
    } else {
      cronometroRodando = true;
      atualizarVisorCronometro(p);
      cronometroIntervalId = setInterval(() => {
        const proj = obterProjetoPorId(projetoWorkspaceId);
        if (!proj) {
          pararCronometro(false);
          return;
        }
        proj.tempo_gasto_seg = (proj.tempo_gasto_seg || 0) + 1;
        atualizarVisorCronometro(proj);
        if (proj.tempo_gasto_seg % 5 === 0) {
          agendarSalvarWorkspace(proj);
        }
      }, 1000);
    }
  }

  function pararCronometro(salvarAgora = true) {
    if (cronometroIntervalId) {
      clearInterval(cronometroIntervalId);
      cronometroIntervalId = null;
    }
    const estavaRodando = cronometroRodando;
    cronometroRodando = false;
    const p = obterProjetoPorId(projetoWorkspaceId);
    if (p) {
      atualizarVisorCronometro(p);
      if (salvarAgora && estavaRodando) {
        salvarProjeto(p, { silencioso: true });
        if (ctx() && Number(ctx().obterProjetoAtivoId()) === Number(p.id)) {
          if (typeof CalculadoraPrecificacao !== "undefined" && typeof CalculadoraPrecificacao.carregarDoProjeto === "function") {
            CalculadoraPrecificacao.carregarDoProjeto(p);
          }
        }
      }
    }
  }

  // --- Receita & Marcador de Linha (RF06) ---
  function renderizarReceitaWorkspace(projeto) {
    const rec = projeto.receita || { modo: "texto", texto: "", linha_atual: 0, regua_pct: 18 };
    const modo = rec.modo === "arquivo" ? "arquivo" : "texto";

    document.querySelectorAll("[data-ws-rec-modo]").forEach((btn) => {
      btn.classList.toggle("ativo", btn.dataset.wsRecModo === modo);
    });

    const wrapTexto = document.getElementById("ws-receita-texto-wrap");
    const wrapArq = document.getElementById("ws-receita-arquivo-wrap");
    if (wrapTexto) wrapTexto.style.display = modo === "texto" ? "block" : "none";
    if (wrapArq) wrapArq.style.display = modo === "arquivo" ? "block" : "none";

    // Modo Texto
    const ta = document.getElementById("ws-receita-textarea");
    const lista = document.getElementById("ws-receita-linhas");
    const statusLinha = document.getElementById("ws-receita-status-linha");
    const btnEdit = document.getElementById("btn-ws-rec-editar-toggle");

    if (ta && ta.value !== (rec.texto || "")) ta.value = rec.texto || "";
    const linhas = (rec.texto || "").split("\n").filter((l) => l.trim() !== "");

    if (linhas.length === 0) {
      receitaModoEdicaoTexto = true;
    }

    if (ta) ta.style.display = receitaModoEdicaoTexto ? "block" : "none";
    if (btnEdit) btnEdit.textContent = receitaModoEdicaoTexto ? "✓ Concluir edição" : "✏️ Editar texto";

    if (lista) {
      lista.innerHTML = "";
      if (linhas.length === 0) {
        lista.innerHTML = `<p class="ws-vazio-mini">Escreva sua receita acima (uma carreira por linha) para marcar onde parou.</p>`;
        if (statusLinha) statusLinha.textContent = "Adicione os passos da receita para marcar a linha atual";
      } else {
        const atual = Math.max(0, Math.min(rec.linha_atual || 0, linhas.length - 1));
        rec.linha_atual = atual;
        if (statusLinha) statusLinha.textContent = `Linha atual marcada: ${atual + 1} de ${linhas.length}`;

        linhas.forEach((linhaTxt, idx) => {
          const btnLinha = document.createElement("button");
          btnLinha.type = "button";
          btnLinha.className = `linha-receita-item ${idx === atual ? "atual" : idx < atual ? "concluida" : ""}`;
          btnLinha.innerHTML = `<span class="linha-receita-num">${idx + 1}.</span><span>${escapeHtml(linhaTxt)}</span>`;
          btnLinha.addEventListener("click", () => {
            projeto.receita.linha_atual = idx;
            renderizarReceitaWorkspace(projeto);
            sincronizarReceitaDoWorkspace(projeto);
          });
          lista.appendChild(btnLinha);
        });
      }
    }

    // Modo Arquivo (PDF / Foto)
    const nomeArq = document.getElementById("ws-receita-arquivo-nome");
    const btnRemArq = document.getElementById("btn-ws-rec-rem-arquivo");
    const reguaWrap = document.getElementById("ws-regua-slider-wrap");
    const sliderRegua = document.getElementById("ws-regua-slider");
    const viewer = document.getElementById("ws-receita-viewer");

    if (nomeArq) nomeArq.textContent = rec.arquivo_nome || "Nenhum arquivo";
    if (btnRemArq) btnRemArq.style.display = rec.arquivo_url ? "inline-flex" : "none";
    if (reguaWrap) reguaWrap.style.display = rec.arquivo_url ? "flex" : "none";
    if (sliderRegua) sliderRegua.value = Math.round(rec.regua_pct || 18);

    if (viewer) {
      if (!rec.arquivo_url) {
        viewer.innerHTML = `<p class="ws-vazio-mini">Nenhum PDF ou imagem anexado a esta receita.</p>`;
      } else {
        const isPdf = (rec.arquivo_tipo || "").includes("pdf") || rec.arquivo_url.startsWith("data:application/pdf");
        const midia = isPdf
          ? `<iframe src="${rec.arquivo_url}" title="PDF da receita"></iframe>`
          : `<img src="${rec.arquivo_url}" alt="Receita do projeto" />`;
        viewer.innerHTML = `
          <div class="palco-arquivo-receita">
            ${midia}
            <div class="regua-marcadora-receita" id="ws-regua-linha-visual" style="top: ${rec.regua_pct || 18}%">
              <span class="etiqueta-regua">📍 Onde parei</span>
            </div>
          </div>
        `;
      }
    }
  }

  function sincronizarReceitaDoWorkspace(projeto) {
    agendarSalvarWorkspace(projeto);
    if (ctx() && Number(ctx().obterProjetoAtivoId()) === Number(projeto.id)) {
      if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.carregarDoProjeto === "function") {
        LeitorReceitas.carregarDoProjeto(projeto);
      }
    }
  }

  // --- Checklist de Etapas e Progresso (RF03) ---
  function renderizarEtapasWorkspace(projeto) {
    const modoManual = projeto.progresso_modo === "manual";
    document.querySelectorAll("[data-ws-prog-modo]").forEach((btn) => {
      btn.classList.toggle("ativo", btn.dataset.wsProgModo === (modoManual ? "manual" : "auto"));
    });

    const boxManual = document.getElementById("ws-progresso-manual-box");
    const sliderManual = document.getElementById("ws-slider-progresso-manual");
    const valManual = document.getElementById("ws-valor-prog-manual");
    if (boxManual) boxManual.style.display = modoManual ? "flex" : "none";
    if (sliderManual) sliderManual.value = projeto.progresso_manual || 0;
    if (valManual) valManual.textContent = `${projeto.progresso_manual || 0}%`;

    const lista = document.getElementById("ws-lista-etapas");
    const resumo = document.getElementById("ws-etapas-resumo");
    const etapas = projeto.etapas || [];
    const feitas = etapas.filter((e) => e.concluida).length;
    if (resumo) resumo.textContent = `${feitas} de ${etapas.length} partes concluídas`;

    if (!lista) return;
    lista.innerHTML = "";
    if (etapas.length === 0) {
      lista.innerHTML = `<li class="ws-vazio-mini">Adicione partes da peça abaixo (ex.: Frente, Costas, Mangas) para calcular o progresso automaticamente.</li>`;
      return;
    }

    etapas.forEach((etapa, idx) => {
      const li = document.createElement("li");
      li.className = `ws-etapa-item ${etapa.concluida ? "concluida" : ""}`;
      li.innerHTML = `
        <input type="checkbox" ${etapa.concluida ? "checked" : ""} aria-label="Marcar etapa ${escapeHtml(etapa.titulo)}" />
        <span class="ws-etapa-titulo">${escapeHtml(etapa.titulo)}</span>
        <button type="button" class="btn-ws-rem-etapa" title="Remover etapa" aria-label="Remover etapa">&times;</button>
      `;

      li.querySelector('input[type="checkbox"]')?.addEventListener("change", (e) => {
        const antesPct = calcularProgresso(projeto);
        etapa.concluida = e.target.checked;
        const depoisPct = calcularProgresso(projeto);
        if (depoisPct >= 100 && projeto.status !== "concluido") {
          projeto.status = "concluido";
          document.getElementById("ws-status-dot").style.backgroundColor = ctx().METADADOS_STATUS.concluido.cor;
          document.getElementById("ws-status-texto").textContent = ctx().METADADOS_STATUS.concluido.rotulo;
          mostrarToast("🎉 Parabéns! Todas as etapas concluídas — Peça Finalizada!");
        }
        renderizarEtapasWorkspace(projeto);
        atualizarProgressoWorkspace(projeto, antesPct < 100 && depoisPct >= 100);
        agendarSalvarWorkspace(projeto);
      });

      li.querySelector(".btn-ws-rem-etapa")?.addEventListener("click", () => {
        projeto.etapas.splice(idx, 1);
        renderizarEtapasWorkspace(projeto);
        atualizarProgressoWorkspace(projeto, false);
        agendarSalvarWorkspace(projeto);
      });

      lista.appendChild(li);
    });
  }

  // --- Ficha Técnica & Ferramentas Ligadas (RF05) ---
  function renderizarMateriaisWorkspace(projeto) {
    const agEl = document.getElementById("ws-agulha-resumo");
    if (agEl) {
      const mm = projeto.materiais?.agulha_mm;
      const nome = projeto.materiais?.agulha_nome;
      agEl.textContent = nome && mm ? `${nome} (${mm})` : mm || nome || "Não informada";
    }

    const listaFios = document.getElementById("ws-lista-fios");
    if (listaFios) {
      const fios = projeto.materiais?.fios || [];
      listaFios.innerHTML = "";
      if (fios.length === 0) {
        listaFios.innerHTML = `<p class="ws-vazio-mini">Nenhum fio vinculado. Clique em "+ Fio" para puxar do estoque ou informar manualmente.</p>`;
      } else {
        fios.forEach((f, idx) => {
          const item = document.createElement("div");
          item.className = "ws-fio-card";
          const detalhes = [
            f.marca ? f.marca : "",
            f.cor ? `Cor: ${f.cor}` : "",
            f.lote ? `Lote: ${f.lote}` : "",
            f.quantidade ? `${f.quantidade} nov.` : ""
          ].filter(Boolean);
          item.innerHTML = `
            <div>
              <strong>🧶 ${escapeHtml(f.nome || "Fio")}</strong>
              <span>${escapeHtml(detalhes.join(" • ") || "Sem detalhes extras")}</span>
            </div>
            <button type="button" class="btn-ws-rem-etapa" title="Remover fio">&times;</button>
          `;
          item.querySelector("button")?.addEventListener("click", () => {
            projeto.materiais.fios.splice(idx, 1);
            renderizarMateriaisWorkspace(projeto);
            agendarSalvarWorkspace(projeto);
          });
          listaFios.appendChild(item);
        });
      }
    }

    const am = projeto.amostra || {};
    const amResumo = document.getElementById("ws-resumo-amostra");
    if (amResumo) {
      amResumo.textContent =
        am.pontos && am.carreiras
          ? `${am.pontos} pts × ${am.carreiras} carr (${am.largura || 10}×${am.altura || 10}${am.unidade || "cm"})`
          : "Abrir na Calculadora de Amostra";
    }

    const prec = projeto.precificacao || {};
    const precResumo = document.getElementById("ws-resumo-precificacao");
    if (precResumo) {
      precResumo.textContent =
        prec.precoVenda > 0
          ? `Venda: ${formatarMoeda(prec.precoVenda)} (Custo ${formatarMoeda(prec.custoTotal)})`
          : "Calcular preço desta peça";
    }
  }

  // --- Galeria de Progresso (RF09) ---
  function renderizarGaleriaWorkspace(projeto) {
    const grade = document.getElementById("ws-grade-galeria");
    if (!grade) return;
    const fotos = projeto.galeria || [];
    grade.innerHTML = "";
    if (fotos.length === 0) {
      grade.innerHTML = `<p class="ws-vazio-mini" style="grid-column:1/-1">Registre fotos intermediárias para acompanhar a evolução da sua peça.</p>`;
      return;
    }

    fotos.forEach((foto, idx) => {
      const card = document.createElement("div");
      card.className = "ws-foto-prog-card";
      card.innerHTML = `
        <img src="${foto.foto_url}" alt="${escapeHtml(foto.legenda || "Progresso")}" loading="lazy" />
        <span class="ws-foto-prog-data">${escapeHtml(formatarDataBr(foto.data) || "Hoje")}</span>
        <button type="button" class="btn-ws-rem-foto" title="Remover foto">&times;</button>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-ws-rem-foto")) return;
        abrirLightboxGaleria(foto);
      });

      card.querySelector(".btn-ws-rem-foto")?.addEventListener("click", (e) => {
        e.stopPropagation();
        projeto.galeria.splice(idx, 1);
        renderizarGaleriaWorkspace(projeto);
        agendarSalvarWorkspace(projeto);
      });

      grade.appendChild(card);
    });
  }

  function abrirLightboxGaleria(foto) {
    const modal = document.getElementById("modal-lightbox-galeria");
    const img = document.getElementById("lightbox-proj-img");
    const dataEl = document.getElementById("lightbox-proj-data");
    const legEl = document.getElementById("lightbox-proj-legenda");
    if (!modal || !img) return;
    img.src = foto.foto_url;
    if (dataEl) dataEl.textContent = formatarDataBr(foto.data) || "";
    if (legEl) legEl.textContent = foto.legenda || "Registro de progresso";
    modal.style.display = "flex";
  }

  // ==========================================================================
  // PARTE 5: DRAWER CRIAR / EDITAR PROJETO (ACCORDIONS) + EXCLUSÃO
  // ==========================================================================

  function atualizarPreviewCapaForm(dataUrl) {
    const ph = document.getElementById("upload-capa-placeholder");
    const prev = document.getElementById("upload-capa-preview");
    const img = document.getElementById("upload-capa-img");
    const inp = document.getElementById("proj-capa-input");
    if (dataUrl) {
      if (img) img.src = dataUrl;
      if (prev) prev.style.display = "block";
      if (ph) ph.style.display = "none";
    } else {
      if (img) img.src = "";
      if (prev) prev.style.display = "none";
      if (ph) ph.style.display = "flex";
      if (inp) inp.value = "";
    }
  }

  async function abrirDrawerForm(dados = null) {
    await carregarDependenciasInventarios();
    const modal = document.getElementById("modal-form-projeto");
    const form = document.getElementById("form-projeto");
    const erro = document.getElementById("aviso-erro-proj");
    const titulo = document.getElementById("titulo-form-projeto");
    const accOpc = document.getElementById("accordion-materiais-prazos");
    if (!modal || !form) return;

    form.reset();
    if (erro) erro.style.display = "none";

    const edicao = Boolean(dados && dados.id);
    if (titulo) titulo.textContent = edicao ? "Editar Pasta do Projeto" : "Novo Projeto";

    document.getElementById("proj-id").value = edicao ? dados.id : "";
    document.getElementById("proj-nome").value = dados?.nome || "";
    const tecPadrao =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obterTecnicaEfetiva === "function"
        ? Configuracoes.obterTecnicaEfetiva()
        : "croche";
    const tecInicial = dados?.tecnica || tecPadrao;
    const catPadrao = tecInicial === "trico" ? "vestuario" : "amigurumi";
    const selTec = document.getElementById("proj-tecnica");
    if (selTec) selTec.value = tecInicial;
    document.getElementById("proj-categoria").value = dados?.categoria || catPadrao;
    document.getElementById("proj-status").value = dados?.status || "em_andamento";
    document.getElementById("proj-data-inicio").value = dados?.data_inicio || new Date().toISOString().slice(0, 10);
    document.getElementById("proj-prazo").value = dados?.prazo_estimado || "";
    document.getElementById("proj-cliente").value = dados?.cliente || "";
    document.getElementById("proj-agulha-select").value = dados?.materiais?.agulha_id ? String(dados.materiais.agulha_id) : "";
    document.getElementById("proj-agulha-mm").value = dados?.materiais?.agulha_mm || "";
    const fio0 = dados?.materiais?.fios?.[0];
    document.getElementById("proj-fio-principal-select").value = fio0?.fio_id ? String(fio0.fio_id) : "";
    document.getElementById("proj-amostra-select").value = dados?.amostra_id ? String(dados.amostra_id) : "";
    document.getElementById("proj-etapas-iniciais").value = (dados?.etapas || []).map((e) => e.titulo).join("\n");
    document.getElementById("proj-observacoes").value = dados?.observacoes || "";

    fotoCapaFormBase64 = dados?.foto_capa || "";
    atualizarPreviewCapaForm(fotoCapaFormBase64);

    if (accOpc) accOpc.open = edicao;
    modal.style.display = "flex";
    setTimeout(() => document.getElementById("proj-nome")?.focus(), 80);
  }

  function fecharDrawerForm() {
    const modal = document.getElementById("modal-form-projeto");
    if (modal) modal.style.display = "none";
    fotoCapaFormBase64 = "";
  }

  async function submitFormProjeto(e) {
    e.preventDefault();
    const erro = document.getElementById("aviso-erro-proj");
    if (erro) erro.style.display = "none";

    const idVal = document.getElementById("proj-id").value;
    const nome = document.getElementById("proj-nome").value.trim();
    if (!nome) {
      if (erro) {
        erro.textContent = "Informe o nome do projeto para criar a pasta.";
        erro.style.display = "block";
      }
      document.getElementById("proj-nome")?.focus();
      return;
    }

    const existente = idVal ? obterProjetoPorId(idVal) : null;
    const tecnica = document.getElementById("proj-tecnica")?.value || "croche";
    const categoria = document.getElementById("proj-categoria").value || (tecnica === "trico" ? "vestuario" : "amigurumi");
    const status = document.getElementById("proj-status").value || "em_andamento";
    const dataInicio = document.getElementById("proj-data-inicio").value || "";
    const prazo = document.getElementById("proj-prazo").value || "";
    const cliente = document.getElementById("proj-cliente").value.trim();
    const observacoes = document.getElementById("proj-observacoes").value.trim();

    // Agulha
    const agIdStr = document.getElementById("proj-agulha-select").value;
    const agObj = agIdStr ? agulhasCache.find((a) => String(a.id) === agIdStr) : null;
    const agMmDigitado = document.getElementById("proj-agulha-mm").value.trim();
    const agMmFinal = agMmDigitado || (agObj?.atributos?.espessura_mm ? `${agObj.atributos.espessura_mm}mm` : "");

    // Fio principal (mantém demais fios se for edição)
    const fioIdStr = document.getElementById("proj-fio-principal-select").value;
    const fioObj = fioIdStr ? fiosCache.find((f) => String(f.id) === fioIdStr) : null;
    let fiosLista = existente ? [...(existente.materiais?.fios || [])] : [];
    if (fioObj) {
      const jaTem = fiosLista.some((f) => Number(f.fio_id) === Number(fioObj.id));
      if (!jaTem) {
        fiosLista.unshift({
          id: `fio-${Date.now()}`,
          fio_id: fioObj.id,
          nome: fioObj.nome,
          marca: fioObj.marca || "",
          cor: fioObj.cor_nome || "",
          lote: fioObj.lote || "",
          quantidade: 1,
          preco_pago: Number(fioObj.preco_pago) || 0,
          peso_novelo_g: Number(fioObj.peso_novelo_g) || 0
        });
      }
    }

    // Amostra vinculada do Banco de Amostras
    const amIdStr = document.getElementById("proj-amostra-select").value;
    const amObj = amIdStr ? amostrasCache.find((a) => String(a.id) === amIdStr) : null;
    let dadosAmostra = existente ? { ...(existente.amostra || {}) } : { tecnica };
    if (amObj) {
      dadosAmostra = {
        ...dadosAmostra,
        amostra_banco_id: amObj.id,
        tecnica: amObj.tecnica || tecnica,
        largura: amObj.largura_cm || 10,
        altura: amObj.altura_cm || 10,
        pontos: amObj.pontos,
        carreiras: amObj.carreiras,
        unidade: "cm"
      };
    }

    // Etapas (preserva concluídas pelo título ao editar)
    const linhasEtapas = document
      .getElementById("proj-etapas-iniciais")
      .value.split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const mapaFeitas = new Map((existente?.etapas || []).map((et) => [et.titulo.toLowerCase(), et.concluida]));
    const etapasFinais = linhasEtapas.map((tit, i) => ({
      id: `et-${Date.now()}-${i}`,
      titulo: tit,
      concluida: Boolean(mapaFeitas.get(tit.toLowerCase()))
    }));

    const registroBase = {
      ...(existente || {}),
      nome,
      tecnica,
      categoria,
      status,
      foto_capa: fotoCapaFormBase64 || "",
      data_inicio: dataInicio,
      prazo_estimado: prazo,
      cliente,
      observacoes,
      agulha_id: agObj ? Number(agObj.id) : null,
      amostra_id: amObj ? Number(amObj.id) : null,
      etapas: etapasFinais,
      materiais: {
        fios: fiosLista,
        agulha_id: agObj ? Number(agObj.id) : null,
        agulha_mm: agMmFinal,
        agulha_nome: agObj ? agObj.nome : agMmFinal ? `Agulha ${agMmFinal}` : ""
      },
      amostra: dadosAmostra
    };
    if (existente?.id !== undefined) {
      registroBase.id = existente.id;
    } else {
      delete registroBase.id;
    }

    const registro = normalizar(registroBase);

    let salvo;
    try {
      salvo = await salvarProjeto(registro);
    } catch (err) {
      console.error("Erro ao salvar pasta do projeto:", err);
      const detalhe = err && err.message ? ` (${err.message})` : "";
      if (erro) {
        erro.textContent = `Não foi possível salvar a pasta do projeto${detalhe}.`;
        erro.style.display = "block";
      }
      mostrarToast("Erro ao salvar pasta do projeto.");
      return;
    }

    fecharDrawerForm();

    // Regra principal do usuário: ao criar um novo projeto, todas as ferramentas
    // já ficam ligadas a esse projeto e salvam as informações nele!
    const autoVincular = typeof Configuracoes === "undefined" || Configuracoes.obter("autoVincularProjeto") !== false;
    if (!existente && ctx() && autoVincular) {
      try {
        await ctx().retirarProjeto(salvo, { origem: "criacao" });
      } catch (errSync) {
        console.warn("Aviso ao vincular ferramentas após criação:", errSync);
      }
      aplicarFiltros(false);
      mostrarToast(`📂 "${salvo.nome}" criado e ligado a todas as ferramentas!`);
      abrirTelinhaPasta(salvo.id);
    } else {
      mostrarToast("✓ Pasta do projeto atualizada!");
      if (projetoWorkspaceId && Number(projetoWorkspaceId) === Number(salvo.id)) {
        renderizarWorkspace(salvo);
      }
    }
  }

  async function duplicarProjeto(id) {
    const orig = obterProjetoPorId(id);
    if (!orig) return;
    const baseCopia = {
      ...orig,
      nome: `${orig.nome} (Cópia)`,
      status: "na_fila",
      arquivado: false,
      tempo_gasto_seg: 0,
      etapas: (orig.etapas || []).map((e, i) => ({ ...e, id: `et-${Date.now()}-${i}`, concluida: false })),
      criado_em: new Date().toISOString()
    };
    delete baseCopia.id;
    const copia = normalizar(baseCopia);
    await salvarProjeto(copia);
    mostrarToast(`📄 Projeto duplicado: "${copia.nome}"`);
  }

  function solicitarExclusao(id) {
    const p = obterProjetoPorId(id);
    if (!p) return;
    projetoParaExcluirId = p.id;
    const txt = document.getElementById("texto-excluir-proj");
    if (txt) {
      txt.innerHTML = `Deseja excluir permanentemente a pasta <strong>${escapeHtml(p.nome)}</strong>? Esta ação não pode ser desfeita.`;
    }
    const modal = document.getElementById("modal-excluir-projeto");
    if (modal) modal.style.display = "flex";
  }

  function fecharModalExclusao() {
    const modal = document.getElementById("modal-excluir-projeto");
    if (modal) modal.style.display = "none";
    projetoParaExcluirId = null;
  }

  async function confirmarExclusao() {
    if (projetoParaExcluirId === null) return;
    const id = projetoParaExcluirId;
    if (typeof BancoDadosPT !== "undefined") {
      await BancoDadosPT.excluir(STORE_PROJETOS, id);
    }
    projetosCache = projetosCache.filter((p) => Number(p.id) !== Number(id));
    if (ctx()) ctx().sincronizarExterno(null, id);

    if (projetoWorkspaceId && Number(projetoWorkspaceId) === Number(id)) {
      voltarParaDashboard();
    }
    fecharModalExclusao();
    atualizarFiltroFiosDisponiveis();
    atualizarContadoresChips();
    aplicarFiltros(false);
    mostrarToast("Pasta removida.");
  }

  // ==========================================================================
  // PARTE 6: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================

  function vincularEventos() {
    // Botões Novo Projeto
    document.getElementById("btn-novo-projeto-header")?.addEventListener("click", () => abrirDrawerForm(null));
    document.getElementById("btn-vazio-novo-projeto")?.addEventListener("click", () => abrirDrawerForm(null));

    // Evento vindo da Home ("+ Novo projeto")
    window.addEventListener("ponto-trama:novo-projeto", () => {
      voltarParaDashboard();
      abrirDrawerForm(null);
    });

    // Busca e Filtros
    const busca = document.getElementById("busca-projetos");
    if (busca) {
      const deb = typeof BancoDadosPT !== "undefined" ? BancoDadosPT.debounce(() => aplicarFiltros(false), 80) : () => aplicarFiltros(false);
      busca.addEventListener("input", deb);
    }
    document.getElementById("filtro-categoria-projetos")?.addEventListener("change", () => aplicarFiltros(true));
    document.getElementById("filtro-fio-projetos")?.addEventListener("change", () => aplicarFiltros(true));
    document.getElementById("btn-limpar-filtros-projetos")?.addEventListener("click", limparFiltros);

    document.querySelectorAll("#chips-status-projetos .chip-status-proj").forEach((chip) => {
      chip.addEventListener("click", () => {
        filtroStatusAtivo = chip.dataset.status || "todos";
        document.querySelectorAll("#chips-status-projetos .chip-status-proj").forEach((c) => {
          c.classList.toggle("ativo", c === chip);
        });
        aplicarFiltros(true);
      });
    });

    // Overlay Telinha da Pasta Aberta
    document.getElementById("btn-fechar-pasta-aberta")?.addEventListener("click", fecharTelinhaPasta);
    document.getElementById("modal-pasta-aberta")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-pasta-aberta") fecharTelinhaPasta();
    });
    document.getElementById("btn-dossie-editar")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoPastaAbertaId);
      fecharTelinhaPasta();
      if (p) abrirDrawerForm(p);
    });
    document.getElementById("btn-dossie-abrir-workspace")?.addEventListener("click", () => {
      if (projetoPastaAbertaId !== null) abrirWorkspacePorId(projetoPastaAbertaId);
    });
    document.getElementById("btn-dossie-retirar")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoPastaAbertaId);
      if (p) executarRetirarProjeto(p, true);
    });

    // Workspace: Topo
    document.getElementById("btn-ws-voltar")?.addEventListener("click", voltarParaDashboard);
    document.getElementById("btn-ws-editar")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (p) abrirDrawerForm(p);
    });
    document.getElementById("btn-ws-retirar")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (p) executarRetirarProjeto(p, false);
    });

    // Dropdown Status no Workspace
    const btnSt = document.getElementById("btn-ws-status-toggle");
    const menuSt = document.getElementById("ws-menu-status");
    btnSt?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!menuSt) return;
      const aberto = menuSt.style.display === "flex";
      menuSt.style.display = aberto ? "none" : "flex";
      btnSt.setAttribute("aria-expanded", aberto ? "false" : "true");
    });

    document.querySelectorAll("#ws-menu-status .opcao-status-ws").forEach((op) => {
      op.addEventListener("click", async () => {
        const p = obterProjetoPorId(projetoWorkspaceId);
        if (!p) return;
        const novoSt = op.dataset.status;
        const eraConcluido = p.status === "concluido";
        p.status = novoSt;
        if (menuSt) menuSt.style.display = "none";
        const meta = ctx()?.METADADOS_STATUS[novoSt];
        if (meta) {
          document.getElementById("ws-status-dot").style.backgroundColor = meta.cor;
          document.getElementById("ws-status-texto").textContent = meta.rotulo;
        }
        atualizarProgressoWorkspace(p, !eraConcluido && novoSt === "concluido");
        if (!eraConcluido && novoSt === "concluido") {
          mostrarToast("🎉 Peça Finalizada! Status alterado para Concluído.");
        }
        await salvarProjeto(p, { silencioso: true });
      });
    });

    // Abas Mobile do Workspace
    document.querySelectorAll("#ws-abas-mobile .ws-aba-mob").forEach((btn) => {
      btn.addEventListener("click", () => {
        const alvo = btn.dataset.abaWs;
        document.querySelectorAll("#ws-abas-mobile .ws-aba-mob").forEach((b) => {
          b.classList.toggle("ativa", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        document.getElementById("ws-col-execucao")?.classList.toggle("ativa-mobile", alvo === "execucao");
        document.getElementById("ws-col-metadados")?.classList.toggle("ativa-mobile", alvo === "metadados");
      });
    });

    // Workspace: Contadores
    document.getElementById("btn-ws-cont-mais")?.addEventListener("click", () => alterarContadorWorkspace(1, true));
    document.getElementById("btn-ws-cont-menos")?.addEventListener("click", () => alterarContadorWorkspace(-1, true));
    document.getElementById("btn-ws-cont-zerar")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p || !p.contadores[contadorAtivoIdx]) return;
      p.contadores[contadorAtivoIdx].carreiras = 0;
      renderizarContadoresWorkspace(p);
      sincronizarContadoresDoWorkspace(p);
    });
    document.getElementById("btn-ws-add-contador")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      const proxNum = p.contadores.length + 1;
      p.contadores.push({ id: String(Date.now()), nome: `Parte ${proxNum}`, carreiras: 0, pontosPorCarreira: 0, meta: 0 });
      contadorAtivoIdx = p.contadores.length - 1;
      renderizarContadoresWorkspace(p);
      sincronizarContadoresDoWorkspace(p);
    });
    document.getElementById("btn-ws-remover-contador")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p || p.contadores.length <= 1) return;
      p.contadores.splice(contadorAtivoIdx, 1);
      contadorAtivoIdx = Math.max(0, contadorAtivoIdx - 1);
      renderizarContadoresWorkspace(p);
      sincronizarContadoresDoWorkspace(p);
    });
    document.getElementById("ws-contador-nome")?.addEventListener("input", (e) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p || !p.contadores[contadorAtivoIdx]) return;
      p.contadores[contadorAtivoIdx].nome = e.target.value;
      const tab = document.querySelectorAll("#ws-tabs-contadores .ws-tab-contador")[contadorAtivoIdx];
      if (tab) tab.textContent = `${e.target.value || "Contador"} (${p.contadores[contadorAtivoIdx].carreiras})`;
      sincronizarContadoresDoWorkspace(p);
    });
    document.getElementById("ws-contador-pts-carr")?.addEventListener("input", (e) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p || !p.contadores[contadorAtivoIdx]) return;
      p.contadores[contadorAtivoIdx].pontosPorCarreira = Math.max(0, parseInt(e.target.value, 10) || 0);
      const total = p.contadores[contadorAtivoIdx].carreiras * p.contadores[contadorAtivoIdx].pontosPorCarreira;
      document.getElementById("ws-contador-total-pts").textContent = `${total.toLocaleString("pt-BR")} pts`;
      sincronizarContadoresDoWorkspace(p);
    });
    document.getElementById("ws-contador-meta")?.addEventListener("input", (e) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p || !p.contadores[contadorAtivoIdx]) return;
      p.contadores[contadorAtivoIdx].meta = Math.max(0, parseInt(e.target.value, 10) || 0);
      sincronizarContadoresDoWorkspace(p);
    });

    // Atalhos de Teclado para o Contador no Workspace (Espaço, ↑, ↓)
    document.addEventListener("keydown", (e) => {
      const ws = document.getElementById("projetos-visao-workspace");
      const secao = document.getElementById("secao-projetos");
      if (!secao || secao.style.display === "none" || !ws || ws.style.display === "none") return;

      // Fecha modais com ESC
      if (e.key === "Escape") {
        fecharTelinhaPasta();
        fecharDrawerForm();
        fecharModalExclusao();
        const lb = document.getElementById("modal-lightbox-galeria");
        if (lb) lb.style.display = "none";
        return;
      }

      // Ignora atalho se estiver digitando em um campo ou com modal aberto
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (document.getElementById("modal-form-projeto")?.style.display === "flex") return;
      if (document.getElementById("modal-pasta-aberta")?.style.display === "flex") return;

      if (typeof Configuracoes !== "undefined" && Configuracoes.obter("atalhosTeclado") === false) return;
      if (e.code === "Space" || e.key === "ArrowUp") {
        e.preventDefault();
        alterarContadorWorkspace(1, true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        alterarContadorWorkspace(-1, true);
      }
    });

    // Workspace: Cronômetro
    document.getElementById("btn-ws-cronometro-toggle")?.addEventListener("click", alternarCronometro);
    document.getElementById("btn-ws-crono-mais15")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      p.tempo_gasto_seg = (p.tempo_gasto_seg || 0) + 900;
      atualizarVisorCronometro(p);
      agendarSalvarWorkspace(p);
    });
    document.getElementById("btn-ws-crono-zerar")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      pararCronometro(false);
      p.tempo_gasto_seg = 0;
      atualizarVisorCronometro(p);
      agendarSalvarWorkspace(p);
    });

    // Workspace: Receita
    document.querySelectorAll("[data-ws-rec-modo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = obterProjetoPorId(projetoWorkspaceId);
        if (!p) return;
        p.receita.modo = btn.dataset.wsRecModo;
        renderizarReceitaWorkspace(p);
        sincronizarReceitaDoWorkspace(p);
      });
    });

    document.getElementById("btn-ws-rec-editar-toggle")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      receitaModoEdicaoTexto = !receitaModoEdicaoTexto;
      renderizarReceitaWorkspace(p);
      if (receitaModoEdicaoTexto) document.getElementById("ws-receita-textarea")?.focus();
    });

    document.getElementById("ws-receita-textarea")?.addEventListener("input", (e) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      p.receita.texto = e.target.value;
      sincronizarReceitaDoWorkspace(p);
    });

    document.getElementById("btn-ws-rec-linha-ant")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      p.receita.linha_atual = Math.max(0, (p.receita.linha_atual || 0) - 1);
      renderizarReceitaWorkspace(p);
      sincronizarReceitaDoWorkspace(p);
    });

    document.getElementById("btn-ws-rec-linha-prox")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      const total = (p.receita.texto || "").split("\n").filter((l) => l.trim() !== "").length;
      if (total <= 0) return;
      p.receita.linha_atual = Math.min(total - 1, (p.receita.linha_atual || 0) + 1);
      renderizarReceitaWorkspace(p);
      sincronizarReceitaDoWorkspace(p);
    });

    document.getElementById("ws-receita-arquivo-input")?.addEventListener("change", async (e) => {
      const arq = e.target.files?.[0];
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!arq || !p) return;
      try {
        let dataUrl = "";
        if (arq.type.startsWith("image/")) {
          dataUrl = await comprimirImagem(arq, 1200, 0.85);
        } else {
          dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(arq);
          });
        }
        p.receita.modo = "arquivo";
        p.receita.arquivo_nome = arq.name;
        p.receita.arquivo_tipo = arq.type || "";
        p.receita.arquivo_url = dataUrl;
        renderizarReceitaWorkspace(p);
        sincronizarReceitaDoWorkspace(p);
        mostrarToast("📖 Receita anexada à pasta!");
      } catch {
        mostrarToast("Não foi possível carregar este arquivo.");
      }
      e.target.value = "";
    });

    document.getElementById("btn-ws-rec-rem-arquivo")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      p.receita.arquivo_nome = "";
      p.receita.arquivo_tipo = "";
      p.receita.arquivo_url = "";
      renderizarReceitaWorkspace(p);
      sincronizarReceitaDoWorkspace(p);
    });

    document.getElementById("ws-regua-slider")?.addEventListener("input", (e) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      p.receita.regua_pct = Number(e.target.value) || 18;
      const linha = document.getElementById("ws-regua-linha-visual");
      if (linha) linha.style.top = `${p.receita.regua_pct}%`;
      sincronizarReceitaDoWorkspace(p);
    });

    // Workspace: Etapas e Progresso Manual
    document.querySelectorAll("[data-ws-prog-modo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = obterProjetoPorId(projetoWorkspaceId);
        if (!p) return;
        p.progresso_modo = btn.dataset.wsProgModo === "manual" ? "manual" : "auto";
        renderizarEtapasWorkspace(p);
        atualizarProgressoWorkspace(p, false);
        agendarSalvarWorkspace(p);
      });
    });

    document.getElementById("ws-slider-progresso-manual")?.addEventListener("input", (e) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      const antes = calcularProgresso(p);
      p.progresso_manual = Number(e.target.value) || 0;
      document.getElementById("ws-valor-prog-manual").textContent = `${p.progresso_manual}%`;
      atualizarProgressoWorkspace(p, antes < 100 && p.progresso_manual >= 100);
      agendarSalvarWorkspace(p);
    });

    document.getElementById("ws-form-nova-etapa")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const p = obterProjetoPorId(projetoWorkspaceId);
      const inp = document.getElementById("ws-input-nova-etapa");
      const titulo = (inp?.value || "").trim();
      if (!p || !titulo) return;
      p.etapas.push({ id: `et-${Date.now()}`, titulo, concluida: false });
      inp.value = "";
      renderizarEtapasWorkspace(p);
      atualizarProgressoWorkspace(p, false);
      agendarSalvarWorkspace(p);
    });

    // Workspace: Fios na Ficha Técnica
    const boxAddFio = document.getElementById("ws-add-fio-box");
    document.getElementById("btn-ws-toggle-add-fio")?.addEventListener("click", async () => {
      await carregarDependenciasInventarios();
      if (boxAddFio) boxAddFio.style.display = boxAddFio.style.display === "flex" ? "none" : "flex";
    });
    document.getElementById("btn-ws-cancelar-fio")?.addEventListener("click", () => {
      if (boxAddFio) boxAddFio.style.display = "none";
    });
    document.getElementById("ws-select-fio-estoque")?.addEventListener("change", (e) => {
      const f = fiosCache.find((item) => String(item.id) === e.target.value);
      if (!f) return;
      document.getElementById("ws-fio-nome").value = f.nome || "";
      document.getElementById("ws-fio-cor").value = f.cor_nome || "";
      document.getElementById("ws-fio-lote").value = f.lote || "";
    });
    document.getElementById("btn-ws-confirmar-fio")?.addEventListener("click", () => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!p) return;
      const selId = document.getElementById("ws-select-fio-estoque")?.value || "";
      const fEst = selId ? fiosCache.find((i) => String(i.id) === selId) : null;
      const nome = document.getElementById("ws-fio-nome").value.trim() || fEst?.nome || "";
      if (!nome) return;
      p.materiais.fios.push({
        id: `fio-${Date.now()}`,
        fio_id: fEst ? fEst.id : null,
        nome,
        marca: fEst?.marca || "",
        cor: document.getElementById("ws-fio-cor").value.trim() || fEst?.cor_nome || "",
        lote: document.getElementById("ws-fio-lote").value.trim() || fEst?.lote || "",
        quantidade: parseFloat(document.getElementById("ws-fio-qtd").value) || 1,
        preco_pago: Number(fEst?.preco_pago) || 0,
        peso_novelo_g: Number(fEst?.peso_novelo_g) || 0
      });
      document.getElementById("ws-fio-nome").value = "";
      document.getElementById("ws-fio-cor").value = "";
      document.getElementById("ws-fio-lote").value = "";
      document.getElementById("ws-select-fio-estoque").value = "";
      if (boxAddFio) boxAddFio.style.display = "none";
      renderizarMateriaisWorkspace(p);
      agendarSalvarWorkspace(p);
    });

    // Workspace: Atalhos diretos para cada ferramenta (retira o projeto antes de navegar!)
    const abrirNaFerramenta = async (chave) => {
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (p && ctx()) {
        await ctx().retirarProjeto(p, { origem: `atalho-${chave}` });
      }
      irParaFerramenta(chave);
    };
    document.getElementById("btn-ws-ir-contadores")?.addEventListener("click", () => abrirNaFerramenta("contador-carreiras"));
    document.getElementById("btn-ws-tempo-precificacao")?.addEventListener("click", () => abrirNaFerramenta("precificacao"));
    document.getElementById("btn-ws-ir-receitas")?.addEventListener("click", () => abrirNaFerramenta("receitas"));
    document.getElementById("btn-ws-ir-agulhas")?.addEventListener("click", () => abrirNaFerramenta("agulhas"));
    document.getElementById("btn-ws-ir-amostra")?.addEventListener("click", () => abrirNaFerramenta("amostra"));
    document.getElementById("btn-ws-ir-precificacao")?.addEventListener("click", () => abrirNaFerramenta("precificacao"));

    // Workspace: Upload Galeria de Progresso
    document.getElementById("ws-galeria-input")?.addEventListener("change", async (e) => {
      const arq = e.target.files?.[0];
      const p = obterProjetoPorId(projetoWorkspaceId);
      if (!arq || !p) return;
      try {
        const dataUrl = await comprimirImagem(arq, 820, 0.8);
        p.galeria.unshift({
          id: `foto-${Date.now()}`,
          foto_url: dataUrl,
          data: new Date().toISOString().slice(0, 10),
          legenda: `Progresso (${calcularProgresso(p)}%)`
        });
        renderizarGaleriaWorkspace(p);
        agendarSalvarWorkspace(p);
        mostrarToast("📸 Foto adicionada à galeria de progresso!");
      } catch {
        mostrarToast("Não foi possível carregar a imagem.");
      }
      e.target.value = "";
    });

    // Drawer Criar/Editar
    document.getElementById("btn-fechar-form-projeto")?.addEventListener("click", fecharDrawerForm);
    document.getElementById("btn-cancelar-form-projeto")?.addEventListener("click", fecharDrawerForm);
    document.getElementById("modal-form-projeto")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-form-projeto") fecharDrawerForm();
    });
    document.getElementById("form-projeto")?.addEventListener("submit", submitFormProjeto);

    document.getElementById("proj-agulha-select")?.addEventListener("change", (e) => {
      const ag = agulhasCache.find((a) => String(a.id) === e.target.value);
      if (ag?.atributos?.espessura_mm) {
        document.getElementById("proj-agulha-mm").value = `${ag.atributos.espessura_mm}mm`;
      }
    });

    document.getElementById("btn-sugerir-etapas-cat")?.addEventListener("click", () => {
      const cat = document.getElementById("proj-categoria")?.value || "amigurumi";
      const lista = ETAPAS_SUGERIDAS[cat] || ETAPAS_SUGERIDAS.amigurumi;
      document.getElementById("proj-etapas-iniciais").value = lista.join("\n");
    });

    document.getElementById("proj-capa-input")?.addEventListener("change", async (e) => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      try {
        fotoCapaFormBase64 = await comprimirImagem(arq, 780, 0.82);
        atualizarPreviewCapaForm(fotoCapaFormBase64);
      } catch {
        mostrarToast("Selecione uma imagem válida (PNG, JPG ou WEBP).");
      }
    });
    document.getElementById("btn-remover-capa-proj")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fotoCapaFormBase64 = "";
      atualizarPreviewCapaForm("");
    });

    // Modais de Exclusão & Lightbox
    document.getElementById("btn-cancelar-exclusao-proj")?.addEventListener("click", fecharModalExclusao);
    document.getElementById("btn-confirmar-exclusao-proj")?.addEventListener("click", confirmarExclusao);
    document.getElementById("modal-excluir-projeto")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-excluir-projeto") fecharModalExclusao();
    });

    document.getElementById("btn-fechar-lightbox-proj")?.addEventListener("click", () => {
      document.getElementById("modal-lightbox-galeria").style.display = "none";
    });
    document.getElementById("modal-lightbox-galeria")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-lightbox-galeria") e.target.style.display = "none";
    });

    // Fecha dropdowns abertos ao clicar fora
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".pasta-menu-wrap")) fecharTodosDropdownsPasta();
      if (!e.target.closest("#ws-dropdown-status") && menuSt) menuSt.style.display = "none";
    });

    // Sincronização em tempo real quando outra ferramenta alterar o projeto ativo
    window.addEventListener("ponto-trama:projeto-atualizado", (e) => {
      const proj = e.detail?.projeto;
      if (!proj) return;
      const norm = normalizar(proj);
      const idx = projetosCache.findIndex((p) => Number(p.id) === Number(norm.id));
      if (idx !== -1) projetosCache[idx] = norm;
      if (projetoWorkspaceId && Number(projetoWorkspaceId) === Number(norm.id)) {
        renderizarWorkspace(norm);
      } else {
        aplicarFiltros(false);
      }
    });

    window.addEventListener("ponto-trama:projeto-ativo-mudou", () => {
      aplicarFiltros(false);
      if (projetoWorkspaceId) {
        const p = obterProjetoPorId(projetoWorkspaceId);
        if (p) atualizarBotaoRetirarWorkspace(p);
      }
    });
  }

  async function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    vincularEventos();
    await carregarDependenciasInventarios();
    await carregarProjetos(true);
  }

  return {
    init,
    abrirModalNovoProjeto: () => abrirDrawerForm(null),
    abrirWorkspacePorId,
    abrirTelinhaPasta,
    recarregar: () => carregarProjetos(false)
  };
})();
