// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: AGULHAS E ACESSÓRIOS
// Catálogo completo com persistência em IndexedDB (PontoETramaDB v2,
// coleção `itens_biblioteca`), abas + subfiltros rápidos, visualização
// Grade/Lista, Drawer dinâmico, controle rápido de estoque e status Em Uso,
// além de API de integração para Gerenciador de Projetos e Precificação.
// ==========================================================================

const InventarioAgulhas = (() => {
  // Configurações do Banco de Dados IndexedDB compartilhado
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  // Estado em memória
  let db = null;
  let itensCache = [];
  let itensFiltrados = [];
  let categoriaAtiva = "todas"; // 'todas' | 'agulha' | 'ferramenta' | 'aviamento'
  let subtipoAgulhaAtivo = "todos"; // 'todos' | 'croche' | 'trico-reto' | 'trico-circular' | 'tapecaria'
  let modoVisao = "grade"; // 'grade' | 'lista'
  let fotoAtualBase64 = "";
  let idParaExcluir = null;

  const ROTULOS_SUBTIPO = {
    croche: "Crochê",
    "trico-reto": "Tricô Reto",
    "trico-circular": "Tricô Circular",
    tapecaria: "Tapeçaria"
  };

  const ROTULOS_CATEGORIA = {
    agulha: "Agulha",
    ferramenta: "Ferramenta",
    aviamento: "Aviamento"
  };

  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (IndexedDB, Filtros, Status e Regras)
  // ==========================================================================

  function abrirBanco() {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.abrir();
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  function dbObterTodos(forcarDisco = false) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.obterTodos(STORE_BIBLIOTECA, forcarDisco);
    }
    return Promise.resolve([]);
  }

  function dbSalvar(item) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.salvar(STORE_BIBLIOTECA, item);
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  function dbExcluir(id) {
    if (typeof BancoDadosPT !== "undefined") {
      return BancoDadosPT.excluir(STORE_BIBLIOTECA, id);
    }
    return Promise.reject(new Error("BancoDadosPT indisponível"));
  }

  async function carregarDadosIniciais() {
    let dados = await dbObterTodos();

    // Limpeza única caso os itens de demonstração antigos tenham sido gravados antes
    const demoJaLimpo = localStorage.getItem("ponto_trama_agulhas_demo_limpo") === "true";
    if (!demoJaLimpo && dados && dados.length > 0) {
      const assinaturasDemo = new Set([
        "Agulha Soft Touch 2.5mm|Excelente deslize para amigurumis com fio 100% algodão.",
        "Agulha Ergonomica 4.5mm|Ideal para barbantes nº 6 e bolsas estruturadas.",
        "Agulha Circular Intercambiável 5.0mm|Cabo flexível sem memória, ótima para blusas top-down.",
        "Agulha Tricô Reto 8.0mm|Leve e confortável para mantas e golas volumosas.",
        "Agulha de Tapeçaria Ponta Curva|Furo largo para arremates de fio de malha e amigurumi.",
        "Marcadores de Ponto Cadeado|Sortidos em cores vibrantes para marcar início de carreira.",
        "Tesoura de Arremate Garça|Ponta fina de precisão, manter exclusiva para fios.",
        "Olhos de Segurança c/ Trava 12mm|Pacote c/ 10 pares pago R$ 15,00 (R$ 1,50 por par).",
        "Alça de Couro Ecológico c/ Mosquetão|Alça de ombro com ferragem dourada para bolsas.",
        "Botão de Madeira Natural|Acabamento fosco de 2 furos para cardigãs e casacos.",
        "Fecho Imantado Costurável|Fácil aplicação em bolsas de fio náutico ou malha."
      ]);

      const idsDemo = dados
        .filter((item) => assinaturasDemo.has(`${item.nome || ""}|${item.observacoes || ""}`))
        .map((item) => item.id);

      if (idsDemo.length > 0 && typeof BancoDadosPT !== "undefined") {
        for (const id of idsDemo) {
          await BancoDadosPT.excluir(STORE_BIBLIOTECA, id).catch(() => {});
        }
        BancoDadosPT.invalidarCache(STORE_BIBLIOTECA);
        dados = await dbObterTodos(true);
      }
    }
    try {
      localStorage.setItem("ponto_trama_agulhas_demo_limpo", "true");
    } catch {
      // ignora
    }

    itensCache = dados || [];
    return itensCache;
  }

  function notificarBibliotecaAtualizada() {
    window.dispatchEvent(
      new CustomEvent("ponto-trama:biblioteca-atualizada", {
        detail: { total: itensCache.length }
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

  function formatarMoeda(valor) {
    if (typeof Configuracoes !== "undefined" && typeof Configuracoes.formatarMoeda === "function") {
      return Configuracoes.formatarMoeda(valor);
    }
    const n = Number(valor) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarMm(valor) {
    if (valor === null || valor === undefined || valor === "") return "";
    const num = Number(valor);
    if (isNaN(num)) return String(valor);
    return `${num % 1 === 0 ? num.toFixed(1) : num}mm`;
  }

  // Calcula status unificado para filtros e badges
  function calcularStatusItem(item) {
    const attr = item.atributos || {};

    if (item.categoria === "agulha") {
      if (attr.em_uso || attr.em_uso_projeto_id) {
        return {
          chave: "em-uso",
          rotulo: "Em uso",
          classe: "status-em-uso"
        };
      }
      return {
        chave: "disponivel",
        rotulo: "Livre",
        classe: "status-disponivel"
      };
    }

    if (item.categoria === "aviamento") {
      const qtd = Number(attr.quantidade_atual) || 0;
      const min = Number(attr.estoque_minimo) || 0;
      if (qtd <= 0) {
        return {
          chave: "estoque-baixo",
          rotulo: "Sem estoque",
          classe: "status-zerado",
          zerado: true
        };
      }
      if (min > 0 && qtd <= min) {
        return {
          chave: "estoque-baixo",
          rotulo: "Estoque baixo",
          classe: "status-estoque-baixo"
        };
      }
      return {
        chave: "disponivel",
        rotulo: "Disponível",
        classe: "status-disponivel"
      };
    }

    // Ferramenta
    const qtdFerr = Number(attr.quantidade) || 0;
    if (qtdFerr <= 0) {
      return {
        chave: "estoque-baixo",
        rotulo: "Sem estoque",
        classe: "status-zerado",
        zerado: true
      };
    }
    return {
      chave: "disponivel",
      rotulo: "Disponível",
      classe: "status-disponivel"
    };
  }

  // Extrai token de tamanho/numeração do item para o filtro de numeração
  function obterNumeracaoItem(item) {
    const attr = item.atributos || {};
    if (item.categoria === "agulha" && attr.espessura_mm) {
      return formatarMm(attr.espessura_mm);
    }
    if (item.categoria === "aviamento" && attr.cor_tamanho) {
      const matchMm = String(attr.cor_tamanho).match(/\d+(?:[.,]\d+)?\s*(?:mm|cm)/i);
      if (matchMm) return matchMm[0].replace(/\s+/g, "").replace(",", ".").toLowerCase();
    }
    return "";
  }

  function atualizarContadoresAbas() {
    const totalTodas = itensCache.length;
    const totalAgulhas = itensCache.filter((i) => i.categoria === "agulha").length;
    const totalFerramentas = itensCache.filter((i) => i.categoria === "ferramenta").length;
    const totalAviamentos = itensCache.filter((i) => i.categoria === "aviamento").length;

    const elTodas = document.getElementById("cont-aba-todas");
    const elAgulhas = document.getElementById("cont-aba-agulha");
    const elFerr = document.getElementById("cont-aba-ferramenta");
    const elAv = document.getElementById("cont-aba-aviamento");

    if (elTodas) elTodas.textContent = totalTodas;
    if (elAgulhas) elAgulhas.textContent = totalAgulhas;
    if (elFerr) elFerr.textContent = totalFerramentas;
    if (elAv) elAv.textContent = totalAviamentos;
  }

  function atualizarSelectNumeracoes() {
    const select = document.getElementById("filtro-numeracao-biblioteca");
    if (!select) return;

    const valorAtual = select.value;
    const conjunto = new Set();

    itensCache.forEach((item) => {
      const num = obterNumeracaoItem(item);
      if (num) conjunto.add(num);
    });

    const ordenadas = Array.from(conjunto).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    select.innerHTML = '<option value="">Todas as numerações</option>';
    ordenadas.forEach((tam) => {
      const opt = document.createElement("option");
      opt.value = tam;
      opt.textContent = tam;
      if (tam === valorAtual) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function aplicarFiltros(dadosAlterados = true) {
    const termo = (document.getElementById("busca-biblioteca")?.value || "").trim().toLowerCase();
    const filtroNum = (document.getElementById("filtro-numeracao-biblioteca")?.value || "").trim().toLowerCase();
    const filtroStatus = (document.getElementById("filtro-status-biblioteca")?.value || "").trim();

    const btnLimpar = document.getElementById("btn-limpar-filtros-biblioteca");
    if (btnLimpar) {
      const temFiltroAtivo = Boolean(termo || filtroNum || filtroStatus || subtipoAgulhaAtivo !== "todos");
      btnLimpar.style.display = temFiltroAtivo ? "inline-flex" : "none";
    }

    itensFiltrados = itensCache.filter((item) => {
      const attr = item.atributos || {};

      // 1. Categoria principal (Abas)
      if (categoriaAtiva !== "todas" && item.categoria !== categoriaAtiva) {
        return false;
      }

      // 2. Subfiltro de tipo de agulha
      if (categoriaAtiva === "agulha" && subtipoAgulhaAtivo !== "todos") {
        if ((attr.tipo || "") !== subtipoAgulhaAtivo) return false;
      }

      // 3. Busca textual
      if (termo) {
        const camposTexto = [
          item.nome,
          item.observacoes,
          ROTULOS_CATEGORIA[item.categoria],
          attr.tipo ? ROTULOS_SUBTIPO[attr.tipo] : "",
          attr.espessura_mm ? formatarMm(attr.espessura_mm) : "",
          attr.material,
          attr.em_uso_projeto_nome,
          attr.local_armazenamento,
          attr.cor_tamanho,
          attr.unidade
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!camposTexto.includes(termo)) return false;
      }

      // 4. Filtro por numeração/tamanho
      if (filtroNum) {
        const numItem = obterNumeracaoItem(item).toLowerCase();
        if (numItem !== filtroNum) return false;
      }

      // 5. Filtro por status
      if (filtroStatus) {
        const st = calcularStatusItem(item);
        if (st.chave !== filtroStatus) return false;
      }

      return true;
    });

    if (dadosAlterados) {
      atualizarContadoresAbas();
      atualizarSelectNumeracoes();
    }
    renderizarListagem();
  }

  function limparFiltros() {
    const busca = document.getElementById("busca-biblioteca");
    const num = document.getElementById("filtro-numeracao-biblioteca");
    const status = document.getElementById("filtro-status-biblioteca");

    if (busca) busca.value = "";
    if (num) num.value = "";
    if (status) status.value = "";

    subtipoAgulhaAtivo = "todos";
    document.querySelectorAll("#subfiltros-agulhas .chip-subfiltro").forEach((chip) => {
      chip.classList.toggle("ativo", chip.dataset.subtipo === "todos");
    });

    aplicarFiltros();
  }

  // Toggle Em Uso / Livre para agulhas
  async function alternarUsoAgulha(id) {
    const item = itensCache.find((i) => Number(i.id) === Number(id));
    if (!item || item.categoria !== "agulha") return;

    item.atributos = item.atributos || {};
    const novoEstado = !Boolean(item.atributos.em_uso);
    item.atributos.em_uso = novoEstado;

    if (!novoEstado) {
      item.atributos.em_uso_projeto_id = null;
      item.atributos.em_uso_projeto_nome = "";
    }
    item.atualizado_em = new Date().toISOString();

    await dbSalvar(item);
    notificarBibliotecaAtualizada();
    aplicarFiltros();
  }

  // Ajuste Rápido (- / +) para aviamentos e ferramentas com pulso de feedback visual
  async function ajustarEstoqueItem(id, delta) {
    const item = itensCache.find((i) => Number(i.id) === Number(id));
    if (!item) return;

    item.atributos = item.atributos || {};
    let novaQtd = 0;
    let estoqueMin = 0;

    if (item.categoria === "aviamento") {
      novaQtd = Math.max(0, (Number(item.atributos.quantidade_atual) || 0) + delta);
      item.atributos.quantidade_atual = novaQtd;
      estoqueMin = Number(item.atributos.estoque_minimo) || 0;
    } else if (item.categoria === "ferramenta") {
      novaQtd = Math.max(0, (Number(item.atributos.quantidade) || 0) + delta);
      item.atributos.quantidade = novaQtd;
    } else {
      return;
    }

    item.atualizado_em = new Date().toISOString();
    await dbSalvar(item);
    notificarBibliotecaAtualizada();

    // Determina a classe de pulso de cor
    let classePulso = "pulso-estoque-add";
    if (delta < 0) {
      if (novaQtd <= 0) {
        classePulso = "pulso-estoque-critico";
      } else if (estoqueMin > 0 && novaQtd <= estoqueMin) {
        classePulso = "pulso-estoque-baixo";
      } else {
        classePulso = "pulso-estoque-baixo";
      }
    }

    // Atualiza o elemento atomicamente sem perder o feedback visual
    atualizarEstoqueNoDOM(item, classePulso);
  }

  // ==========================================================================
  // API DE INTEGRAÇÃO (GERENCIADOR DE PROJETOS & CALCULADORA DE PRECIFICAÇÃO)
  // ==========================================================================

  async function vincularAgulhaProjeto(itemId, projetoId, projetoNome = "") {
    const item = itensCache.find((i) => Number(i.id) === Number(itemId));
    if (!item || item.categoria !== "agulha") return null;

    item.atributos = item.atributos || {};
    item.atributos.em_uso = true;
    item.atributos.em_uso_projeto_id = projetoId || `proj-${Date.now()}`;
    item.atributos.em_uso_projeto_nome = projetoNome || "";
    item.atualizado_em = new Date().toISOString();

    await dbSalvar(item);
    notificarBibliotecaAtualizada();
    aplicarFiltros();
    return item;
  }

  async function liberarAgulhaProjeto(itemId) {
    const item = itensCache.find((i) => Number(i.id) === Number(itemId));
    if (!item || item.categoria !== "agulha") return null;

    item.atributos = item.atributos || {};
    item.atributos.em_uso = false;
    item.atributos.em_uso_projeto_id = null;
    item.atributos.em_uso_projeto_nome = "";
    item.atualizado_em = new Date().toISOString();

    await dbSalvar(item);
    notificarBibliotecaAtualizada();
    aplicarFiltros();
    return item;
  }

  async function darBaixaAviamento(itemId, quantidadeUsada) {
    const qtdBaixa = Math.max(0, Number(quantidadeUsada) || 0);
    if (qtdBaixa <= 0) return null;

    const item = itensCache.find((i) => Number(i.id) === Number(itemId));
    if (!item || item.categoria !== "aviamento") return null;

    item.atributos = item.atributos || {};
    const atual = Number(item.atributos.quantidade_atual) || 0;
    const restante = Math.max(0, atual - qtdBaixa);
    item.atributos.quantidade_atual = restante;
    item.atualizado_em = new Date().toISOString();

    await dbSalvar(item);
    notificarBibliotecaAtualizada();
    aplicarFiltros();

    const min = Number(item.atributos.estoque_minimo) || 0;
    return {
      item,
      restante,
      estoqueBaixo: restante <= min
    };
  }

  async function darBaixaAviamentosEmLote(listaItens) {
    if (!Array.isArray(listaItens)) return [];
    const resultados = [];
    for (const entrada of listaItens) {
      if (entrada && entrada.id && entrada.quantidade > 0) {
        const res = await darBaixaAviamento(entrada.id, entrada.quantidade);
        if (res) resultados.push(res);
      }
    }
    return resultados;
  }

  function obterTodosItens() {
    return itensCache.map((i) => ({ ...i, atributos: { ...(i.atributos || {}) } }));
  }

  function obterAgulhas() {
    return obterTodosItens().filter((i) => i.categoria === "agulha");
  }

  function obterAviamentos() {
    return obterTodosItens().filter((i) => i.categoria === "aviamento");
  }

  function obterFerramentas() {
    return obterTodosItens().filter((i) => i.categoria === "ferramenta");
  }

  // ==========================================================================
  // PARTE 2: RENDERIZAÇÃO, DRAWER, ANIMAÇÕES E EFEITOS
  // ==========================================================================

  function atualizarEstoqueNoDOM(item, classePulso) {
    const attr = item.atributos || {};
    const status = calcularStatusItem(item);
    const qtd = item.categoria === "aviamento" ? attr.quantidade_atual : attr.quantidade;
    const unidade = item.categoria === "aviamento" ? attr.unidade || "un" : "un";

    // Atualiza texto no card e na linha da tabela
    const alvos = [
      document.getElementById(`bib-card-qtd-${item.id}`),
      document.getElementById(`bib-row-qtd-${item.id}`)
    ].filter(Boolean);

    alvos.forEach((el) => {
      el.textContent = `${qtd} ${unidade}`;
      el.classList.remove("pulso-estoque-add", "pulso-estoque-baixo", "pulso-estoque-critico");
      void el.offsetWidth;
      if (classePulso) el.classList.add(classePulso);
    });

    // Atualiza valor total em estoque no rodapé do card de aviamento
    if (item.categoria === "aviamento") {
      const elTotal = document.getElementById(`bib-card-total-${item.id}`);
      if (elTotal) {
        const custo = Number(attr.custo_unitario) || 0;
        elTotal.textContent = custo > 0 ? formatarMoeda(custo * qtd) : "Sem custo";
      }
    }

    // Atualiza badge de status no card e na tabela
    const badgeCard = document.getElementById(`bib-card-status-${item.id}`);
    if (badgeCard) {
      badgeCard.className = `badge-status-bib ${status.classe}`;
      badgeCard.textContent = status.rotulo;
    }

    const badgeRow = document.getElementById(`bib-row-status-${item.id}`);
    if (badgeRow) {
      badgeRow.className = `pill-status-tabela ${status.classe}`;
      badgeRow.textContent = status.rotulo;
    }

    // Se houver filtro por status ativo, reaplica após a animação do pulso
    const filtroStatus = document.getElementById("filtro-status-biblioteca")?.value || "";
    if (filtroStatus) {
      setTimeout(() => aplicarFiltros(), 360);
    }
  }

  function renderizarListagem() {
    const grade = document.getElementById("grade-itens-biblioteca");
    const tabelaWrapper = document.getElementById("tabela-wrapper-biblioteca");
    const tabelaCorpo = document.getElementById("tabela-corpo-biblioteca");
    const estadoVazio = document.getElementById("estado-vazio-biblioteca");

    if (!grade || !tabelaWrapper || !tabelaCorpo) return;

    if (itensFiltrados.length === 0) {
      grade.style.display = "none";
      tabelaWrapper.style.display = "none";
      if (estadoVazio) estadoVazio.style.display = "flex";
      return;
    }

    if (estadoVazio) estadoVazio.style.display = "none";

    if (modoVisao === "grade") {
      grade.style.display = "grid";
      tabelaWrapper.style.display = "none";
      grade.innerHTML = "";
      const frag = document.createDocumentFragment();
      itensFiltrados.forEach((item) => frag.appendChild(criarCardElemento(item)));
      grade.appendChild(frag);
    } else {
      grade.style.display = "none";
      tabelaWrapper.style.display = "block";
      tabelaCorpo.innerHTML = "";
      const frag = document.createDocumentFragment();
      itensFiltrados.forEach((item) => frag.appendChild(criarLinhaTabelaElemento(item)));
      tabelaCorpo.appendChild(frag);
    }
  }

  function criarIconeSvgEditar() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>`;
  }

  function criarIconeSvgExcluir() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>`;
  }

  function gerarMidiaCardHtml(item) {
    if (item.foto_url) {
      return `<img src="${item.foto_url}" alt="${escapeHtml(item.nome)}" class="card-bib-img" loading="lazy" />`;
    }

    const attr = item.atributos || {};
    if (item.categoria === "agulha") {
      const mmTexto = attr.espessura_mm ? formatarMm(attr.espessura_mm) : "🪡";
      const tipoTexto = ROTULOS_SUBTIPO[attr.tipo] || "Agulha";
      return `
        <div class="card-bib-placeholder">
          <span class="card-bib-placeholder-mm">${escapeHtml(mmTexto)}</span>
          <span class="card-bib-placeholder-sub">${escapeHtml(tipoTexto)}</span>
        </div>
      `;
    }

    if (item.categoria === "ferramenta") {
      return `
        <div class="card-bib-placeholder">
          <span class="card-bib-placeholder-icone" aria-hidden="true">✂️</span>
          <span class="card-bib-placeholder-sub">Ferramenta</span>
        </div>
      `;
    }

    return `
      <div class="card-bib-placeholder">
        <span class="card-bib-placeholder-icone" aria-hidden="true">🎀</span>
        <span class="card-bib-placeholder-sub">${escapeHtml(attr.cor_tamanho || "Aviamento")}</span>
      </div>
    `;
  }

  function criarCardElemento(item) {
    const card = document.createElement("article");
    card.className = "card-bib";
    card.dataset.id = item.id;
    card.dataset.categoria = item.categoria;

    const attr = item.atributos || {};
    const status = calcularStatusItem(item);
    const catRotulo = ROTULOS_CATEGORIA[item.categoria] || "Item";

    // Chips de metadados específicos
    const chips = [];
    let subinfo = "";
    let rodapeHtml = "";

    if (item.categoria === "agulha") {
      const tipoNome = ROTULOS_SUBTIPO[attr.tipo] || "Crochê";
      subinfo = attr.material ? `${tipoNome} • ${attr.material}` : tipoNome;

      if (attr.espessura_mm) {
        chips.push(`<span class="chip-meta-bib destaque-mm">${escapeHtml(formatarMm(attr.espessura_mm))}</span>`);
      }
      if (attr.comprimento_cabo_cm) {
        chips.push(`<span class="chip-meta-bib">Cabo ${escapeHtml(attr.comprimento_cabo_cm)}cm</span>`);
      }
      if (attr.em_uso && attr.em_uso_projeto_nome) {
        chips.push(
          `<span class="chip-meta-bib destaque-projeto" title="Projeto vinculado">📌 ${escapeHtml(attr.em_uso_projeto_nome)}</span>`
        );
      }

      const emUso = Boolean(attr.em_uso || attr.em_uso_projeto_id);
      rodapeHtml = `
        <button
          type="button"
          class="btn-toggle-uso ${emUso ? "em-uso" : ""}"
          role="switch"
          aria-checked="${emUso ? "true" : "false"}"
          title="Alternar status entre Livre e Em uso"
        >
          <span class="indicador-uso-texto">
            <span class="ponto-uso" aria-hidden="true"></span>
            <span>${emUso ? "Em uso no projeto" : "Livre para uso"}</span>
          </span>
          <span class="pilula-switch" aria-hidden="true"></span>
        </button>
      `;
    } else if (item.categoria === "aviamento") {
      const qtd = Number(attr.quantidade_atual) || 0;
      const un = attr.unidade || "un";
      const min = Number(attr.estoque_minimo) || 0;
      const custo = Number(attr.custo_unitario) || 0;

      subinfo = attr.cor_tamanho || "Aviamento de projeto";
      if (custo > 0) {
        chips.push(`<span class="chip-meta-bib destaque-preco">${formatarMoeda(custo)} / ${escapeHtml(un)}</span>`);
      }
      if (min > 0) {
        chips.push(`<span class="chip-meta-bib">Mín: ${min} ${escapeHtml(un)}</span>`);
      }

      rodapeHtml = `
        <div class="controle-estoque-bib" title="Ajuste rápido de estoque">
          <button type="button" class="btn-stepper-bib btn-step-menos" aria-label="Diminuir 1 ${escapeHtml(un)}">−</button>
          <span class="valor-estoque-bib" id="bib-card-qtd-${item.id}">${qtd} ${escapeHtml(un)}</span>
          <button type="button" class="btn-stepper-bib btn-step-mais" aria-label="Adicionar 1 ${escapeHtml(un)}">+</button>
        </div>
        <span class="info-rodape-direita" id="bib-card-total-${item.id}" title="Valor total em estoque">
          ${custo > 0 ? formatarMoeda(custo * qtd) : "Sem custo"}
        </span>
      `;
    } else {
      // Ferramenta
      const qtd = Number(attr.quantidade) || 0;
      const local = attr.local_armazenamento || "Local não informado";
      subinfo = `Ferramenta de confecção`;
      chips.push(`<span class="chip-meta-bib">📍 ${escapeHtml(local)}</span>`);

      rodapeHtml = `
        <div class="controle-estoque-bib" title="Ajuste rápido de quantidade">
          <button type="button" class="btn-stepper-bib btn-step-menos" aria-label="Diminuir quantidade">−</button>
          <span class="valor-estoque-bib" id="bib-card-qtd-${item.id}">${qtd} un</span>
          <button type="button" class="btn-stepper-bib btn-step-mais" aria-label="Adicionar quantidade">+</button>
        </div>
        <span class="info-rodape-direita" title="${escapeHtml(local)}">${escapeHtml(local)}</span>
      `;
    }

    card.innerHTML = `
      <div class="card-bib-acoes-hover">
        <button type="button" class="btn-flutuante-card btn-editar-card-bib" title="Editar item" aria-label="Editar ${escapeHtml(item.nome)}">
          ${criarIconeSvgEditar()}
        </button>
        <button type="button" class="btn-flutuante-card btn-excluir-flutuante btn-excluir-card-bib" title="Excluir item" aria-label="Excluir ${escapeHtml(item.nome)}">
          ${criarIconeSvgExcluir()}
        </button>
      </div>

      <div class="card-bib-midia">
        ${gerarMidiaCardHtml(item)}
        <span class="badge-cat-card">${escapeHtml(catRotulo)}</span>
        <span class="badge-status-bib ${status.classe}" id="bib-card-status-${item.id}">${escapeHtml(status.rotulo)}</span>
      </div>

      <div class="card-bib-corpo">
        <div class="card-bib-titulo-area">
          <h3 class="card-bib-nome">${escapeHtml(item.nome)}</h3>
          <span class="card-bib-subinfo">${escapeHtml(subinfo)}</span>
        </div>

        ${chips.length > 0 ? `<div class="card-bib-chips">${chips.join("")}</div>` : ""}
        ${item.observacoes ? `<p class="card-bib-obs">${escapeHtml(item.observacoes)}</p>` : ""}

        <div class="card-bib-rodape">
          ${rodapeHtml}
        </div>
      </div>
    `;

    // Eventos do card
    card.querySelector(".btn-editar-card-bib")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirDrawer(item);
    });

    card.querySelector(".btn-excluir-card-bib")?.addEventListener("click", (e) => {
      e.stopPropagation();
      solicitarExclusao(item.id);
    });

    card.querySelector(".btn-toggle-uso")?.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarUsoAgulha(item.id);
    });

    card.querySelector(".btn-step-menos")?.addEventListener("click", (e) => {
      e.stopPropagation();
      ajustarEstoqueItem(item.id, -1);
    });

    card.querySelector(".btn-step-mais")?.addEventListener("click", (e) => {
      e.stopPropagation();
      ajustarEstoqueItem(item.id, 1);
    });

    return card;
  }

  function criarLinhaTabelaElemento(item) {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;

    const attr = item.atributos || {};
    const status = calcularStatusItem(item);
    const catRotulo = ROTULOS_CATEGORIA[item.categoria] || "Item";

    let iconePadrao = "🎀";
    if (item.categoria === "agulha") iconePadrao = "🪡";
    else if (item.categoria === "ferramenta") iconePadrao = "✂️";

    const thumbHtml = item.foto_url
      ? `<img src="${item.foto_url}" alt="${escapeHtml(item.nome)}" class="thumb-tabela" loading="lazy" />`
      : `<div class="thumb-tabela" aria-hidden="true">${iconePadrao}</div>`;

    let especificacao = "—";
    let estoqueUsoHtml = "—";
    let custoLocal = "—";

    if (item.categoria === "agulha") {
      const partes = [];
      if (attr.espessura_mm) partes.push(`<strong>${escapeHtml(formatarMm(attr.espessura_mm))}</strong>`);
      if (attr.tipo) partes.push(escapeHtml(ROTULOS_SUBTIPO[attr.tipo] || attr.tipo));
      if (attr.material) partes.push(escapeHtml(attr.material));
      if (attr.comprimento_cabo_cm) partes.push(`${escapeHtml(attr.comprimento_cabo_cm)}cm`);
      especificacao = partes.join(" • ") || "—";

      const emUso = Boolean(attr.em_uso || attr.em_uso_projeto_id);
      estoqueUsoHtml = `
        <button type="button" class="btn-toggle-uso-compacto ${emUso ? "em-uso" : ""}" title="Alternar Em uso / Livre">
          <span class="ponto-uso" aria-hidden="true"></span>
          <span>${emUso ? "Em uso" : "Livre"}</span>
        </button>
      `;
      custoLocal = attr.em_uso_projeto_nome ? `📌 ${escapeHtml(attr.em_uso_projeto_nome)}` : "—";
    } else if (item.categoria === "aviamento") {
      const qtd = Number(attr.quantidade_atual) || 0;
      const un = attr.unidade || "un";
      especificacao = escapeHtml(attr.cor_tamanho || "—");
      estoqueUsoHtml = `
        <div class="controle-estoque-bib">
          <button type="button" class="btn-stepper-bib btn-step-menos" aria-label="Diminuir 1">−</button>
          <span class="valor-estoque-bib" id="bib-row-qtd-${item.id}">${qtd} ${escapeHtml(un)}</span>
          <button type="button" class="btn-stepper-bib btn-step-mais" aria-label="Adicionar 1">+</button>
        </div>
      `;
      custoLocal = attr.custo_unitario > 0 ? `${formatarMoeda(attr.custo_unitario)} / ${escapeHtml(un)}` : "—";
    } else {
      const qtd = Number(attr.quantidade) || 0;
      especificacao = "Ferramenta de confecção";
      estoqueUsoHtml = `
        <div class="controle-estoque-bib">
          <button type="button" class="btn-stepper-bib btn-step-menos" aria-label="Diminuir 1">−</button>
          <span class="valor-estoque-bib" id="bib-row-qtd-${item.id}">${qtd} un</span>
          <button type="button" class="btn-stepper-bib btn-step-mais" aria-label="Adicionar 1">+</button>
        </div>
      `;
      custoLocal = escapeHtml(attr.local_armazenamento || "—");
    }

    tr.innerHTML = `
      <td>
        <div class="celula-item-tabela">
          ${thumbHtml}
          <div>
            <span class="nome-item-tabela">${escapeHtml(item.nome)}</span>
            ${item.observacoes ? `<span class="sub-item-tabela">${escapeHtml(item.observacoes.slice(0, 56))}${item.observacoes.length > 56 ? "…" : ""}</span>` : ""}
          </div>
        </div>
      </td>
      <td>${escapeHtml(catRotulo)}</td>
      <td>${especificacao}</td>
      <td><span class="pill-status-tabela ${status.classe}" id="bib-row-status-${item.id}">${escapeHtml(status.rotulo)}</span></td>
      <td>${estoqueUsoHtml}</td>
      <td>${custoLocal}</td>
      <td class="col-acoes-tabela">
        <div class="acoes-linha-tabela">
          <button type="button" class="btn-acao-tabela btn-editar-row" title="Editar" aria-label="Editar ${escapeHtml(item.nome)}">
            ${criarIconeSvgEditar()}
          </button>
          <button type="button" class="btn-acao-tabela excluir btn-excluir-row" title="Excluir" aria-label="Excluir ${escapeHtml(item.nome)}">
            ${criarIconeSvgExcluir()}
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-editar-row")?.addEventListener("click", () => abrirDrawer(item));
    tr.querySelector(".btn-excluir-row")?.addEventListener("click", () => solicitarExclusao(item.id));
    tr.querySelector(".btn-toggle-uso-compacto")?.addEventListener("click", () => alternarUsoAgulha(item.id));
    tr.querySelector(".btn-step-menos")?.addEventListener("click", () => ajustarEstoqueItem(item.id, -1));
    tr.querySelector(".btn-step-mais")?.addEventListener("click", () => ajustarEstoqueItem(item.id, 1));

    return tr;
  }

  // ==========================================================================
  // DRAWER LATERAL DESLIZANTE (CADASTRO E EDIÇÃO DINÂMICA)
  // ==========================================================================

  function atualizarCamposDinamicosCategoria(categoria, comAnimacao = true) {
    const inputCat = document.getElementById("bib-categoria");
    if (inputCat) inputCat.value = categoria;

    document.querySelectorAll(".seletor-categoria-bib .btn-cat-form").forEach((btn) => {
      const ativa = btn.dataset.cat === categoria;
      btn.classList.toggle("ativo", ativa);
      btn.setAttribute("aria-pressed", ativa ? "true" : "false");
    });

    const blocos = {
      agulha: document.getElementById("campos-cat-agulha"),
      ferramenta: document.getElementById("campos-cat-ferramenta"),
      aviamento: document.getElementById("campos-cat-aviamento")
    };

    Object.entries(blocos).forEach(([chave, bloco]) => {
      if (!bloco) return;
      if (chave === categoria) {
        bloco.style.display = "flex";
        if (comAnimacao) {
          bloco.classList.remove("entrando");
          void bloco.offsetWidth;
          bloco.classList.add("entrando");
        }
      } else {
        bloco.style.display = "none";
        bloco.classList.remove("entrando");
      }
    });
  }

  function atualizarPreviewFoto(dataUrl) {
    const placeholder = document.getElementById("upload-placeholder-bib");
    const previewBox = document.getElementById("upload-preview-bib");
    const previewImg = document.getElementById("upload-preview-img-bib");
    const inputFoto = document.getElementById("bib-foto-input");

    if (dataUrl) {
      if (previewImg) previewImg.src = dataUrl;
      if (previewBox) previewBox.style.display = "flex";
      if (placeholder) placeholder.style.display = "none";
    } else {
      if (previewImg) previewImg.src = "";
      if (previewBox) previewBox.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
      if (inputFoto) inputFoto.value = "";
    }
  }

  function abrirDrawer(itemEdicao = null) {
    const overlay = document.getElementById("drawer-overlay-biblioteca");
    const form = document.getElementById("form-item-biblioteca");
    const titulo = document.getElementById("drawer-bib-titulo");
    const subtitulo = document.getElementById("drawer-bib-subtitulo");
    const btnExcluir = document.getElementById("btn-excluir-drawer-bib");
    const btnSalvar = document.getElementById("btn-salvar-drawer-bib");

    if (!overlay || !form) return;

    form.reset();

    const isEdicao = Boolean(itemEdicao && itemEdicao.id);
    const categoriaInicial = isEdicao
      ? itemEdicao.categoria
      : categoriaAtiva !== "todas"
        ? categoriaAtiva
        : "agulha";

    if (titulo) titulo.textContent = isEdicao ? "Editar Item" : "Novo Item";
    if (subtitulo) {
      subtitulo.textContent = isEdicao
        ? "Atualize os detalhes e salve suas alterações"
        : "Adicione uma agulha, ferramenta ou aviamento ao catálogo";
    }
    if (btnSalvar) btnSalvar.textContent = isEdicao ? "Salvar Alterações" : "Salvar Item";
    if (btnExcluir) btnExcluir.style.display = isEdicao ? "inline-flex" : "none";

    document.getElementById("bib-item-id").value = isEdicao ? itemEdicao.id : "";
    document.getElementById("bib-nome").value = itemEdicao?.nome || "";
    document.getElementById("bib-observacoes").value = itemEdicao?.observacoes || "";

    atualizarCamposDinamicosCategoria(categoriaInicial, false);

    const attr = itemEdicao?.atributos || {};

    // Preenche campos de Agulha (respeita Técnica Principal nas Configurações)
    const tipoAgulhaPadrao =
      typeof Configuracoes !== "undefined" && Configuracoes.obter("tecnicaPrincipal") === "trico"
        ? "trico-reto"
        : "croche";
    document.getElementById("bib-agulha-tipo").value =
      attr.tipo || (subtipoAgulhaAtivo !== "todos" ? subtipoAgulhaAtivo : tipoAgulhaPadrao);
    document.getElementById("bib-agulha-mm").value = attr.espessura_mm ?? "";
    document.getElementById("bib-agulha-material").value = attr.material || "";
    document.getElementById("bib-agulha-cabo").value = attr.comprimento_cabo_cm ?? "";

    const checkEmUso = document.getElementById("bib-agulha-em-uso");
    const wrapperProj = document.getElementById("wrapper-projeto-vinculado");
    const inputProjNome = document.getElementById("bib-agulha-projeto-nome");
    const estaEmUso = Boolean(attr.em_uso || attr.em_uso_projeto_id);
    if (checkEmUso) checkEmUso.checked = estaEmUso;
    if (wrapperProj) wrapperProj.style.display = estaEmUso ? "flex" : "none";
    if (inputProjNome) inputProjNome.value = attr.em_uso_projeto_nome || "";

    // Preenche campos de Ferramenta
    document.getElementById("bib-ferr-qtd").value = attr.quantidade ?? 1;
    document.getElementById("bib-ferr-local").value = attr.local_armazenamento || "";

    // Preenche campos de Aviamento
    document.getElementById("bib-av-qtd").value = attr.quantidade_atual ?? 1;
    document.getElementById("bib-av-min").value = attr.estoque_minimo ?? 5;
    document.getElementById("bib-av-unidade").value = attr.unidade || "un";
    document.getElementById("bib-av-cor-tam").value = attr.cor_tamanho || "";
    document.getElementById("bib-av-custo").value = attr.custo_unitario ?? "";

    // Limpa calculadora de pacote
    const pacVal = document.getElementById("bib-pacote-valor");
    const pacQtd = document.getElementById("bib-pacote-qtd");
    if (pacVal) pacVal.value = "";
    if (pacQtd) pacQtd.value = "";

    // Foto
    fotoAtualBase64 = itemEdicao?.foto_url || "";
    atualizarPreviewFoto(fotoAtualBase64);

    overlay.classList.add("aberto");
    overlay.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      document.getElementById("bib-nome")?.focus();
    }, 120);
  }

  function fecharDrawer() {
    const overlay = document.getElementById("drawer-overlay-biblioteca");
    if (!overlay) return;
    overlay.classList.remove("aberto");
    overlay.setAttribute("aria-hidden", "true");
    fotoAtualBase64 = "";
  }

  function redimensionarFoto(arquivo, maxDim = 560, qualidade = 0.82) {
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
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL("image/webp", qualidade);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", qualidade);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Falha ao processar imagem."));
        img.src = ev.target.result;
      };
      leitor.onerror = () => reject(new Error("Falha ao ler arquivo."));
      leitor.readAsDataURL(arquivo);
    });
  }

  async function processarFotoUpload(arquivo) {
    if (!arquivo || !arquivo.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem válido (PNG, JPG ou WEBP).");
      return;
    }
    try {
      fotoAtualBase64 = await redimensionarFoto(arquivo);
      atualizarPreviewFoto(fotoAtualBase64);
    } catch {
      const leitor = new FileReader();
      leitor.onload = (e) => {
        fotoAtualBase64 = e.target.result;
        atualizarPreviewFoto(fotoAtualBase64);
      };
      leitor.readAsDataURL(arquivo);
    }
  }

  async function salvarFormularioDrawer(e) {
    e.preventDefault();

    const idVal = document.getElementById("bib-item-id").value;
    const categoria = document.getElementById("bib-categoria").value || "agulha";
    const nome = document.getElementById("bib-nome").value.trim();
    const observacoes = document.getElementById("bib-observacoes").value.trim();

    if (!nome) {
      alert("Por favor, informe o nome do item.");
      document.getElementById("bib-nome")?.focus();
      return;
    }

    let atributos = {};

    if (categoria === "agulha") {
      const tipo = document.getElementById("bib-agulha-tipo").value || "croche";
      const espessura = parseFloat(document.getElementById("bib-agulha-mm").value);
      if (isNaN(espessura) || espessura <= 0) {
        alert("Informe a espessura da agulha em milímetros (ex.: 3.5).");
        document.getElementById("bib-agulha-mm")?.focus();
        return;
      }
      const material = document.getElementById("bib-agulha-material").value.trim();
      const caboVal = parseFloat(document.getElementById("bib-agulha-cabo").value);
      const emUso = Boolean(document.getElementById("bib-agulha-em-uso").checked);
      const projNome = document.getElementById("bib-agulha-projeto-nome").value.trim();

      atributos = {
        tipo,
        espessura_mm: espessura,
        material,
        comprimento_cabo_cm: isNaN(caboVal) ? null : caboVal,
        em_uso: emUso,
        em_uso_projeto_id: emUso ? (idVal ? `proj-agulha-${idVal}` : `proj-manual-${Date.now()}`) : null,
        em_uso_projeto_nome: emUso ? projNome : ""
      };
    } else if (categoria === "ferramenta") {
      const qtd = parseInt(document.getElementById("bib-ferr-qtd").value, 10);
      const local = document.getElementById("bib-ferr-local").value.trim();
      atributos = {
        quantidade: isNaN(qtd) ? 1 : Math.max(0, qtd),
        local_armazenamento: local
      };
    } else if (categoria === "aviamento") {
      const qtdAtual = parseInt(document.getElementById("bib-av-qtd").value, 10);
      const estMin = parseInt(document.getElementById("bib-av-min").value, 10);
      const unidade = document.getElementById("bib-av-unidade").value || "un";
      const corTamanho = document.getElementById("bib-av-cor-tam").value.trim();
      const custo = parseFloat(document.getElementById("bib-av-custo").value);

      atributos = {
        quantidade_atual: isNaN(qtdAtual) ? 0 : Math.max(0, qtdAtual),
        estoque_minimo: isNaN(estMin) ? 0 : Math.max(0, estMin),
        unidade,
        custo_unitario: isNaN(custo) ? 0 : Math.max(0, custo),
        cor_tamanho: corTamanho
      };
    }

    const item = {
      nome,
      categoria,
      foto_url: fotoAtualBase64 || "",
      observacoes,
      atributos,
      atualizado_em: new Date().toISOString()
    };

    if (idVal) {
      item.id = Number(idVal);
      const existente = itensCache.find((i) => Number(i.id) === item.id);
      if (existente?.criado_em) item.criado_em = existente.criado_em;
    } else {
      item.criado_em = new Date().toISOString();
    }

    const salvo = await dbSalvar(item);

    if (idVal) {
      const idx = itensCache.findIndex((i) => Number(i.id) === Number(salvo.id));
      if (idx !== -1) itensCache[idx] = salvo;
    } else {
      itensCache.unshift(salvo);
    }

    fecharDrawer();
    notificarBibliotecaAtualizada();
    aplicarFiltros();
  }

  // ==========================================================================
  // MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
  // ==========================================================================

  function solicitarExclusao(id) {
    const item = itensCache.find((i) => Number(i.id) === Number(id));
    if (!item) return;

    idParaExcluir = item.id;
    const modal = document.getElementById("modal-confirmar-exclusao-bib");
    const texto = document.getElementById("texto-excluir-bib");

    if (modal && texto) {
      texto.innerHTML = `Tem certeza que deseja excluir <strong>${escapeHtml(item.nome)}</strong>?<br>Esta ação não poderá ser desfeita.`;
      modal.style.display = "flex";
    }
  }

  function fecharModalExclusao() {
    const modal = document.getElementById("modal-confirmar-exclusao-bib");
    if (modal) modal.style.display = "none";
    idParaExcluir = null;
  }

  async function confirmarExclusao() {
    if (idParaExcluir === null || idParaExcluir === undefined) return;
    const alvo = idParaExcluir;

    await dbExcluir(alvo);
    itensCache = itensCache.filter((i) => Number(i.id) !== Number(alvo));

    fecharModalExclusao();
    fecharDrawer();
    notificarBibliotecaAtualizada();
    aplicarFiltros();
  }

  // ==========================================================================
  // ALTERNÂNCIA DE ABAS E MODO DE VISÃO (GRADE / LISTA)
  // ==========================================================================

  function selecionarCategoriaAba(categoria) {
    categoriaAtiva = categoria || "todas";

    document.querySelectorAll(".lista-abas-biblioteca .aba-biblioteca").forEach((aba) => {
      const ativa = aba.dataset.categoria === categoriaAtiva;
      aba.classList.toggle("ativa", ativa);
      aba.setAttribute("aria-selected", ativa ? "true" : "false");
    });

    const barraSubfiltros = document.getElementById("subfiltros-agulhas");
    if (barraSubfiltros) {
      barraSubfiltros.style.display = categoriaAtiva === "agulha" ? "flex" : "none";
    }

    if (categoriaAtiva !== "agulha") {
      subtipoAgulhaAtivo = "todos";
      document.querySelectorAll("#subfiltros-agulhas .chip-subfiltro").forEach((chip) => {
        chip.classList.toggle("ativo", chip.dataset.subtipo === "todos");
      });
    }

    aplicarFiltros();
  }

  function alternarVisao(novoModo) {
    modoVisao = novoModo === "lista" ? "lista" : "grade";

    const btnGrade = document.getElementById("btn-visao-grade");
    const btnLista = document.getElementById("btn-visao-lista");

    if (btnGrade) {
      btnGrade.classList.toggle("ativo", modoVisao === "grade");
      btnGrade.setAttribute("aria-pressed", modoVisao === "grade" ? "true" : "false");
    }
    if (btnLista) {
      btnLista.classList.toggle("ativo", modoVisao === "lista");
      btnLista.setAttribute("aria-pressed", modoVisao === "lista" ? "true" : "false");
    }

    try {
      localStorage.setItem("ponto_trama_agulhas_visao", modoVisao);
    } catch {
      // ignora restrição de storage
    }

    renderizarListagem();
  }

  // ==========================================================================
  // PARTE 3: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================

  function vincularEventos() {
    // 1. Abas de Categoria
    document.querySelectorAll(".lista-abas-biblioteca .aba-biblioteca").forEach((aba) => {
      aba.addEventListener("click", () => {
        selecionarCategoriaAba(aba.dataset.categoria);
      });
    });

    // 2. Subfiltros rápidos de Agulhas
    document.querySelectorAll("#subfiltros-agulhas .chip-subfiltro").forEach((chip) => {
      chip.addEventListener("click", () => {
        subtipoAgulhaAtivo = chip.dataset.subtipo || "todos";
        document.querySelectorAll("#subfiltros-agulhas .chip-subfiltro").forEach((c) => {
          c.classList.toggle("ativo", c === chip);
        });
        aplicarFiltros();
      });
    });

    // 3. Toolbar: Busca (com debounce), Alternador de Visão, Filtros e + Novo Item
    const buscaBib = document.getElementById("busca-biblioteca");
    if (buscaBib) {
      const buscarDebounced =
        typeof BancoDadosPT !== "undefined" ? BancoDadosPT.debounce(() => aplicarFiltros(false), 80) : () => aplicarFiltros(false);
      buscaBib.addEventListener("input", buscarDebounced);
    }
    document.getElementById("filtro-numeracao-biblioteca")?.addEventListener("change", () => aplicarFiltros(false));
    document.getElementById("filtro-status-biblioteca")?.addEventListener("change", () => aplicarFiltros(false));
    document.getElementById("btn-limpar-filtros-biblioteca")?.addEventListener("click", limparFiltros);

    document.getElementById("btn-visao-grade")?.addEventListener("click", () => alternarVisao("grade"));
    document.getElementById("btn-visao-lista")?.addEventListener("click", () => alternarVisao("lista"));

    document.getElementById("btn-novo-item-biblioteca")?.addEventListener("click", () => abrirDrawer(null));
    document.getElementById("btn-vazio-novo-item")?.addEventListener("click", () => abrirDrawer(null));

    // 4. Drawer: Fechar, Troca Dinâmica de Categoria, Upload, Pacote e Submit
    document.getElementById("btn-fechar-drawer-bib")?.addEventListener("click", fecharDrawer);
    document.getElementById("btn-cancelar-drawer-bib")?.addEventListener("click", fecharDrawer);

    const overlayDrawer = document.getElementById("drawer-overlay-biblioteca");
    if (overlayDrawer) {
      overlayDrawer.addEventListener("click", (e) => {
        if (e.target === overlayDrawer) fecharDrawer();
      });
    }

    document.querySelectorAll(".seletor-categoria-bib .btn-cat-form").forEach((btn) => {
      btn.addEventListener("click", () => {
        atualizarCamposDinamicosCategoria(btn.dataset.cat, true);
      });
    });

    const checkEmUso = document.getElementById("bib-agulha-em-uso");
    const wrapperProj = document.getElementById("wrapper-projeto-vinculado");
    if (checkEmUso && wrapperProj) {
      checkEmUso.addEventListener("change", () => {
        wrapperProj.style.display = checkEmUso.checked ? "flex" : "none";
      });
    }

    // Calculadora rápida de custo unitário a partir do pacote
    document.getElementById("btn-calcular-custo-pacote")?.addEventListener("click", () => {
      const valorPacote = parseFloat(document.getElementById("bib-pacote-valor")?.value);
      const qtdPacote = parseFloat(document.getElementById("bib-pacote-qtd")?.value);
      const inputCusto = document.getElementById("bib-av-custo");

      if (!isNaN(valorPacote) && valorPacote > 0 && !isNaN(qtdPacote) && qtdPacote > 0 && inputCusto) {
        const unitario = valorPacote / qtdPacote;
        inputCusto.value = unitario.toFixed(2);
        if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
          Animacoes.animarPulso(inputCusto);
        }
      }
    });

    // Upload de foto no Drawer
    const uploadArea = document.getElementById("upload-area-bib");
    const inputFoto = document.getElementById("bib-foto-input");
    const btnRemoverFoto = document.getElementById("btn-remover-foto-bib");

    if (uploadArea && inputFoto) {
      uploadArea.addEventListener("click", (e) => {
        if (e.target.closest("#btn-remover-foto-bib")) return;
        inputFoto.click();
      });

      inputFoto.addEventListener("change", (e) => {
        const arq = e.target.files?.[0];
        if (arq) processarFotoUpload(arq);
      });

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
        const arq = e.dataTransfer?.files?.[0];
        if (arq) processarFotoUpload(arq);
      });
    }

    if (btnRemoverFoto) {
      btnRemoverFoto.addEventListener("click", (e) => {
        e.stopPropagation();
        fotoAtualBase64 = "";
        atualizarPreviewFoto("");
      });
    }

    document.getElementById("form-item-biblioteca")?.addEventListener("submit", salvarFormularioDrawer);

    document.getElementById("btn-excluir-drawer-bib")?.addEventListener("click", () => {
      const idEdicao = document.getElementById("bib-item-id")?.value;
      if (idEdicao) solicitarExclusao(Number(idEdicao));
    });

    // 5. Modal de Confirmação de Exclusão
    document.getElementById("btn-cancelar-exclusao-bib")?.addEventListener("click", fecharModalExclusao);
    document.getElementById("btn-confirmar-exclusao-bib")?.addEventListener("click", confirmarExclusao);

    const modalExclusao = document.getElementById("modal-confirmar-exclusao-bib");
    if (modalExclusao) {
      modalExclusao.addEventListener("click", (e) => {
        if (e.target === modalExclusao) fecharModalExclusao();
      });
    }

    // 6. Tecla ESC fecha modal de exclusão ou drawer
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modalConf = document.getElementById("modal-confirmar-exclusao-bib");
      if (modalConf && modalConf.style.display === "flex") {
        fecharModalExclusao();
        return;
      }
      const drawerOverlay = document.getElementById("drawer-overlay-biblioteca");
      if (drawerOverlay && drawerOverlay.classList.contains("aberto")) {
        fecharDrawer();
      }
    });
  }

  async function recarregar() {
    try {
      await carregarDadosIniciais();
      aplicarFiltros(true);
      notificarBibliotecaAtualizada();
    } catch (erro) {
      console.error("Falha ao recarregar Agulhas e Acessórios:", erro);
    }
  }

  async function init() {
    vincularEventos();
    try {
      await carregarDadosIniciais();

      // Restaura visualização salva (grade ou lista)
      try {
        const visaoSalva = localStorage.getItem("ponto_trama_agulhas_visao");
        if (visaoSalva === "lista" || visaoSalva === "grade") {
          modoVisao = visaoSalva;
          alternarVisao(modoVisao);
        }
      } catch {
        // ignora
      }

      aplicarFiltros(true);
      notificarBibliotecaAtualizada();
      window.addEventListener("ponto-trama:configuracoes-atualizadas", () => {
        aplicarFiltros(false);
      });
    } catch (erro) {
      console.error("Falha ao inicializar Agulhas e Acessórios:", erro);
    }
  }

  // API pública (inclui métodos para Gerenciador de Projetos e Calculadora de Precificação)
  return {
    init,
    recarregar,
    abrirDrawer,
    fecharDrawer,
    obterTodosItens,
    obterAgulhas,
    obterAviamentos,
    obterFerramentas,
    vincularAgulhaProjeto,
    liberarAgulhaProjeto,
    darBaixaAviamento,
    darBaixaAviamentosEmLote
  };
})();
