// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: BANCO DE AMOSTRAS
// Galeria completa de modelos de pontos com persistência em IndexedDB
// (PontoETramaDB v3 -> store `banco_amostras`), busca em tempo real,
// filtros rápidos, favoritos, duplicação, detalhes e envio direto para
// a Calculadora de Amostras.
// ==========================================================================

const BancoAmostras = (() => {
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  let db = null;
  let amostrasCache = [];
  let amostrasFiltradas = [];
  let filtroCategoriaAtivo = "todos"; // 'todos' | 'basico' | 'fechado' | 'texturizado' | 'rendado' | 'relevo' | 'favoritos'
  let fotoBase64Atual = "";
  let idDetalhesAtual = null;
  let idParaExcluir = null;
  let timerToast = null;

  const ROTULOS_CATEGORIA = {
    basico: "Básico",
    fechado: "Fechado",
    texturizado: "Texturizado",
    rendado: "Rendado",
    relevo: "Relevo"
  };

  const ROTULOS_TECNICA = {
    croche: "Crochê",
    trico: "Tricô"
  };

  const ROTULOS_TENSAO = {
    apertado: "Apertado",
    medio: "Médio",
    solto: "Solto"
  };

  // ==========================================================================
  // PARTE 1: OPERAÇÕES DE BANCO (IndexedDB) E SUGESTÕES DOS INVENTÁRIOS
  // ==========================================================================

  function abrirBanco() {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.abrir();
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  function dbObterStore(storeName) {
    if (typeof BancoDadosPT === "undefined") return Promise.resolve([]);
    return BancoDadosPT.obterTodos(storeName);
  }

  function dbSalvarAmostra(amostra) {
    if (typeof BancoDadosPT === "undefined") {
      return Promise.reject(new Error("BancoDadosPT indisponível"));
    }
    return BancoDadosPT.salvar(STORE_AMOSTRAS, amostra);
  }

  function dbExcluirAmostra(id) {
    if (typeof BancoDadosPT === "undefined") {
      return Promise.reject(new Error("BancoDadosPT indisponível"));
    }
    return BancoDadosPT.excluir(STORE_AMOSTRAS, id);
  }

  function notificarAtualizacao() {
    window.dispatchEvent(
      new CustomEvent("ponto-trama:banco-amostras-atualizado", {
        detail: { total: amostrasCache.length }
      })
    );
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

  function formatarNumero(n, casas = 1) {
    const val = Number(n);
    if (isNaN(val)) return "—";
    return val % 1 === 0 ? String(val) : val.toLocaleString("pt-BR", { maximumFractionDigits: casas });
  }

  function mostrarLoader(visivel) {
    const loader = document.getElementById("loader-banco-amostras");
    if (loader) loader.style.display = visivel ? "flex" : "none";
  }

  function mostrarToast(mensagem) {
    const toast = document.getElementById("toast-banco-amostras");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove("visivel"), 2600);
  }

  // Preenche datalists de Fio e Agulha no modal com itens dos outros inventários
  async function atualizarSugestoesInventarios() {
    const [fios, bib] = await Promise.all([dbObterStore(STORE_FIOS), dbObterStore(STORE_BIBLIOTECA)]);

    const dlFios = document.getElementById("datalist-banco-fios");
    if (dlFios) {
      const nomes = new Set();
      fios.forEach((f) => {
        if (f.nome) nomes.add(f.marca ? `${f.nome} (${f.marca})` : f.nome);
      });
      dlFios.innerHTML = "";
      nomes.forEach((n) => {
        const opt = document.createElement("option");
        opt.value = n;
        dlFios.appendChild(opt);
      });
    }

    const dlAgulhas = document.getElementById("datalist-banco-agulhas");
    if (dlAgulhas) {
      const mms = new Set(["2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "6.0", "8.0"]);
      bib
        .filter((i) => i.categoria === "agulha" && i.atributos?.espessura_mm)
        .forEach((a) => mms.add(String(a.atributos.espessura_mm)));

      dlAgulhas.innerHTML = "";
      Array.from(mms)
        .sort((a, b) => parseFloat(a) - parseFloat(b))
        .forEach((mm) => {
          const opt = document.createElement("option");
          opt.value = mm;
          dlAgulhas.appendChild(opt);
        });
    }
  }

  // ==========================================================================
  // PARTE 2: FILTROS, RENDERIZAÇÃO (STAGGER) E AÇÕES NOS CARDS
  // ==========================================================================

  function aplicarFiltros() {
    const termo = (document.getElementById("busca-banco-amostras")?.value || "").trim().toLowerCase();
    const btnLimpar = document.getElementById("btn-limpar-filtros-banco");
    const temFiltro = Boolean(termo || filtroCategoriaAtivo !== "todos");

    if (btnLimpar) {
      btnLimpar.style.display = temFiltro ? "inline-flex" : "none";
    }

    amostrasFiltradas = amostrasCache
      .filter((am) => {
        if (filtroCategoriaAtivo === "favoritos") {
          if (!am.favorito) return false;
        } else if (filtroCategoriaAtivo !== "todos") {
          if (am.categoria !== filtroCategoriaAtivo) return false;
        }

        if (termo) {
          const texto = [
            am.nome,
            am.fio,
            am.agulha_mm ? `${am.agulha_mm}mm ${am.agulha_mm}` : "",
            ROTULOS_CATEGORIA[am.categoria],
            ROTULOS_TECNICA[am.tecnica],
            am.anotacoes
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!texto.includes(termo)) return false;
        }

        return true;
      })
      // Favoritas ficam fixadas no topo para acesso rápido
      .sort((a, b) => {
        if (Boolean(b.favorito) !== Boolean(a.favorito)) {
          return b.favorito ? 1 : -1;
        }
        return (b.id || 0) - (a.id || 0);
      });

    renderizarGaleria(temFiltro);
  }

  function limparFiltros() {
    const busca = document.getElementById("busca-banco-amostras");
    if (busca) busca.value = "";
    filtroCategoriaAtivo = "todos";
    document.querySelectorAll("#chips-filtro-banco .chip-filtro-banco").forEach((c) => {
      c.classList.toggle("ativo", c.dataset.filtro === "todos");
    });
    aplicarFiltros();
  }

  function placeholderSvgNovelo() {
    return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="24" cy="24" r="15"></circle>
      <path d="M12 20c6-4 14-4 22 0"></path>
      <path d="M11 28c7 4 16 4 25-2"></path>
      <path d="M17 11c5 7 5 18 0 26"></path>
      <path d="M31 11c-4 8-3 18 2 25"></path>
      <path d="M35 35c3 2 6 3 9 2"></path>
    </svg>`;
  }

  function renderizarGaleria(temFiltro = false) {
    const grade = document.getElementById("grade-banco-amostras");
    const vazio = document.getElementById("estado-vazio-banco");
    const tituloVazio = document.getElementById("titulo-vazio-banco");
    const textoVazio = document.getElementById("texto-vazio-banco");
    if (!grade || !vazio) return;

    grade.innerHTML = "";

    if (amostrasFiltradas.length === 0) {
      grade.style.display = "none";
      vazio.style.display = "flex";
      if (temFiltro && amostrasCache.length > 0) {
        if (tituloVazio) tituloVazio.textContent = "Nenhuma amostra encontrada";
        if (textoVazio) {
          textoVazio.textContent = "Tente outro termo de busca ou clique em Limpar Filtros para ver todas as suas amostras.";
        }
      } else {
        if (tituloVazio) tituloVazio.textContent = "Seu banco de amostras está vazio";
        if (textoVazio) {
          textoVazio.textContent =
            "Cadastre seus pontos favoritos com medidas, fio, agulha e foto para reutilizar na Calculadora de Amostra em um clique.";
        }
      }
      return;
    }

    vazio.style.display = "none";
    grade.style.display = "grid";

    const frag = document.createDocumentFragment();
    amostrasFiltradas.forEach((amostra, idx) => {
      frag.appendChild(criarCardAmostra(amostra, idx));
    });
    grade.appendChild(frag);
  }

  function criarCardAmostra(amostra, idx) {
    const card = document.createElement("article");
    card.className = "card-banco-amostra";
    card.style.setProperty("--delay-stagger", `${Math.min(idx, 6) * 25}ms`);
    card.dataset.id = amostra.id;

    const catRotulo = ROTULOS_CATEGORIA[amostra.categoria] || "Básico";
    const tecRotulo = ROTULOS_TECNICA[amostra.tecnica] || "Crochê";

    const midiaHtml = amostra.foto_url
      ? `<img src="${amostra.foto_url}" alt="${escapeHtml(amostra.nome)}" class="card-banco-foto" loading="lazy" decoding="async" />`
      : `<div class="card-banco-placeholder">${placeholderSvgNovelo()}<span>${escapeHtml(tecRotulo)}</span></div>`;

    const partesConsumo = [];
    if (amostra.peso_g > 0) partesConsumo.push(`${formatarNumero(amostra.peso_g)}g`);
    if (amostra.metros > 0) partesConsumo.push(`${formatarNumero(amostra.metros)}m`);

    const medidaResumo = `${amostra.pontos} pts × ${amostra.carreiras} carr = ${formatarNumero(amostra.largura_cm)}×${formatarNumero(amostra.altura_cm)} cm`;

    card.innerHTML = `
      <div class="card-banco-midia">
        ${midiaHtml}
        <button
          type="button"
          class="btn-fav-card-banco ${amostra.favorito ? "favorito" : ""}"
          title="${amostra.favorito ? "Remover dos favoritos" : "Favoritar amostra"}"
          aria-label="Favoritar ${escapeHtml(amostra.nome)}"
          aria-pressed="${amostra.favorito ? "true" : "false"}"
        >★</button>

        <div class="menu-card-banco-wrap">
          <button type="button" class="btn-menu-card-banco" title="Mais ações" aria-label="Mais ações">⋯</button>
          <div class="dropdown-card-banco" role="menu">
            <button type="button" class="item-dropdown-banco acao-duplicar" role="menuitem">📄 Duplicar</button>
            <button type="button" class="item-dropdown-banco acao-editar" role="menuitem">✏️ Editar</button>
            <button type="button" class="item-dropdown-banco perigo acao-excluir" role="menuitem">🗑️ Excluir</button>
          </div>
        </div>

        <span class="badge-cat-card-banco">${escapeHtml(catRotulo)}</span>
      </div>

      <div class="card-banco-corpo">
        <h3 class="card-banco-nome">${escapeHtml(amostra.nome)}</h3>

        <div class="card-banco-badges">
          <span class="badge-mat-banco">${escapeHtml(formatarNumero(amostra.agulha_mm))} mm • ${escapeHtml(amostra.fio)}</span>
          ${partesConsumo.length > 0 ? `<span class="badge-mat-banco consumo">🧶 ${escapeHtml(partesConsumo.join(" • "))}</span>` : ""}
        </div>

        <div class="destaque-num-banco">${escapeHtml(medidaResumo)}</div>

        <div class="card-banco-rodape">
          <button type="button" class="btn-usar-calc-banco btn-macio">
            <span class="icone-usar-calc" aria-hidden="true">📐</span>
            <span class="txt-usar-calc">Usar na Calculadora</span>
          </button>
        </div>
      </div>
    `;

    // Clique no card abre Detalhes
    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".btn-fav-card-banco") ||
        e.target.closest(".menu-card-banco-wrap") ||
        e.target.closest(".btn-usar-calc-banco")
      ) {
        return;
      }
      abrirModalDetalhes(amostra.id);
    });

    // Favoritar com efeito Pop
    const btnFav = card.querySelector(".btn-fav-card-banco");
    btnFav?.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarFavorito(amostra.id, btnFav);
    });

    // Menu dropdown (...)
    const btnMenu = card.querySelector(".btn-menu-card-banco");
    const dropdown = card.querySelector(".dropdown-card-banco");
    btnMenu?.addEventListener("click", (e) => {
      e.stopPropagation();
      const estavaAberto = dropdown?.classList.contains("aberto");
      fecharTodosDropdowns();
      if (!estavaAberto) dropdown?.classList.add("aberto");
    });

    card.querySelector(".acao-duplicar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdowns();
      duplicarAmostra(amostra.id);
    });

    card.querySelector(".acao-editar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdowns();
      abrirModalForm(amostra);
    });

    card.querySelector(".acao-excluir")?.addEventListener("click", (e) => {
      e.stopPropagation();
      fecharTodosDropdowns();
      solicitarExclusao(amostra.id);
    });

    // Usar na Calculadora com micro-animação de confirmação
    const btnUsar = card.querySelector(".btn-usar-calc-banco");
    btnUsar?.addEventListener("click", (e) => {
      e.stopPropagation();
      enviarParaCalculadora(amostra, btnUsar);
    });

    return card;
  }

  function fecharTodosDropdowns() {
    document.querySelectorAll(".dropdown-card-banco.aberto").forEach((d) => d.classList.remove("aberto"));
  }

  async function alternarFavorito(id, botaoEl = null) {
    const amostra = amostrasCache.find((a) => Number(a.id) === Number(id));
    if (!amostra) return;

    amostra.favorito = !Boolean(amostra.favorito);
    amostra.atualizado_em = new Date().toISOString();
    await dbSalvarAmostra(amostra);

    if (botaoEl) {
      botaoEl.classList.toggle("favorito", amostra.favorito);
      botaoEl.setAttribute("aria-pressed", amostra.favorito ? "true" : "false");
      botaoEl.classList.remove("animar-pop");
      void botaoEl.offsetWidth;
      botaoEl.classList.add("animar-pop");
    }

    if (idDetalhesAtual === amostra.id) {
      const btnFavDet = document.getElementById("det-banco-btn-fav");
      if (btnFavDet) {
        btnFavDet.classList.toggle("favorito", amostra.favorito);
        btnFavDet.classList.remove("animar-pop");
        void btnFavDet.offsetWidth;
        btnFavDet.classList.add("animar-pop");
      }
    }

    notificarAtualizacao();
    // Reordena após a micro-animação do pop completar
    setTimeout(() => aplicarFiltros(), 280);
  }

  function enviarParaCalculadora(amostra, botaoEl = null) {
    if (!amostra) return;

    if (botaoEl) {
      const htmlOriginal = botaoEl.innerHTML;
      botaoEl.classList.add("confirmado");
      botaoEl.innerHTML = `<span>✓ Carregado!</span>`;
      setTimeout(() => {
        botaoEl.classList.remove("confirmado");
        botaoEl.innerHTML = htmlOriginal;
      }, 900);
    }

    mostrarToast("✓ Amostra carregada na calculadora!");

    setTimeout(() => {
      fecharModalDetalhes();
      // Navega para a Calculadora de Amostra na barra lateral
      const btnSidebarCalc = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="amostra"]');
      if (btnSidebarCalc && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
        BarraLateral.alternarFerramenta(btnSidebarCalc);
      }
      // Envia os dados matemáticos + materiais para a Calculadora de Amostra
      if (typeof CalculadoraAmostra !== "undefined" && typeof CalculadoraAmostra.carregarDoBancoDeAmostras === "function") {
        CalculadoraAmostra.carregarDoBancoDeAmostras(amostra);
      }
    }, 100);
  }

  // ==========================================================================
  // PARTE 3: MODAIS (CADASTRO / EDIÇÃO, DETALHES, EXCLUSÃO E UPLOAD)
  // ==========================================================================

  function atualizarPreviewFoto(dataUrl) {
    const placeholder = document.getElementById("upload-placeholder-banco");
    const preview = document.getElementById("upload-preview-banco");
    const img = document.getElementById("upload-preview-img-banco");
    const input = document.getElementById("banco-foto-input");

    if (dataUrl) {
      if (img) img.src = dataUrl;
      if (preview) preview.style.display = "flex";
      if (placeholder) placeholder.style.display = "none";
    } else {
      if (img) img.src = "";
      if (preview) preview.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
      if (input) input.value = "";
    }
  }

  function comprimirImagem(arquivo, maxDim = 680, qualidade = 0.84) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = (ev) => {
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
        img.onerror = () => reject(new Error("Erro ao carregar imagem"));
        img.src = ev.target.result;
      };
      leitor.onerror = () => reject(new Error("Erro ao ler arquivo"));
      leitor.readAsDataURL(arquivo);
    });
  }

  async function processarFotoUpload(arquivo) {
    const ehImg =
      arquivo &&
      ((arquivo.type && arquivo.type.startsWith("image/")) ||
        /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(arquivo.name || ""));
    if (!ehImg) {
      mostrarToast("Selecione um arquivo de imagem válido (PNG, JPG ou WEBP).");
      return;
    }
    try {
      fotoBase64Atual = await comprimirImagem(arquivo);
      atualizarPreviewFoto(fotoBase64Atual);
    } catch {
      const leitor = new FileReader();
      leitor.onload = (e) => {
        fotoBase64Atual = e.target.result;
        atualizarPreviewFoto(fotoBase64Atual);
      };
      leitor.readAsDataURL(arquivo);
    }
  }

  async function abrirModalForm(dados = null, tituloCustom = null) {
    await atualizarSugestoesInventarios();

    const modal = document.getElementById("modal-form-banco-amostra");
    const form = document.getElementById("form-banco-amostra");
    const titulo = document.getElementById("titulo-modal-form-banco");
    const erroBox = document.getElementById("aviso-erro-banco");
    if (!modal || !form) return;

    form.reset();
    if (erroBox) erroBox.style.display = "none";

    const isEdicao = Boolean(dados && dados.id);
    if (titulo) titulo.textContent = tituloCustom || (isEdicao ? "Editar Amostra" : "Nova Amostra");

    document.getElementById("banco-amostra-id").value = isEdicao ? dados.id : "";
    document.getElementById("banco-nome").value = dados?.nome || "";
    const tecPadrao =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obterTecnicaEfetiva === "function"
        ? Configuracoes.obterTecnicaEfetiva()
        : "croche";
    document.getElementById("banco-tecnica").value = dados?.tecnica || tecPadrao;
    document.getElementById("banco-categoria").value = dados?.categoria || "basico";
    document.getElementById("banco-tensao").value = dados?.tensao || "medio";
    document.getElementById("banco-fio").value = dados?.fio || "";
    document.getElementById("banco-agulha").value = dados?.agulha_mm ?? "";
    document.getElementById("banco-largura").value = dados?.largura_cm ?? 10;
    document.getElementById("banco-altura").value = dados?.altura_cm ?? 10;
    document.getElementById("banco-pontos").value = dados?.pontos ?? "";
    document.getElementById("banco-carreiras").value = dados?.carreiras ?? "";
    document.getElementById("banco-peso").value = dados?.peso_g ?? "";
    document.getElementById("banco-metros").value = dados?.metros ?? "";
    document.getElementById("banco-link").value = dados?.link_referencia || "";
    document.getElementById("banco-anotacoes").value = dados?.anotacoes || "";

    fotoBase64Atual = dados?.foto_url || "";
    atualizarPreviewFoto(fotoBase64Atual);

    modal.style.display = "flex";
    setTimeout(() => document.getElementById("banco-nome")?.focus(), 100);
  }

  function fecharModalForm() {
    const modal = document.getElementById("modal-form-banco-amostra");
    if (modal) modal.style.display = "none";
    fotoBase64Atual = "";
  }

  async function salvarFormAmostra(e) {
    e.preventDefault();
    const erroBox = document.getElementById("aviso-erro-banco");
    if (erroBox) erroBox.style.display = "none";

    const idVal = document.getElementById("banco-amostra-id").value;
    const nome = document.getElementById("banco-nome").value.trim();
    const tecnica = document.getElementById("banco-tecnica").value || "croche";
    const categoria = document.getElementById("banco-categoria").value || "basico";
    const tensao = document.getElementById("banco-tensao").value || "medio";
    const fio = document.getElementById("banco-fio").value.trim();
    const agulhaMm = parseFloat(document.getElementById("banco-agulha").value);
    const larguraCm = parseFloat(document.getElementById("banco-largura").value);
    const alturaCm = parseFloat(document.getElementById("banco-altura").value);
    const pontos = parseInt(document.getElementById("banco-pontos").value, 10);
    const carreiras = parseInt(document.getElementById("banco-carreiras").value, 10);
    const pesoG = parseFloat(document.getElementById("banco-peso").value);
    const metros = parseFloat(document.getElementById("banco-metros").value);
    const linkRef = document.getElementById("banco-link").value.trim();
    const anotacoes = document.getElementById("banco-anotacoes").value.trim();

    if (!nome || !fio || !(agulhaMm > 0) || !(larguraCm > 0) || !(alturaCm > 0) || !(pontos > 0) || !(carreiras > 0)) {
      if (erroBox) {
        erroBox.textContent =
          "Preencha todos os campos obrigatórios (*): Nome do Ponto, Fio, Agulha (mm), Largura, Altura, Pontos e Carreiras.";
        erroBox.style.display = "block";
      }
      return;
    }

    const existente = idVal ? amostrasCache.find((a) => Number(a.id) === Number(idVal)) : null;

    const registro = {
      nome,
      tecnica,
      categoria,
      tensao,
      fio,
      agulha_mm: agulhaMm,
      largura_cm: larguraCm,
      altura_cm: alturaCm,
      pontos,
      carreiras,
      peso_g: !isNaN(pesoG) && pesoG > 0 ? pesoG : null,
      metros: !isNaN(metros) && metros > 0 ? metros : null,
      foto_url: fotoBase64Atual || "",
      link_referencia: linkRef,
      anotacoes,
      favorito: existente ? Boolean(existente.favorito) : false,
      criado_em: existente?.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    };

    if (idVal) registro.id = Number(idVal);

    mostrarLoader(true);
    let salvo;
    try {
      salvo = await dbSalvarAmostra(registro);
    } catch (erro) {
      console.error("Erro ao salvar amostra:", erro);
      mostrarToast("Não foi possível salvar no banco local. Recarregue a página e tente novamente.");
      return;
    } finally {
      mostrarLoader(false);
    }

    const idxExistente = amostrasCache.findIndex((a) => Number(a.id) === Number(salvo.id));
    if (idxExistente !== -1) {
      amostrasCache[idxExistente] = salvo;
    } else {
      amostrasCache.unshift(salvo);
    }

    fecharModalForm();
    notificarAtualizacao();
    aplicarFiltros();
    mostrarToast(idVal ? "✓ Amostra atualizada!" : "✓ Nova amostra salva no banco!");

    if (idDetalhesAtual === salvo.id) {
      abrirModalDetalhes(salvo.id);
    }
  }

  function duplicarAmostra(id) {
    const orig = amostrasCache.find((a) => Number(a.id) === Number(id));
    if (!orig) return;

    const copia = {
      ...orig,
      id: "",
      nome: `${orig.nome} (Cópia)`,
      favorito: false
    };
    fecharModalDetalhes();
    abrirModalForm(copia, "Duplicar Amostra");
  }

  function abrirModalDetalhes(id) {
    const am = amostrasCache.find((a) => Number(a.id) === Number(id));
    if (!am) return;
    idDetalhesAtual = am.id;

    document.getElementById("det-banco-nome").textContent = am.nome;
    document.getElementById("det-banco-categoria").textContent = ROTULOS_CATEGORIA[am.categoria] || "Básico";
    document.getElementById("det-banco-tecnica").textContent = ROTULOS_TECNICA[am.tecnica] || "Crochê";
    document.getElementById("det-banco-tensao").textContent = `Tensão: ${ROTULOS_TENSAO[am.tensao] || "Médio"}`;

    const btnFav = document.getElementById("det-banco-btn-fav");
    if (btnFav) btnFav.classList.toggle("favorito", Boolean(am.favorito));

    const img = document.getElementById("det-banco-foto");
    const placeholder = document.getElementById("det-banco-placeholder");
    if (am.foto_url) {
      if (img) {
        img.src = am.foto_url;
        img.style.display = "block";
      }
      if (placeholder) placeholder.style.display = "none";
    } else {
      if (img) img.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
    }

    document.getElementById("det-banco-destaque-num").textContent =
      `${am.pontos} pts × ${am.carreiras} carr = ${formatarNumero(am.largura_cm)} × ${formatarNumero(am.altura_cm)} cm`;
    document.getElementById("det-banco-fio").textContent = am.fio || "—";
    document.getElementById("det-banco-agulha").textContent = `${formatarNumero(am.agulha_mm)} mm`;

    const areaCm2 = (Number(am.largura_cm) || 10) * (Number(am.altura_cm) || 10);
    const partesCons = [];
    const partes100 = [];
    if (am.peso_g > 0) {
      partesCons.push(`${formatarNumero(am.peso_g)} g`);
      partes100.push(`${formatarNumero((am.peso_g / areaCm2) * 100)} g`);
    }
    if (am.metros > 0) {
      partesCons.push(`${formatarNumero(am.metros)} m`);
      partes100.push(`${formatarNumero((am.metros / areaCm2) * 100)} m`);
    }
    document.getElementById("det-banco-consumo").textContent = partesCons.length ? partesCons.join(" • ") : "Não informado";
    document.getElementById("det-banco-consumo-100").textContent = partes100.length ? partes100.join(" • ") : "—";

    const linkBox = document.getElementById("det-banco-link-box");
    const linkEl = document.getElementById("det-banco-link");
    if (am.link_referencia && linkBox && linkEl) {
      const urlSegura = /^https?:\/\//i.test(am.link_referencia) ? am.link_referencia : `https://${am.link_referencia}`;
      linkEl.href = urlSegura;
      linkEl.textContent = `${am.link_referencia} ↗`;
      linkBox.style.display = "flex";
    } else if (linkBox) {
      linkBox.style.display = "none";
    }

    const notasBox = document.getElementById("det-banco-notas-box");
    const notasEl = document.getElementById("det-banco-anotacoes");
    if (am.anotacoes && notasBox && notasEl) {
      notasEl.textContent = am.anotacoes;
      notasBox.style.display = "flex";
    } else if (notasBox) {
      notasBox.style.display = "none";
    }

    const modal = document.getElementById("modal-detalhes-banco-amostra");
    if (modal) modal.style.display = "flex";
  }

  function fecharModalDetalhes() {
    const modal = document.getElementById("modal-detalhes-banco-amostra");
    if (modal) modal.style.display = "none";
    idDetalhesAtual = null;
  }

  function solicitarExclusao(id) {
    const am = amostrasCache.find((a) => Number(a.id) === Number(id));
    if (!am) return;
    idParaExcluir = am.id;
    const modal = document.getElementById("modal-excluir-banco-amostra");
    const texto = document.getElementById("texto-excluir-banco");
    if (texto) {
      texto.innerHTML = `Deseja remover permanentemente <strong>${escapeHtml(am.nome)}</strong> (${escapeHtml(am.fio)}) do seu banco de amostras?`;
    }
    if (modal) modal.style.display = "flex";
  }

  function fecharModalExclusao() {
    const modal = document.getElementById("modal-excluir-banco-amostra");
    if (modal) modal.style.display = "none";
    idParaExcluir = null;
  }

  async function confirmarExclusao() {
    if (idParaExcluir === null || idParaExcluir === undefined) return;
    await dbExcluirAmostra(idParaExcluir);
    amostrasCache = amostrasCache.filter((a) => Number(a.id) !== Number(idParaExcluir));
    fecharModalExclusao();
    fecharModalDetalhes();
    notificarAtualizacao();
    aplicarFiltros();
    mostrarToast("Amostra removida do banco.");
  }

  // ==========================================================================
  // PARTE 4: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================

  function vincularEventos() {
    document.getElementById("btn-nova-amostra-banco")?.addEventListener("click", () => abrirModalForm(null));
    document.getElementById("btn-vazio-nova-amostra")?.addEventListener("click", () => abrirModalForm(null));

    const buscaBanco = document.getElementById("busca-banco-amostras");
    if (buscaBanco) {
      const buscarDebounced =
        typeof BancoDadosPT !== "undefined" ? BancoDadosPT.debounce(aplicarFiltros, 80) : aplicarFiltros;
      buscaBanco.addEventListener("input", buscarDebounced);
    }
    document.getElementById("btn-limpar-filtros-banco")?.addEventListener("click", limparFiltros);

    document.querySelectorAll("#chips-filtro-banco .chip-filtro-banco").forEach((chip) => {
      chip.addEventListener("click", () => {
        filtroCategoriaAtivo = chip.dataset.filtro || "todos";
        document.querySelectorAll("#chips-filtro-banco .chip-filtro-banco").forEach((c) => {
          c.classList.toggle("ativo", c === chip);
        });
        aplicarFiltros();
      });
    });

    // Fecha dropdowns de card ao clicar fora
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".menu-card-banco-wrap")) {
        fecharTodosDropdowns();
      }
    });

    // Modal Cadastro / Edição
    document.getElementById("btn-fechar-form-banco")?.addEventListener("click", fecharModalForm);
    document.getElementById("btn-cancelar-form-banco")?.addEventListener("click", fecharModalForm);
    document.getElementById("form-banco-amostra")?.addEventListener("submit", salvarFormAmostra);
    document.getElementById("modal-form-banco-amostra")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-form-banco-amostra") fecharModalForm();
    });

    // Upload de Foto com Drag & Drop
    const uploadArea = document.getElementById("upload-area-banco");
    const inputFoto = document.getElementById("banco-foto-input");
    const btnRemFoto = document.getElementById("btn-remover-foto-banco");

    if (uploadArea && inputFoto) {
      inputFoto.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      uploadArea.addEventListener("click", (e) => {
        if (e.target === inputFoto || e.target.closest("#btn-remover-foto-banco")) return;
        inputFoto.click();
      });
      inputFoto.addEventListener("change", (e) => {
        const arq = e.target.files?.[0];
        if (arq) processarFotoUpload(arq);
        e.target.value = "";
      });
      uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
      });
      uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        const arq = e.dataTransfer?.files?.[0];
        if (arq) processarFotoUpload(arq);
      });
    }

    btnRemFoto?.addEventListener("click", (e) => {
      e.stopPropagation();
      fotoBase64Atual = "";
      atualizarPreviewFoto("");
    });

    // Modal Detalhes
    document.getElementById("btn-fechar-det-banco")?.addEventListener("click", fecharModalDetalhes);
    document.getElementById("modal-detalhes-banco-amostra")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-detalhes-banco-amostra") fecharModalDetalhes();
    });
    document.getElementById("det-banco-btn-fav")?.addEventListener("click", () => {
      if (idDetalhesAtual) alternarFavorito(idDetalhesAtual);
    });
    document.getElementById("det-banco-btn-excluir")?.addEventListener("click", () => {
      if (idDetalhesAtual) solicitarExclusao(idDetalhesAtual);
    });
    document.getElementById("det-banco-btn-duplicar")?.addEventListener("click", () => {
      if (idDetalhesAtual) duplicarAmostra(idDetalhesAtual);
    });
    document.getElementById("det-banco-btn-editar")?.addEventListener("click", () => {
      if (idDetalhesAtual) {
        const am = amostrasCache.find((a) => Number(a.id) === Number(idDetalhesAtual));
        if (am) {
          fecharModalDetalhes();
          abrirModalForm(am);
        }
      }
    });
    document.getElementById("det-banco-btn-usar")?.addEventListener("click", (e) => {
      if (idDetalhesAtual) {
        const am = amostrasCache.find((a) => Number(a.id) === Number(idDetalhesAtual));
        if (am) enviarParaCalculadora(am, e.currentTarget);
      }
    });

    // Modal Exclusão
    document.getElementById("btn-cancelar-excluir-banco")?.addEventListener("click", fecharModalExclusao);
    document.getElementById("btn-confirmar-excluir-banco")?.addEventListener("click", confirmarExclusao);
    document.getElementById("modal-excluir-banco-amostra")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-excluir-banco-amostra") fecharModalExclusao();
    });

    // Atualiza a galeria instantaneamente quando a Calculadora de Amostra ou Configurações alterar o banco
    window.addEventListener("ponto-trama:banco-amostras-atualizado", async (e) => {
      if (e.detail?.origem === "calculadora" || e.detail?.origem === "configuracoes") {
        amostrasCache = await dbObterStore(STORE_AMOSTRAS);
        aplicarFiltros();
      }
    });

    // ESC fecha modais
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (document.getElementById("modal-excluir-banco-amostra")?.style.display === "flex") {
        fecharModalExclusao();
      } else if (document.getElementById("modal-form-banco-amostra")?.style.display === "flex") {
        fecharModalForm();
      } else if (document.getElementById("modal-detalhes-banco-amostra")?.style.display === "flex") {
        fecharModalDetalhes();
      } else {
        fecharTodosDropdowns();
      }
    });
  }

  let jaInicializado = false;

  async function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    // Vincula eventos primeiro para a interface responder imediatamente
    vincularEventos();

    const timerLoader = setTimeout(() => mostrarLoader(true), 150);
    try {
      amostrasCache = await dbObterStore(STORE_AMOSTRAS);
    } catch (erro) {
      console.error("Falha ao carregar Banco de Amostras:", erro);
      amostrasCache = [];
    } finally {
      clearTimeout(timerLoader);
      mostrarLoader(false);
    }

    aplicarFiltros();
    notificarAtualizacao();
  }

  async function recarregar() {
    try {
      amostrasCache = await dbObterStore(STORE_AMOSTRAS);
      aplicarFiltros();
    } catch (erro) {
      console.error("Falha ao recarregar Banco de Amostras:", erro);
    }
  }

  return {
    init,
    recarregar,
    obterTodas: () => amostrasCache.map((a) => ({ ...a })),
    abrirModalNovaAmostra: () => abrirModalForm(null),
    abrirModalDetalhes
  };
})();
