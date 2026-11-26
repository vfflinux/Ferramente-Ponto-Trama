// ==========================================================================
// CONTROLE DA BARRA LATERAL, NAVEGAÇÃO, POPUP CONECTADO "FERRAMENTAS"
// E ARRASTAR & SOLTAR BIDIRECIONAL (BARRA LATERAL <-> POPUP <-> CONFIGURAÇÕES)
// ==========================================================================

const BarraLateral = (() => {
  const FERRAMENTAS_FIXAS = new Set(["home", "configuracoes"]);
  const FERRAMENTAS_PERSONALIZAVEIS = [
    "contador-carreiras",
    "receitas",
    "precificacao",
    "projetos",
    "fios",
    "agulhas",
    "amostra",
    "banco-amostras",
    "editor-graficos",
    "tabelas-conversao"
  ];
  const PADRAO_VISIVEIS = ["projetos", "contador-carreiras", "receitas", "precificacao", "fios"];

  let ferramentaAtual = "home";
  let ferramentasVisiveisOrdem = [...PADRAO_VISIVEIS];
  let ferramentasVisiveisSet = new Set(PADRAO_VISIVEIS);
  let popupAberto = false;
  let sincronizandoInternamente = false;
  let ultimoFimArrastoMs = 0;

  // Estado do Drag & Drop via Pointer Events (Web, Ubuntu WebKit2GTK e Android Touch)
  let arrasto = null;

  // ==========================================================================
  // PARTE 1: POPUP CONECTADO E VISIBILIDADE DAS FERRAMENTAS
  // ==========================================================================

  function atualizarClasseModoArrasto() {
    const barra = document.querySelector(".barraLateral");
    if (barra) barra.classList.toggle("modo-arrastar-ferramentas", popupAberto);
  }

  function fecharPopupFerramentas() {
    const popup = document.getElementById("popup-ferramentas-lateral");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    popupAberto = false;
    atualizarClasseModoArrasto();
    if (popup) {
      popup.classList.remove("aberto", "zona-drop-ativa", "zona-drop-hover");
      popup.setAttribute("aria-hidden", "true");
    }
    if (btnAba) {
      btnAba.classList.remove("popup-aberto");
      btnAba.setAttribute("aria-expanded", "false");
      // Se ficou sem nenhuma ferramenta oculta após fechar, oculta a aba Ferramentas
      const totalOcultas = FERRAMENTAS_PERSONALIZAVEIS.filter(
        (k) => !ferramentasVisiveisSet.has(k)
      ).length;
      if (totalOcultas === 0) {
        btnAba.classList.add("ferramenta-oculta-barra");
      }
    }
  }

  function posicionarPopupConectado() {
    const popup = document.getElementById("popup-ferramentas-lateral");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    const barra = document.querySelector(".barraLateral");
    if (!popup || !btnAba || !barra) return;

    if (window.innerWidth <= 768) {
      popup.style.top = "";
      popup.style.bottom = "";
      return;
    }

    const barraRect = barra.getBoundingClientRect();
    const btnRect = btnAba.getBoundingClientRect();
    const popupAltura = popup.offsetHeight || 160;
    const btnCentroY = btnRect.top - barraRect.top + btnRect.height / 2;

    let topPx = Math.round(btnCentroY - popupAltura / 2);
    const maxTop = Math.max(8, barraRect.height - popupAltura - 8);
    topPx = Math.max(8, Math.min(topPx, maxTop));

    popup.style.top = `${topPx}px`;
    popup.style.bottom = "auto";

    const origemY = Math.max(12, Math.min(popupAltura - 12, Math.round(btnCentroY - topPx)));
    popup.style.transformOrigin = `left ${origemY}px`;
  }

  function abrirPopupFerramentas() {
    const popup = document.getElementById("popup-ferramentas-lateral");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    if (!popup || !btnAba) return;

    const totalOcultas = FERRAMENTAS_PERSONALIZAVEIS.filter(
      (k) => !ferramentasVisiveisSet.has(k)
    ).length;
    if (totalOcultas === 0) return;

    posicionarPopupConectado();
    popupAberto = true;
    atualizarClasseModoArrasto();
    popup.classList.add("aberto");
    popup.setAttribute("aria-hidden", "false");
    btnAba.classList.add("popup-aberto");
    btnAba.setAttribute("aria-expanded", "true");
  }

  function alternarPopupFerramentas() {
    if (popupAberto) fecharPopupFerramentas();
    else abrirPopupFerramentas();
  }

  function sincronizarDestaqueAbaFerramentas() {
    const btnAba = document.getElementById("btn-aba-ferramentas");
    const grade = document.getElementById("popup-ferramentas-grade");
    const ativaEstaNoPopup =
      !FERRAMENTAS_FIXAS.has(ferramentaAtual) && !ferramentasVisiveisSet.has(ferramentaAtual);

    if (btnAba) {
      btnAba.classList.toggle("ativo", ativaEstaNoPopup);
    }

    if (grade) {
      grade.querySelectorAll(".btn-popup-ferramenta-icone").forEach((b) => {
        b.classList.toggle("ativo", b.dataset.ferramentaAlvo === ferramentaAtual);
      });
    }
  }

  function aplicarOrdemDomSidebar() {
    const lista = document.querySelector(".barraLateral .listaNavegacao");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    if (!lista || !btnAba) return;

    // Mantém Início no topo, depois as ferramentas visíveis na ordem escolhida, depois ocultas, depois Ferramentas e Configurações
    const visiveisOrdenadas = ferramentasVisiveisOrdem.filter((k) =>
      FERRAMENTAS_PERSONALIZAVEIS.includes(k)
    );
    const ocultasOrdenadas = FERRAMENTAS_PERSONALIZAVEIS.filter(
      (k) => !ferramentasVisiveisSet.has(k)
    );
    const ordemFinal = [...visiveisOrdenadas, ...ocultasOrdenadas];

    ordemFinal.forEach((chave) => {
      const btn = lista.querySelector(`.botaoFerramenta[data-ferramenta="${chave}"]`);
      if (btn) lista.insertBefore(btn, btnAba);
    });
  }

  function reconstruirPopupFerramentas(chaveRecemMovida = null) {
    const btnAba = document.getElementById("btn-aba-ferramentas");
    const badge = document.getElementById("badge-qtd-ferramentas");
    const grade = document.getElementById("popup-ferramentas-grade");
    if (!btnAba || !grade) return;

    aplicarOrdemDomSidebar();

    const ocultas = [];
    document
      .querySelectorAll(".barraLateral .listaNavegacao .botaoFerramenta[data-ferramenta]")
      .forEach((btn) => {
        const chave = btn.dataset.ferramenta;
        if (!chave || FERRAMENTAS_FIXAS.has(chave)) return;
        const visivel = ferramentasVisiveisSet.has(chave);
        btn.classList.toggle("ferramenta-oculta-barra", !visivel);
        btn.classList.add("ferramenta-personalizavel");
        if (visivel && chave === chaveRecemMovida) {
          btn.classList.remove("ferramenta-recem-movida");
          void btn.offsetWidth;
          btn.classList.add("ferramenta-recem-movida");
        }
        if (!visivel) ocultas.push(btn);
      });

    if (badge) badge.textContent = String(ocultas.length);

    if (ocultas.length === 0) {
      if (!popupAberto) {
        btnAba.classList.add("ferramenta-oculta-barra");
        grade.innerHTML = "";
        return;
      }
      // Se o popup está aberto e o usuário acabou de arrastar o último ícone para fora,
      // mantém o popup aberto como área de soltura caso queira arrastar algo de volta
      btnAba.classList.remove("ferramenta-oculta-barra");
      grade.style.setProperty("--popup-cols", "1");
      grade.innerHTML = `<div class="popup-vazio-drop" aria-live="polite">Solte aqui para mover para Ferramentas</div>`;
      sincronizarDestaqueAbaFerramentas();
      requestAnimationFrame(posicionarPopupConectado);
      return;
    }

    btnAba.classList.remove("ferramenta-oculta-barra");

    const cols = ocultas.length <= 3 ? 1 : ocultas.length <= 6 ? 2 : 3;
    grade.style.setProperty("--popup-cols", String(cols));

    grade.innerHTML = "";
    ocultas.forEach((btnOriginal) => {
      const chave = btnOriginal.dataset.ferramenta;
      const titulo =
        btnOriginal.getAttribute("title") ||
        btnOriginal.querySelector("span")?.textContent?.trim() ||
        chave;
      const svgOriginal = btnOriginal.querySelector("svg.iconeFerramenta");

      const item = document.createElement("button");
      item.type = "button";
      item.className = "btn-popup-ferramenta-icone";
      item.dataset.ferramentaAlvo = chave;
      item.dataset.tooltip = titulo;
      item.setAttribute("role", "menuitem");
      item.setAttribute("aria-label", titulo);
      item.setAttribute("title", `${titulo} (arraste para a barra lateral ou clique para abrir)`);
      if (chave === ferramentaAtual) item.classList.add("ativo");
      if (chave === chaveRecemMovida) item.classList.add("ferramenta-recem-movida");

      if (svgOriginal) {
        const clone = svgOriginal.cloneNode(true);
        clone.classList.add("icone-popup-ferramenta");
        item.appendChild(clone);
      }

      item.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        iniciarPossivelArrasto(e, {
          chave,
          titulo,
          origem: "popup",
          elementoOrigem: item,
          svgHtml: svgOriginal ? svgOriginal.outerHTML : ""
        });
      });

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (Date.now() - ultimoFimArrastoMs < 260) return;
        alternarFerramenta(btnOriginal);
        fecharPopupFerramentas();
        const chkMenu = document.getElementById("opcao-menu");
        if (chkMenu && window.innerWidth <= 768) {
          chkMenu.checked = true;
        }
      });

      grade.appendChild(item);
    });

    sincronizarDestaqueAbaFerramentas();
    if (popupAberto) requestAnimationFrame(posicionarPopupConectado);
  }

  function aplicarFerramentasVisiveis(listaVisiveis, chaveRecemMovida = null) {
    if (sincronizandoInternamente) return;
    if (Array.isArray(listaVisiveis)) {
      const unicas = [];
      listaVisiveis.forEach((k) => {
        if (FERRAMENTAS_PERSONALIZAVEIS.includes(k) && !unicas.includes(k)) {
          unicas.push(k);
        }
      });
      ferramentasVisiveisOrdem = unicas;
      ferramentasVisiveisSet = new Set(unicas);
    } else {
      ferramentasVisiveisOrdem = [...PADRAO_VISIVEIS];
      ferramentasVisiveisSet = new Set(PADRAO_VISIVEIS);
    }
    reconstruirPopupFerramentas(chaveRecemMovida);
  }

  function persistirNovaListaFerramentas(novaLista, chaveRecemMovida) {
    aplicarFerramentasVisiveis(novaLista, chaveRecemMovida);
    sincronizandoInternamente = true;
    try {
      if (typeof Configuracoes !== "undefined" && typeof Configuracoes.atualizar === "function") {
        Configuracoes.atualizar("ferramentasBarraLateral", [...ferramentasVisiveisOrdem]);
      }
    } finally {
      sincronizandoInternamente = false;
    }
  }

  // ==========================================================================
  // PARTE 2: ARRASTAR & SOLTAR BIDIRECIONAL (POINTER EVENTS)
  // ==========================================================================

  function criarFantasmaArrasto(titulo, svgHtml, origem) {
    const ghost = document.createElement("div");
    ghost.className = `fantasma-arrasto-ferramenta origem-${origem}`;
    ghost.setAttribute("aria-hidden", "true");
    ghost.innerHTML = `${svgHtml}<span>${titulo}</span>`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function garantirLinhaInsercao() {
    let linha = document.getElementById("linha-insercao-sidebar");
    if (!linha) {
      linha = document.createElement("div");
      linha.id = "linha-insercao-sidebar";
      linha.className = "linha-insercao-sidebar";
      linha.setAttribute("aria-hidden", "true");
    }
    return linha;
  }

  function removerLinhaInsercao() {
    const linha = document.getElementById("linha-insercao-sidebar");
    if (linha && linha.parentNode) linha.parentNode.removeChild(linha);
  }

  function calcularAlvoInsercaoSidebar(clientY, chaveArrastada) {
    const lista = document.querySelector(".barraLateral .listaNavegacao");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    if (!lista || !btnAba) return { antesDe: btnAba, indice: ferramentasVisiveisOrdem.length };

    const botoesVisiveis = Array.from(
      lista.querySelectorAll(
        ".botaoFerramenta[data-ferramenta]:not(.ferramenta-oculta-barra)"
      )
    ).filter(
      (b) =>
        !FERRAMENTAS_FIXAS.has(b.dataset.ferramenta) &&
        b.dataset.ferramenta !== chaveArrastada
    );

    for (let i = 0; i < botoesVisiveis.length; i++) {
      const rect = botoesVisiveis[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return { antesDe: botoesVisiveis[i], indice: i };
      }
    }
    return { antesDe: btnAba, indice: botoesVisiveis.length };
  }

  function pontoDentroRect(x, y, rect, margem = 14) {
    if (!rect || rect.width === 0 || rect.height === 0) return false;
    return (
      x >= rect.left - margem &&
      x <= rect.right + margem &&
      y >= rect.top - margem &&
      y <= rect.bottom + margem
    );
  }

  function iniciarPossivelArrasto(e, info) {
    if (!popupAberto) return;

    arrasto = {
      ...info,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      ativo: false,
      ghost: null,
      zonaAtual: null,
      indiceInsercao: null
    };

    window.addEventListener("pointermove", aoMoverArrasto, { passive: false });
    window.addEventListener("pointerup", aoFinalizarArrasto);
    window.addEventListener("pointercancel", aoCancelarArrasto);
  }

  function ativarVisualArrasto(e) {
    if (!arrasto || arrasto.ativo) return;
    arrasto.ativo = true;
    document.body.classList.add("arrastando-ferramenta-sidebar");
    if (arrasto.elementoOrigem) {
      arrasto.elementoOrigem.classList.add("sendo-arrastada");
    }

    arrasto.ghost = criarFantasmaArrasto(arrasto.titulo, arrasto.svgHtml, arrasto.origem);
    atualizarPosicaoFantasma(e.clientX, e.clientY);

    const popup = document.getElementById("popup-ferramentas-lateral");
    const lista = document.querySelector(".barraLateral .listaNavegacao");
    if (arrasto.origem === "sidebar" && popup) {
      popup.classList.add("zona-drop-ativa");
    }
    if (arrasto.origem === "popup" && lista) {
      lista.classList.add("zona-drop-ativa");
    }
  }

  function atualizarPosicaoFantasma(x, y) {
    if (!arrasto || !arrasto.ghost) return;
    arrasto.ghost.style.transform = `translate3d(${Math.round(x + 12)}px, ${Math.round(y - 20)}px, 0)`;
  }

  function aoMoverArrasto(e) {
    if (!arrasto || e.pointerId !== arrasto.pointerId) return;

    const dx = e.clientX - arrasto.startX;
    const dy = e.clientY - arrasto.startY;
    if (!arrasto.ativo) {
      if (Math.hypot(dx, dy) < 6) return;
      ativarVisualArrasto(e);
    }

    e.preventDefault();
    atualizarPosicaoFantasma(e.clientX, e.clientY);

    const popup = document.getElementById("popup-ferramentas-lateral");
    const barra = document.querySelector(".barraLateral");
    const lista = document.querySelector(".barraLateral .listaNavegacao");

    const emPopup = popup && pontoDentroRect(e.clientX, e.clientY, popup.getBoundingClientRect(), 18);
    const emSidebar =
      !emPopup &&
      barra &&
      pontoDentroRect(e.clientX, e.clientY, barra.getBoundingClientRect(), 12);

    if (popup) popup.classList.toggle("zona-drop-hover", Boolean(emPopup && arrasto.origem === "sidebar"));
    if (lista) lista.classList.toggle("zona-drop-hover", Boolean(emSidebar));

    if (emPopup) {
      arrasto.zonaAtual = "popup";
      arrasto.indiceInsercao = null;
      removerLinhaInsercao();
    } else if (emSidebar && lista) {
      arrasto.zonaAtual = "sidebar";
      const alvo = calcularAlvoInsercaoSidebar(e.clientY, arrasto.chave);
      arrasto.indiceInsercao = alvo.indice;
      const linha = garantirLinhaInsercao();
      if (alvo.antesDe && alvo.antesDe.parentNode === lista) {
        lista.insertBefore(linha, alvo.antesDe);
      }
    } else {
      arrasto.zonaAtual = null;
      arrasto.indiceInsercao = null;
      removerLinhaInsercao();
    }
  }

  function limparEstadoArrasto() {
    window.removeEventListener("pointermove", aoMoverArrasto);
    window.removeEventListener("pointerup", aoFinalizarArrasto);
    window.removeEventListener("pointercancel", aoCancelarArrasto);

    document.body.classList.remove("arrastando-ferramenta-sidebar");
    document.getElementById("popup-ferramentas-lateral")?.classList.remove(
      "zona-drop-ativa",
      "zona-drop-hover"
    );
    document.querySelector(".barraLateral .listaNavegacao")?.classList.remove(
      "zona-drop-ativa",
      "zona-drop-hover"
    );
    removerLinhaInsercao();

    if (arrasto) {
      if (arrasto.elementoOrigem) arrasto.elementoOrigem.classList.remove("sendo-arrastada");
      if (arrasto.ghost && arrasto.ghost.parentNode) arrasto.ghost.parentNode.removeChild(arrasto.ghost);
    }
    arrasto = null;
  }

  function aoFinalizarArrasto(e) {
    if (!arrasto || e.pointerId !== arrasto.pointerId) return;
    const estado = arrasto;
    limparEstadoArrasto();

    if (!estado.ativo) return;
    ultimoFimArrastoMs = Date.now();

    const chave = estado.chave;

    // Caso 1: Arrastou da Barra Lateral -> para dentro do Popup (desativa nas Configurações)
    if (estado.origem === "sidebar" && estado.zonaAtual === "popup") {
      const novaLista = ferramentasVisiveisOrdem.filter((k) => k !== chave);
      persistirNovaListaFerramentas(novaLista, chave);
      return;
    }

    // Caso 2: Arrastou do Popup -> para a Barra Lateral (ativa nas Configurações na posição exata)
    if (estado.origem === "popup" && estado.zonaAtual === "sidebar") {
      const semChave = ferramentasVisiveisOrdem.filter((k) => k !== chave);
      const pos =
        typeof estado.indiceInsercao === "number"
          ? Math.max(0, Math.min(semChave.length, estado.indiceInsercao))
          : semChave.length;
      semChave.splice(pos, 0, chave);
      persistirNovaListaFerramentas(semChave, chave);
      return;
    }

    // Caso 3: Reordenou ferramenta dentro da própria Barra Lateral enquanto o popup está aberto
    if (estado.origem === "sidebar" && estado.zonaAtual === "sidebar" && typeof estado.indiceInsercao === "number") {
      const semChave = ferramentasVisiveisOrdem.filter((k) => k !== chave);
      const pos = Math.max(0, Math.min(semChave.length, estado.indiceInsercao));
      semChave.splice(pos, 0, chave);
      const mudou = semChave.some((k, i) => k !== ferramentasVisiveisOrdem[i]);
      if (mudou) {
        persistirNovaListaFerramentas(semChave, chave);
      }
    }
  }

  function aoCancelarArrasto(e) {
    if (!arrasto || e.pointerId !== arrasto.pointerId) return;
    if (arrasto.ativo) ultimoFimArrastoMs = Date.now();
    limparEstadoArrasto();
  }

  // ==========================================================================
  // PARTE 3: CATÁLOGO E TROCA DE FERRAMENTA ATIVA
  // ==========================================================================

  function obterListaCatalogoFerramentas() {
    const lista = [];
    FERRAMENTAS_PERSONALIZAVEIS.forEach((chave) => {
      const btn = document.querySelector(
        `.barraLateral .listaNavegacao .botaoFerramenta[data-ferramenta="${chave}"]`
      );
      if (!btn) return;
      const nome =
        btn.querySelector("span")?.textContent?.trim() ||
        btn.getAttribute("title") ||
        chave;
      const svgHtml = btn.querySelector("svg.iconeFerramenta")?.outerHTML || "";
      lista.push({ chave, nome, svgHtml });
    });
    return lista;
  }

  function alternarFerramenta(botaoClicado) {
    if (!botaoClicado) return;
    const botoesFerramenta = document.querySelectorAll(
      ".barraLateral .botaoFerramenta[data-ferramenta]"
    );
    const todasSecoesFerramentas = document.querySelectorAll(".secao-ferramenta");
    const secaoContador = document.getElementById("secao-contador-carreiras");
    const conteinerContador = document.getElementById("conteiner-contador");

    const ferramenta =
      botaoClicado.dataset.ferramenta || (botaoClicado.getAttribute("title") || "").toLowerCase();
    const isContador = ferramenta === "contador-carreiras" || ferramenta.includes("contador");
    ferramentaAtual = ferramenta;

    botoesFerramenta.forEach((b) => b.classList.remove("ativo"));
    botaoClicado.classList.add("ativo");
    sincronizarDestaqueAbaFerramentas();
    fecharPopupFerramentas();

    todasSecoesFerramentas.forEach((secao) => {
      secao.style.display = "none";
    });

    if (!isContador) {
      if (secaoContador) secaoContador.style.display = "none";
      if (conteinerContador) conteinerContador.style.display = "none";
    }

    const secaoAlvo = document.getElementById(`secao-${ferramenta}`);
    if (secaoAlvo) {
      secaoAlvo.style.display = "flex";
    }

    if (typeof PontoTramaApp !== "undefined" && typeof PontoTramaApp.garantirModulo === "function") {
      PontoTramaApp.garantirModulo(ferramenta);
    }

    if (isContador) {
      if (secaoContador) secaoContador.style.display = "flex";
      if (conteinerContador) conteinerContador.style.display = "flex";
    }

    window.dispatchEvent(
      new CustomEvent("ponto-trama:ferramenta-alterada", {
        detail: { ferramenta }
      })
    );

    const btnsMob = document.querySelectorAll(
      "#nav-mobile-inferior .nav-mob-btn[data-mob-ferramenta]"
    );
    let achouNaBarra = false;
    btnsMob.forEach((bm) => {
      const ativo = bm.dataset.mobFerramenta === ferramenta;
      bm.classList.toggle("ativo", ativo);
      if (ativo) achouNaBarra = true;
    });
    const btnMais = document.getElementById("btn-nav-mob-mais");
    if (btnMais) btnMais.classList.toggle("ativo", !achouNaBarra);
  }

  // ==========================================================================
  // PARTE 4: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================
  function init() {
    const chkMenu = document.getElementById("opcao-menu");
    const isMobileViewport = () =>
      (typeof window !== "undefined" && window.innerWidth <= 768) ||
      Boolean(typeof window !== "undefined" && window.PontoETramaAndroid);

    if (chkMenu && isMobileViewport()) {
      chkMenu.checked = true;
    }

    const salvas =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function"
        ? Configuracoes.obter("ferramentasBarraLateral")
        : PADRAO_VISIVEIS;
    aplicarFerramentasVisiveis(salvas);

    const botoesFerramenta = document.querySelectorAll(
      ".barraLateral .botaoFerramenta[data-ferramenta]"
    );
    botoesFerramenta.forEach((botao) => {
      const chave = botao.dataset.ferramenta;
      if (chave && !FERRAMENTAS_FIXAS.has(chave)) {
        botao.addEventListener("pointerdown", (e) => {
          if (!popupAberto) return;
          if (e.button !== 0 && e.pointerType === "mouse") return;
          const titulo =
            botao.getAttribute("title") ||
            botao.querySelector("span")?.textContent?.trim() ||
            chave;
          const svgOriginal = botao.querySelector("svg.iconeFerramenta");
          iniciarPossivelArrasto(e, {
            chave,
            titulo,
            origem: "sidebar",
            elementoOrigem: botao,
            svgHtml: svgOriginal ? svgOriginal.outerHTML : ""
          });
        });
      }

      botao.addEventListener("click", () => {
        if (Date.now() - ultimoFimArrastoMs < 260) return;
        alternarFerramenta(botao);
        if (chkMenu && window.innerWidth <= 768) {
          chkMenu.checked = true;
        }
      });
    });

    const btnAbaFerramentas = document.getElementById("btn-aba-ferramentas");
    if (btnAbaFerramentas) {
      btnAbaFerramentas.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarPopupFerramentas();
      });
    }

    const popupEl = document.getElementById("popup-ferramentas-lateral");
    if (popupEl) {
      popupEl.addEventListener("click", (e) => e.stopPropagation());
    }

    document.addEventListener("click", (e) => {
      if (!popupAberto) return;
      if (Date.now() - ultimoFimArrastoMs < 260) return;
      const popup = document.getElementById("popup-ferramentas-lateral");
      const btnAba = document.getElementById("btn-aba-ferramentas");
      if (popup && popup.contains(e.target)) return;
      if (btnAba && btnAba.contains(e.target)) return;
      fecharPopupFerramentas();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && popupAberto) {
        fecharPopupFerramentas();
        document.getElementById("btn-aba-ferramentas")?.focus();
      }
    });

    const listaNav = document.querySelector(".barraLateral .listaNavegacao");
    if (listaNav) {
      listaNav.addEventListener("scroll", () => {
        if (popupAberto) posicionarPopupConectado();
      });
    }
    window.addEventListener("resize", () => {
      if (popupAberto) posicionarPopupConectado();
    });
    if (chkMenu) {
      chkMenu.addEventListener("change", () => {
        if (popupAberto) {
          if (window.innerWidth <= 768 && chkMenu.checked) fecharPopupFerramentas();
          else setTimeout(posicionarPopupConectado, 60);
        }
      });
    }

    window.addEventListener("ponto-trama:configuracoes-atualizadas", (e) => {
      if (sincronizandoInternamente) return;
      if (e.detail && Array.isArray(e.detail.ferramentasBarraLateral)) {
        aplicarFerramentasVisiveis(e.detail.ferramentasBarraLateral);
      }
    });

    document
      .querySelectorAll("#nav-mobile-inferior .nav-mob-btn[data-mob-ferramenta]")
      .forEach((btnMob) => {
        btnMob.addEventListener("click", () => {
          const alvo = btnMob.dataset.mobFerramenta;
          const btnSide = document.querySelector(
            `.barraLateral .botaoFerramenta[data-ferramenta="${alvo}"]`
          );
          if (btnSide) alternarFerramenta(btnSide);
          if (chkMenu && window.innerWidth <= 768) {
            chkMenu.checked = true;
          }
        });
      });

    const btnMobMais = document.getElementById("btn-nav-mob-mais");
    if (btnMobMais && chkMenu) {
      btnMobMais.addEventListener("click", (e) => {
        e.stopPropagation();
        chkMenu.checked = !chkMenu.checked;
      });
    }

    const mainEl = document.querySelector("main");
    if (mainEl && chkMenu) {
      mainEl.addEventListener("click", () => {
        if (Date.now() - ultimoFimArrastoMs < 260) return;
        if (window.innerWidth <= 768 && !chkMenu.checked) {
          chkMenu.checked = true;
          fecharPopupFerramentas();
        }
      });
    }
  }

  return {
    init,
    alternarFerramenta,
    aplicarFerramentasVisiveis,
    obterListaCatalogoFerramentas,
    fecharPopupFerramentas,
    PADRAO_VISIVEIS,
    FERRAMENTAS_PERSONALIZAVEIS
  };
})();
