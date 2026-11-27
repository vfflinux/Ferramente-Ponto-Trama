// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: CALCULADORA DE PRECIFICAÇÃO
// Implementação completa da precificação com suporte a modo avançado
// de Estoque (busca no inventário, cálculo de rateio em gramas ou frações
// de novelo, visualização de sobras, drawer de consulta rápida).
// ==========================================================================

const CalculadoraPrecificacao = (() => {
  let linhaIdCounter = 1;
  let modoEstoqueAtivo = false;
  let fiosEstoque = []; // Cache dos fios carregados do IndexedDB
  let aviamentosEstoque = []; // Cache dos aviamentos de itens_biblioteca
  let aviamentosSelecionados = new Map(); // id -> { item, quantidade }

  // Constantes do IndexedDB do Ponto & Trama
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (Cálculos, Fórmulas, Integração e Estado)
  // ==========================================================================

  function formatarMoeda(valor) {
    if (typeof Configuracoes !== "undefined" && typeof Configuracoes.formatarMoeda === "function") {
      return Configuracoes.formatarMoeda(valor);
    }
    const numero = Number(valor) || 0;
    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formatarQuantidade(qtd) {
    const q = Number(qtd) || 0;
    return q % 1 === 0
      ? q.toString()
      : q.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

  // Carrega os fios do banco de dados IndexedDB (via conexão compartilhada)
  async function obterFiosDoInventario() {
    if (typeof BancoDadosPT === "undefined") return [];
    fiosEstoque = await BancoDadosPT.obterTodos(STORE_FIOS);
    return fiosEstoque;
  }

  // Carrega os aviamentos cadastrados na ferramenta Agulhas e Acessórios
  async function obterAviamentosDoInventario() {
    if (typeof BancoDadosPT === "undefined") return [];
    const todos = await BancoDadosPT.obterTodos(STORE_BIBLIOTECA);
    aviamentosEstoque = todos.filter((i) => i.categoria === "aviamento");
    return aviamentosEstoque;
  }

  // Popula o datalist com os fios para autocomplete
  function atualizarDatalistFios() {
    const datalist = document.getElementById("datalist-fios-estoque");
    if (!datalist) return;

    datalist.innerHTML = "";
    fiosEstoque.forEach((fio) => {
      const opt = document.createElement("option");
      const rotuloExibicao = `${fio.nome} - ${fio.cor_nome} (${fio.marca})`;
      opt.value = rotuloExibicao;
      opt.dataset.id = fio.id;
      const partesDetalhe = [];
      if (fio.cor_codigo) partesDetalhe.push(`Cód: ${fio.cor_codigo}`);
      if (fio.tex) partesDetalhe.push(`TEX ${fio.tex}`);
      if (fio.peso_novelo_g) partesDetalhe.push(`${fio.peso_novelo_g}g`);
      partesDetalhe.push(`Estoque: ${formatarQuantidade(fio.quantidade)} un`);
      opt.textContent = partesDetalhe.join(" | ");
      datalist.appendChild(opt);
    });
  }

  // Encontra um fio do estoque por ID ou nome
  function buscarFioPorNomeOuId(identificador) {
    if (!identificador) return null;
    const str = String(identificador).trim().toLowerCase();

    // 1. Tenta por ID numérico direto
    const porId = fiosEstoque.find((f) => String(f.id) === str);
    if (porId) return porId;

    // 2. Tenta por match exato com o texto do datalist "Nome - Cor (Marca)"
    const porRotulo = fiosEstoque.find((f) => {
      const rotulo = `${f.nome} - ${f.cor_nome} (${f.marca})`.toLowerCase();
      return rotulo === str;
    });
    if (porRotulo) return porRotulo;

    // 3. Tenta por "Nome - Cor"
    const porNomeCor = fiosEstoque.find((f) => {
      const nc = `${f.nome} - ${f.cor_nome}`.toLowerCase();
      return nc === str;
    });
    if (porNomeCor) return porNomeCor;

    // 4. Tenta por nome da linha apenas
    const porNome = fiosEstoque.find((f) => (f.nome || "").toLowerCase() === str);
    if (porNome) return porNome;

    return null;
  }

  // Cálculo detalhado do subtotal das linhas de fio
  function calcularSubtotalLinhas() {
    const listaLinhas = document.getElementById("lista-linhas");
    if (!listaLinhas) return { subtotal: 0, listaDiscriminada: [] };

    let subtotal = 0;
    const listaDiscriminada = [];
    const itens = listaLinhas.querySelectorAll(".item-linha");

    itens.forEach((item) => {
      const inputValor = item.querySelector(".input-valor-linha");
      const inputQtd = item.querySelector(".input-qtd-linha");
      const inputNome = item.querySelector(".input-nome-linha");
      const toggle = item.querySelector(".toggle-medida");

      const valorDigitado = Math.max(0, parseFloat(inputValor?.value) || 0);
      const qtdDigitada = Math.max(0, parseFloat(inputQtd?.value) || 0);
      const unidade = toggle?.dataset.unidade || "un";
      const nomeDigitado = inputNome?.value?.trim() || "";
      const fioId = item.dataset.fioId;

      const fio = fioId ? buscarFioPorNomeOuId(fioId) : buscarFioPorNomeOuId(nomeDigitado);

      let custoItem = 0;
      let precoUnitarioCalculado = valorDigitado;

      if (valorDigitado > 0 && qtdDigitada > 0) {
        if (unidade === "g") {
          // Se a medida for em gramas:
          // Se o fio tiver peso cadastrado (ex: 100g, 125g), calcula o preço por grama!
          const pesoNovelo = (fio && fio.peso_novelo_g > 0) ? fio.peso_novelo_g : null;

          if (pesoNovelo) {
            const precoPorGrama = valorDigitado / pesoNovelo;
            custoItem = precoPorGrama * qtdDigitada;
            precoUnitarioCalculado = precoPorGrama;
          } else {
            // Se não souber o peso do novelo, assume que o valor digitado é por grama ou multiplica direto
            custoItem = valorDigitado * qtdDigitada;
          }
        } else {
          // Medida em unidades / novelos inteiros ou frações (ex: 1, 0.5 novelos)
          custoItem = valorDigitado * qtdDigitada;
        }

        subtotal += custoItem;

        listaDiscriminada.push({
          nome: fio ? `${fio.nome} (${fio.cor_nome})` : (nomeDigitado || "Linha de crochê/tricô"),
          valorOriginal: valorDigitado,
          qtd: qtdDigitada,
          unidade,
          custoItem,
          fio
        });
      }

      // Atualiza a tarja de informações de estoque se aplicável
      atualizarTarjaInfoEstoque(item, fio, qtdDigitada, unidade, valorDigitado);
    });

    return { subtotal, listaDiscriminada };
  }

  // Atualiza as tags visuais de Cor, TEX, Peso, Estoque Disponível e Sobra
  function atualizarTarjaInfoEstoque(item, fio, qtdDigitada, unidade, valorDigitado) {
    const tarja = item.querySelector(".linha-info-estoque");
    if (!tarja) return;

    if (!modoEstoqueAtivo || !fio) {
      tarja.style.display = "none";
      tarja.innerHTML = "";
      return;
    }

    const tagsHtml = [];

    // 1. Cor & Código
    const corTexto = fio.cor_nome ? `${fio.cor_nome}${fio.cor_codigo ? ' #' + fio.cor_codigo : ''}` : "Cor não inf.";
    tagsHtml.push(`<span class="info-tag tag-cor" title="Cor e código do lote">🎨 ${escapeHtml(corTexto)}</span>`);

    // 2. TEX
    if (fio.tex) {
      tagsHtml.push(`<span class="info-tag tag-tex" title="Espessura do fio">🧵 TEX ${fio.tex}</span>`);
    }

    // 3. Peso de 1 Unidade
    if (fio.peso_novelo_g) {
      if (unidade === "g" && valorDigitado > 0) {
        const precoPorG = (valorDigitado / fio.peso_novelo_g).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        });
        tagsHtml.push(`<span class="info-tag tag-peso" title="Peso unitário e preço por grama">⚖️ ${fio.peso_novelo_g}g (${precoPorG}/g)</span>`);
      } else {
        tagsHtml.push(`<span class="info-tag tag-peso" title="Peso de um novelo cheio">⚖️ ${fio.peso_novelo_g}g / un</span>`);
      }
    }

    // 4. Estoque Disponível no Inventário
    const qtdEstoque = Number(fio.quantidade) || 0;
    let classeStatus = "tag-estoque-ok";
    let textoStatus = `${formatarQuantidade(qtdEstoque)} nov. em estoque`;

    if (qtdEstoque <= 0) {
      classeStatus = "tag-estoque-zerado";
      textoStatus = "Zerado no estoque";
    } else if (qtdEstoque <= 1) {
      classeStatus = "tag-estoque-baixo";
      textoStatus = `Acabando (${formatarQuantidade(qtdEstoque)} nov.)`;
    }

    tagsHtml.push(`<span class="info-tag ${classeStatus}" title="Disponibilidade atual no seu inventário de fios">📦 ${textoStatus}</span>`);

    // 5. Cálculo Dinâmico de Sobras (O que resta após a confecção da peça)
    if (qtdDigitada > 0) {
      if (unidade === "g" && fio.peso_novelo_g > 0) {
        const pctNovelo = Math.round((qtdDigitada / fio.peso_novelo_g) * 100);
        const sobraGramas = fio.peso_novelo_g - (qtdDigitada % fio.peso_novelo_g);
        const novelosConsumidos = (qtdDigitada / fio.peso_novelo_g).toFixed(1);

        if (qtdDigitada <= fio.peso_novelo_g) {
          const sobra = fio.peso_novelo_g - qtdDigitada;
          tagsHtml.push(`<span class="info-tag tag-sobra">Uso: ${pctNovelo}% do novelo | Sobra estimada: ${sobra}g</span>`);
        } else {
          tagsHtml.push(`<span class="info-tag tag-sobra">Uso: ~${novelosConsumidos} nov. | Sobra no aberto: ${sobraGramas}g</span>`);
        }
      } else if (unidade === "un") {
        const restanteEstoque = qtdEstoque - qtdDigitada;
        if (restanteEstoque >= 0) {
          tagsHtml.push(`<span class="info-tag tag-sobra">Restarão: ${formatarQuantidade(restanteEstoque)} nov.</span>`);
        } else {
          const falta = Math.abs(restanteEstoque);
          tagsHtml.push(`<span class="info-tag tag-estoque-zerado tag-sobra">⚠️ Faltam ${formatarQuantidade(falta)} nov. para a receita!</span>`);
        }
      }
    }

    tarja.innerHTML = tagsHtml.join("");
    tarja.style.display = "flex";
  }

  function calcularSubtotalMaoDeObra() {
    const horasGastas = Math.max(0, parseFloat(document.getElementById("input-horas-gastas")?.value) || 0);
    const valorHora = Math.max(0, parseFloat(document.getElementById("input-valor-hora")?.value) || 0);
    return horasGastas * valorHora;
  }

  function calcularSubtotalAcessorios() {
    return Math.max(0, parseFloat(document.getElementById("input-valor-acessorios")?.value) || 0);
  }

  function calcularPrecificacao(comFeedbackPulso = false) {
    const { subtotal: subtotalLinhas, listaDiscriminada } = calcularSubtotalLinhas();
    const subtotalMaoObra = calcularSubtotalMaoDeObra();
    const subtotalAcessorios = calcularSubtotalAcessorios();

    const custoTotal = subtotalLinhas + subtotalMaoObra + subtotalAcessorios;

    const inputMargemLucro = document.getElementById("input-margem-lucro");
    const margemPercentual = Math.max(0, parseFloat(inputMargemLucro?.value) || 0);

    const precoVenda = custoTotal * (1 + margemPercentual / 100);
    const lucroReal = precoVenda - custoTotal;

    // Atualização visual dos resultados no DOM
    const subtotalLinhasElem = document.getElementById("subtotal-linhas");
    const subtotalMaoObraElem = document.getElementById("subtotal-mao-obra");
    const subtotalAcessoriosElem = document.getElementById("subtotal-acessorios");
    const resultadoCustoTotalElem = document.getElementById("resultado-custo-total");
    const resultadoPrecoVendaElem = document.getElementById("resultado-preco-venda");
    const textoBadgeLucroElem = document.getElementById("texto-badge-lucro");

    if (subtotalLinhasElem) subtotalLinhasElem.textContent = formatarMoeda(subtotalLinhas);
    if (subtotalMaoObraElem) subtotalMaoObraElem.textContent = formatarMoeda(subtotalMaoObra);
    if (subtotalAcessoriosElem) subtotalAcessoriosElem.textContent = formatarMoeda(subtotalAcessorios);
    if (resultadoCustoTotalElem) resultadoCustoTotalElem.textContent = formatarMoeda(custoTotal);
    if (resultadoPrecoVendaElem) resultadoPrecoVendaElem.textContent = formatarMoeda(precoVenda);

    if (textoBadgeLucroElem) {
      textoBadgeLucroElem.textContent = `Lucro: +${formatarMoeda(lucroReal)} (${margemPercentual}%)`;
    }

    if (comFeedbackPulso && resultadoPrecoVendaElem) {
      if (typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
        Animacoes.animarPulso(resultadoPrecoVendaElem);
      }
    }

    const resultado = {
      subtotalLinhas,
      subtotalMaoObra,
      subtotalAcessorios,
      custoTotal,
      margemPercentual,
      precoVenda,
      lucroReal,
      listaDiscriminada
    };

    sincronizarComProjetoAtivo(resultado);
    return resultado;
  }

  function capturarSnapshotLinhas() {
    const listaLinhas = document.getElementById("lista-linhas");
    if (!listaLinhas) return [];
    return Array.from(listaLinhas.querySelectorAll(".item-linha")).map((item) => ({
      fio_id: item.dataset.fioId ? Number(item.dataset.fioId) : null,
      nome: item.querySelector(".input-nome-linha")?.value?.trim() || "",
      valor: item.querySelector(".input-valor-linha")?.value || "",
      qtd: item.querySelector(".input-qtd-linha")?.value || "",
      unidade: item.querySelector(".toggle-medida")?.dataset.unidade || "un"
    }));
  }

  function sincronizarComProjetoAtivo(resultado) {
    if (
      typeof ProjetoContexto === "undefined" ||
      ProjetoContexto.estaHidratando() ||
      !ProjetoContexto.obterProjetoAtivo()
    ) {
      return;
    }

    ProjetoContexto.atualizarSecaoAtiva(
      "precificacao",
      {
        linhas: capturarSnapshotLinhas(),
        aviamentos: Array.from(aviamentosSelecionados.values()).map(({ item, quantidade }) => ({
          id: item.id,
          nome: item.nome,
          quantidade,
          unidade: item.atributos?.unidade || "un"
        })),
        horasGastas: document.getElementById("input-horas-gastas")?.value || "",
        valorHora: document.getElementById("input-valor-hora")?.value || "",
        valorAcessorios: document.getElementById("input-valor-acessorios")?.value || "",
        margemLucro: document.getElementById("input-margem-lucro")?.value || "30",
        custoTotal: resultado.custoTotal,
        precoVenda: resultado.precoVenda
      },
      { origem: "precificacao" }
    );
  }

  function carregarDoProjeto(projeto) {
    if (!projeto) return;
    const prec = projeto.precificacao || {};
    const listaLinhas = document.getElementById("lista-linhas");

    // Define as linhas: prioridade para precificacao.linhas salvas, senão puxa de projeto.materiais.fios
    let linhasOrigem = Array.isArray(prec.linhas) && prec.linhas.length > 0 ? prec.linhas : null;
    if (!linhasOrigem && Array.isArray(projeto.materiais?.fios) && projeto.materiais.fios.length > 0) {
      linhasOrigem = projeto.materiais.fios.map((f) => ({
        fio_id: f.fio_id || null,
        nome: f.marca ? `${f.nome} - ${f.cor || ""} (${f.marca})` : f.nome || "",
        valor: f.preco_pago > 0 ? Number(f.preco_pago).toFixed(2) : "",
        qtd: f.quantidade || 1,
        unidade: "un"
      }));
    }

    if (listaLinhas) {
      listaLinhas.innerHTML = "";
      linhaIdCounter = 0;

      const listaFinal = linhasOrigem && linhasOrigem.length > 0 ? linhasOrigem : [{ nome: "", valor: "", qtd: "", unidade: "un" }];
      const temFioVinculado = listaFinal.some((l) => l.nome || l.fio_id);
      if (temFioVinculado && !modoEstoqueAtivo) {
        alternarModoEstoque(true);
      }

      listaFinal.forEach((l) => {
        linhaIdCounter++;
        const item = criarItemLinha(linhaIdCounter, null);
        if (l.fio_id) item.dataset.fioId = l.fio_id;
        const inpNome = item.querySelector(".input-nome-linha");
        const inpVal = item.querySelector(".input-valor-linha");
        const inpQtd = item.querySelector(".input-qtd-linha");
        const toggle = item.querySelector(".toggle-medida");
        if (inpNome) inpNome.value = l.nome || "";
        if (inpVal) inpVal.value = l.valor !== undefined && l.valor !== null ? l.valor : "";
        if (inpQtd) inpQtd.value = l.qtd !== undefined && l.qtd !== null ? l.qtd : "";
        if (toggle && l.unidade) {
          toggle.dataset.unidade = l.unidade;
          toggle.querySelectorAll(".btn-toggle-opcao").forEach((b) => {
            b.classList.toggle("ativo", b.dataset.valor === l.unidade);
          });
        }
        listaLinhas.appendChild(item);
      });
      atualizarBotoesRemover();
    }

    const horasCrono =
      projeto.tempo_gasto_seg > 0 && typeof ProjetoContexto !== "undefined"
        ? ProjetoContexto.segundosParaHoras(projeto.tempo_gasto_seg)
        : 0;
    const horasFinais =
      prec.horasGastas !== undefined && prec.horasGastas !== ""
        ? prec.horasGastas
        : horasCrono > 0
          ? String(horasCrono)
          : "";

    const inpHoras = document.getElementById("input-horas-gastas");
    const inpValHora = document.getElementById("input-valor-hora");
    const inpAcess = document.getElementById("input-valor-acessorios");
    const inpMargem = document.getElementById("input-margem-lucro");
    const sliderMargem = document.getElementById("slider-margem-lucro");
    const dispMargem = document.getElementById("display-margem-lucro");

    if (inpHoras) inpHoras.value = horasFinais;
    if (inpValHora) inpValHora.value = prec.valorHora || "";
    if (inpAcess) inpAcess.value = prec.valorAcessorios || "";
    const margem = prec.margemLucro !== undefined && prec.margemLucro !== "" ? prec.margemLucro : "30";
    if (inpMargem) inpMargem.value = margem;
    if (sliderMargem) sliderMargem.value = Math.min(200, Number(margem) || 30);
    if (dispMargem) dispMargem.textContent = `${margem}%`;

    aviamentosSelecionados.clear();
    if (Array.isArray(prec.aviamentos) && prec.aviamentos.length > 0) {
      prec.aviamentos.forEach((av) => {
        const encontrado = aviamentosEstoque.find((item) => Number(item.id) === Number(av.id));
        if (encontrado && Number(av.quantidade) > 0) {
          aviamentosSelecionados.set(encontrado.id, { item: encontrado, quantidade: Number(av.quantidade) });
        }
      });
    }
    renderizarChipsAviamentos();

    calcularPrecificacao(false);
  }

  function alternarModoEstoque(forcarEstado = null) {
    if (forcarEstado !== null) {
      modoEstoqueAtivo = Boolean(forcarEstado);
    } else {
      modoEstoqueAtivo = !modoEstoqueAtivo;
    }

    const conteiner = document.getElementById("conteiner-precificacao");
    const btnEstoque = document.getElementById("btn-estoque-precificacao");
    const badgeStatus = document.getElementById("badge-status-estoque");
    const btnGaveta = document.getElementById("btn-abrir-gaveta-estoque");

    if (conteiner) {
      conteiner.classList.toggle("modo-estoque-ativo", modoEstoqueAtivo);
    }

    if (btnEstoque) {
      btnEstoque.classList.toggle("ativo", modoEstoqueAtivo);
      btnEstoque.setAttribute("aria-pressed", modoEstoqueAtivo ? "true" : "false");
    }

    if (badgeStatus) {
      badgeStatus.textContent = modoEstoqueAtivo ? "Ativo" : "Desativado";
    }

    if (btnGaveta) {
      btnGaveta.style.display = modoEstoqueAtivo ? "inline-flex" : "none";
    }

    try {
      localStorage.setItem("ponto_trama_modo_estoque", modoEstoqueAtivo ? "true" : "false");
    } catch {
      // Ignora erro de storage restrito
    }

    // Se ativado, sincroniza dados do inventário e atualiza as linhas
    if (modoEstoqueAtivo) {
      obterFiosDoInventario().then(() => {
        atualizarDatalistFios();
        calcularPrecificacao();
      });
    } else {
      calcularPrecificacao();
    }
  }

  function limparCampos() {
    const listaLinhas = document.getElementById("lista-linhas");
    if (listaLinhas) {
      const itens = Array.from(listaLinhas.querySelectorAll(".item-linha"));
      for (let i = 1; i < itens.length; i++) {
        itens[i].remove();
      }

      if (itens[0]) {
        const inputNome = itens[0].querySelector(".input-nome-linha");
        const inputValor = itens[0].querySelector(".input-valor-linha");
        const inputQtd = itens[0].querySelector(".input-qtd-linha");
        if (inputNome) inputNome.value = "";
        if (inputValor) inputValor.value = "";
        if (inputQtd) inputQtd.value = "";

        delete itens[0].dataset.fioId;

        const tarja = itens[0].querySelector(".linha-info-estoque");
        if (tarja) {
          tarja.style.display = "none";
          tarja.innerHTML = "";
        }

        const toggle = itens[0].querySelector(".toggle-medida");
        if (toggle) {
          toggle.dataset.unidade = "un";
          const opcoes = toggle.querySelectorAll(".btn-toggle-opcao");
          opcoes.forEach((b) => b.classList.toggle("ativo", b.dataset.valor === "un"));
        }
      }
      atualizarBotoesRemover();
    }

    const inputHorasGastas = document.getElementById("input-horas-gastas");
    const inputValorHora = document.getElementById("input-valor-hora");
    const inputValorAcessorios = document.getElementById("input-valor-acessorios");
    const inputMargemLucro = document.getElementById("input-margem-lucro");
    const sliderMargemLucro = document.getElementById("slider-margem-lucro");
    const displayMargemLucro = document.getElementById("display-margem-lucro");

    const valorHoraDefault =
      typeof Configuracoes !== "undefined" && Configuracoes.obter("valorHoraPadrao") !== ""
        ? Number(Configuracoes.obter("valorHoraPadrao"))
        : 0;
    const margemDefault =
      typeof Configuracoes !== "undefined" && Configuracoes.obter("margemPadrao") !== ""
        ? Number(Configuracoes.obter("margemPadrao"))
        : 30;

    if (inputHorasGastas) inputHorasGastas.value = "";
    if (inputValorHora) inputValorHora.value = valorHoraDefault > 0 ? valorHoraDefault.toFixed(2) : "";
    if (inputValorAcessorios) inputValorAcessorios.value = "";
    if (inputMargemLucro) inputMargemLucro.value = margemDefault;
    if (sliderMargemLucro) sliderMargemLucro.value = Math.min(200, margemDefault);
    if (displayMargemLucro) displayMargemLucro.textContent = `${margemDefault}%`;

    aviamentosSelecionados.clear();
    renderizarChipsAviamentos();

    calcularPrecificacao(false);
  }

  function copiarOrcamento() {
    const dados = calcularPrecificacao(true);

    const linhasFiosTexto = dados.listaDiscriminada.length > 0
      ? dados.listaDiscriminada.map((item) => {
          const med = item.unidade === "g" ? `${item.qtd}g` : `${formatarQuantidade(item.qtd)} nov.`;
          return `   • ${item.nome}: ${med} (${formatarMoeda(item.custoItem)})`;
        }).join("\n")
      : `   • Linhas e Fios: ${formatarMoeda(dados.subtotalLinhas)}`;

    const aviamentosLista = Array.from(aviamentosSelecionados.values());
    const linhasAviamentosTexto = aviamentosLista.length > 0
      ? "\n" + aviamentosLista.map(({ item, quantidade }) => {
          const un = item.atributos?.unidade || "un";
          const unit = Number(item.atributos?.custo_unitario) || 0;
          return `   • ${item.nome}: ${quantidade} ${un} (${formatarMoeda(unit * quantidade)})`;
        }).join("\n")
      : "";

    const nomeAtelie =
      typeof Configuracoes !== "undefined" && Configuracoes.obter("nomeAtelie")
        ? Configuracoes.obter("nomeAtelie")
        : "Ponto & Trama";
    const assinatura =
      typeof Configuracoes !== "undefined" && Configuracoes.obter("assinaturaOrcamento")
        ? `\n${Configuracoes.obter("assinaturaOrcamento")}`
        : "";

    const texto = [
      `📋 Orçamento de Precificação - ${nomeAtelie}`,
      "----------------------------------------",
      "🧵 Fios e Materiais:",
      linhasFiosTexto,
      `⏱️ Mão de Obra: ${formatarMoeda(dados.subtotalMaoObra)}`,
      `🎀 Acessórios e Extras: ${formatarMoeda(dados.subtotalAcessorios)}${linhasAviamentosTexto}`,
      "----------------------------------------",
      `💰 Custo Total de Produção: ${formatarMoeda(dados.custoTotal)}`,
      `📈 Margem de Lucro: ${dados.margemPercentual}% (+${formatarMoeda(dados.lucroReal)})`,
      `✨ Preço Final Sugerido: ${formatarMoeda(dados.precoVenda)}${assinatura}`
    ].join("\n");

    const btn = document.getElementById("btn-calcular-precificacao");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        if (btn) {
          const original = btn.innerHTML;
          btn.innerHTML = `<span>✓ Orçamento Copiado!</span>`;
          btn.style.backgroundColor = "#27ae60";
          btn.style.color = "#ffffff";
          setTimeout(() => {
            btn.innerHTML = original;
            btn.style.backgroundColor = "";
            btn.style.color = "";
          }, 2000);
        }
      }).catch(() => {
        if (btn) {
          const original = btn.innerHTML;
          btn.innerHTML = `<span>✓ Preço Calculado!</span>`;
          setTimeout(() => {
            btn.innerHTML = original;
          }, 1500);
        }
      });
    } else {
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = `<span>✓ Preço Calculado!</span>`;
        setTimeout(() => {
          btn.innerHTML = original;
        }, 1500);
      }
    }
  }

  // ==========================================================================
  // PARTE 2: ANIMAÇÕES E EFEITOS (Drawer, Cards, DOM e Linhas Dinâmicas)
  // ==========================================================================

  function criarItemLinha(id, fioPreselecionado = null) {
    const item = document.createElement("div");
    item.className = "item-linha";
    item.dataset.linhaId = id;

    if (fioPreselecionado) {
      item.dataset.fioId = fioPreselecionado.id;
    }

    const valorPreco = fioPreselecionado?.preco_pago ? fioPreselecionado.preco_pago.toFixed(2) : "";
    const nomePreenchido = fioPreselecionado ? `${fioPreselecionado.nome} - ${fioPreselecionado.cor_nome} (${fioPreselecionado.marca})` : "";
    const simboloMoeda =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obterSimboloMoeda === "function"
        ? Configuracoes.obterSimboloMoeda()
        : "R$";

    item.innerHTML = `
      <div class="item-linha-campos">
        <!-- Campo Nome da Linha / Fio -->
        <div class="campo-item campo-nome-linha">
          <label class="label-campo">NOME DA LINHA / FIO</label>
          <div class="input-grupo">
            <input
              type="text"
              class="input-precificacao input-nome-linha"
              placeholder="Buscar no estoque ou digitar..."
              list="datalist-fios-estoque"
              aria-label="Nome do fio ou linha"
              autocomplete="off"
              value="${escapeHtml(nomePreenchido)}"
            />
          </div>
        </div>

        <div class="campo-item campo-valor-linha">
          <label class="label-campo">VALOR DA LINHA</label>
          <div class="input-grupo">
            <span class="prefixo-input">${escapeHtml(simboloMoeda)}</span>
            <input
              type="number"
              class="input-precificacao input-valor-linha"
              placeholder="0,00"
              min="0"
              step="0.01"
              value="${valorPreco}"
              aria-label="Valor da Linha em Reais"
            />
          </div>
        </div>

        <div class="campo-item campo-qtd-linha">
          <label class="label-campo">QUANTIDADE</label>
          <input
            type="number"
            class="input-precificacao input-qtd-linha"
            placeholder="1"
            min="0"
            step="0.1"
            aria-label="Quantidade utilizada"
          />
        </div>

        <div class="campo-item campo-medida-linha">
          <label class="label-campo">MEDIDA</label>
          <div class="toggle-medida" data-unidade="un" role="group" aria-label="Seletor de Unidade de Medida">
            <button type="button" class="btn-toggle-opcao ativo" data-valor="un">Un.</button>
            <button type="button" class="btn-toggle-opcao" data-valor="g">g</button>
          </div>
        </div>

        <div class="campo-item campo-acao-linha">
          <button
            type="button"
            class="btn-remover-linha"
            title="Remover linha"
            aria-label="Remover esta linha"
          >
            &times;
          </button>
        </div>
      </div>

      <!-- Tarja Informativa com Cor, TEX, Peso e Estoque -->
      <div class="linha-info-estoque" style="display: none;"></div>
    `;

    configurarEventosItemLinha(item);
    return item;
  }

  function atualizarBotoesRemover() {
    const listaLinhas = document.getElementById("lista-linhas");
    if (!listaLinhas) return;

    const itens = listaLinhas.querySelectorAll(".item-linha");
    itens.forEach((item) => {
      const btnRemover = item.querySelector(".btn-remover-linha");
      if (btnRemover) {
        if (itens.length > 1) {
          btnRemover.classList.remove("btn-oculto");
        } else {
          btnRemover.classList.add("btn-oculto");
        }
      }
    });
  }

  function adicionarLinha(fioPreselecionado = null) {
    linhaIdCounter++;
    const listaLinhas = document.getElementById("lista-linhas");
    if (!listaLinhas) return;

    const novoItem = criarItemLinha(linhaIdCounter, fioPreselecionado);
    listaLinhas.appendChild(novoItem);
    atualizarBotoesRemover();
    calcularPrecificacao();
    novoItem.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Foca no campo de quantidade se o fio já foi pré-selecionado
    if (fioPreselecionado) {
      setTimeout(() => {
        novoItem.querySelector(".input-qtd-linha")?.focus();
      }, 100);
    }
  }

  function removerLinha(itemElemento) {
    if (!itemElemento) return;
    if (typeof Animacoes !== "undefined" && typeof Animacoes.animarSaida === "function") {
      Animacoes.animarSaida(itemElemento, "animar-linha-removida", 200, () => {
        itemElemento.remove();
        atualizarBotoesRemover();
        calcularPrecificacao();
      });
    } else {
      itemElemento.remove();
      atualizarBotoesRemover();
      calcularPrecificacao();
    }
  }

  function alternarMedida(btnClicado) {
    const containerToggle = btnClicado.closest(".toggle-medida");
    if (!containerToggle) return;

    const opcoes = containerToggle.querySelectorAll(".btn-toggle-opcao");
    opcoes.forEach((b) => b.classList.remove("ativo"));
    btnClicado.classList.add("ativo");
    containerToggle.dataset.unidade = btnClicado.dataset.valor || "un";

    calcularPrecificacao();
  }

  function configurarEventosItemLinha(item) {
    const inputNome = item.querySelector(".input-nome-linha");
    const inputValor = item.querySelector(".input-valor-linha");
    const inputQtd = item.querySelector(".input-qtd-linha");
    const btnRemover = item.querySelector(".btn-remover-linha");
    const btnsToggle = item.querySelectorAll(".btn-toggle-opcao");

    if (inputNome) {
      inputNome.addEventListener("input", () => {
        const valorDigitado = inputNome.value.trim();
        const fioEncontrado = buscarFioPorNomeOuId(valorDigitado);

        if (fioEncontrado) {
          item.dataset.fioId = fioEncontrado.id;
          // Se o valor estiver vazio ou zero, preenche automaticamente com o preço pago do fio
          if (!inputValor.value || parseFloat(inputValor.value) === 0) {
            if (fioEncontrado.preco_pago > 0) {
              inputValor.value = fioEncontrado.preco_pago.toFixed(2);
            }
          }
        } else {
          delete item.dataset.fioId;
        }

        calcularPrecificacao();
      });

      inputNome.addEventListener("change", () => {
        calcularPrecificacao();
      });
    }

    if (inputValor) inputValor.addEventListener("input", () => calcularPrecificacao());
    if (inputQtd) inputQtd.addEventListener("input", () => calcularPrecificacao());

    if (btnRemover) {
      btnRemover.addEventListener("click", () => removerLinha(item));
    }

    btnsToggle.forEach((btn) => {
      btn.addEventListener("click", () => alternarMedida(btn));
    });
  }

  // ==========================================================================
  // DRAWER DE CONSULTA RÁPIDA DE ESTOQUE
  // ==========================================================================

  function abrirDrawerEstoque() {
    const overlay = document.getElementById("drawer-overlay-estoque");
    if (!overlay) return;

    overlay.style.display = "flex";
    obterFiosDoInventario().then(() => {
      renderizarListaDrawerEstoque();
      setTimeout(() => {
        document.getElementById("busca-drawer-estoque")?.focus();
      }, 100);
    });
  }

  function fecharDrawerEstoque() {
    const overlay = document.getElementById("drawer-overlay-estoque");
    if (overlay) overlay.style.display = "none";
  }

  function renderizarListaDrawerEstoque(termoBusca = "") {
    const listaContainer = document.getElementById("drawer-lista-fios");
    if (!listaContainer) return;

    listaContainer.innerHTML = "";

    const termo = termoBusca.trim().toLowerCase();
    const fiosFiltrados = fiosEstoque.filter((fio) => {
      if (!termo) return true;
      const nome = (fio.nome || "").toLowerCase();
      const marca = (fio.marca || "").toLowerCase();
      const cor = (fio.cor_nome || "").toLowerCase();
      const codigo = (fio.cor_codigo || "").toLowerCase();
      return nome.includes(termo) || marca.includes(termo) || cor.includes(termo) || codigo.includes(termo);
    });

    if (fiosFiltrados.length === 0) {
      listaContainer.innerHTML = `
        <div class="drawer-vazio">
          <span class="drawer-vazio-icone">🧶</span>
          <strong>Nenhum fio encontrado</strong>
          <span style="font-size: 12px;">Cadastre fios no Inventário ou ajuste a busca acima.</span>
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();
    fiosFiltrados.forEach((fio) => {
      const card = document.createElement("div");
      card.className = "card-fio-drawer";

      const qtd = Number(fio.quantidade) || 0;
      let statusClasse = "tag-estoque-ok";
      let statusTexto = `${formatarQuantidade(qtd)} em estoque`;

      if (qtd <= 0) {
        statusClasse = "tag-estoque-zerado";
        statusTexto = "Zerado";
      } else if (qtd <= 1) {
        statusClasse = "tag-estoque-baixo";
        statusTexto = `Acabando (${formatarQuantidade(qtd)})`;
      }

      const precoTexto = fio.preco_pago > 0 ? formatarMoeda(fio.preco_pago) : "Preço não inf.";
      const corTexto = fio.cor_nome ? `${fio.cor_nome}${fio.cor_codigo ? ' #' + fio.cor_codigo : ''}` : "Cor —";

      card.innerHTML = `
        <div class="card-fio-drawer-cabecalho">
          <div class="card-fio-drawer-titulos">
            <span class="card-fio-drawer-marca">${escapeHtml(fio.marca || "Marca")}</span>
            <h4 class="card-fio-drawer-nome">${escapeHtml(fio.nome || "Sem nome")}</h4>
          </div>
          <span class="info-tag ${statusClasse}">${statusTexto}</span>
        </div>

        <div class="card-fio-drawer-specs">
          <span class="info-tag tag-cor">🎨 ${escapeHtml(corTexto)}</span>
          ${fio.tex ? `<span class="info-tag tag-tex">🧵 TEX ${fio.tex}</span>` : ""}
          ${fio.peso_novelo_g ? `<span class="info-tag tag-peso">⚖️ ${fio.peso_novelo_g}g</span>` : ""}
        </div>

        <div class="card-fio-drawer-rodape">
          <span class="card-fio-drawer-preco">${precoTexto}</span>
          <button type="button" class="btn-usar-fio-drawer" data-id="${fio.id}">
            <span>+ Usar na Receita</span>
          </button>
        </div>
      `;

      const btnUsar = card.querySelector(".btn-usar-fio-drawer");
      btnUsar.addEventListener("click", () => {
        usarFioDoDrawer(fio);
      });

      frag.appendChild(card);
    });
    listaContainer.appendChild(frag);
  }

  // Insere o fio selecionado no drawer diretamente na calculadora
  function usarFioDoDrawer(fio) {
    if (!modoEstoqueAtivo) {
      alternarModoEstoque(true);
    }

    const listaLinhas = document.getElementById("lista-linhas");
    if (!listaLinhas) return;

    // Procura se a primeira linha está vazia (sem valor e sem quantidade)
    const primeiraLinha = listaLinhas.querySelector(".item-linha");
    const inputNomePrimeira = primeiraLinha?.querySelector(".input-nome-linha");
    const inputValorPrimeira = primeiraLinha?.querySelector(".input-valor-linha");
    const inputQtdPrimeira = primeiraLinha?.querySelector(".input-qtd-linha");

    const primeiraVazia = primeiraLinha && (!inputValorPrimeira.value || parseFloat(inputValorPrimeira.value) === 0) && !inputQtdPrimeira.value;

    if (primeiraVazia) {
      primeiraLinha.dataset.fioId = fio.id;
      if (inputNomePrimeira) {
        inputNomePrimeira.value = `${fio.nome} - ${fio.cor_nome} (${fio.marca})`;
      }
      if (inputValorPrimeira && fio.preco_pago > 0) {
        inputValorPrimeira.value = fio.preco_pago.toFixed(2);
      }
      fecharDrawerEstoque();
      calcularPrecificacao(true);
      setTimeout(() => inputQtdPrimeira?.focus(), 150);
    } else {
      // Adiciona uma nova linha com o fio já selecionado
      fecharDrawerEstoque();
      adicionarLinha(fio);
    }
  }

  // ==========================================================================
  // DRAWER DE SELEÇÃO DE AVIAMENTOS (INTEGRAÇÃO COM AGULHAS E ACESSÓRIOS)
  // ==========================================================================

  function abrirDrawerAviamentos() {
    const overlay = document.getElementById("drawer-overlay-aviamentos");
    if (!overlay) return;

    overlay.style.display = "flex";
    obterAviamentosDoInventario().then(() => {
      renderizarListaDrawerAviamentos(document.getElementById("busca-drawer-aviamentos")?.value || "");
      atualizarTotalDrawerAviamentos();
      setTimeout(() => {
        document.getElementById("busca-drawer-aviamentos")?.focus();
      }, 100);
    });
  }

  function fecharDrawerAviamentos() {
    const overlay = document.getElementById("drawer-overlay-aviamentos");
    if (overlay) overlay.style.display = "none";
  }

  function calcularTotalAviamentosSelecionados() {
    let total = 0;
    aviamentosSelecionados.forEach(({ item, quantidade }) => {
      const custo = Number(item.atributos?.custo_unitario) || 0;
      total += custo * quantidade;
    });
    return total;
  }

  function atualizarTotalDrawerAviamentos() {
    const elTotal = document.getElementById("total-aviamentos-drawer");
    if (elTotal) {
      elTotal.textContent = formatarMoeda(calcularTotalAviamentosSelecionados());
    }
  }

  function renderizarChipsAviamentos() {
    const container = document.getElementById("chips-aviamentos-precificacao");
    if (!container) return;

    if (aviamentosSelecionados.size === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    container.innerHTML = "";

    aviamentosSelecionados.forEach(({ item, quantidade }, id) => {
      const un = item.atributos?.unidade || "un";
      const chip = document.createElement("span");
      chip.className = "chip-aviamento-prec";
      chip.innerHTML = `
        <span>${quantidade}${escapeHtml(un)} ${escapeHtml(item.nome)}</span>
        <button type="button" title="Remover aviamento" aria-label="Remover ${escapeHtml(item.nome)}">&times;</button>
      `;
      chip.querySelector("button")?.addEventListener("click", () => {
        aviamentosSelecionados.delete(id);
        aplicarAviamentosNaPrecificacao(false);
      });
      container.appendChild(chip);
    });
  }

  function aplicarAviamentosNaPrecificacao(fechar = true) {
    const total = calcularTotalAviamentosSelecionados();
    const inputAcessorios = document.getElementById("input-valor-acessorios");
    if (inputAcessorios) {
      inputAcessorios.value = total > 0 ? total.toFixed(2) : "";
    }
    renderizarChipsAviamentos();
    calcularPrecificacao(true);
    if (fechar) fecharDrawerAviamentos();
  }

  function renderizarListaDrawerAviamentos(termoBusca = "") {
    const lista = document.getElementById("drawer-lista-aviamentos");
    if (!lista) return;

    lista.innerHTML = "";
    const termo = termoBusca.trim().toLowerCase();

    const filtrados = aviamentosEstoque.filter((item) => {
      if (!termo) return true;
      const nome = (item.nome || "").toLowerCase();
      const corTam = (item.atributos?.cor_tamanho || "").toLowerCase();
      const obs = (item.observacoes || "").toLowerCase();
      return nome.includes(termo) || corTam.includes(termo) || obs.includes(termo);
    });

    if (filtrados.length === 0) {
      lista.innerHTML = `
        <div class="drawer-vazio">
          <span class="drawer-vazio-icone">🎀</span>
          <strong>Nenhum aviamento encontrado</strong>
          <span style="font-size: 12px;">Cadastre aviamentos na aba "Agulhas e acessórios" com custo unitário.</span>
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();
    filtrados.forEach((item) => {
      const attr = item.atributos || {};
      const qtdEstoque = Number(attr.quantidade_atual) || 0;
      const min = Number(attr.estoque_minimo) || 0;
      const un = attr.unidade || "un";
      const custo = Number(attr.custo_unitario) || 0;
      const qtdSel = aviamentosSelecionados.get(item.id)?.quantidade || 0;

      let statusClasse = "tag-estoque-ok";
      let statusTexto = `${qtdEstoque} ${un} em estoque`;
      if (qtdEstoque <= 0) {
        statusClasse = "tag-estoque-zerado";
        statusTexto = "Sem estoque";
      } else if (min > 0 && qtdEstoque <= min) {
        statusClasse = "tag-estoque-baixo";
        statusTexto = `Baixo (${qtdEstoque} ${un})`;
      }

      const card = document.createElement("div");
      card.className = "card-fio-drawer";
      card.innerHTML = `
        <div class="card-fio-drawer-cabecalho">
          <div class="card-fio-drawer-titulos">
            <span class="card-fio-drawer-marca">Aviamento</span>
            <h4 class="card-fio-drawer-nome">${escapeHtml(item.nome)}</h4>
          </div>
          <span class="info-tag ${statusClasse}">${escapeHtml(statusTexto)}</span>
        </div>

        <div class="card-fio-drawer-specs">
          ${attr.cor_tamanho ? `<span class="info-tag tag-cor">📏 ${escapeHtml(attr.cor_tamanho)}</span>` : ""}
          <span class="info-tag tag-peso">💰 ${custo > 0 ? `${formatarMoeda(custo)} / ${escapeHtml(un)}` : "Sem custo cadastrado"}</span>
        </div>

        <div class="card-fio-drawer-rodape">
          <span class="card-fio-drawer-preco" data-sub-av="${item.id}">
            ${qtdSel > 0 ? formatarMoeda(custo * qtdSel) : formatarMoeda(custo)}
          </span>
          <div class="controle-qtd-av-drawer">
            <button type="button" class="btn-av-drawer-step btn-av-menos" aria-label="Remover 1">−</button>
            <span class="qtd-av-drawer-num">${qtdSel}</span>
            <button type="button" class="btn-av-drawer-step btn-av-mais" aria-label="Adicionar 1">+</button>
          </div>
        </div>
      `;

      const elNum = card.querySelector(".qtd-av-drawer-num");
      const elSub = card.querySelector(`[data-sub-av="${item.id}"]`);

      const atualizarQtdItem = (delta) => {
        const atual = aviamentosSelecionados.get(item.id)?.quantidade || 0;
        const prox = Math.max(0, atual + delta);
        if (prox === 0) {
          aviamentosSelecionados.delete(item.id);
        } else {
          aviamentosSelecionados.set(item.id, { item, quantidade: prox });
        }
        if (elNum) elNum.textContent = prox;
        if (elSub) elSub.textContent = prox > 0 ? formatarMoeda(custo * prox) : formatarMoeda(custo);
        atualizarTotalDrawerAviamentos();
      };

      card.querySelector(".btn-av-menos")?.addEventListener("click", () => atualizarQtdItem(-1));
      card.querySelector(".btn-av-mais")?.addEventListener("click", () => atualizarQtdItem(1));

      frag.appendChild(card);
    });
    lista.appendChild(frag);
  }

  // ==========================================================================
  // PARTE 3: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================

  function vincularEventos() {
    const btnEstoque = document.getElementById("btn-estoque-precificacao");
    const btnGaveta = document.getElementById("btn-abrir-gaveta-estoque");
    const btnFecharDrawer = document.getElementById("btn-fechar-drawer-estoque");
    const overlayDrawer = document.getElementById("drawer-overlay-estoque");
    const buscaDrawer = document.getElementById("busca-drawer-estoque");

    // Botão Estoque no Cabeçalho
    if (btnEstoque) {
      btnEstoque.addEventListener("click", () => alternarModoEstoque());
    }

    // Botão Consultar Fios
    if (btnGaveta) {
      btnGaveta.addEventListener("click", abrirDrawerEstoque);
    }

    // Fechar Drawer
    if (btnFecharDrawer) {
      btnFecharDrawer.addEventListener("click", fecharDrawerEstoque);
    }

    if (overlayDrawer) {
      overlayDrawer.addEventListener("click", (e) => {
        if (e.target === overlayDrawer) fecharDrawerEstoque();
      });
    }

    // Busca nos Drawers com debounce leve
    if (buscaDrawer) {
      const buscarFiosDeb =
        typeof BancoDadosPT !== "undefined"
          ? BancoDadosPT.debounce((val) => renderizarListaDrawerEstoque(val), 80)
          : (val) => renderizarListaDrawerEstoque(val);
      buscaDrawer.addEventListener("input", (e) => buscarFiosDeb(e.target.value));
    }

    // Botões Principais da Calculadora
    const btnAdicionarLinha = document.getElementById("btn-adicionar-linha");
    const btnCalcularPrecificacao = document.getElementById("btn-calcular-precificacao");
    const btnLimparPrecificacao = document.getElementById("btn-limpar-precificacao");
    const inputHorasGastas = document.getElementById("input-horas-gastas");
    const inputValorHora = document.getElementById("input-valor-hora");
    const inputValorAcessorios = document.getElementById("input-valor-acessorios");
    const inputMargemLucro = document.getElementById("input-margem-lucro");
    const sliderMargemLucro = document.getElementById("slider-margem-lucro");
    const displayMargemLucro = document.getElementById("display-margem-lucro");

    // Sincronização Slider <-> Input Margem de Lucro
    if (sliderMargemLucro && inputMargemLucro) {
      sliderMargemLucro.addEventListener("input", () => {
        inputMargemLucro.value = sliderMargemLucro.value;
        if (displayMargemLucro) {
          displayMargemLucro.textContent = `${sliderMargemLucro.value}%`;
        }
        calcularPrecificacao();
      });

      inputMargemLucro.addEventListener("input", () => {
        let val = parseFloat(inputMargemLucro.value);
        if (isNaN(val) || val < 0) val = 0;
        sliderMargemLucro.value = Math.min(200, val);
        if (displayMargemLucro) {
          displayMargemLucro.textContent = `${val}%`;
        }
        calcularPrecificacao();
      });
    }

    // Inputs de Mão de Obra e Custos Extras
    if (inputHorasGastas) inputHorasGastas.addEventListener("input", () => calcularPrecificacao());
    if (inputValorHora) inputValorHora.addEventListener("input", () => calcularPrecificacao());
    if (inputValorAcessorios) inputValorAcessorios.addEventListener("input", () => calcularPrecificacao());

    // Ações de Rodapé
    if (btnAdicionarLinha) btnAdicionarLinha.addEventListener("click", () => adicionarLinha());
    if (btnCalcularPrecificacao) btnCalcularPrecificacao.addEventListener("click", copiarOrcamento);
    if (btnLimparPrecificacao) btnLimparPrecificacao.addEventListener("click", limparCampos);

    // Tecla ESC fecha os Drawers se abertos
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const overlay = document.getElementById("drawer-overlay-estoque");
        if (overlay && overlay.style.display !== "none") {
          fecharDrawerEstoque();
        }
        const overlayAv = document.getElementById("drawer-overlay-aviamentos");
        if (overlayAv && overlayAv.style.display !== "none") {
          fecharDrawerAviamentos();
        }
      }
    });

    // Eventos do Drawer de Aviamentos (Integração com Agulhas e Acessórios)
    const btnPuxarAviamentos = document.getElementById("btn-puxar-aviamentos-precificacao");
    const btnFecharDrawerAv = document.getElementById("btn-fechar-drawer-aviamentos");
    const overlayDrawerAv = document.getElementById("drawer-overlay-aviamentos");
    const buscaDrawerAv = document.getElementById("busca-drawer-aviamentos");
    const btnAplicarAv = document.getElementById("btn-aplicar-aviamentos-drawer");

    if (btnPuxarAviamentos) {
      btnPuxarAviamentos.addEventListener("click", abrirDrawerAviamentos);
    }
    if (btnFecharDrawerAv) {
      btnFecharDrawerAv.addEventListener("click", fecharDrawerAviamentos);
    }
    if (overlayDrawerAv) {
      overlayDrawerAv.addEventListener("click", (e) => {
        if (e.target === overlayDrawerAv) fecharDrawerAviamentos();
      });
    }
    if (buscaDrawerAv) {
      const buscarAvDeb =
        typeof BancoDadosPT !== "undefined"
          ? BancoDadosPT.debounce((val) => renderizarListaDrawerAviamentos(val), 80)
          : (val) => renderizarListaDrawerAviamentos(val);
      buscaDrawerAv.addEventListener("input", (e) => buscarAvDeb(e.target.value));
    }
    if (btnAplicarAv) {
      btnAplicarAv.addEventListener("click", () => aplicarAviamentosNaPrecificacao(true));
    }

    // Atualiza cache de aviamentos quando houver alterações em Agulhas e Acessórios
    window.addEventListener("ponto-trama:biblioteca-atualizada", () => {
      obterAviamentosDoInventario();
    });

    // Configura eventos para as linhas já existentes no HTML
    const listaLinhas = document.getElementById("lista-linhas");
    if (listaLinhas) {
      const itensIniciais = listaLinhas.querySelectorAll(".item-linha");
      itensIniciais.forEach((item) => configurarEventosItemLinha(item));
      atualizarBotoesRemover();
    }
  }

  function aplicarConfiguracoesNaPrecificacao(sobrescreverSeVazio = true) {
    if (typeof Configuracoes === "undefined") return;
    const simbolo = typeof Configuracoes.obterSimboloMoeda === "function" ? Configuracoes.obterSimboloMoeda() : "R$";
    document.querySelectorAll("#secao-precificacao .prefixo-input").forEach((el) => {
      el.textContent = simbolo;
    });

    const inpValHora = document.getElementById("input-valor-hora");
    const valHoraPadrao = Configuracoes.obter("valorHoraPadrao");
    if (inpValHora) {
      if (valHoraPadrao !== "" && Number(valHoraPadrao) >= 0) {
        if (!sobrescreverSeVazio || !inpValHora.value) {
          inpValHora.value = Number(valHoraPadrao) > 0 ? Number(valHoraPadrao).toFixed(2) : "";
        }
      } else if (!sobrescreverSeVazio) {
        inpValHora.value = "";
      }
    }

    const margemPadrao = Configuracoes.obter("margemPadrao");
    const inpMargem = document.getElementById("input-margem-lucro");
    const sliderMargem = document.getElementById("slider-margem-lucro");
    const dispMargem = document.getElementById("display-margem-lucro");
    if (inpMargem && margemPadrao !== undefined && margemPadrao !== "") {
      if (!sobrescreverSeVazio || inpMargem.value === "30" || inpMargem.value === "") {
        inpMargem.value = margemPadrao;
        if (sliderMargem) sliderMargem.value = Math.min(200, Number(margemPadrao) || 30);
        if (dispMargem) dispMargem.textContent = `${margemPadrao}%`;
      }
    }
  }

  // Inicialização do módulo
  async function init() {
    vincularEventos();

    // Injeta botão "📄 Ficha / Orçamento PDF" ao lado de Copiar Orçamento
    const btnCopiar = document.getElementById("btn-copiar-orcamento");
    if (btnCopiar && !document.getElementById("btn-gerar-pdf-orcamento")) {
      const btnPdf = document.createElement("button");
      btnPdf.type = "button";
      btnPdf.id = "btn-gerar-pdf-orcamento";
      btnPdf.className = "btn-acao-secundaria-prec";
      btnPdf.style.marginLeft = "8px";
      btnPdf.title = "Gerar Ficha Técnica e Orçamento em PDF pronto para imprimir ou enviar no WhatsApp";
      btnPdf.innerHTML = "📄 Gerar PDF";
      btnPdf.addEventListener("click", () => {
        if (typeof HistoricoAcoes === "undefined") return;
        const nomePeca = document.getElementById("input-nome-peca")?.value?.trim() || "Peça Artesanal Sob Encomenda";
        const horas = document.getElementById("input-horas-trabalhadas")?.value || "0";
        const infoLinhas = calcularSubtotalLinhas();
        const fiosDesc = (infoLinhas.listaDiscriminada || []).map((l) => `${l.nome}: ${formatarMoeda(l.custo)}`);
        const parseMoedaTxt = (id) => {
          const t = document.getElementById(id)?.textContent || "0";
          return Number(t.replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
        };
        HistoricoAcoes.gerarFichaOrcamentoPDF({
          nomePeca,
          tempoFmt: `${horas}h dedicadas`,
          fios: fiosDesc,
          custoMateriais: parseMoedaTxt("valor-custo-materiais"),
          custoMaoObra: parseMoedaTxt("valor-mao-de-obra"),
          precoFinal: parseMoedaTxt("valor-preco-final")
        });
      });
      btnCopiar.parentNode.insertBefore(btnPdf, btnCopiar.nextSibling);
    }

    // Carrega o estoque de fios e aviamentos em background
    await obterFiosDoInventario();
    await obterAviamentosDoInventario();
    atualizarDatalistFios();

    // Restaura preferência salva de modo estoque (se houver)
    let modoSalvo = false;
    try {
      modoSalvo = localStorage.getItem("ponto_trama_modo_estoque") === "true";
    } catch {
      modoSalvo = false;
    }

    if (modoSalvo) {
      alternarModoEstoque(true);
    }

    aplicarConfiguracoesNaPrecificacao(true);

    window.addEventListener("ponto-trama:configuracoes-atualizadas", () => {
      aplicarConfiguracoesNaPrecificacao(false);
      calcularPrecificacao(false);
    });

    window.addEventListener("ponto-trama:fios-atualizados", async () => {
      await obterFiosDoInventario();
      atualizarDatalistFios();
    });

    window.addEventListener("ponto-trama:biblioteca-atualizada", async () => {
      await obterAviamentosDoInventario();
    });

    const projAtivo = typeof ProjetoContexto !== "undefined" ? ProjetoContexto.obterProjetoAtivo() : null;
    if (projAtivo) {
      carregarDoProjeto(projAtivo);
    } else {
      // Cálculo inicial
      calcularPrecificacao(false);
    }
  }

  return {
    init,
    carregarDoProjeto,
    calcularPrecificacao,
    adicionarLinha,
    removerLinha,
    limparCampos,
    copiarOrcamento,
    alternarModoEstoque,
    abrirDrawerEstoque,
    fecharDrawerEstoque
  };
})();
