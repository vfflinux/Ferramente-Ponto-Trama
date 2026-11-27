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
    fios: () => {
      if (typeof InventarioFios !== "undefined") InventarioFios.init();
      if (typeof PlanejadorManta !== "undefined") PlanejadorManta.init();
    },
    agulhas: () => typeof InventarioAgulhas !== "undefined" && InventarioAgulhas.init(),
    amostra: () => {
      if (typeof CalculadoraAmostra !== "undefined") CalculadoraAmostra.init();
      if (typeof GeradorEsferaCirculo !== "undefined") GeradorEsferaCirculo.init();
    },
    "banco-amostras": () => typeof BancoAmostras !== "undefined" && BancoAmostras.init(),
    "editor-graficos": () => {
      if (typeof EditorGraficos !== "undefined") EditorGraficos.init();
      if (typeof EditorSimbolosCroche !== "undefined") EditorSimbolosCroche.init();
    },
    "tabelas-conversao": () => typeof TabelasConversao !== "undefined" && TabelasConversao.init(),
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

  function estaInicializado(chaveFerramenta) {
    return modulosInicializados.has(chaveFerramenta);
  }

  return { garantirModulo, estaInicializado };
})();

document.addEventListener("DOMContentLoaded", () => {
  // 0. Aplica imediatamente tema, fonte, animações e estado da barra lateral salvos
  if (typeof Configuracoes !== "undefined" && typeof Configuracoes.aplicarPreferenciasIniciais === "function") {
    Configuracoes.aplicarPreferenciasIniciais();
  }

  // 1. Navegação da barra lateral e Busca Global Ctrl+K (instantâneas)
  if (typeof BarraLateral !== "undefined" && typeof BarraLateral.init === "function") {
    BarraLateral.init();
  }
  if (typeof BuscaGlobal !== "undefined" && typeof BuscaGlobal.init === "function") {
    BuscaGlobal.init();
  }
  if (typeof AranhasAtelie !== "undefined" && typeof AranhasAtelie.init === "function") {
    AranhasAtelie.init();
  }
  if (typeof HistoricoAcoes !== "undefined" && typeof HistoricoAcoes.init === "function") {
    HistoricoAcoes.init();
  }

  // 2. Inicializa imediatamente apenas a tela inicial visível (Home)
  PontoTramaApp.garantirModulo("home");

  // 3. Pré-aquece o cache em RAM do banco e restaura projeto ativo na bancada
  if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.precarregarTudo === "function") {
    BancoDadosPT.precarregarTudo().finally(() => {
      if (typeof ProjetoContexto !== "undefined" && typeof ProjetoContexto.init === "function") {
        ProjetoContexto.init();
      }
    });
  } else if (typeof ProjetoContexto !== "undefined" && typeof ProjetoContexto.init === "function") {
    ProjetoContexto.init();
  }

  // 4. Registra Service Worker (PWA Offline-First) no navegador Web
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    window.location &&
    (window.location.protocol === "https:" || window.location.protocol === "http:") &&
    window.location.hostname !== "appassets.androidplatform.net" &&
    window.__PONTO_TRAMA_DESKTOP__ !== true
  ) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
