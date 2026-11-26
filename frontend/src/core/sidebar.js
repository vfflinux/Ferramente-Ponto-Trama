// ==========================================================================
// CONTROLE DA BARRA LATERAL, NAVEGAÇÃO E POPUP CONECTADO "FERRAMENTAS"
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
  let ferramentasVisiveisSet = new Set(PADRAO_VISIVEIS);
  let popupAberto = false;

  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (Alternância e Visibilidade)
  // ==========================================================================

  function fecharPopupFerramentas() {
    const popup = document.getElementById("popup-ferramentas-lateral");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    popupAberto = false;
    if (popup) {
      popup.classList.remove("aberto");
      popup.setAttribute("aria-hidden", "true");
    }
    if (btnAba) {
      btnAba.classList.remove("popup-aberto");
      btnAba.setAttribute("aria-expanded", "false");
    }
  }

  function posicionarPopupConectado() {
    const popup = document.getElementById("popup-ferramentas-lateral");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    const barra = document.querySelector(".barraLateral");
    if (!popup || !btnAba || !barra) return;

    // No celular (gaveta lateral <= 768px), o popup expande inline conectado ao botão
    if (window.innerWidth <= 768) {
      popup.style.top = "";
      popup.style.bottom = "";
      return;
    }

    const barraRect = barra.getBoundingClientRect();
    const btnRect = btnAba.getBoundingClientRect();
    const popupAltura = popup.offsetHeight || 160;
    const btnCentroY = btnRect.top - barraRect.top + btnRect.height / 2;

    // Alinha verticalmente ao centro da aba "Ferramentas", mantendo dentro da tela
    let topPx = Math.round(btnCentroY - popupAltura / 2);
    const maxTop = Math.max(8, barraRect.height - popupAltura - 8);
    topPx = Math.max(8, Math.min(topPx, maxTop));

    popup.style.top = `${topPx}px`;
    popup.style.bottom = "auto";

    // Calcula posição relativa da aba no popup para o ponto de origem da animação "inflar"
    const origemY = Math.max(12, Math.min(popupAltura - 12, Math.round(btnCentroY - topPx)));
    popup.style.transformOrigin = `left ${origemY}px`;
  }

  function abrirPopupFerramentas() {
    const popup = document.getElementById("popup-ferramentas-lateral");
    const btnAba = document.getElementById("btn-aba-ferramentas");
    const grade = document.getElementById("popup-ferramentas-grade");
    if (!popup || !btnAba || !grade || grade.children.length === 0) return;

    posicionarPopupConectado();
    popupAberto = true;
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

  function reconstruirPopupFerramentas() {
    const btnAba = document.getElementById("btn-aba-ferramentas");
    const badge = document.getElementById("badge-qtd-ferramentas");
    const grade = document.getElementById("popup-ferramentas-grade");
    if (!btnAba || !grade) return;

    const ocultas = [];
    document
      .querySelectorAll(".barraLateral .listaNavegacao .botaoFerramenta[data-ferramenta]")
      .forEach((btn) => {
        const chave = btn.dataset.ferramenta;
        if (!chave || FERRAMENTAS_FIXAS.has(chave)) return;
        const visivel = ferramentasVisiveisSet.has(chave);
        btn.classList.toggle("ferramenta-oculta-barra", !visivel);
        if (!visivel) ocultas.push(btn);
      });

    if (ocultas.length === 0) {
      btnAba.classList.add("ferramenta-oculta-barra");
      fecharPopupFerramentas();
      grade.innerHTML = "";
      if (badge) badge.textContent = "0";
      return;
    }

    btnAba.classList.remove("ferramenta-oculta-barra");
    if (badge) badge.textContent = String(ocultas.length);

    // Ajusta número de colunas da grade de ícones conforme quantidade
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
      item.setAttribute("title", titulo);
      if (chave === ferramentaAtual) item.classList.add("ativo");

      if (svgOriginal) {
        const clone = svgOriginal.cloneNode(true);
        clone.classList.add("icone-popup-ferramenta");
        item.appendChild(clone);
      }

      item.addEventListener("click", (e) => {
        e.stopPropagation();
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
    if (popupAberto) posicionarPopupConectado();
  }

  function aplicarFerramentasVisiveis(listaVisiveis) {
    if (Array.isArray(listaVisiveis)) {
      const validas = listaVisiveis.filter((k) => FERRAMENTAS_PERSONALIZAVEIS.includes(k));
      ferramentasVisiveisSet = new Set(validas);
    } else {
      ferramentasVisiveisSet = new Set(PADRAO_VISIVEIS);
    }
    reconstruirPopupFerramentas();
  }

  function obterListaCatalogoFerramentas() {
    const lista = [];
    document
      .querySelectorAll(".barraLateral .listaNavegacao .botaoFerramenta[data-ferramenta]")
      .forEach((btn) => {
        const chave = btn.dataset.ferramenta;
        if (!chave || FERRAMENTAS_FIXAS.has(chave)) return;
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

    // Atualiza classe ativa na barra lateral
    botoesFerramenta.forEach((b) => b.classList.remove("ativo"));
    botaoClicado.classList.add("ativo");
    sincronizarDestaqueAbaFerramentas();
    fecharPopupFerramentas();

    // Oculta todas as seções reservadas
    todasSecoesFerramentas.forEach((secao) => {
      secao.style.display = "none";
    });

    // Se não for contador, garante que o contador receba display none
    if (!isContador) {
      if (secaoContador) secaoContador.style.display = "none";
      if (conteinerContador) conteinerContador.style.display = "none";
    }

    // Exibe a seção reservada correspondente
    const secaoAlvo = document.getElementById(`secao-${ferramenta}`);
    if (secaoAlvo) {
      secaoAlvo.style.display = "flex";
    }

    // Inicializa o módulo sob demanda na primeira vez que a aba é aberta
    if (typeof PontoTramaApp !== "undefined" && typeof PontoTramaApp.garantirModulo === "function") {
      PontoTramaApp.garantirModulo(ferramenta);
    }

    // Se for o contador, restaura seu display flex
    if (isContador) {
      if (secaoContador) secaoContador.style.display = "flex";
      if (conteinerContador) conteinerContador.style.display = "flex";
    }

    window.dispatchEvent(
      new CustomEvent("ponto-trama:ferramenta-alterada", {
        detail: { ferramenta }
      })
    );

    // Sincroniza destaque da barra inferior mobile
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
  // PARTE 3: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================
  function init() {
    const chkMenu = document.getElementById("opcao-menu");
    const isMobileViewport = () =>
      (typeof window !== "undefined" && window.innerWidth <= 768) ||
      Boolean(typeof window !== "undefined" && window.PontoETramaAndroid);

    // No celular, inicia com a gaveta lateral fechada para a ferramenta ocupar 100% da tela
    if (chkMenu && isMobileViewport()) {
      chkMenu.checked = true;
    }

    // Aplica imediatamente as ferramentas salvas nas Configurações
    const salvas =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function"
        ? Configuracoes.obter("ferramentasBarraLateral")
        : PADRAO_VISIVEIS;
    aplicarFerramentasVisiveis(salvas);

    const botoesFerramenta = document.querySelectorAll(
      ".barraLateral .botaoFerramenta[data-ferramenta]"
    );
    botoesFerramenta.forEach((botao) => {
      botao.addEventListener("click", () => {
        alternarFerramenta(botao);
        if (chkMenu && window.innerWidth <= 768) {
          chkMenu.checked = true;
        }
      });
    });

    // Aba "Ferramentas" -> infla o popup conectado à barra lateral
    const btnAbaFerramentas = document.getElementById("btn-aba-ferramentas");
    if (btnAbaFerramentas) {
      btnAbaFerramentas.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarPopupFerramentas();
      });
    }

    // No mobile, move o popup para logo após o botão quando em tela estreita e mantém conectado
    const popupEl = document.getElementById("popup-ferramentas-lateral");
    if (popupEl) {
      popupEl.addEventListener("click", (e) => e.stopPropagation());
    }

    // Fecha o popup ao clicar fora ou pressionar ESC
    document.addEventListener("click", (e) => {
      if (!popupAberto) return;
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

    // Reposiciona popup ao rolar a barra lateral, redimensionar ou recolher/expandir menu
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

    // Reage em tempo real quando o usuário altera a lista nas Configurações
    window.addEventListener("ponto-trama:configuracoes-atualizadas", (e) => {
      if (e.detail && Array.isArray(e.detail.ferramentasBarraLateral)) {
        aplicarFerramentasVisiveis(e.detail.ferramentasBarraLateral);
      }
    });

    // Barra inferior nativa mobile (navegação rápida por polegar)
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

    // Toque na área principal fecha a gaveta lateral aberta no celular
    const mainEl = document.querySelector("main");
    if (mainEl && chkMenu) {
      mainEl.addEventListener("click", () => {
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
