// ==========================================================================
// CONTROLE DA BARRA LATERAL E NAVEGAÇÃO DE FERRAMENTAS
// ==========================================================================

const BarraLateral = (() => {
  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (Alternância e Visibilidade)
  // ==========================================================================

  function alternarFerramenta(botaoClicado) {
    const botoesFerramenta = document.querySelectorAll(".barraLateral .botaoFerramenta");
    const todasSecoesFerramentas = document.querySelectorAll(".secao-ferramenta");
    const secaoContador = document.getElementById("secao-contador-carreiras");
    const conteinerContador = document.getElementById("conteiner-contador");

    const ferramenta = botaoClicado.dataset.ferramenta || (botaoClicado.getAttribute("title") || "").toLowerCase();
    const isContador = ferramenta === "contador-carreiras" || ferramenta.includes("contador");

    // Atualiza classe ativa na barra lateral
    botoesFerramenta.forEach((b) => b.classList.remove("ativo"));
    botaoClicado.classList.add("ativo");

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
  }

  // ==========================================================================
  // PARTE 2: ANIMAÇÕES E EFEITOS
  // ==========================================================================
  // As animações de transição de largura (80px <-> 270px) são coordenadas
  // pelo CSS com a variável global --transicao-suave em barraLateral.css.

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

    const botoesFerramenta = document.querySelectorAll(".barraLateral .botaoFerramenta");
    botoesFerramenta.forEach((botao) => {
      botao.addEventListener("click", () => {
        alternarFerramenta(botao);
        if (chkMenu && window.innerWidth <= 768) {
          chkMenu.checked = true;
        }
      });
    });

    // Toque na área principal fecha a gaveta lateral aberta no celular
    const mainEl = document.querySelector("main");
    if (mainEl && chkMenu) {
      mainEl.addEventListener("click", () => {
        if (window.innerWidth <= 768 && !chkMenu.checked) {
          chkMenu.checked = true;
        }
      });
    }
  }

  return {
    init,
    alternarFerramenta
  };
})();
