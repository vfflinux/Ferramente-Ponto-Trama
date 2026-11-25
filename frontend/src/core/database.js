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
  const DB_VERSAO = 4;
  const STORES = {
    FIOS: "fios",
    BIBLIOTECA: "itens_biblioteca",
    AMOSTRAS: "banco_amostras",
    PROJETOS: "projetos"
  };

  let modoAtual = null; // "sqlite" (App Desktop) | "indexeddb" (Web)
  let promessaModo = null;

  let dbInstancia = null;
  let promessaConexao = null;

  const cacheStores = new Map();
  const leiturasEmVoo = new Map();
  let promessaPreload = null;

  // Fallback local ultraleve em localStorage (usado automaticamente se IndexedDB
  // estiver bloqueado por outra aba, restrito em file:// ou sem a store esperada)
  function chaveFallbackLS(storeName) {
    return `ponto_trama_fallback_${storeName}`;
  }

  function lsLerStore(storeName) {
    try {
      const raw = localStorage.getItem(chaveFallbackLS(storeName));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function lsGravarStore(storeName, lista) {
    try {
      localStorage.setItem(chaveFallbackLS(storeName), JSON.stringify(lista));
      return true;
    } catch {
      return false;
    }
  }

  function lsSalvarRegistro(storeName, payload, temId) {
    const lista = lsLerStore(storeName);
    const copia = { ...payload };
    if (temId) {
      copia.id = Number(copia.id);
      const idx = lista.findIndex((item) => Number(item.id) === copia.id);
      if (idx !== -1) lista[idx] = copia;
      else lista.unshift(copia);
    } else {
      const maxId = lista.reduce((acc, item) => Math.max(acc, Number(item.id) || 0), 0);
      copia.id = maxId + 1;
      lista.unshift(copia);
    }
    lsGravarStore(storeName, lista);
    return copia;
  }

  function lsExcluirRegistro(storeName, id) {
    const lista = lsLerStore(storeName).filter(
      (item) => String(item.id) !== String(id) && Number(item.id) !== Number(id)
    );
    lsGravarStore(storeName, lista);
    return true;
  }

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
      if (!resp.ok) {
        let detalhe = "";
        try {
          detalhe = await resp.text();
        } catch {
          // ignora
        }
        throw new Error(`HTTP ${resp.status}${detalhe ? `: ${detalhe.slice(0, 140)}` : ""}`);
      }
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
    if (!db.objectStoreNames.contains(STORES.PROJETOS)) {
      const projStore = db.createObjectStore(STORES.PROJETOS, { keyPath: "id", autoIncrement: true });
      projStore.createIndex("nome", "nome", { unique: false });
      projStore.createIndex("status", "status", { unique: false });
      projStore.createIndex("categoria", "categoria", { unique: false });
    }
  }

  function abrir(versaoForcada = null) {
    if (dbInstancia && !versaoForcada) return Promise.resolve(dbInstancia);
    if (promessaConexao && !versaoForcada) return promessaConexao;

    const versaoAlvo = versaoForcada || DB_VERSAO;
    if (versaoForcada && dbInstancia) {
      try {
        dbInstancia.close();
      } catch {
        // ignora
      }
      dbInstancia = null;
      promessaConexao = null;
    }

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
      }, 2200);

      let request;
      try {
        request = indexedDB.open(DB_NOME, versaoAlvo);
      } catch (err) {
        finalizarErro(err);
        return;
      }

      request.onupgradeneeded = (event) => criarStoresSeNecessario(event.target.result);
      request.onblocked = () => {
        finalizarErro(new Error("IndexedDB bloqueado por outra aba aberta."));
      };
      request.onsuccess = (event) => finalizarOk(event.target.result);
      request.onerror = (event) => finalizarErro(event.target.error);
    });

    return promessaConexao;
  }

  async function garantirStoreIndexedDB(storeName) {
    let db = await abrir();
    if (!db.objectStoreNames.contains(storeName)) {
      const novaVersao = Math.max(DB_VERSAO, (db.version || 1) + 1);
      db = await abrir(novaVersao);
    }
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store "${storeName}" indisponível no IndexedDB.`);
    }
    return db;
  }

  async function lerTudoIndexedDB() {
    try {
      const db = await abrir();
      const nomes = [STORES.FIOS, STORES.BIBLIOTECA, STORES.AMOSTRAS, STORES.PROJETOS].filter((s) =>
        db.objectStoreNames.contains(s)
      );
      const resultado = { fios: [], itens_biblioteca: [], banco_amostras: [], projetos: [] };
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
      return { fios: [], itens_biblioteca: [], banco_amostras: [], projetos: [] };
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
              dadosSql.banco_amostras.length === 0 &&
              (dadosSql.projetos || []).length === 0;

            if (!jaMigrou && sqlVazio && typeof indexedDB !== "undefined") {
              const idbDados = await lerTudoIndexedDB();
              const temAlgoIdb =
                idbDados.fios.length > 0 ||
                idbDados.itens_biblioteca.length > 0 ||
                idbDados.banco_amostras.length > 0 ||
                idbDados.projetos.length > 0;

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
                    cacheStores.set(STORES.PROJETOS, resMig.projetos || []);
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
            cacheStores.set(STORES.PROJETOS, dadosSql.projetos || []);
            return modoAtual;
          }
        } catch {
          // Servidor Python local não está rodando nesta porta -> cai silenciosamente no IndexedDB
        }
      }

      modoAtual = "indexeddb";
      const dadosIdb = await lerTudoIndexedDB();
      const mesclarFallback = (storeName, listaIdb) => {
        const ls = lsLerStore(storeName);
        if (!ls.length) return listaIdb || [];
        if (!listaIdb || !listaIdb.length) return ls;
        const ids = new Set(listaIdb.map((i) => Number(i.id)));
        return [...listaIdb, ...ls.filter((i) => !ids.has(Number(i.id)))];
      };
      cacheStores.set(STORES.FIOS, mesclarFallback(STORES.FIOS, dadosIdb.fios));
      cacheStores.set(STORES.BIBLIOTECA, mesclarFallback(STORES.BIBLIOTECA, dadosIdb.itens_biblioteca));
      cacheStores.set(STORES.AMOSTRAS, mesclarFallback(STORES.AMOSTRAS, dadosIdb.banco_amostras));
      cacheStores.set(STORES.PROJETOS, mesclarFallback(STORES.PROJETOS, dadosIdb.projetos));
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
          const db = await garantirStoreIndexedDB(storeName);
          dados = await new Promise((resolve) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
          const ls = lsLerStore(storeName);
          if (ls.length > 0) {
            const ids = new Set(dados.map((i) => Number(i.id)));
            dados = [...dados, ...ls.filter((i) => !ids.has(Number(i.id)))];
          }
        }
        cacheStores.set(storeName, dados);
        return dados;
      } catch {
        const ls = lsLerStore(storeName);
        if (ls.length > 0) {
          cacheStores.set(storeName, ls);
          return ls;
        }
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

    const payload = { ...registro };
    const temId = payload.id !== undefined && payload.id !== null && payload.id !== "" && !Number.isNaN(Number(payload.id));
    if (temId) {
      payload.id = Number(payload.id);
    } else {
      delete payload.id;
    }

    let salvo;
    if (modoAtual === "sqlite") {
      try {
        const rota = temId ? `/api/${storeName}/${encodeURIComponent(payload.id)}` : `/api/${storeName}`;
        salvo = await fetchLocalJson(rota, {
          method: temId ? "PUT" : "POST",
          body: payload,
          timeoutMs: 5000
        });
      } catch (errSql) {
        console.warn(`[BancoDadosPT] Falha SQLite em ${storeName}, usando fallback local:`, errSql);
        salvo = lsSalvarRegistro(storeName, payload, temId);
      }
    } else {
      try {
        const db = await garantirStoreIndexedDB(storeName);
        salvo = await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const req = temId ? store.put(payload) : store.add(payload);
          req.onsuccess = () => {
            if (!temId) payload.id = req.result;
            resolve(payload);
          };
          req.onerror = () => reject(req.error);
        });
      } catch (errIdb) {
        console.warn(`[BancoDadosPT] IndexedDB indisponível em ${storeName}, salvando em localStorage:`, errIdb);
        salvo = lsSalvarRegistro(storeName, payload, temId);
      }
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
      try {
        await fetchLocalJson(`/api/${storeName}/${encodeURIComponent(id)}`, {
          method: "DELETE",
          timeoutMs: 4000
        });
      } catch {
        // tenta também limpar fallback local
      }
      lsExcluirRegistro(storeName, id);
    } else {
      try {
        const db = await garantirStoreIndexedDB(storeName);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const idNum = Number(id);
          if (!isNaN(idNum)) store.delete(idNum);
          store.delete(String(id));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // ignora se estiver no fallback
      }
      lsExcluirRegistro(storeName, id);
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

  async function limparColecao(storeName) {
    if (!modoAtual) await detectarModoEPrecarregar();

    if (modoAtual === "sqlite") {
      try {
        await fetchLocalJson(`/api/${storeName}`, { method: "DELETE", timeoutMs: 5000 });
      } catch {
        // tenta também limpar fallback local
      }
    } else {
      try {
        const db = await garantirStoreIndexedDB(storeName);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // ignora se estiver no fallback
      }
    }

    lsGravarStore(storeName, []);
    cacheStores.set(storeName, []);
    return true;
  }

  async function exportarTudo() {
    if (!modoAtual) await detectarModoEPrecarregar();
    const [projetos, fios, itens_biblioteca, banco_amostras] = await Promise.all([
      obterTodos(STORES.PROJETOS, true),
      obterTodos(STORES.FIOS, true),
      obterTodos(STORES.BIBLIOTECA, true),
      obterTodos(STORES.AMOSTRAS, true)
    ]);
    return { projetos, fios, itens_biblioteca, banco_amostras };
  }

  async function importarTudo(dados, modo = "mesclar") {
    if (!dados || typeof dados !== "object") return { total: 0 };
    const colecoes = [STORES.FIOS, STORES.BIBLIOTECA, STORES.AMOSTRAS, STORES.PROJETOS];
    const resumo = { projetos: 0, fios: 0, itens_biblioteca: 0, banco_amostras: 0 };

    if (modo === "substituir") {
      // Limpa projetos primeiro por causa de foreign keys opcionais no SQLite
      await limparColecao(STORES.PROJETOS);
      await limparColecao(STORES.AMOSTRAS);
      await limparColecao(STORES.BIBLIOTECA);
      await limparColecao(STORES.FIOS);
    }

    for (const col of colecoes) {
      const lista = Array.isArray(dados[col]) ? dados[col] : [];
      for (const item of lista) {
        if (!item || typeof item !== "object") continue;
        const copia = { ...item };
        delete copia.id;
        await salvar(col, copia);
        resumo[col]++;
      }
    }

    invalidarCache();
    await detectarModoEPrecarregar();
    return resumo;
  }

  function escapeHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function comprimirImagem(arquivo, maxDim = 760, qualidade = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          let out = canvas.toDataURL("image/webp", qualidade);
          if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", qualidade);
          resolve(out);
        };
        img.onerror = () => reject(new Error("Imagem inválida"));
        img.src = ev.target.result;
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsDataURL(arquivo);
    });
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
    limparColecao,
    exportarTudo,
    importarTudo,
    invalidarCache,
    escapeHtml,
    comprimirImagem,
    debounce
  };
})();
