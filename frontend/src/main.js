// ==========================================================================
// PONTO & TRAMA - COORDENADOR PRINCIPAL (MAIN)
// Inicialização ultra-rápida: carrega imediatamente apenas a barra lateral e
// a ferramenta visível, pré-aquece o cache local em 1 única transação e
// inicializa as demais ferramentas sob demanda (lazy init) ao abrir cada aba.
// ==========================================================================

const PontoTramaApp = (() => {
  const modulosInicializados = new Set();

  const MAPA_MODULOS = {
    home: () => typeof Home !== "undefined" && Home.init(),
    "contador-carreiras": () => typeof ContadorCarreiras !== "undefined" && ContadorCarreiras.init(),
    receitas: () => typeof LeitorReceitas !== "undefined" && LeitorReceitas.init(),
    precificacao: () => typeof CalculadoraPrecificacao !== "undefined" && CalculadoraPrecificacao.init(),
    projetos: () => typeof GerenciadorProjetos !== "undefined" && GerenciadorProjetos.init(),
    fios: () => typeof InventarioFios !== "undefined" && InventarioFios.init(),
    agulhas: () => typeof InventarioAgulhas !== "undefined" && InventarioAgulhas.init(),
    amostra: () => typeof CalculadoraAmostra !== "undefined" && CalculadoraAmostra.init(),
    "banco-amostras": () => typeof BancoAmostras !== "undefined" && BancoAmostras.init(),
    configuracoes: () => typeof Configuracoes !== "undefined" && Configuracoes.init()
  };

  function garantirModulo(chaveFerramenta) {
    if (!chaveFerramenta || modulosInicializados.has(chaveFerramenta)) return;
    const initFn = MAPA_MODULOS[chaveFerramenta];
    if (typeof initFn === "function") {
      modulosInicializados.add(chaveFerramenta);
      initFn();
    }
  }

  return { garantirModulo };
})();

document.addEventListener("DOMContentLoaded", () => {
  // 1. Navegação da barra lateral (instantânea)
  if (typeof BarraLateral !== "undefined" && typeof BarraLateral.init === "function") {
    BarraLateral.init();
  }

  // 2. Inicializa imediatamente apenas a tela inicial visível (Home)
  PontoTramaApp.garantirModulo("home");

  // 3. Pré-aquece o cache em RAM do IndexedDB em 1 única transação (não bloqueia a UI)
  if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.precarregarTudo === "function") {
    BancoDadosPT.precarregarTudo();
  }
});
