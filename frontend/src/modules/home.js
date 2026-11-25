// ==========================================================================
// PONTO & TRAMA - TELA INICIAL (HOME)
// Navegação rápida para "Novo projeto" e "Ver meus projetos".
// ==========================================================================

const Home = (() => {
  function irParaFerramenta(chave) {
    const botao = document.querySelector(`.barraLateral .botaoFerramenta[data-ferramenta="${chave}"]`);
    if (botao && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
      BarraLateral.alternarFerramenta(botao);
    }
  }

  function init() {
    const btnNovo = document.getElementById("btn-home-novo-projeto");
    const btnVer = document.getElementById("btn-home-ver-projetos");
    const logoArea = document.querySelector(".barraLateral .logoArea");

    if (btnNovo) {
      btnNovo.addEventListener("click", () => {
        irParaFerramenta("projetos");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("ponto-trama:novo-projeto"));
        }, 30);
      });
    }

    if (btnVer) {
      btnVer.addEventListener("click", () => {
        irParaFerramenta("projetos");
      });
    }

    if (logoArea) {
      logoArea.style.cursor = "pointer";
      logoArea.title = "Voltar ao Início";
      logoArea.addEventListener("click", () => irParaFerramenta("home"));
    }
  }

  return { init };
})();
