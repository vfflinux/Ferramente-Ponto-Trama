// ==========================================================================
// PONTO & TRAMA - GERENCIADOR ÚNICO DO BANCO DE DADOS
// 100% local/offline (nunca acessa a internet).
//
// - App Desktop Ubuntu (`./PontoETrama`):
//     Usa o banco relacional SQL (SQLite em `backend/database/ponto_e_trama.db`)
//     com cache em memória RAM e migração única opcional.
//
// - Versão Web (navegador direto / hospedagem estática):
//     Mais simples, sem servidor SQL — grava e lê direto no IndexedDB local
//     do navegador com cache em RAM instantâneo (zero requisições `/api/`).
// ==========================================================================

const BancoDadosPT = (() => {
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORES = {
    FIOS: "fios",
    BIBLIOTECA: "itens_biblioteca",
    AMOSTRAS: "banco_amostras"
  };

  let modoAtual = null; // "sqlite" (App Desktop) | "indexeddb" (Web)
  let promessaModo = null;

  let dbInstancia = null;
  let promessaConexao = null;

  const cacheStores = new Map();
  const leiturasEmVoo = new Map();
  let promessaPreload = null;

  // Ativa o backend SQLite somente no App Desktop Ubuntu (ou se forçado via ?banco=sql)
  function deveUsarSqliteDesktop() {
    if (typeof window === "undefined") return false;
    if (window.__PONTO_TRAMA_DESKTOP__ === true) return true;
    try {
      const params = new URLSearchParams(window.location.search || "");
      return params.get("ambiente") === "desktop" || params.get("banco") === "sql";
    } catch {
      return false;
    }
  }

  async function fetchLocalJson(caminho, opcoes = {}) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), opcoes.timeoutMs || 2500) : null;
    try {
      const resp = await fetch(caminho, {
        method: opcoes.method || "GET",
        headers: opcoes.body ? { "Content-Type": "application/json" } : undefined,
        body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // ==========================================================================
  // INDEXEDDB (FALLBACK LOCAL + LEITURA PARA MIGRAÇÃO AUTOMÁTICA -> SQLITE)
  // ==========================================================================

  function criarStoresSeNecessario(db) {
    if (!db.objectStoreNames.contains(STORES.FIOS)) {
      const fiosStore = db.createObjectStore(STORES.FIOS, { keyPath: "id", autoIncrement: true });
      fiosStore.createIndex("nome", "nome", { unique: false });
      fiosStore.createIndex("marca", "marca", { unique: false });
      fiosStore.createIndex("cor_nome", "cor_nome", { unique: false });
      fiosStore.createIndex("lote", "lote", { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.BIBLIOTECA)) {
      const bibStore = db.createObjectStore(STORES.BIBLIOTECA, { keyPath: "id", autoIncrement: true });
      bibStore.createIndex("nome", "nome", { unique: false });
      bibStore.createIndex("categoria", "categoria", { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.AMOSTRAS)) {
      const amStore = db.createObjectStore(STORES.AMOSTRAS, { keyPath: "id", autoIncrement: true });
      amStore.createIndex("nome", "nome", { unique: false });
      amStore.createIndex("categoria", "categoria", { unique: false });
      amStore.createIndex("favorito", "favorito", { unique: false });
    }
  }

  function abrir() {
    if (dbInstancia) return Promise.resolve(dbInstancia);
    if (promessaConexao) return promessaConexao;

    promessaConexao = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        promessaConexao = null;
        reject(new Error("IndexedDB não disponível."));
        return;
      }

      let finalizado = false;
      const finalizarOk = (db) => {
        if (finalizado) return;
        finalizado = true;
        clearTimeout(timerBloqueio);
        dbInstancia = db;
        dbInstancia.onversionchange = () => {
          try {
            dbInstancia.close();
          } catch {
            // ignora
          }
          dbInstancia = null;
          promessaConexao = null;
        };
        dbInstancia.onclose = () => {
          dbInstancia = null;
          promessaConexao = null;
        };
        resolve(dbInstancia);
      };

      const finalizarErro = (err) => {
        if (finalizado) return;
        finalizado = true;
        clearTimeout(timerBloqueio);
        promessaConexao = null;
        reject(err);
      };

      const timerBloqueio = setTimeout(() => {
        if (!finalizado) {
          finalizarErro(new Error("IndexedDB bloqueado por outra aba."));
        }
      }, 2500);

      let request;
      try {
        request = indexedDB.open(DB_NOME, DB_VERSAO);
      } catch (err) {
        finalizarErro(err);
        return;
      }

      request.onupgradeneeded = (event) => criarStoresSeNecessario(event.target.result);
      request.onsuccess = (event) => finalizarOk(event.target.result);
      request.onerror = (event) => finalizarErro(event.target.error);
    });

    return promessaConexao;
  }

  async function lerTudoIndexedDB() {
    try {
      const db = await abrir();
      const nomes = [STORES.FIOS, STORES.BIBLIOTECA, STORES.AMOSTRAS].filter((s) =>
        db.objectStoreNames.contains(s)
      );
      const resultado = { fios: [], itens_biblioteca: [], banco_amostras: [] };
      if (nomes.length === 0) return resultado;

      await new Promise((resolve) => {
        const tx = db.transaction(nomes, "readonly");
        nomes.forEach((storeName) => {
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => {
            resultado[storeName] = req.result || [];
          };
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
      return resultado;
    } catch {
      return { fios: [], itens_biblioteca: [], banco_amostras: [] };
    }
  }

  // ==========================================================================
  // DETECÇÃO DE MODO (SQLite Local vs IndexedDB) + MIGRAÇÃO AUTOMÁTICA ÚNICA
  // ==========================================================================

  async function detectarModoEPrecarregar() {
    if (modoAtual) return modoAtual;
    if (promessaModo) return promessaModo;

    promessaModo = (async () => {
      if (deveUsarSqliteDesktop()) {
        try {
          const dadosSql = await fetchLocalJson("/api/tudo", { timeoutMs: 1800 });
          if (dadosSql && Array.isArray(dadosSql.fios)) {
            modoAtual = "sqlite";

            // Se alguma tabela SQLite estiver vazia, verifica se há dados antigos no IndexedDB para migrar 1 vez
            const jaMigrou = localStorage.getItem("ponto_trama_migrado_sqlite_v1") === "true";
            const sqlVazio =
              dadosSql.fios.length === 0 &&
              dadosSql.itens_biblioteca.length === 0 &&
              dadosSql.banco_amostras.length === 0;

            if (!jaMigrou && sqlVazio && typeof indexedDB !== "undefined") {
              const idbDados = await lerTudoIndexedDB();
              const temAlgoIdb =
                idbDados.fios.length > 0 ||
                idbDados.itens_biblioteca.length > 0 ||
                idbDados.banco_amostras.length > 0;

              if (temAlgoIdb) {
                try {
                  const resMig = await fetchLocalJson("/api/sincronizar-inicial", {
                    method: "POST",
                    body: idbDados,
                    timeoutMs: 5000
                  });
                  if (resMig && resMig.ok) {
                    cacheStores.set(STORES.FIOS, resMig.fios || []);
                    cacheStores.set(STORES.BIBLIOTECA, resMig.itens_biblioteca || []);
                    cacheStores.set(STORES.AMOSTRAS, resMig.banco_amostras || []);
                    localStorage.setItem("ponto_trama_migrado_sqlite_v1", "true");
                    return modoAtual;
                  }
                } catch {
                  // continua com dadosSql
                }
              }
              localStorage.setItem("ponto_trama_migrado_sqlite_v1", "true");
            }

            cacheStores.set(STORES.FIOS, dadosSql.fios || []);
            cacheStores.set(STORES.BIBLIOTECA, dadosSql.itens_biblioteca || []);
            cacheStores.set(STORES.AMOSTRAS, dadosSql.banco_amostras || []);
            return modoAtual;
          }
        } catch {
          // Servidor Python local não está rodando nesta porta -> cai silenciosamente no IndexedDB
        }
      }

      modoAtual = "indexeddb";
      const dadosIdb = await lerTudoIndexedDB();
      cacheStores.set(STORES.FIOS, dadosIdb.fios || []);
      cacheStores.set(STORES.BIBLIOTECA, dadosIdb.itens_biblioteca || []);
      cacheStores.set(STORES.AMOSTRAS, dadosIdb.banco_amostras || []);
      return modoAtual;
    })();

    try {
      return await promessaModo;
    } finally {
      promessaModo = null;
    }
  }

  function precarregarTudo() {
    if (promessaPreload) return promessaPreload;
    promessaPreload = detectarModoEPrecarregar().finally(() => {
      promessaPreload = null;
    });
    return promessaPreload;
  }

  // ==========================================================================
  // OPERAÇÕES UNIFICADAS (obterTodos, salvar, salvarEmLote, excluir)
  // ==========================================================================

  async function obterTodos(storeName, forcarDisco = false) {
    if (!modoAtual) {
      await detectarModoEPrecarregar();
    }

    if (!forcarDisco && cacheStores.has(storeName)) {
      return cacheStores.get(storeName);
    }

    if (!forcarDisco && leiturasEmVoo.has(storeName)) {
      return leiturasEmVoo.get(storeName);
    }

    const p = (async () => {
      try {
        let dados = [];
        if (modoAtual === "sqlite") {
          dados = await fetchLocalJson(`/api/${storeName}`);
          if (!Array.isArray(dados)) dados = [];
        } else {
          const db = await abrir();
          if (!db.objectStoreNames.contains(storeName)) return [];
          dados = await new Promise((resolve) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
        }
        cacheStores.set(storeName, dados);
        return dados;
      } catch {
        return cacheStores.get(storeName) || [];
      } finally {
        leiturasEmVoo.delete(storeName);
      }
    })();

    leiturasEmVoo.set(storeName, p);
    return p;
  }

  async function salvar(storeName, registro) {
    if (!modoAtual) await detectarModoEPrecarregar();

    let salvo;
    if (modoAtual === "sqlite") {
      const temId = registro.id !== undefined && registro.id !== null && registro.id !== "";
      const rota = temId ? `/api/${storeName}/${encodeURIComponent(registro.id)}` : `/api/${storeName}`;
      salvo = await fetchLocalJson(rota, {
        method: temId ? "PUT" : "POST",
        body: registro,
        timeoutMs: 5000
      });
    } else {
      const db = await abrir();
      salvo = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = registro.id ? store.put(registro) : store.add(registro);
        req.onsuccess = () => {
          if (!registro.id) registro.id = req.result;
          resolve(registro);
        };
        req.onerror = () => reject(req.error);
      });
    }

    if (cacheStores.has(storeName)) {
      const lista = cacheStores.get(storeName);
      const idx = lista.findIndex((item) => Number(item.id) === Number(salvo.id));
      if (idx !== -1) lista[idx] = salvo;
      else lista.unshift(salvo);
    }
    return salvo;
  }

  async function salvarEmLote(storeName, itens) {
    if (!Array.isArray(itens) || itens.length === 0) return [];
    if (!modoAtual) await detectarModoEPrecarregar();

    let salvos = [];
    if (modoAtual === "sqlite") {
      salvos = await fetchLocalJson(`/api/${storeName}`, {
        method: "POST",
        body: itens,
        timeoutMs: 8000
      });
    } else {
      const db = await abrir();
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      itens.forEach((item) => {
        const copia = { ...item };
        delete copia.id;
        store.add(copia);
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    invalidarCache(storeName);
    return await obterTodos(storeName, true);
  }

  async function excluir(storeName, id) {
    if (!modoAtual) await detectarModoEPrecarregar();

    if (modoAtual === "sqlite") {
      await fetchLocalJson(`/api/${storeName}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        timeoutMs: 4000
      });
    } else {
      const db = await abrir();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const idNum = Number(id);
        if (!isNaN(idNum)) store.delete(idNum);
        store.delete(String(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    if (cacheStores.has(storeName)) {
      const lista = cacheStores.get(storeName);
      cacheStores.set(
        storeName,
        lista.filter((item) => String(item.id) !== String(id) && Number(item.id) !== Number(id))
      );
    }
    return true;
  }

  function invalidarCache(storeName = null) {
    if (storeName) cacheStores.delete(storeName);
    else cacheStores.clear();
  }

  function debounce(fn, esperaMs = 90) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, args);
      }, esperaMs);
    };
  }

  return {
    DB_NOME,
    DB_VERSAO,
    STORES,
    obterModo: () => modoAtual || "detectando",
    abrir,
    precarregarTudo,
    obterTodos,
    salvar,
    salvarEmLote,
    excluir,
    invalidarCache,
    debounce
  };
})();
