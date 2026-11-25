// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: INVENTÁRIO DE FIOS
// Módulo completo com persistência IndexedDB, busca instantânea, filtros,
// controle de estoque em tempo real (+ e -), cadastro/edição, tela de
// detalhes com ficha técnica, cálculo de rendimento e backup JSON.
// ==========================================================================

const InventarioFios = (() => {
  // Configurações do Banco de Dados IndexedDB
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  // Estado interno em memória
  let db = null;
  let fiosCache = []; // Todos os fios carregados do IndexedDB
  let fiosFiltrados = []; // Fios após aplicação da busca e filtros
  let idFioSelecionado = null; // ID do fio atualmente exibido no modal de detalhes
  let indexFioAtual = -1; // Índice atual na lista filtrada para navegação < e >
  let imagemAtualBase64 = null; // Imagem temporária em edição no formulário

  // Dados iniciais de amostra para primeira execução
  const DADOS_INICIAIS = [
    {
      nome: "Amigurumi",
      marca: "Círculo",
      cor_nome: "Off-White",
      cor_codigo: "8176",
      lote: "482019",
      imagem_url: "",
      tex: 492,
      composicao: "100% Algodão Mercerizado",
      peso_novelo_g: 125,
      metragem_novelo_m: 254,
      agulha: "Crochê 2.5mm–4.0mm / Tricô 3.5mm–4.5mm",
      quantidade: 4,
      peso_restante_g: null,
      preco_pago: 16.90,
      localizacao: "Caixa 01 - Amigurumi",
      observacoes: "Fio super macio e resistente, ótimo acabamento para bichinhos e detalhes.",
      criado_em: new Date().toISOString()
    },
    {
      nome: "Mollet",
      marca: "Pingouin",
      cor_nome: "Mostarda",
      cor_codigo: "1324",
      lote: "92841",
      imagem_url: "",
      tex: 500,
      composicao: "100% Acrílico",
      peso_novelo_g: 100,
      metragem_novelo_m: 200,
      agulha: "Crochê 4.0mm–5.0mm / Tricô 4.5mm–5.5mm",
      quantidade: 1,
      peso_restante_g: null,
      preco_pago: 9.80,
      localizacao: "Gaveta de Lãs",
      observacoes: "Clássico e quente, perfeito para toucas, mantas e cachecóis.",
      criado_em: new Date().toISOString()
    },
    {
      nome: "Anne",
      marca: "Círculo",
      cor_nome: "Verde Musgo",
      cor_codigo: "5398",
      lote: "771204",
      imagem_url: "",
      tex: 295,
      composicao: "100% Algodão Mercerizado",
      peso_novelo_g: 147.5,
      metragem_novelo_m: 500,
      agulha: "Crochê 1.75mm–2.5mm / Tricô 3.0mm–3.5mm",
      quantidade: 2.5,
      peso_restante_g: null,
      preco_pago: 21.00,
      localizacao: "Cesto 02 - Fios Finos",
      observacoes: "Rendimento excelente para peças de vestuário, barrados e toalhas.",
      criado_em: new Date().toISOString()
    },
    {
      nome: "Barroco Maxcolor",
      marca: "Círculo",
      cor_nome: "Cru / Natural",
      cor_codigo: "0020",
      lote: "104928",
      imagem_url: "",
      tex: 885,
      composicao: "100% Algodão",
      peso_novelo_g: 400,
      metragem_novelo_m: 452,
      agulha: "Crochê 4.0mm–5.0mm / Tricô 4.5mm–5.5mm",
      quantidade: 0,
      peso_restante_g: null,
      preco_pago: 28.50,
      localizacao: "Prateleira Superior",
      observacoes: "Acabou na última encomenda. Comprar mais 2 novelos do mesmo lote se possível.",
      criado_em: new Date().toISOString()
    }
  ];

  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (IndexedDB, Filtros, Cálculos e Regras de Negócio)
  // ==========================================================================

  // Inicialização e conexão com o IndexedDB (usa conexão única compartilhada)
  function abrirBanco() {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.abrir();
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  // Obter todos os fios do IndexedDB (via cache em RAM)
  function dbObterTodos(forcarDisco = false) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.obterTodos(STORE_FIOS, forcarDisco);
    }
    return Promise.resolve([]);
  }

  // Salvar ou atualizar fio no IndexedDB (atualiza cache atomicamente)
  function dbSalvar(fio) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.salvar(STORE_FIOS, fio);
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  // Excluir fio do IndexedDB (atualiza cache atomicamente)
  function dbExcluir(id) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.excluir(STORE_FIOS, id);
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  // Carga inicial com sementes caso o banco esteja vazio
  async function carregarDadosIniciais() {
    let dados = await dbObterTodos();
    const jaInicializado = localStorage.getItem("ponto_trama_fios_inicializados") === "true";

    // Só carrega amostras se o banco estiver vazio E nunca tiver sido inicializado antes
    if ((!dados || dados.length === 0) && !jaInicializado) {
      if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.salvarEmLote === "function") {
        dados = await BancoDadosPT.salvarEmLote(STORE_FIOS, DADOS_INICIAIS);
      }
      localStorage.setItem("ponto_trama_fios_inicializados", "true");
    } else if (dados && dados.length > 0 && !jaInicializado) {
      localStorage.setItem("ponto_trama_fios_inicializados", "true");
    }

    fiosCache = dados || [];
    return fiosCache;
  }

  // Cálculo do indicador de status de estoque
  function calcularStatus(quantidade) {
    const q = Number(quantidade) || 0;
    if (q > 1) {
      return {
        chave: "em-estoque",
        rotulo: "Em estoque",
        classe: "status-em-estoque"
      };
    } else if (q > 0) {
      return {
        chave: "acabando",
        rotulo: "Acabando",
        classe: "status-acabando"
      };
    } else {
      return {
        chave: "zerado",
        rotulo: "Zerado",
        classe: "status-zerado"
      };
    }
  }

  // Faixa de TEX (fino < 350, médio 350-600, grosso > 600)
  function obterFaixaTex(tex) {
    const t = Number(tex) || 0;
    if (t <= 0) return "";
    if (t < 350) return "fino";
    if (t <= 600) return "medio";
    return "grosso";
  }

  // Formatadores de valores
  function formatarMoeda(valor) {
    const v = Number(valor) || 0;
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarQuantidade(qtd) {
    const q = Number(qtd) || 0;
    return q % 1 === 0
      ? q.toString()
      : q.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function formatarPeso(pesoGramas) {
    const p = Number(pesoGramas) || 0;
    if (p <= 0) return "—";
    if (p >= 1000) {
      const kg = p / 1000;
      return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
    }
    return `${Math.round(p)} g`;
  }

  function formatarMetragem(metros) {
    const m = Number(metros) || 0;
    if (m <= 0) return "—";
    return `${Math.round(m)} m`;
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

  // Recalcula o resumo consolidado de estoque no topo
  function atualizarResumoEstoque() {
    let totalNovelos = 0;
    let totalPesoGramas = 0;
    let totalValorEstoque = 0;

    fiosCache.forEach((fio) => {
      const qtd = Number(fio.quantidade) || 0;
      totalNovelos += qtd;

      const pesoUn = Number(fio.peso_novelo_g) || 0;
      if (pesoUn > 0 && qtd > 0) {
        totalPesoGramas += qtd * pesoUn;
      } else if (fio.peso_restante_g) {
        totalPesoGramas += Number(fio.peso_restante_g) || 0;
      }

      const preco = Number(fio.preco_pago) || 0;
      if (preco > 0 && qtd > 0) {
        totalValorEstoque += qtd * preco;
      }
    });

    const elNovelos = document.getElementById("fios-total-novelos");
    const elPeso = document.getElementById("fios-peso-total");
    const elValor = document.getElementById("fios-valor-total");

    if (elNovelos) {
      elNovelos.textContent = formatarQuantidade(totalNovelos);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elNovelos);
      }
    }

    if (elPeso) {
      elPeso.textContent = formatarPeso(totalPesoGramas);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elPeso);
      }
    }

    if (elValor) {
      elValor.textContent = formatarMoeda(totalValorEstoque);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elValor);
      }
    }
  }

  // Aplicação da busca instantânea e dos filtros de marca, composição, TEX e status
  function aplicarFiltros(atualizarSeletores = false) {
    const termoBusca = (document.getElementById("busca-fios")?.value || "").trim().toLowerCase();
    const filtroMarca = (document.getElementById("filtro-marca")?.value || "").trim().toLowerCase();
    const filtroComposicao = (document.getElementById("filtro-composicao")?.value || "").trim().toLowerCase();
    const filtroTex = (document.getElementById("filtro-tex")?.value || "").trim();
    const filtroStatus = (document.getElementById("filtro-status")?.value || "").trim();

    fiosFiltrados = fiosCache.filter((fio) => {
      // 1. Busca por termo
      if (termoBusca) {
        const nome = (fio.nome || "").toLowerCase();
        const marca = (fio.marca || "").toLowerCase();
        const corNome = (fio.cor_nome || "").toLowerCase();
        const corCodigo = (fio.cor_codigo || "").toLowerCase();
        const lote = (fio.lote || "").toLowerCase();

        const bateuBusca =
          nome.includes(termoBusca) ||
          marca.includes(termoBusca) ||
          corNome.includes(termoBusca) ||
          corCodigo.includes(termoBusca) ||
          lote.includes(termoBusca);

        if (!bateuBusca) return false;
      }

      // 2. Filtro por marca
      if (filtroMarca && (fio.marca || "").toLowerCase() !== filtroMarca) {
        return false;
      }

      // 3. Filtro por composição
      if (filtroComposicao && (fio.composicao || "").toLowerCase() !== filtroComposicao) {
        return false;
      }

      // 4. Filtro por faixa de TEX
      if (filtroTex) {
        const faixa = obterFaixaTex(fio.tex);
        if (faixa !== filtroTex) return false;
      }

      // 5. Filtro por status de estoque
      if (filtroStatus) {
        const status = calcularStatus(fio.quantidade);
        if (status.chave !== filtroStatus) return false;
      }

      return true;
    });

    renderizarGradeFios();
    if (atualizarSeletores) {
      atualizarSeletoresDinamicos();
    }
  }

  // Popula dinamicamente os selects com marcas e composições existentes
  function atualizarSeletoresDinamicos() {
    const selectMarca = document.getElementById("filtro-marca");
    const selectComposicao = document.getElementById("filtro-composicao");

    if (selectMarca) {
      const valorAtual = selectMarca.value;
      const marcas = [...new Set(fiosCache.map((f) => (f.marca || "").trim()).filter(Boolean))].sort();
      selectMarca.innerHTML = '<option value="">Todas as marcas</option>';
      marcas.forEach((marca) => {
        const opt = document.createElement("option");
        opt.value = marca;
        opt.textContent = marca;
        if (marca.toLowerCase() === valorAtual.toLowerCase()) opt.selected = true;
        selectMarca.appendChild(opt);
      });
    }

    if (selectComposicao) {
      const valorAtual = selectComposicao.value;
      const composicoes = [...new Set(fiosCache.map((f) => (f.composicao || "").trim()).filter(Boolean))].sort();
      selectComposicao.innerHTML = '<option value="">Todas composições</option>';
      composicoes.forEach((comp) => {
        const opt = document.createElement("option");
        opt.value = comp;
        opt.textContent = comp;
        if (comp.toLowerCase() === valorAtual.toLowerCase()) opt.selected = true;
        selectComposicao.appendChild(opt);
      });
    }
  }

  // Limpa todos os filtros ativos e a busca
  function limparFiltros() {
    const inputBusca = document.getElementById("busca-fios");
    const selectMarca = document.getElementById("filtro-marca");
    const selectComposicao = document.getElementById("filtro-composicao");
    const selectTex = document.getElementById("filtro-tex");
    const selectStatus = document.getElementById("filtro-status");

    if (inputBusca) inputBusca.value = "";
    if (selectMarca) selectMarca.value = "";
    if (selectComposicao) selectComposicao.value = "";
    if (selectTex) selectTex.value = "";
    if (selectStatus) selectStatus.value = "";

    aplicarFiltros();
  }

  // Ajuste rápido de estoque com salvamento imediato (+ e -)
  async function alterarQuantidade(id, delta) {
    const fio = fiosCache.find((f) => f.id === Number(id));
    if (!fio) return;

    const novaQtd = Math.max(0, Math.round(((Number(fio.quantidade) || 0) + delta) * 10) / 10);
    fio.quantidade = novaQtd;

    await dbSalvar(fio);
    atualizarResumoEstoque();
    atualizarCardNoDOM(fio);

    // Se a tela de detalhes estiver aberta para este fio, sincroniza imediatamente
    if (idFioSelecionado === fio.id) {
      renderizarDetalhesFio(fio);
    }
  }

  // Duplicar especificações técnicas para cadastrar nova cor rapidamente
  function duplicarFio(id) {
    const original = fiosCache.find((f) => f.id === Number(id));
    if (!original) return;

    const copia = {
      id: "", // novo cadastro
      nome: original.nome || "",
      marca: original.marca || "",
      cor_nome: "",
      cor_codigo: "",
      lote: "",
      imagem_url: null,
      tex: original.tex || "",
      composicao: original.composicao || "",
      peso_novelo_g: original.peso_novelo_g || "",
      metragem_novelo_m: original.metragem_novelo_m || "",
      agulha: original.agulha || "",
      quantidade: 1,
      peso_restante_g: "",
      preco_pago: original.preco_pago || "",
      localizacao: original.localizacao || "",
      observacoes: original.observacoes ? `Cópia de ${original.nome}: ${original.observacoes}` : ""
    };

    fecharModalDetalhes();
    abrirModalCadastro(copia, "Novo Fio (Duplicado)");
  }

  // ==========================================================================
  // EXCLUSÃO DE FIOS (COM MODAL DE CONFIRMAÇÃO ESTILIZADO)
  // ==========================================================================
  let idFioParaExcluir = null;

  // Abre o modal de confirmação de exclusão
  function solicitarExclusaoFio(id) {
    if (id === undefined || id === null) return;
    idFioParaExcluir = id;

    // Busca o fio por igualdade de valor (string ou número)
    const fio = fiosCache.find((f) => String(f.id) === String(id) || Number(f.id) === Number(id));
    if (!fio) {
      console.warn("Fio não encontrado para exclusão:", id);
      return;
    }

    const modal = document.getElementById("modal-confirmar-exclusao-fio");
    const textoEl = document.getElementById("texto-confirmar-exclusao");

    if (modal && textoEl) {
      textoEl.innerHTML = `Tem certeza que deseja excluir o fio <strong>${escapeHtml(fio.nome)} - ${escapeHtml(fio.cor_nome)}</strong> (${escapeHtml(fio.marca || "")})?<br><span style="font-size: 12px; color: rgba(252,241,208,0.6); display: inline-block; margin-top: 6px;">Esta ação removerá o novelo do seu estoque e não pode ser desfeita.</span>`;
      modal.style.display = "flex";
    } else {
      // Fallback para window.confirm caso o modal não esteja presente
      const confirmou = window.confirm(
        `Deseja realmente excluir o fio "${fio.nome} - ${fio.cor_nome}" do seu inventário?`
      );
      if (confirmou) {
        executarExclusaoFio(fio.id);
      }
    }
  }

  // Fecha o modal de confirmação de exclusão
  function fecharModalConfirmarExclusao() {
    const modal = document.getElementById("modal-confirmar-exclusao-fio");
    if (modal) modal.style.display = "none";
    idFioParaExcluir = null;
  }

  // Executa a remoção definitiva do fio do IndexedDB e da interface
  async function executarExclusaoFio(id = null) {
    try {
      const idAlvo = id !== null && id !== undefined ? id : idFioParaExcluir;
      if (idAlvo === null || idAlvo === undefined) return;

      const fio = fiosCache.find((f) => String(f.id) === String(idAlvo) || Number(f.id) === Number(idAlvo));
      const idParaExcluir = fio ? fio.id : idAlvo;

      await dbExcluir(idParaExcluir);

      // Remove da memória cache filtrando tanto por string quanto por número
      fiosCache = fiosCache.filter(
        (f) => String(f.id) !== String(idParaExcluir) && Number(f.id) !== Number(idParaExcluir)
      );

      fecharModalConfirmarExclusao();
      fecharModalDetalhes();
      aplicarFiltros(true);
      atualizarResumoEstoque();
    } catch (err) {
      console.error("Erro ao excluir fio:", err);
      alert("Ocorreu um erro ao excluir o fio do inventário.");
    }
  }

  // Exportar inventário completo em formato JSON
  function exportarBackupJSON() {
    if (!fiosCache || fiosCache.length === 0) {
      alert("Não há fios cadastrados no inventário para exportar.");
      return;
    }
    const dadosStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fiosCache, null, 2));
    const linkDownload = document.createElement("a");
    const dataHoje = new Date().toISOString().slice(0, 10);
    linkDownload.setAttribute("href", dadosStr);
    linkDownload.setAttribute("download", `ponto-e-trama-inventario-fios-${dataHoje}.json`);
    document.body.appendChild(linkDownload);
    linkDownload.click();
    linkDownload.remove();

    // Fecha menu de backup
    fecharMenuBackup();
  }

  // Importar backup de arquivo JSON
  function importarBackupJSON(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = async (evento) => {
      try {
        const conteudo = JSON.parse(evento.target.result);
        if (!Array.isArray(conteudo)) {
          alert("Arquivo de backup inválido! O conteúdo deve ser uma lista de fios.");
          return;
        }

        const confirmou = window.confirm(
          `Foram encontrados ${conteudo.length} fios no arquivo. Deseja importá-los para o seu inventário?`
        );
        if (!confirmou) return;

        if (typeof BancoDadosPT !== "undefined" && typeof BancoDadosPT.salvarEmLote === "function") {
          const limpos = conteudo.map(({ id, ...fioLimpo }) => fioLimpo);
          fiosCache = await BancoDadosPT.salvarEmLote(STORE_FIOS, limpos);
        }
        aplicarFiltros(true);
        atualizarResumoEstoque();
        fecharMenuBackup();
        alert("Backup importado com sucesso!");
      } catch (err) {
        console.error("Erro na importação do backup:", err);
        alert("Erro ao ler arquivo de backup JSON: " + err.message);
      }
    };
    leitor.readAsText(arquivo);
  }

  // ==========================================================================
  // PARTE 2: ANIMAÇÕES, MODAIS E EFEITOS (DOM, Modais, Cards e Transições)
  // ==========================================================================

  // Renderiza a grade de cards com os fios filtrados
  function renderizarGradeFios() {
    const grade = document.getElementById("grade-cards-fios");
    const estadoVazio = document.getElementById("estado-vazio-fios");
    if (!grade) return;

    grade.innerHTML = "";

    if (fiosFiltrados.length === 0) {
      if (estadoVazio) estadoVazio.style.display = "flex";
      return;
    }

    if (estadoVazio) estadoVazio.style.display = "none";

    const frag = document.createDocumentFragment();
    fiosFiltrados.forEach((fio) => {
      frag.appendChild(criarCardElement(fio));
    });
    grade.appendChild(frag);
  }

  // Criação de um card individual de fio com especificações e ações rápidas
  function criarCardElement(fio) {
    const card = document.createElement("article");
    card.className = "card-fio";
    card.id = `card-fio-${fio.id}`;
    card.dataset.id = fio.id;

    const status = calcularStatus(fio.quantidade);

    const fotoHtml = fio.imagem_url
      ? `<img src="${fio.imagem_url}" alt="${escapeHtml(fio.nome)} ${escapeHtml(fio.cor_nome)}" class="card-fio-img" loading="lazy" decoding="async" />`
      : `<div class="card-fio-placeholder"><span class="icone-placeholder">🧶</span></div>`;

    const texTexto = fio.tex ? `${fio.tex}` : "—";
    const agulhaTexto = fio.agulha ? `${fio.agulha}` : "—";
    const codigoTexto = fio.cor_codigo ? ` #${fio.cor_codigo}` : "";
    const loteTexto = fio.lote ? `Lote: ${fio.lote}` : "Sem lote";

    card.innerHTML = `
      <div class="card-fio-foto-wrapper">
        ${fotoHtml}
        <span class="badge-status-card ${status.classe}" id="card-status-${fio.id}">${status.rotulo}</span>
      </div>
      <div class="card-fio-corpo">
        <div class="card-fio-header">
          <div class="card-fio-titulos">
            <span class="card-fio-marca">${escapeHtml(fio.marca || "Marca")}</span>
            <h3 class="card-fio-nome">${escapeHtml(fio.nome || "Sem nome")}</h3>
          </div>
        </div>

        <div class="card-fio-tags">
          <span class="card-tag tag-cor">${escapeHtml(fio.cor_nome || "Cor")}${escapeHtml(codigoTexto)}</span>
          <span class="card-tag tag-lote">${escapeHtml(loteTexto)}</span>
        </div>

        <div class="card-fio-specs">
          <span class="spec-item">TEX: <strong>${escapeHtml(texTexto)}</strong></span>
          <span class="spec-item">Agulha: <strong>${escapeHtml(agulhaTexto)}</strong></span>
        </div>

        <div class="card-fio-rodape">
          <div class="card-controle-estoque" title="Ajuste rápido de estoque">
            <button type="button" class="btn-qtd-card btn-menos" data-id="${fio.id}" aria-label="Diminuir 0.5 novelo">−</button>
            <span class="card-qtd-numero" id="card-qtd-val-${fio.id}">${formatarQuantidade(fio.quantidade)}</span>
            <button type="button" class="btn-qtd-card btn-mais" data-id="${fio.id}" aria-label="Aumentar 0.5 novelo">+</button>
          </div>

          <div class="card-acoes-rapidas">
            <button type="button" class="btn-acao-card btn-editar-card" data-id="${fio.id}" title="Editar fio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-acao-card btn-duplicar-card" data-id="${fio.id}" title="Duplicar especificações">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button type="button" class="btn-acao-card btn-excluir-card" data-id="${fio.id}" title="Excluir fio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Clique no corpo do card abre a Tela de Detalhes
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-controle-estoque") || e.target.closest(".card-acoes-rapidas")) {
        return;
      }
      abrirModalDetalhesPorId(fio.id);
    });

    // Botões de estoque no card
    const btnMenos = card.querySelector(".btn-menos");
    const btnMais = card.querySelector(".btn-mais");
    btnMenos.addEventListener("click", (e) => {
      e.stopPropagation();
      alterarQuantidade(fio.id, -0.5);
    });
    btnMais.addEventListener("click", (e) => {
      e.stopPropagation();
      alterarQuantidade(fio.id, 0.5);
    });

    // Botões de ação rápida no card
    const btnEditar = card.querySelector(".btn-editar-card");
    btnEditar.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalCadastro(fio, "Editar Fio");
    });

    const btnDuplicar = card.querySelector(".btn-duplicar-card");
    btnDuplicar.addEventListener("click", (e) => {
      e.stopPropagation();
      duplicarFio(fio.id);
    });

    const btnExcluir = card.querySelector(".btn-excluir-card");
    btnExcluir.addEventListener("click", (e) => {
      e.stopPropagation();
      solicitarExclusaoFio(fio.id);
    });

    return card;
  }

  // Atualização atômica do card no DOM após alteração de quantidade
  function atualizarCardNoDOM(fio) {
    const elQtd = document.getElementById(`card-qtd-val-${fio.id}`);
    const elStatus = document.getElementById(`card-status-${fio.id}`);

    if (elQtd) {
      elQtd.textContent = formatarQuantidade(fio.quantidade);
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(elQtd);
      }
    }

    if (elStatus) {
      const status = calcularStatus(fio.quantidade);
      elStatus.className = `badge-status-card ${status.classe}`;
      elStatus.textContent = status.rotulo;
    }
  }

  // Abertura do Modal de Detalhes por ID do Fio
  function abrirModalDetalhesPorId(id) {
    idFioSelecionado = Number(id);
    indexFioAtual = fiosFiltrados.findIndex((f) => f.id === idFioSelecionado);

    let fio = null;
    if (indexFioAtual !== -1) {
      fio = fiosFiltrados[indexFioAtual];
    } else {
      fio = fiosCache.find((f) => f.id === idFioSelecionado);
    }

    if (!fio) return;
    renderizarDetalhesFio(fio);

    const modal = document.getElementById("modal-detalhes-fio");
    if (modal) modal.style.display = "flex";
  }

  // Popula todos os campos da Tela de Detalhes (Modal Grande)
  function renderizarDetalhesFio(fio) {
    if (!fio) return;
    idFioSelecionado = fio.id;
    indexFioAtual = fiosFiltrados.findIndex((f) => f.id === fio.id);

    // Controles de Navegação Anterior / Próximo
    const btnAnt = document.getElementById("btn-fio-anterior");
    const btnProx = document.getElementById("btn-fio-proximo");
    const indPosicao = document.getElementById("det-indicador-posicao");

    if (indPosicao) {
      if (indexFioAtual >= 0 && fiosFiltrados.length > 0) {
        indPosicao.textContent = `${indexFioAtual + 1} de ${fiosFiltrados.length}`;
      } else {
        indPosicao.textContent = "1 de 1";
      }
    }

    if (btnAnt) {
      btnAnt.disabled = indexFioAtual <= 0;
    }
    if (btnProx) {
      btnProx.disabled = indexFioAtual < 0 || indexFioAtual >= fiosFiltrados.length - 1;
    }

    // Marca, Nome e Status
    const elMarca = document.getElementById("det-fio-marca");
    const elNome = document.getElementById("det-fio-nome");
    const elStatusBadge = document.getElementById("det-fio-status-badge");

    if (elMarca) elMarca.textContent = fio.marca || "Marca";
    if (elNome) elNome.textContent = fio.nome || "Fio sem nome";

    const status = calcularStatus(fio.quantidade);
    if (elStatusBadge) {
      elStatusBadge.className = `badge-status-fio ${status.classe}`;
      elStatusBadge.textContent = status.rotulo;
    }

    // Foto Ampliada ou Placeholder
    const imgFoto = document.getElementById("det-fio-foto");
    const placeholderFoto = document.getElementById("det-foto-placeholder");
    if (fio.imagem_url) {
      if (imgFoto) {
        imgFoto.src = fio.imagem_url;
        imgFoto.style.display = "block";
      }
      if (placeholderFoto) placeholderFoto.style.display = "none";
    } else {
      if (imgFoto) imgFoto.style.display = "none";
      if (placeholderFoto) placeholderFoto.style.display = "flex";
    }

    // Bloco 1: Cor e Lote
    const elCor = document.getElementById("det-fio-cor");
    const elCodigo = document.getElementById("det-fio-codigo");
    const elLote = document.getElementById("det-fio-lote");

    if (elCor) elCor.textContent = fio.cor_nome || "—";
    if (elCodigo) elCodigo.textContent = fio.cor_codigo ? `Cód: ${fio.cor_codigo}` : "Sem código";
    if (elLote) elLote.textContent = fio.lote || "Não especificado";

    // Bloco 2: Estoque e Rendimento Estimado
    const elQtd = document.getElementById("det-fio-qtd");
    const elPesoDisp = document.getElementById("det-fio-peso-disp");
    const elMetragemDisp = document.getElementById("det-fio-metragem-disp");

    const qtd = Number(fio.quantidade) || 0;
    if (elQtd) elQtd.textContent = formatarQuantidade(qtd);

    const pesoUn = Number(fio.peso_novelo_g) || 0;
    const pesoEstimado = pesoUn > 0 && qtd > 0 ? qtd * pesoUn : fio.peso_restante_g ? Number(fio.peso_restante_g) : 0;
    if (elPesoDisp) elPesoDisp.textContent = pesoEstimado > 0 ? formatarPeso(pesoEstimado) : "—";

    const metragemUn = Number(fio.metragem_novelo_m) || 0;
    const metragemEstimada = metragemUn > 0 && qtd > 0 ? qtd * metragemUn : 0;
    if (elMetragemDisp) elMetragemDisp.textContent = metragemEstimada > 0 ? formatarMetragem(metragemEstimada) : "—";

    // Bloco 3: Ficha Técnica
    const elTex = document.getElementById("det-fio-tex");
    const elAgulha = document.getElementById("det-fio-agulha");
    const elComposicao = document.getElementById("det-fio-composicao");
    const elPesoUn = document.getElementById("det-fio-peso-un");
    const elMetragemUn = document.getElementById("det-fio-metragem-un");

    if (elTex) elTex.textContent = fio.tex ? `${fio.tex}` : "—";
    if (elAgulha) elAgulha.textContent = fio.agulha || "—";
    if (elComposicao) elComposicao.textContent = fio.composicao || "—";
    if (elPesoUn) elPesoUn.textContent = pesoUn > 0 ? `${pesoUn}g` : "—";
    if (elMetragemUn) elMetragemUn.textContent = metragemUn > 0 ? `${metragemUn}m` : "—";

    // Bloco 4: Organização & Valores
    const elLoc = document.getElementById("det-fio-localizacao");
    const elPrecoUn = document.getElementById("det-fio-preco-un");
    const elPrecoTotal = document.getElementById("det-fio-preco-total");
    const elObs = document.getElementById("det-fio-obs");
    const blocoObs = document.getElementById("det-bloco-observacoes");

    if (elLoc) elLoc.textContent = fio.localizacao || "—";

    const precoUn = Number(fio.preco_pago) || 0;
    if (elPrecoUn) elPrecoUn.textContent = precoUn > 0 ? formatarMoeda(precoUn) : "—";

    const valorTotalEstoque = precoUn > 0 && qtd > 0 ? precoUn * qtd : 0;
    if (elPrecoTotal) elPrecoTotal.textContent = valorTotalEstoque > 0 ? formatarMoeda(valorTotalEstoque) : "R$ 0,00";

    if (elObs) {
      if (fio.observacoes && fio.observacoes.trim()) {
        elObs.textContent = fio.observacoes;
        if (blocoObs) blocoObs.style.display = "block";
      } else {
        elObs.textContent = "—";
        if (blocoObs) blocoObs.style.display = "none";
      }
    }
  }

  // Fechar Modal de Detalhes
  function fecharModalDetalhes() {
    const modal = document.getElementById("modal-detalhes-fio");
    if (modal) modal.style.display = "none";
    idFioSelecionado = null;
    indexFioAtual = -1;
  }

  // Navegação entre fios na tela de detalhes
  function navegarDetalhes(direcao) {
    if (fiosFiltrados.length === 0) return;
    const novoIndex = indexFioAtual + direcao;
    if (novoIndex >= 0 && novoIndex < fiosFiltrados.length) {
      renderizarDetalhesFio(fiosFiltrados[novoIndex]);
    }
  }

  // Abertura do Modal de Cadastro ou Edição
  function abrirModalCadastro(dadosIniciais = null, titulo = "Novo Fio") {
    const modal = document.getElementById("modal-cadastro-fio");
    const tituloEl = document.getElementById("modal-fio-titulo");
    const form = document.getElementById("form-fio");
    if (!modal || !form) return;

    if (tituloEl) tituloEl.textContent = titulo;

    // Reseta formulário e posiciona na primeira aba
    form.reset();
    alternarAbaFormulario("identificacao");

    // Preenche campos
    document.getElementById("fio-id").value = dadosIniciais?.id || "";
    document.getElementById("fio-nome").value = dadosIniciais?.nome || "";
    document.getElementById("fio-marca").value = dadosIniciais?.marca || "";
    document.getElementById("fio-cor-nome").value = dadosIniciais?.cor_nome || "";
    document.getElementById("fio-cor-codigo").value = dadosIniciais?.cor_codigo || "";
    document.getElementById("fio-lote").value = dadosIniciais?.lote || "";

    document.getElementById("fio-tex").value = dadosIniciais?.tex || "";
    document.getElementById("fio-composicao").value = dadosIniciais?.composicao || "";
    document.getElementById("fio-peso-novelo").value = dadosIniciais?.peso_novelo_g || "";
    document.getElementById("fio-metragem-novelo").value = dadosIniciais?.metragem_novelo_m || "";
    document.getElementById("fio-agulha").value = dadosIniciais?.agulha || "";

    document.getElementById("fio-quantidade").value = dadosIniciais?.quantidade ?? 1;
    document.getElementById("fio-peso-restante").value = dadosIniciais?.peso_restante_g || "";
    document.getElementById("fio-preco").value = dadosIniciais?.preco_pago || "";
    document.getElementById("fio-localizacao").value = dadosIniciais?.localizacao || "";
    document.getElementById("fio-observacoes").value = dadosIniciais?.observacoes || "";

    // Foto
    imagemAtualBase64 = dadosIniciais?.imagem_url || null;
    atualizarPreviewImagem(imagemAtualBase64);

    modal.style.display = "flex";
    setTimeout(() => {
      document.getElementById("fio-nome")?.focus();
    }, 100);
  }

  // Fechar Modal de Cadastro
  function fecharModalCadastro() {
    const modal = document.getElementById("modal-cadastro-fio");
    if (modal) modal.style.display = "none";
    imagemAtualBase64 = null;
    atualizarPreviewImagem(null);
  }

  // Alternância de abas no Modal de Cadastro
  function alternarAbaFormulario(nomeAba) {
    const abas = document.querySelectorAll(".abas-modal-fio .aba-item");
    const secoes = document.querySelectorAll(".secao-form-aba");

    abas.forEach((aba) => {
      if (aba.dataset.aba === nomeAba) {
        aba.classList.add("ativa");
      } else {
        aba.classList.remove("ativa");
      }
    });

    secoes.forEach((secao) => {
      if (secao.id === `aba-conteudo-${nomeAba}`) {
        secao.style.display = "block";
      } else {
        secao.style.display = "none";
      }
    });
  }

  // Atualização do preview visual de imagem no formulário
  function atualizarPreviewImagem(dataUrl) {
    const placeholder = document.getElementById("upload-placeholder");
    const containerPreview = document.getElementById("upload-preview-container");
    const imgPreview = document.getElementById("upload-preview-img");

    if (dataUrl) {
      if (imgPreview) imgPreview.src = dataUrl;
      if (containerPreview) containerPreview.style.display = "flex";
      if (placeholder) placeholder.style.display = "none";
    } else {
      if (imgPreview) imgPreview.src = "";
      if (containerPreview) containerPreview.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
      const fileInput = document.getElementById("fio-imagem-input");
      if (fileInput) fileInput.value = "";
    }
  }

  // Otimização e compressão de imagem via Canvas para economizar armazenamento no IndexedDB
  function redimensionarEComprimirImagem(arquivo, maxDimensao = 600, qualidade = 0.82) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = (eventoLeitura) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimensao || height > maxDimensao) {
            if (width > height) {
              height = Math.round((height * maxDimensao) / width);
              width = maxDimensao;
            } else {
              width = Math.round((width * maxDimensao) / height);
              height = maxDimensao;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Tenta exportar para webp; se o navegador não suportar, fallback para jpeg
          let dataUrl = canvas.toDataURL("image/webp", qualidade);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", qualidade);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Erro ao carregar imagem para compressão"));
        img.src = eventoLeitura.target.result;
      };
      leitor.onerror = () => reject(new Error("Erro ao ler arquivo"));
      leitor.readAsDataURL(arquivo);
    });
  }

  // Leitura de arquivo de imagem com compressão automática
  async function processarArquivoImagem(arquivo) {
    if (!arquivo || !arquivo.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }

    try {
      imagemAtualBase64 = await redimensionarEComprimirImagem(arquivo, 600, 0.82);
      atualizarPreviewImagem(imagemAtualBase64);
    } catch (err) {
      console.warn("Falha ao otimizar imagem, usando original:", err);
      const leitor = new FileReader();
      leitor.onload = (e) => {
        imagemAtualBase64 = e.target.result;
        atualizarPreviewImagem(imagemAtualBase64);
      };
      leitor.readAsDataURL(arquivo);
    }
  }

  // Submissão do formulário de cadastro / edição
  async function salvarFormularioFio(e) {
    e.preventDefault();

    const idVal = document.getElementById("fio-id").value;
    const nome = document.getElementById("fio-nome").value.trim();
    const marca = document.getElementById("fio-marca").value.trim();
    const corNome = document.getElementById("fio-cor-nome").value.trim();
    const corCodigo = document.getElementById("fio-cor-codigo").value.trim();
    const lote = document.getElementById("fio-lote").value.trim();

    const tex = parseFloat(document.getElementById("fio-tex").value) || null;
    const composicao = document.getElementById("fio-composicao").value.trim();
    const pesoNovelo = parseFloat(document.getElementById("fio-peso-novelo").value) || null;
    const metragemNovelo = parseFloat(document.getElementById("fio-metragem-novelo").value) || null;
    const agulha = document.getElementById("fio-agulha").value.trim();

    const quantidade = parseFloat(document.getElementById("fio-quantidade").value);
    const pesoRestante = parseFloat(document.getElementById("fio-peso-restante").value) || null;
    const precoPago = parseFloat(document.getElementById("fio-preco").value) || null;
    const localizacao = document.getElementById("fio-localizacao").value.trim();
    const observacoes = document.getElementById("fio-observacoes").value.trim();

    // Validação de campos obrigatórios
    if (!nome || !marca || !corNome || isNaN(quantidade)) {
      alert("Por favor, preencha os campos obrigatórios (*): Nome da linha, Marca, Cor e Quantidade.");
      if (!nome || !marca || !corNome) {
        alternarAbaFormulario("identificacao");
      } else {
        alternarAbaFormulario("estoque");
      }
      return;
    }

    const fio = {
      nome,
      marca,
      cor_nome: corNome,
      cor_codigo: corCodigo,
      lote,
      imagem_url: imagemAtualBase64 || null,
      tex,
      composicao,
      peso_novelo_g: pesoNovelo,
      metragem_novelo_m: metragemNovelo,
      agulha,
      quantidade: Math.max(0, quantidade),
      peso_restante_g: pesoRestante,
      preco_pago: precoPago,
      localizacao,
      observacoes,
      atualizado_em: new Date().toISOString()
    };

    if (idVal) {
      fio.id = Number(idVal);
    } else {
      fio.criado_em = new Date().toISOString();
    }

    const salvo = await dbSalvar(fio);

    if (idVal) {
      const idx = fiosCache.findIndex((f) => f.id === fio.id);
      if (idx !== -1) fiosCache[idx] = salvo;
    } else {
      fiosCache.unshift(salvo);
    }

    fecharModalCadastro();
    aplicarFiltros(true);
    atualizarResumoEstoque();

    // Se o modal de detalhes estiver aberto para este fio, re-renderiza
    if (idFioSelecionado === salvo.id) {
      renderizarDetalhesFio(salvo);
    }
  }

  // Copiar número do lote para a área de transferência com feedback visual
  function copiarLote() {
    const elLote = document.getElementById("det-fio-lote");
    const btnCopiar = document.getElementById("btn-copiar-lote");
    const loteValor = elLote?.textContent || "";

    if (!loteValor || loteValor === "—" || loteValor === "Não especificado") {
      return;
    }

    navigator.clipboard
      .writeText(loteValor)
      .then(() => {
        if (btnCopiar) {
          const textoOriginal = btnCopiar.innerHTML;
          btnCopiar.innerHTML = "<span>✓ Copiado!</span>";
          btnCopiar.classList.add("copiado");
          setTimeout(() => {
            btnCopiar.innerHTML = textoOriginal;
            btnCopiar.classList.remove("copiado");
          }, 2000);
        }
      })
      .catch(() => {
        alert("Número do lote: " + loteValor);
      });
  }

  // Controle do menu dropdown de backup
  function alternarMenuBackup() {
    const menu = document.getElementById("menu-backup-fios");
    if (!menu) return;
    const estaVisivel = menu.style.display === "flex" || menu.style.display === "block";
    menu.style.display = estaVisivel ? "none" : "flex";
  }

  function fecharMenuBackup() {
    const menu = document.getElementById("menu-backup-fios");
    if (menu) menu.style.display = "none";
  }

  // ==========================================================================
  // PARTE 3: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================
  function vincularEventos() {
    // 1. Botão + Novo Fio (Barra de ferramentas e Estado Vazio)
    const btnNovoFio = document.getElementById("btn-novo-fio");
    const btnVazioNovoFio = document.getElementById("btn-vazio-novo-fio");
    if (btnNovoFio) {
      btnNovoFio.addEventListener("click", () => abrirModalCadastro(null, "Novo Fio"));
    }
    if (btnVazioNovoFio) {
      btnVazioNovoFio.addEventListener("click", () => abrirModalCadastro(null, "Novo Fio"));
    }

    // 2. Dropdown de Backup
    const btnMenuBackup = document.getElementById("btn-menu-backup-fios");
    if (btnMenuBackup) {
      btnMenuBackup.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarMenuBackup();
      });
    }

    const btnExportar = document.getElementById("btn-exportar-fios");
    if (btnExportar) {
      btnExportar.addEventListener("click", (e) => {
        e.stopPropagation();
        exportarBackupJSON();
      });
    }

    const inputImportar = document.getElementById("input-importar-fios");
    if (inputImportar) {
      inputImportar.addEventListener("change", (e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) importarBackupJSON(arquivo);
        e.target.value = "";
      });
    }

    // Fecha dropdown de backup ao clicar fora
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown-backup-fios")) {
        fecharMenuBackup();
      }
    });

    // 3. Busca Instantânea (com debounce leve) e Filtros
    const inputBusca = document.getElementById("busca-fios");
    if (inputBusca) {
      const filtrarDebounced =
        typeof BancoDadosPT !== "undefined" ? BancoDadosPT.debounce(() => aplicarFiltros(false), 80) : () => aplicarFiltros(false);
      inputBusca.addEventListener("input", filtrarDebounced);
    }

    const selectMarca = document.getElementById("filtro-marca");
    if (selectMarca) {
      selectMarca.addEventListener("change", () => aplicarFiltros());
    }

    const selectComposicao = document.getElementById("filtro-composicao");
    if (selectComposicao) {
      selectComposicao.addEventListener("change", () => aplicarFiltros());
    }

    const selectTex = document.getElementById("filtro-tex");
    if (selectTex) {
      selectTex.addEventListener("change", () => aplicarFiltros());
    }

    const selectStatus = document.getElementById("filtro-status");
    if (selectStatus) {
      selectStatus.addEventListener("change", () => aplicarFiltros());
    }

    const btnLimparFiltros = document.getElementById("btn-limpar-filtros-fios");
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener("click", () => limparFiltros());
    }

    // 4. Modal de Cadastro: Fechar, Abas, Upload e Salvar
    const btnFecharModalFio = document.getElementById("btn-fechar-modal-fio");
    const btnCancelarModalFio = document.getElementById("btn-cancelar-modal-fio");
    if (btnFecharModalFio) btnFecharModalFio.addEventListener("click", fecharModalCadastro);
    if (btnCancelarModalFio) btnCancelarModalFio.addEventListener("click", fecharModalCadastro);

    const abasForm = document.querySelectorAll(".abas-modal-fio .aba-item");
    abasForm.forEach((aba) => {
      aba.addEventListener("click", () => {
        const nomeAba = aba.dataset.aba;
        if (nomeAba) alternarAbaFormulario(nomeAba);
      });
    });

    const formFio = document.getElementById("form-fio");
    if (formFio) {
      formFio.addEventListener("submit", salvarFormularioFio);
    }

    // Upload de Imagem no Formulário
    const uploadArea = document.getElementById("upload-area-fio");
    const inputImagem = document.getElementById("fio-imagem-input");
    const btnRemoverFoto = document.getElementById("btn-remover-foto");

    if (uploadArea && inputImagem) {
      uploadArea.addEventListener("click", (e) => {
        if (e.target.closest("#btn-remover-foto")) return;
        inputImagem.click();
      });

      inputImagem.addEventListener("change", (e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) processarArquivoImagem(arquivo);
      });

      // Suporte a Drag & Drop
      uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
      });

      uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
      });

      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        const arquivo = e.dataTransfer?.files?.[0];
        if (arquivo) processarArquivoImagem(arquivo);
      });
    }

    if (btnRemoverFoto) {
      btnRemoverFoto.addEventListener("click", (e) => {
        e.stopPropagation();
        imagemAtualBase64 = null;
        atualizarPreviewImagem(null);
      });
    }

    // Fechar modal de cadastro ao clicar no overlay
    const modalCadastro = document.getElementById("modal-cadastro-fio");
    if (modalCadastro) {
      modalCadastro.addEventListener("click", (e) => {
        if (e.target === modalCadastro) fecharModalCadastro();
      });
    }

    // 5. Modal de Detalhes: Fechar, Navegação, Copiar Lote, Estoque e Ações de Rodapé
    const btnFecharDetalhes = document.getElementById("btn-fechar-detalhes-fio");
    if (btnFecharDetalhes) btnFecharDetalhes.addEventListener("click", fecharModalDetalhes);

    const btnNavAnt = document.getElementById("btn-fio-anterior");
    const btnNavProx = document.getElementById("btn-fio-proximo");
    if (btnNavAnt) btnNavAnt.addEventListener("click", () => navegarDetalhes(-1));
    if (btnNavProx) btnNavProx.addEventListener("click", () => navegarDetalhes(1));

    const btnCopiarLote = document.getElementById("btn-copiar-lote");
    if (btnCopiarLote) btnCopiarLote.addEventListener("click", copiarLote);

    const btnMenosDet = document.getElementById("det-btn-menos");
    const btnMaisDet = document.getElementById("det-btn-mais");
    if (btnMenosDet) {
      btnMenosDet.addEventListener("click", () => {
        if (idFioSelecionado) alterarQuantidade(idFioSelecionado, -0.5);
      });
    }
    if (btnMaisDet) {
      btnMaisDet.addEventListener("click", () => {
        if (idFioSelecionado) alterarQuantidade(idFioSelecionado, 0.5);
      });
    }

    const btnExcluirDet = document.getElementById("btn-excluir-fio");
    if (btnExcluirDet) {
      btnExcluirDet.addEventListener("click", () => {
        if (idFioSelecionado !== null && idFioSelecionado !== undefined) {
          solicitarExclusaoFio(idFioSelecionado);
        }
      });
    }

    // Modal de Confirmação de Exclusão de Fio
    const btnCancelarExclusao = document.getElementById("btn-cancelar-exclusao-fio");
    const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao-fio");
    const modalConfirmarExclusao = document.getElementById("modal-confirmar-exclusao-fio");

    if (btnCancelarExclusao) {
      btnCancelarExclusao.addEventListener("click", fecharModalConfirmarExclusao);
    }

    if (btnConfirmarExclusao) {
      btnConfirmarExclusao.addEventListener("click", () => executarExclusaoFio());
    }

    if (modalConfirmarExclusao) {
      modalConfirmarExclusao.addEventListener("click", (e) => {
        if (e.target === modalConfirmarExclusao) fecharModalConfirmarExclusao();
      });
    }

    const btnDuplicarDet = document.getElementById("btn-duplicar-fio");
    if (btnDuplicarDet) {
      btnDuplicarDet.addEventListener("click", () => {
        if (idFioSelecionado) duplicarFio(idFioSelecionado);
      });
    }

    const btnEditarDet = document.getElementById("btn-editar-fio");
    if (btnEditarDet) {
      btnEditarDet.addEventListener("click", () => {
        if (idFioSelecionado) {
          const fio = fiosCache.find((f) => f.id === idFioSelecionado);
          if (fio) {
            fecharModalDetalhes();
            abrirModalCadastro(fio, "Editar Fio");
          }
        }
      });
    }

    // Fechar modal de detalhes ao clicar no overlay
    const modalDetalhes = document.getElementById("modal-detalhes-fio");
    if (modalDetalhes) {
      modalDetalhes.addEventListener("click", (e) => {
        if (e.target === modalDetalhes) fecharModalDetalhes();
      });
    }

    // 6. Atalhos de Teclado Globais (ESC para fechar modais, setas para navegar detalhes)
    document.addEventListener("keydown", (e) => {
      const modalDet = document.getElementById("modal-detalhes-fio");
      const modalCad = document.getElementById("modal-cadastro-fio");

      const detAberto = modalDet && (modalDet.style.display === "flex" || modalDet.style.display === "block");
      const cadAberto = modalCad && (modalCad.style.display === "flex" || modalCad.style.display === "block");

      if (e.key === "Escape") {
        const modalConf = document.getElementById("modal-confirmar-exclusao-fio");
        if (modalConf && (modalConf.style.display === "flex" || modalConf.style.display === "block")) {
          fecharModalConfirmarExclusao();
          return;
        }
        if (cadAberto) fecharModalCadastro();
        else if (detAberto) fecharModalDetalhes();
        else fecharMenuBackup();
      }

      if (detAberto && !cadAberto) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          navegarDetalhes(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          navegarDetalhes(1);
        }
      }
    });
  }

  // Inicialização do módulo
  async function init() {
    try {
      vincularEventos();
      await carregarDadosIniciais();
      aplicarFiltros(true);
      atualizarResumoEstoque();
    } catch (erro) {
      console.error("Falha ao inicializar o Inventário de Fios:", erro);
    }
  }

  // API pública do módulo
  return {
    init,
    alterarQuantidade,
    duplicarFio,
    excluirFio: solicitarExclusaoFio,
    solicitarExclusaoFio,
    executarExclusaoFio,
    exportarBackupJSON,
    importarBackupJSON
  };
})();
