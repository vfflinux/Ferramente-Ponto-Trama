// ==========================================================================
// PONTO & TRAMA — SERVICE WORKER (ARQUITETURA OFFLINE-FIRST / PWA)
// Garante cache local completo da interface, scripts, estilos, dicionário
// de pontos e tabelas de conversão/medidas para uso 100% offline.
// Usa estratégia network-first com fallback em cache para refletir atualizações
// imediatamente quando online/local e funcionar 100% offline sem rede.
// ==========================================================================

const CACHE_NOME = "ponto-e-trama-offline-v47";

const RECURSOS_ESSENCIAIS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/images/logo.png",
  "./data/dicionario-pontos.json",
  "./data/tabelas-conversao.json",
  "./styles/base/global.css",
  "./styles/layout/barra-lateral.css",
  "./styles/layout/busca-global.css",
  "./styles/layout/identidade-artesanal.css",
  "./styles/layout/aranhas-atelie.css",
  "./styles/modules/home.css",
  "./styles/modules/contador-carreiras.css",
  "./styles/modules/leitor-receitas.css",
  "./styles/modules/calculadora-precificacao.css",
  "./styles/modules/gerenciador-projetos.css",
  "./styles/modules/inventario-fios.css",
  "./styles/modules/inventario-agulhas.css",
  "./styles/modules/calculadora-amostra.css",
  "./styles/modules/banco-amostras.css",
  "./styles/modules/editor-graficos.css",
  "./styles/modules/tabelas-conversao.css",
  "./styles/modules/configuracoes.css",
  "./styles/modules/ferramentas-atelie-pro.css",
  "./styles/base/mobile.css",
  "./styles/base/temas.css",
  "./src/core/database.js",
  "./src/core/projeto-contexto.js",
  "./src/core/animations.js",
  "./src/core/historico-acoes.js",
  "./src/core/sidebar.js",
  "./src/core/busca-global.js",
  "./src/core/aranhas-cinematica-ik.js",
  "./src/core/aranhas-atelie.js",
  "./src/modules/home.js",
  "./src/modules/contador-carreiras.js",
  "./src/modules/calculadora-precificacao.js",
  "./src/modules/leitor-receitas.js",
  "./src/modules/tradutor-receitas.js",
  "./src/modules/gerenciador-projetos.js",
  "./src/modules/inventario-fios.js",
  "./src/modules/planejador-manta.js",
  "./src/modules/inventario-agulhas.js",
  "./src/modules/calculadora-amostra.js",
  "./src/modules/gerador-esfera-circulo.js",
  "./src/modules/banco-amostras.js",
  "./src/modules/editor-graficos.js",
  "./src/modules/editor-simbolos-croche.js",
  "./src/modules/tabelas-conversao.js",
  "./src/modules/configuracoes.js",
  "./src/main.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NOME)
      .then((cache) => cache.addAll(RECURSOS_ESSENCIAIS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((k) => k.startsWith("ponto-e-trama-offline-") && k !== CACHE_NOME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Nunca intercepta chamadas da API local SQLite (/api/)
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  // Network-first com fallback instantâneo para cache offline
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE_NOME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
