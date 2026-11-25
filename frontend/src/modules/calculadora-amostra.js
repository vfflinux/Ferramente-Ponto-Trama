// ==========================================================================
// PONTO & TRAMA - FERRAMENTA: CALCULADORA DE AMOSTRA (TENSÃO DO PONTO)
// Arquitetura mobile-first com 2 modos (Por Medida / Adaptar Receita),
// Modo Avançado integrado ao Inventário de Fios, Agulhas e Banco de Amostras,
// conversão cm <-> pol, visualização proporcional da amostra, fita métrica
// elástica, contador rolante (count-up), estimativa de consumo e salvamento.
// ==========================================================================

const CalculadoraAmostra = (() => {
  const DB_NOME = "PontoETramaDB";
  const DB_VERSAO = 3;
  const STORE_FIOS = "fios";
  const STORE_BIBLIOTECA = "itens_biblioteca";
  const STORE_AMOSTRAS = "banco_amostras";

  const STORAGE_SALVAS = "ponto_trama_amostras_salvas";
  const STORAGE_MODO_AVANCADO = "ponto_trama_amostra_modo_avancado";
  const STORAGE_PONTOS_CUSTOM = "ponto_trama_pontos_custom_amostra";
  const CM_POR_POLEGADA = 2.54;

  // Pontos-base padrão (Crochê -> Ponto Baixo | Tricô -> Ponto Malha)
  const PONTOS_BASE_PADRAO = [
    { id: "padrao:croche-ponto-baixo", nome: "Ponto Baixo (Base Crochê)", tecnica: "croche", fatorConsumo: 1.0, padrao: true },
    { id: "padrao:trico-ponto-malha", nome: "Ponto Malha (Base Tricô)", tecnica: "trico", fatorConsumo: 0.78, padrao: true }
  ];

  // Estado interno
  let modoAtual = "medida"; // 'medida' | 'receita'
  let unidadeAtual = "cm"; // 'cm' | 'pol'
  let modoAvancadoAtivo = false;
  let tecnicaAtiva = "croche"; // 'croche' | 'trico'
  let pontoSelecionadoId = "padrao:croche-ponto-baixo";

  // Caches integrados do IndexedDB
  let fiosInventario = [];
  let agulhasInventario = [];
  let bancoAmostrasCache = [];
  let pontosCustomLista = [];

  let fioSelecionado = null;
  let agulhaSelecionada = null;
  let amostraBancoSelecionada = null;

  let ultimoResultado = {
    valido: false,
    pontosInt: 0,
    carreirasInt: 0,
    pontosExato: 0,
    carreirasExato: 0,
    ptsPorUnidade: 0,
    carrPorUnidade: 0,
    diagnostico: "",
    consumo: null
  };

  // Controle de animação de Count-up
  const animacaoValores = {
    pontos: { atual: 0, rafId: null },
    carreiras: { atual: 0, rafId: null }
  };

  let timerToast = null;
  let amostrasSalvas = [];
  let jaInicializado = false;

  // ==========================================================================
  // PARTE 1: INTEGRAÇÃO COM INDEXEDDB (FIOS, AGULHAS E BANCO DE AMOSTRAS)
  // ==========================================================================

  function lerStoreDB(storeName) {
    if (typeof BancoDadosPT === "undefined") return Promise.resolve([]);
    return BancoDadosPT.obterTodos(storeName);
  }

  async function sincronizarDadosIntegrados() {
    const [fios, bib, amostras] = await Promise.all([
      lerStoreDB(STORE_FIOS),
      lerStoreDB(STORE_BIBLIOTECA),
      lerStoreDB(STORE_AMOSTRAS)
    ]);

    fiosInventario = fios || [];
    agulhasInventario = (bib || []).filter((i) => i.categoria === "agulha");
    bancoAmostrasCache = amostras || [];

    popularSelectFios();
    popularSelectAgulhas();
    popularSelectPontosBase();
    atualizarTarjaMateriaisAvancado();

    if (modoAvancadoAtivo) {
      calcularTensaodoPonto(false);
    }
  }

  function carregarPontosCustomLista() {
    try {
      const raw = localStorage.getItem(STORAGE_PONTOS_CUSTOM);
      pontosCustomLista = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(pontosCustomLista)) pontosCustomLista = [];
    } catch {
      pontosCustomLista = [];
    }
    renderizarChipsPontosCustom();
  }

  function salvarPontosCustomLista() {
    try {
      localStorage.setItem(STORAGE_PONTOS_CUSTOM, JSON.stringify(pontosCustomLista));
    } catch {
      // ignora
    }
    popularSelectPontosBase();
    renderizarChipsPontosCustom();
  }

  function popularSelectFios() {
    const select = document.getElementById("avancado-select-fio");
    if (!select) return;
    const valAtual = select.value;

    select.innerHTML = '<option value="">Selecionar fio do estoque...</option>';
    fiosInventario.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = String(f.id);
      const texTxt = f.tex ? ` • TEX ${f.tex}` : "";
      opt.textContent = `${f.nome} - ${f.cor_nome || "Sem cor"} (${f.marca || "Marca"})${texTxt}`;
      if (String(f.id) === valAtual) opt.selected = true;
      select.appendChild(opt);
    });

    fioSelecionado = fiosInventario.find((f) => String(f.id) === select.value) || null;
  }

  function popularSelectAgulhas() {
    const select = document.getElementById("avancado-select-agulha");
    if (!select) return;
    const valAtual = select.value;

    select.innerHTML = '<option value="">Selecionar agulha cadastrada...</option>';
    agulhasInventario.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = String(a.id);
      const mm = a.atributos?.espessura_mm ? `${a.atributos.espessura_mm}mm` : "";
      const tipo = a.atributos?.tipo || "";
      opt.textContent = `${a.nome}${mm ? ` (${mm})` : ""}${tipo ? ` • ${tipo}` : ""}`;
      if (String(a.id) === valAtual) opt.selected = true;
      select.appendChild(opt);
    });

    agulhaSelecionada = agulhasInventario.find((a) => String(a.id) === select.value) || null;
  }

  function popularSelectPontosBase() {
    const select = document.getElementById("avancado-select-ponto");
    if (!select) return;

    select.innerHTML = "";

    // Grupo 1: Pontos-Base Padrão (Crochê = Ponto Baixo / Tricô = Ponto Malha)
    const grpPadrao = document.createElement("optgroup");
    grpPadrao.label = "Base Padrão";
    PONTOS_BASE_PADRAO.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.nome;
      grpPadrao.appendChild(opt);
    });
    select.appendChild(grpPadrao);

    // Grupo 2: Outros Pontos da Listinha Personalizada
    if (pontosCustomLista.length > 0) {
      const grpCustom = document.createElement("optgroup");
      grpCustom.label = "Minha Listinha de Pontos";
      pontosCustomLista.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.nome} (${p.tecnica === "trico" ? "Tricô" : "Crochê"})`;
        grpCustom.appendChild(opt);
      });
      select.appendChild(grpCustom);
    }

    // Grupo 3: Modelos Salvos no Banco de Amostras
    if (bancoAmostrasCache.length > 0) {
      const grpBanco = document.createElement("optgroup");
      grpBanco.label = "Banco de Amostras";
      bancoAmostrasCache.forEach((am) => {
        const opt = document.createElement("option");
        opt.value = `banco:${am.id}`;
        const cons = am.peso_g ? ` • ${am.peso_g}g` : am.metros ? ` • ${am.metros}m` : "";
        opt.textContent = `${am.nome} (${am.pontos}×${am.carreiras} • ${am.agulha_mm}mm${cons})`;
        grpBanco.appendChild(opt);
      });
      select.appendChild(grpBanco);
    }

    // Restaura seleção se existir, senão usa base da técnica ativa
    const opcoesValidas = Array.from(select.options).map((o) => o.value);
    if (opcoesValidas.includes(pontoSelecionadoId)) {
      select.value = pontoSelecionadoId;
    } else {
      pontoSelecionadoId = tecnicaAtiva === "trico" ? "padrao:trico-ponto-malha" : "padrao:croche-ponto-baixo";
      select.value = pontoSelecionadoId;
    }

    sincronizarModeloSelecionado(false);
  }

  function sincronizarModeloSelecionado(preencherMedidas = false) {
    const select = document.getElementById("avancado-select-ponto");
    if (!select) return;
    pontoSelecionadoId = select.value;

    if (pontoSelecionadoId.startsWith("banco:")) {
      const idNum = Number(pontoSelecionadoId.replace("banco:", ""));
      amostraBancoSelecionada = bancoAmostrasCache.find((a) => Number(a.id) === idNum) || null;
      if (amostraBancoSelecionada) {
        atualizarBotoesTecnica(amostraBancoSelecionada.tecnica || "croche", false);
        if (preencherMedidas) {
          aplicarMedidasDeAmostraBanco(amostraBancoSelecionada);
        }
      }
    } else {
      amostraBancoSelecionada = null;
      const itemPonto =
        PONTOS_BASE_PADRAO.find((p) => p.id === pontoSelecionadoId) ||
        pontosCustomLista.find((p) => p.id === pontoSelecionadoId);
      if (itemPonto) {
        atualizarBotoesTecnica(itemPonto.tecnica, false);
      }
    }

    atualizarTarjaMateriaisAvancado();
  }

  function aplicarMedidasDeAmostraBanco(amostra) {
    if (!amostra) return;
    if (unidadeAtual !== "cm") alternarUnidade("cm");

    const setV = (id, v) => {
      const el = document.getElementById(id);
      if (el && v !== undefined && v !== null) el.value = v;
    };

    setV("amostra-largura", amostra.largura_cm || 10);
    setV("amostra-altura", amostra.altura_cm || 10);
    setV("amostra-pontos", amostra.pontos);
    setV("amostra-carreiras", amostra.carreiras);

    // Tenta vincular automaticamente o fio e agulha dos inventários se existirem
    if (amostra.fio && fiosInventario.length > 0) {
      const termoFio = amostra.fio.toLowerCase();
      const matchFio = fiosInventario.find((f) => {
        const rot = `${f.nome} (${f.marca || ""})`.toLowerCase();
        return rot.includes(termoFio) || termoFio.includes((f.nome || "").toLowerCase());
      });
      if (matchFio) {
        fioSelecionado = matchFio;
        const selFio = document.getElementById("avancado-select-fio");
        if (selFio) selFio.value = String(matchFio.id);
      }
    }

    if (amostra.agulha_mm && agulhasInventario.length > 0) {
      const matchAg = agulhasInventario.find(
        (a) => Number(a.atributos?.espessura_mm) === Number(amostra.agulha_mm)
      );
      if (matchAg) {
        agulhaSelecionada = matchAg;
        const selAg = document.getElementById("avancado-select-agulha");
        if (selAg) selAg.value = String(matchAg.id);
      }
    }

    atualizarTarjaMateriaisAvancado();
  }

  function atualizarBotoesTecnica(novaTecnica, trocarPontoPadrao = true) {
    tecnicaAtiva = novaTecnica === "trico" ? "trico" : "croche";
    document.querySelectorAll(".pills-tecnica-avancado .btn-tec-av").forEach((btn) => {
      const ativo = btn.dataset.tecnica === tecnicaAtiva;
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });

    if (trocarPontoPadrao) {
      pontoSelecionadoId = tecnicaAtiva === "trico" ? "padrao:trico-ponto-malha" : "padrao:croche-ponto-baixo";
      const select = document.getElementById("avancado-select-ponto");
      if (select) select.value = pontoSelecionadoId;
      amostraBancoSelecionada = null;
      atualizarTarjaMateriaisAvancado();
      calcularTensaodoPonto(false);
    }
  }

  function atualizarTarjaMateriaisAvancado() {
    const tarja = document.getElementById("tarja-materiais-avancado");
    if (!tarja) return;

    const tags = [];
    if (fioSelecionado) {
      if (fioSelecionado.tex) tags.push(`<span class="tag-mat-av">🧵 TEX ${fioSelecionado.tex}</span>`);
      if (fioSelecionado.peso_novelo_g) tags.push(`<span class="tag-mat-av">⚖️ ${fioSelecionado.peso_novelo_g}g/nov</span>`);
      if (fioSelecionado.metragem_novelo_m) tags.push(`<span class="tag-mat-av">📏 ${fioSelecionado.metragem_novelo_m}m/nov</span>`);
      tags.push(`<span class="tag-mat-av">📦 Estoque: ${fioSelecionado.quantidade ?? 0} nov.</span>`);
    }
    if (agulhaSelecionada) {
      const mm = agulhaSelecionada.atributos?.espessura_mm;
      const mat = agulhaSelecionada.atributos?.material;
      tags.push(`<span class="tag-mat-av">🪡 ${mm ? `${mm}mm` : agulhaSelecionada.nome}${mat ? ` (${escapeHtml(mat)})` : ""}</span>`);
    }
    if (amostraBancoSelecionada) {
      const cons = [];
      if (amostraBancoSelecionada.peso_g) cons.push(`${amostraBancoSelecionada.peso_g}g`);
      if (amostraBancoSelecionada.metros) cons.push(`${amostraBancoSelecionada.metros}m`);
      tags.push(
        `<span class="tag-mat-av">📚 Modelo: ${escapeHtml(amostraBancoSelecionada.nome)}${cons.length ? ` (${cons.join(" / ")})` : ""}</span>`
      );
    }

    if (tags.length === 0) {
      tarja.style.display = "none";
      tarja.innerHTML = "";
    } else {
      tarja.innerHTML = tags.join("");
      tarja.style.display = "flex";
    }
  }

  function renderizarChipsPontosCustom() {
    const container = document.getElementById("chips-pontos-custom");
    if (!container) return;

    if (pontosCustomLista.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    container.innerHTML = "";

    pontosCustomLista.forEach((p) => {
      const chip = document.createElement("span");
      chip.className = "chip-ponto-custom";
      chip.innerHTML = `
        <span>${escapeHtml(p.nome)} (${p.tecnica === "trico" ? "Tricô" : "Crochê"})</span>
        <button type="button" title="Remover ponto da listinha" aria-label="Remover ${escapeHtml(p.nome)}">&times;</button>
      `;
      chip.querySelector("button")?.addEventListener("click", () => {
        pontosCustomLista = pontosCustomLista.filter((item) => item.id !== p.id);
        if (pontoSelecionadoId === p.id) {
          pontoSelecionadoId = tecnicaAtiva === "trico" ? "padrao:trico-ponto-malha" : "padrao:croche-ponto-baixo";
        }
        salvarPontosCustomLista();
        calcularTensaodoPonto(false);
      });
      container.appendChild(chip);
    });
  }

  function alternarModoAvancado(forcarEstado = null) {
    modoAvancadoAtivo = forcarEstado !== null ? Boolean(forcarEstado) : !modoAvancadoAtivo;

    const btn = document.getElementById("btn-modo-avancado-amostra");
    const badge = document.getElementById("badge-modo-avancado-amostra");
    const painel = document.getElementById("painel-modo-avancado-amostra");

    if (btn) {
      btn.classList.toggle("ativo", modoAvancadoAtivo);
      btn.setAttribute("aria-pressed", modoAvancadoAtivo ? "true" : "false");
    }
    if (badge) badge.textContent = modoAvancadoAtivo ? "On" : "Off";
    if (painel) painel.style.display = modoAvancadoAtivo ? "flex" : "none";

    try {
      localStorage.setItem(STORAGE_MODO_AVANCADO, modoAvancadoAtivo ? "true" : "false");
    } catch {
      // ignora
    }

    if (modoAvancadoAtivo) {
      sincronizarDadosIntegrados();
    } else {
      calcularTensaodoPonto(false);
    }
  }

  // ==========================================================================
  // PARTE 2: OPERAÇÕES E LÓGICA (Fórmulas de Tensão + Consumo de Fio)
  // ==========================================================================

  function lerNumero(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const val = parseFloat(String(el.value).replace(",", "."));
    return isNaN(val) ? NaN : val;
  }

  function formatarDecimal(valor, casas = 2) {
    const n = Number(valor) || 0;
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas
    });
  }

  function formatarMedidaLimpa(valor) {
    const n = Number(valor) || 0;
    return Number(n.toFixed(2)).toString();
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

  function baseReferenciaReceita() {
    return unidadeAtual === "cm" ? 10 : 4;
  }

  function obterObjetoPontoAtivo() {
    return (
      PONTOS_BASE_PADRAO.find((p) => p.id === pontoSelecionadoId) ||
      pontosCustomLista.find((p) => p.id === pontoSelecionadoId) ||
      PONTOS_BASE_PADRAO[0]
    );
  }

  function calcularEstimativaConsumoFio(largAm, altAm, ptsPorUn, carrPorUn, pontosExato, carreirasExato) {
    const deveCalcular = modoAvancadoAtivo || Boolean(amostraBancoSelecionada);
    if (!deveCalcular) return null;

    const fatorCm = unidadeAtual === "pol" ? CM_POR_POLEGADA : 1;
    const largAmCm = largAm * fatorCm;
    const altAmCm = altAm * fatorCm;
    const areaAmostraCm2 = largAmCm * altAmCm;

    // Calcula área total da peça em cm²
    let largPecaCm = 0;
    let altPecaCm = 0;

    if (modoAtual === "medida") {
      largPecaCm = (lerNumero("meta-largura") || 0) * fatorCm;
      altPecaCm = (lerNumero("meta-altura") || 0) * fatorCm;
    } else {
      if (ptsPorUn > 0 && pontosExato > 0) largPecaCm = (pontosExato / ptsPorUn) * fatorCm;
      if (carrPorUn > 0 && carreirasExato > 0) altPecaCm = (carreirasExato / carrPorUn) * fatorCm;
    }

    const areaPecaCm2 = largPecaCm * altPecaCm;
    if (!(areaPecaCm2 > 0) || !(areaAmostraCm2 > 0)) {
      return { incompleto: true };
    }

    // Propriedades do fio selecionado no inventário
    const pesoNovelo = Number(fioSelecionado?.peso_novelo_g) || 0;
    const metragemNovelo = Number(fioSelecionado?.metragem_novelo_m) || 0;
    const texFio =
      Number(fioSelecionado?.tex) ||
      (pesoNovelo > 0 && metragemNovelo > 0 ? (pesoNovelo / metragemNovelo) * 1000 : 500);

    let gramas = 0;
    let metros = 0;
    let origem = "Estimativa pelo Ponto Base";

    // Caso 1: Amostra do Banco possui peso (g) ou metragem (m) reais!
    const temPesoReal = amostraBancoSelecionada && Number(amostraBancoSelecionada.peso_g) > 0;
    const temMetrosReal = amostraBancoSelecionada && Number(amostraBancoSelecionada.metros) > 0;

    if (temPesoReal || temMetrosReal) {
      const fatorArea = areaPecaCm2 / areaAmostraCm2;
      origem = `Amostra Real (${amostraBancoSelecionada.nome})`;
      if (temPesoReal) gramas = Number(amostraBancoSelecionada.peso_g) * fatorArea;
      if (temMetrosReal) metros = Number(amostraBancoSelecionada.metros) * fatorArea;

      if (!temMetrosReal && gramas > 0 && texFio > 0) {
        metros = (gramas * 1000) / texFio;
      } else if (!temPesoReal && metros > 0 && texFio > 0) {
        gramas = (metros * texFio) / 1000;
      }
    } else {
      // Caso 2: Estimativa baseada no Fio (TEX), Agulha (mm) e Ponto Base (Crochê: Ponto Baixo | Tricô: Ponto Malha)
      const pontoInfo = obterObjetoPontoAtivo();
      const fatorPonto = Number(pontoInfo?.fatorConsumo) || 1.0;
      const agulhaMm =
        Number(agulhaSelecionada?.atributos?.espessura_mm) ||
        Number(amostraBancoSelecionada?.agulha_mm) ||
        4.0;

      // Agulha mais grossa gera pontos mais abertos (menos metros por cm²); mais fina gera trama mais densa
      const fatorAgulha = Math.pow(4.0 / Math.max(1.75, Math.min(12.0, agulhaMm)), 0.35);
      // Referência têxtil: ~12m por 100cm² em Ponto Baixo (Crochê) com agulha 4.0mm
      const metrosPor100cm2 = 12.0 * fatorPonto * fatorAgulha;

      metros = (areaPecaCm2 / 100) * metrosPor100cm2;
      gramas = (metros * texFio) / 1000;
      origem = `${pontoInfo.nome.split(" (")[0]} • ${agulhaMm}mm`;
    }

    // Cálculo de novelos necessários (se fio selecionado tiver peso ou metragem por novelo)
    let novelosExatos = 0;
    if (pesoNovelo > 0 && gramas > 0) {
      novelosExatos = gramas / pesoNovelo;
    } else if (metragemNovelo > 0 && metros > 0) {
      novelosExatos = metros / metragemNovelo;
    } else if (gramas > 0) {
      novelosExatos = gramas / 100; // referência padrão 100g
    }

    const novelosArredondados = novelosExatos > 0 ? Math.ceil(novelosExatos) : 0;

    // Compara com o estoque atual do fio selecionado no inventário
    let statusEstoque = null;
    if (fioSelecionado && novelosExatos > 0) {
      const disponivel = Number(fioSelecionado.quantidade) || 0;
      if (disponivel >= novelosExatos) {
        statusEstoque = {
          ok: true,
          texto: `✅ Estoque suficiente: você tem ${formatarDecimal(disponivel, 1)} nov. de ${fioSelecionado.nome} (${fioSelecionado.cor_nome || ""}).`
        };
      } else {
        const falta = novelosExatos - disponivel;
        statusEstoque = {
          ok: false,
          texto: `⚠️ Estoque insuficiente: você tem ${formatarDecimal(disponivel, 1)} nov. (faltam ~${formatarDecimal(falta, 1)} nov. de ${fioSelecionado.nome}).`
        };
      }
    }

    return {
      incompleto: false,
      gramas,
      metros,
      novelosExatos,
      novelosArredondados,
      usaNoveloPadrao100g: !(pesoNovelo > 0 || metragemNovelo > 0),
      origem,
      statusEstoque
    };
  }

  function calcularTensaodoPonto(dispararValidacao = false) {
    limparErrosValidacao();

    const larguraAm = lerNumero("amostra-largura");
    const alturaAm = lerNumero("amostra-altura");
    const pontosAm = lerNumero("amostra-pontos");
    const carreirasAm = lerNumero("amostra-carreiras");

    const camposInvalidos = [];

    if (!(larguraAm > 0)) camposInvalidos.push("campo-amostra-largura");
    if (!(alturaAm > 0)) camposInvalidos.push("campo-amostra-altura");
    if (!(pontosAm > 0)) camposInvalidos.push("campo-amostra-pontos");

    const ptsPorUnidade = larguraAm > 0 && pontosAm > 0 ? pontosAm / larguraAm : 0;
    const carrPorUnidade = alturaAm > 0 && carreirasAm > 0 ? carreirasAm / alturaAm : 0;

    let pontosExato = 0;
    let carreirasExato = 0;
    let diagnostico = "";

    if (modoAtual === "medida") {
      const metaLarg = lerNumero("meta-largura");
      const metaAlt = lerNumero("meta-altura");

      if (!(metaLarg > 0) && !(metaAlt > 0)) {
        camposInvalidos.push("campo-meta-largura");
      }

      if (metaAlt > 0 && !(carreirasAm > 0)) {
        camposInvalidos.push("campo-amostra-carreiras");
      }

      if (ptsPorUnidade > 0 && metaLarg > 0) {
        pontosExato = ptsPorUnidade * metaLarg;
      }
      if (carrPorUnidade > 0 && metaAlt > 0) {
        carreirasExato = carrPorUnidade * metaAlt;
      }
    } else {
      // Modo 2: Adaptar Receita
      const baseRef = baseReferenciaReceita();
      const recPtsBase = lerNumero("receita-amostra-pontos");
      const recCarrBase = lerNumero("receita-amostra-carreiras");
      const recTotalPts = lerNumero("receita-total-pontos");
      const recTotalCarr = lerNumero("receita-total-carreiras");

      if (!(recPtsBase > 0)) camposInvalidos.push("campo-rec-amostra-pts");
      if (!(recTotalPts > 0)) camposInvalidos.push("campo-rec-total-pts");
      if (recTotalCarr > 0 && !(recCarrBase > 0)) camposInvalidos.push("campo-rec-amostra-carr");
      if (recTotalCarr > 0 && !(carreirasAm > 0)) camposInvalidos.push("campo-amostra-carreiras");

      if (ptsPorUnidade > 0 && recPtsBase > 0 && recTotalPts > 0) {
        const densidadeReceitaPts = recPtsBase / baseRef;
        const proporcaoPts = ptsPorUnidade / densidadeReceitaPts;
        pontosExato = recTotalPts * proporcaoPts;

        const diffPct = Math.round((proporcaoPts - 1) * 100);
        const diffPts = Math.round(pontosExato) - Math.round(recTotalPts);

        if (diffPct === 0) {
          diagnostico = `✨ <strong>Tensão alinhada!</strong> Sua amostra bate com a receita — mantenha os <strong>${Math.round(recTotalPts)} pts</strong> originais.`;
        } else if (diffPct > 0) {
          diagnostico = `🧶 Seu ponto está <strong>${diffPct}% mais apertado</strong> que o da receita. Aumente <strong>+${Math.abs(diffPts)} pts</strong> para manter o tamanho original da peça.`;
        } else {
          diagnostico = `🧶 Seu ponto está <strong>${Math.abs(diffPct)}% mais largo</strong> que o da receita. Reduza <strong>−${Math.abs(diffPts)} pts</strong> para a peça não ficar maior que o previsto.`;
        }
      }

      if (carrPorUnidade > 0 && recCarrBase > 0 && recTotalCarr > 0) {
        const densidadeReceitaCarr = recCarrBase / baseRef;
        carreirasExato = recTotalCarr * (carrPorUnidade / densidadeReceitaCarr);
      }
    }

    if (dispararValidacao && camposInvalidos.length > 0) {
      sinalizarErroGentil(camposInvalidos);
      return false;
    }

    const pontosInt = Math.round(pontosExato);
    const carreirasInt = Math.round(carreirasExato);

    const consumo = calcularEstimativaConsumoFio(
      larguraAm,
      alturaAm,
      ptsPorUnidade,
      carrPorUnidade,
      pontosExato,
      carreirasExato
    );

    ultimoResultado = {
      valido: pontosInt > 0 || carreirasInt > 0,
      pontosInt,
      carreirasInt,
      pontosExato,
      carreirasExato,
      ptsPorUnidade,
      carrPorUnidade,
      diagnostico,
      consumo
    };

    atualizarPainelResultados();
    atualizarVisualizacaoAmostraEFitas();
    atualizarTextoBotaoCalcular();

    return ultimoResultado.valido;
  }

  function alternarUnidade(novaUnidade) {
    if (novaUnidade !== "cm" && novaUnidade !== "pol") return;
    if (novaUnidade === unidadeAtual) return;

    const fator = novaUnidade === "pol" ? 1 / CM_POR_POLEGADA : CM_POR_POLEGADA;
    unidadeAtual = novaUnidade;

    const toggleWrap = document.getElementById("toggle-unidade-amostra");
    if (toggleWrap) {
      toggleWrap.classList.toggle("unidade-pol", unidadeAtual === "pol");
      toggleWrap.querySelectorAll(".btn-unidade-amostra").forEach((btn) => {
        const ativo = btn.dataset.unidade === unidadeAtual;
        btn.classList.toggle("ativo", ativo);
        btn.setAttribute("aria-pressed", ativo ? "true" : "false");
      });
    }

    const idsMedida = ["amostra-largura", "amostra-altura", "meta-largura", "meta-altura"];
    idsMedida.forEach((id) => {
      const input = document.getElementById(id);
      if (!input || input.value === "") return;
      const atual = parseFloat(input.value);
      if (!isNaN(atual) && atual > 0) {
        const convertido = atual * fator;
        const arredondado =
          unidadeAtual === "pol" && Math.abs(convertido - 4) < 0.08
            ? 4
            : unidadeAtual === "cm" && Math.abs(convertido - 10) < 0.2
              ? 10
              : Math.round(convertido * 10) / 10;
        input.value = arredondado;
      }
    });

    const novoPasso = unidadeAtual === "cm" ? "0.5" : "0.25";
    idsMedida.forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.step = novoPasso;
      document.querySelectorAll(`.btn-stepper-am[data-alvo="${id}"]`).forEach((btn) => {
        const sinal = parseFloat(btn.dataset.delta) < 0 ? -1 : 1;
        btn.dataset.delta = String(sinal * parseFloat(novoPasso));
      });
    });

    document.querySelectorAll("#secao-amostra .txt-unidade").forEach((el) => {
      el.textContent = unidadeAtual;
    });

    const badgePadrao = document.getElementById("badge-padrao-amostra");
    if (badgePadrao) {
      badgePadrao.textContent = unidadeAtual === "cm" ? "Padrão 10 × 10 cm" : "Padrão 4 × 4 pol";
    }

    const txtBase = document.getElementById("txt-base-receita");
    if (txtBase) txtBase.textContent = unidadeAtual === "cm" ? "10 cm" : "4 pol";
    document.querySelectorAll("#secao-amostra .txt-base-curta").forEach((el) => {
      el.textContent = unidadeAtual === "cm" ? "10cm" : "4pol";
    });

    calcularTensaodoPonto(false);
  }

  function alternarModo(novoModo) {
    if (novoModo !== "medida" && novoModo !== "receita") return;
    modoAtual = novoModo;

    const seletor = document.getElementById("seletor-modo-amostra");
    if (seletor) {
      seletor.classList.toggle("modo-receita", modoAtual === "receita");
      seletor.querySelectorAll(".btn-modo-amostra").forEach((btn) => {
        const ativo = btn.dataset.modo === modoAtual;
        btn.classList.toggle("ativo", ativo);
        btn.setAttribute("aria-selected", ativo ? "true" : "false");
      });
    }

    const blocoMedida = document.getElementById("campos-modo-medida");
    const blocoReceita = document.getElementById("campos-modo-receita");
    const tituloMeta = document.getElementById("titulo-card-meta");
    const subMeta = document.getElementById("subtitulo-card-meta");
    const descModo = document.getElementById("descricao-modo-amostra");
    const labelResPts = document.getElementById("label-res-pontos");
    const labelResCarr = document.getElementById("label-res-carreiras");

    if (modoAtual === "medida") {
      if (blocoMedida) blocoMedida.style.display = "flex";
      if (blocoReceita) blocoReceita.style.display = "none";
      if (tituloMeta) tituloMeta.textContent = "2. Sua Meta (Tamanho da Peça)";
      if (subMeta) subMeta.textContent = "Dimensões finais que você deseja alcançar";
      if (descModo) {
        descModo.textContent =
          "Informe sua amostra e o tamanho desejado da peça para descobrir quantos pontos e carreiras fazer.";
      }
      if (labelResPts) labelResPts.textContent = "PONTOS INICIAIS (BASE)";
      if (labelResCarr) labelResCarr.textContent = "CARREIRAS NECESSÁRIAS";
    } else {
      if (blocoMedida) blocoMedida.style.display = "none";
      if (blocoReceita) blocoReceita.style.display = "flex";
      if (tituloMeta) tituloMeta.textContent = "2. Dados da Receita Original";
      if (subMeta) subMeta.textContent = "Compare sua tensão com a da receita para ajustar a quantidade de pontos";
      if (descModo) {
        descModo.textContent =
          "A receita pede uma tensão diferente da sua? Informe os dados originais e calculamos a adaptação exata.";
      }
      if (labelResPts) labelResPts.textContent = "PONTOS ADAPTADOS";
      if (labelResCarr) labelResCarr.textContent = "CARREIRAS ADAPTADAS";
    }

    limparErrosValidacao();
    calcularTensaodoPonto(false);
  }

  function limparCampos() {
    const padrao = unidadeAtual === "cm" ? "10" : "4";
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };

    setVal("amostra-largura", padrao);
    setVal("amostra-altura", padrao);
    setVal("amostra-pontos", "");
    setVal("amostra-carreiras", "");
    setVal("meta-largura", "");
    setVal("meta-altura", "");
    setVal("receita-amostra-pontos", "");
    setVal("receita-amostra-carreiras", "");
    setVal("receita-total-pontos", "");
    setVal("receita-total-carreiras", "");

    limparErrosValidacao();
    calcularTensaodoPonto(false);
    mostrarToast("Campos limpos! Amostra resetada para o padrão.");
  }

  function carregarAmostrasSalvas() {
    try {
      const bruto = localStorage.getItem(STORAGE_SALVAS);
      amostrasSalvas = bruto ? JSON.parse(bruto) : [];
      if (!Array.isArray(amostrasSalvas)) amostrasSalvas = [];
    } catch {
      amostrasSalvas = [];
    }
    renderizarAmostrasSalvas();
  }

  function persistirAmostrasSalvas() {
    try {
      localStorage.setItem(STORAGE_SALVAS, JSON.stringify(amostrasSalvas));
    } catch {
      // ignora
    }
    window.dispatchEvent(
      new CustomEvent("ponto-trama:amostra-salva", {
        detail: { amostras: amostrasSalvas }
      })
    );
  }

  // ==========================================================================
  // PARTE 3: ANIMAÇÕES, VISUALIZAÇÃO E RESULTADOS
  // ==========================================================================

  function animarContadorRolante(elemento, valorFinal, chave) {
    if (!elemento) return;
    const estado = animacaoValores[chave];
    if (!estado) {
      elemento.textContent = String(valorFinal);
      return;
    }

    if (estado.rafId) {
      cancelAnimationFrame(estado.rafId);
      estado.rafId = null;
    }

    const valorInicial = estado.atual;
    if (valorInicial === valorFinal) {
      elemento.textContent = String(valorFinal);
      return;
    }

    const duracao = 210;
    const inicio = performance.now();

    function passo(agora) {
      const progresso = Math.min(1, (agora - inicio) / duracao);
      const eased = 1 - Math.pow(1 - progresso, 3);
      const corrente = Math.round(valorInicial + (valorFinal - valorInicial) * eased);
      elemento.textContent = String(corrente);

      if (progresso < 1) {
        estado.rafId = requestAnimationFrame(passo);
      } else {
        estado.atual = valorFinal;
        estado.rafId = null;
        elemento.textContent = String(valorFinal);
      }
    }

    estado.rafId = requestAnimationFrame(passo);
  }

  function atualizarPainelResultados() {
    const elPts = document.getElementById("resultado-amostra-pontos");
    const elCarr = document.getElementById("resultado-amostra-carreiras");
    const elExatoPts = document.getElementById("exato-amostra-pontos");
    const elExatoCarr = document.getElementById("exato-amostra-carreiras");
    const elDensPts = document.getElementById("densidade-pts-unidade");
    const elDensCarr = document.getElementById("densidade-carr-unidade");
    const boxDiag = document.getElementById("box-diagnostico-receita");
    const mostrarExato = Boolean(document.getElementById("check-valor-exato-amostra")?.checked);

    animarContadorRolante(elPts, ultimoResultado.pontosInt, "pontos");
    animarContadorRolante(elCarr, ultimoResultado.carreirasInt, "carreiras");

    if (elExatoPts) {
      elExatoPts.textContent = `Exato: ${formatarDecimal(ultimoResultado.pontosExato, 2)} pts`;
      elExatoPts.style.display = mostrarExato ? "block" : "none";
    }
    if (elExatoCarr) {
      elExatoCarr.textContent = `Exato: ${formatarDecimal(ultimoResultado.carreirasExato, 2)} carr`;
      elExatoCarr.style.display = mostrarExato ? "block" : "none";
    }

    if (elDensPts) {
      elDensPts.textContent =
        ultimoResultado.ptsPorUnidade > 0
          ? `${formatarDecimal(ultimoResultado.ptsPorUnidade, 2)} pts/${unidadeAtual}`
          : "—";
    }
    if (elDensCarr) {
      elDensCarr.textContent =
        ultimoResultado.carrPorUnidade > 0
          ? `${formatarDecimal(ultimoResultado.carrPorUnidade, 2)} carr/${unidadeAtual}`
          : "—";
    }

    if (boxDiag) {
      if (modoAtual === "receita" && ultimoResultado.diagnostico) {
        boxDiag.innerHTML = ultimoResultado.diagnostico;
        boxDiag.style.display = "block";
      } else {
        boxDiag.style.display = "none";
      }
    }

    // Bloco de Estimativa de Consumo de Fio (Modo Avançado)
    const blocoConsumo = document.getElementById("bloco-consumo-fio-amostra");
    const badgeOrigem = document.getElementById("badge-origem-consumo");
    const elGramas = document.getElementById("consumo-fio-gramas");
    const elMetros = document.getElementById("consumo-fio-metros");
    const elNovelos = document.getElementById("consumo-fio-novelos");
    const elStatusEst = document.getElementById("status-estoque-consumo");

    if (blocoConsumo) {
      const cons = ultimoResultado.consumo;
      if (!cons) {
        blocoConsumo.style.display = "none";
      } else {
        blocoConsumo.style.display = "flex";
        if (cons.incompleto) {
          if (badgeOrigem) badgeOrigem.textContent = "Aguardando medidas";
          if (elGramas) elGramas.textContent = "—";
          if (elMetros) elMetros.textContent = "—";
          if (elNovelos) elNovelos.textContent = "—";
          if (elStatusEst) {
            elStatusEst.className = "status-estoque-consumo aviso";
            elStatusEst.textContent = "Informe largura e altura da peça para estimar o consumo de fio.";
            elStatusEst.style.display = "block";
          }
        } else {
          if (badgeOrigem) badgeOrigem.textContent = cons.origem;
          if (elGramas) elGramas.textContent = `${Math.round(cons.gramas)} g`;
          if (elMetros) elMetros.textContent = `${Math.round(cons.metros)} m`;
          if (elNovelos) {
            elNovelos.textContent = `${cons.novelosArredondados} (${formatarDecimal(cons.novelosExatos, 1)})`;
          }
          if (elStatusEst) {
            if (cons.statusEstoque) {
              elStatusEst.className = `status-estoque-consumo ${cons.statusEstoque.ok ? "ok" : "aviso"}`;
              elStatusEst.textContent = cons.statusEstoque.texto;
              elStatusEst.style.display = "block";
            } else if (cons.usaNoveloPadrao100g) {
              elStatusEst.className = "status-estoque-consumo ok";
              elStatusEst.textContent = "💡 Referência de novelos baseada em 100g. Selecione um fio do inventário para cálculo exato.";
              elStatusEst.style.display = "block";
            } else {
              elStatusEst.style.display = "none";
            }
          }
        }
      }
    }
  }

  function atualizarVisualizacaoAmostraEFitas() {
    const largAm = Math.max(0, lerNumero("amostra-largura") || 0);
    const altAm = Math.max(0, lerNumero("amostra-altura") || 0);
    const ptsAm = Math.max(0, lerNumero("amostra-pontos") || 0);
    const carrAm = Math.max(0, lerNumero("amostra-carreiras") || 0);
    const metaLarg = Math.max(0, lerNumero("meta-largura") || 0);

    const quadrado = document.getElementById("preview-quadrado-trama");
    const txtLarg = document.getElementById("preview-txt-largura");
    const txtAlt = document.getElementById("preview-txt-altura");
    const centroTag = document.getElementById("preview-centro-tag");

    if (quadrado) {
      let w = 96;
      let h = 96;
      if (largAm > 0 && altAm > 0) {
        const razao = largAm / altAm;
        if (razao >= 1) {
          w = Math.min(122, Math.max(76, 92 * Math.min(razao, 1.45)));
          h = Math.max(66, Math.round(w / Math.min(razao, 1.55)));
        } else {
          h = Math.min(114, Math.max(76, 92 * Math.min(1 / razao, 1.4)));
          w = Math.max(66, Math.round(h * Math.max(razao, 0.65)));
        }
      }
      quadrado.style.width = `${w}px`;
      quadrado.style.height = `${h}px`;
    }

    if (txtLarg) {
      txtLarg.textContent = `${largAm > 0 ? formatarMedidaLimpa(largAm) : "—"} ${unidadeAtual} • ${ptsAm > 0 ? ptsAm : "—"} pts`;
    }
    if (txtAlt) {
      txtAlt.textContent = `${altAm > 0 ? formatarMedidaLimpa(altAm) : "—"} ${unidadeAtual} • ${carrAm > 0 ? carrAm : "—"} carr`;
    }
    if (centroTag) {
      centroTag.textContent = `${largAm > 0 ? formatarMedidaLimpa(largAm) : "—"} × ${altAm > 0 ? formatarMedidaLimpa(altAm) : "—"}`;
    }

    const maxFitaAm = unidadeAtual === "cm" ? 20 : 8;
    const pctAm = Math.min(100, Math.max(10, (largAm / maxFitaAm) * 100));
    const barraAm = document.getElementById("fita-amostra-barra");
    const valAm = document.getElementById("fita-amostra-valor");
    if (barraAm) barraAm.style.width = `${pctAm}%`;
    if (valAm) valAm.textContent = `${formatarMedidaLimpa(largAm)} ${unidadeAtual}`;

    const maxFitaMeta = unidadeAtual === "cm" ? 100 : 40;
    const pctMeta = metaLarg > 0 ? Math.min(100, Math.max(10, (metaLarg / maxFitaMeta) * 100)) : 8;
    const barraMeta = document.getElementById("fita-meta-barra");
    const valMeta = document.getElementById("fita-meta-valor");
    if (barraMeta) barraMeta.style.width = `${pctMeta}%`;
    if (valMeta) valMeta.textContent = `${formatarMedidaLimpa(metaLarg)} ${unidadeAtual}`;
  }

  function limparErrosValidacao() {
    document.querySelectorAll("#secao-amostra .campo-erro-amostra").forEach((el) => {
      el.classList.remove("campo-erro-amostra");
    });
    const aviso = document.getElementById("aviso-validacao-amostra");
    if (aviso) {
      aviso.style.display = "none";
      aviso.textContent = "";
    }
  }

  function sinalizarErroGentil(idsCampos, mensagem = null) {
    idsCampos.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("campo-erro-amostra");
      void el.offsetWidth;
      el.classList.add("campo-erro-amostra");
    });

    const primeiro = document.getElementById(idsCampos[0]);
    primeiro?.querySelector("input")?.focus();

    const aviso = document.getElementById("aviso-validacao-amostra");
    if (aviso) {
      aviso.textContent =
        mensagem ||
        "Preencha os campos destacados com valores maiores que zero para calcular sua tensão.";
      aviso.style.display = "block";
    }
  }

  function mostrarToast(mensagem) {
    const toast = document.getElementById("toast-amostra");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove("visivel"), 2400);
  }

  function atualizarTextoBotaoCalcular() {
    const btn = document.getElementById("btn-calcular-amostra");
    if (!btn) return;
    const mobile = window.innerWidth < 980;
    btn.innerHTML = mobile && ultimoResultado.valido ? "<span>✨ Ver Resultado ↓</span>" : "<span>✨ Calcular</span>";
  }

  function gerarTextoResumoResultado() {
    const largAm = formatarMedidaLimpa(lerNumero("amostra-largura") || 0);
    const altAm = formatarMedidaLimpa(lerNumero("amostra-altura") || 0);
    const ptsAm = lerNumero("amostra-pontos") || 0;
    const carrAm = lerNumero("amostra-carreiras") || 0;

    const linhas = [
      modoAtual === "medida"
        ? "🧶 Calculadora de Amostra - Ponto & Trama"
        : "🧶 Adaptação de Receita - Ponto & Trama",
      `Amostra: ${ptsAm} pts × ${carrAm || "—"} carr em ${largAm} × ${altAm} ${unidadeAtual}`
    ];

    if (modoAtual === "medida") {
      const metaL = formatarMedidaLimpa(lerNumero("meta-largura") || 0);
      const metaA = formatarMedidaLimpa(lerNumero("meta-altura") || 0);
      linhas.push(`Meta da peça: ${metaL} × ${metaA} ${unidadeAtual}`);
      linhas.push(`Resultado: ${ultimoResultado.pontosInt} pontos iniciais × ${ultimoResultado.carreirasInt} carreiras`);
    } else {
      const recPts = lerNumero("receita-total-pontos") || 0;
      const recCarr = lerNumero("receita-total-carreiras") || 0;
      linhas.push(`Receita original: ${recPts} pts${recCarr > 0 ? ` × ${recCarr} carr` : ""}`);
      linhas.push(`Adaptado: ${ultimoResultado.pontosInt} pontos × ${ultimoResultado.carreirasInt} carreiras`);
    }

    if (ultimoResultado.consumo && !ultimoResultado.consumo.incompleto) {
      const c = ultimoResultado.consumo;
      linhas.push(
        `Consumo estimado (${c.origem}): ~${Math.round(c.gramas)}g / ~${Math.round(c.metros)}m (${c.novelosArredondados} novelo(s))`
      );
    }

    return linhas.join("\n");
  }

  function copiarResultado() {
    if (!ultimoResultado.valido) {
      calcularTensaodoPonto(true);
      return;
    }

    const texto = gerarTextoResumoResultado();
    const btn = document.getElementById("btn-copiar-amostra");
    const icone = document.getElementById("icone-copiar-amostra");
    const txtBtn = document.getElementById("texto-btn-copiar-amostra");

    const aplicarAnimacaoCopiado = () => {
      if (btn && icone && txtBtn) {
        const svgOriginal = icone.innerHTML;
        btn.classList.add("copiado");
        icone.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        icone.classList.remove("animar-check");
        void icone.offsetWidth;
        icone.classList.add("animar-check");
        txtBtn.textContent = "Copiado!";

        setTimeout(() => {
          btn.classList.remove("copiado");
          icone.innerHTML = svgOriginal;
          icone.classList.remove("animar-check");
          txtBtn.textContent = "Copiar Resultado";
        }, 2000);
      }
      mostrarToast("✓ Resultado copiado para a área de transferência!");
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(aplicarAnimacaoCopiado).catch(aplicarAnimacaoCopiado);
    } else {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignora
      }
      ta.remove();
      aplicarAnimacaoCopiado();
    }
  }

  function abrirModalSalvar() {
    if (!ultimoResultado.valido) {
      calcularTensaodoPonto(true);
      return;
    }
    const modal = document.getElementById("modal-salvar-amostra");
    const resumo = document.getElementById("resumo-modal-salvar");
    const form = document.getElementById("form-salvar-amostra");
    const inputNotas = document.getElementById("input-notas-projeto-amostra");
    const checkBanco = document.getElementById("check-salvar-tambem-banco");
    const boxExtraBanco = document.getElementById("campos-extra-salvar-banco");
    const inputPontoBanco = document.getElementById("input-banco-ponto-rapido");
    const inputFioBanco = document.getElementById("input-banco-fio-rapido");
    const inputAgulhaBanco = document.getElementById("input-banco-agulha-rapido");

    if (form) form.reset();
    document.getElementById("campo-nome-projeto-amostra")?.classList.remove("campo-erro-amostra");

    if (checkBanco) checkBanco.checked = true;
    if (boxExtraBanco) boxExtraBanco.style.display = "flex";

    // Pré-preenche notas e campos do Banco de Amostras com dados do Modo Avançado
    if (inputNotas && (fioSelecionado || agulhaSelecionada)) {
      const p = [];
      if (fioSelecionado) p.push(fioSelecionado.nome);
      if (agulhaSelecionada) p.push(agulhaSelecionada.nome);
      inputNotas.value = p.join(" + ");
    }

    if (inputPontoBanco) {
      if (amostraBancoSelecionada) {
        inputPontoBanco.value = amostraBancoSelecionada.nome;
      } else {
        const pontoObj = obterObjetoPontoAtivo();
        inputPontoBanco.value = pontoObj ? pontoObj.nome.split(" (")[0] : "";
      }
    }

    if (inputFioBanco) {
      inputFioBanco.value = fioSelecionado
        ? `${fioSelecionado.nome}${fioSelecionado.marca ? ` (${fioSelecionado.marca})` : ""}`
        : amostraBancoSelecionada?.fio || "";
    }

    if (inputAgulhaBanco) {
      const mm = agulhaSelecionada?.atributos?.espessura_mm || amostraBancoSelecionada?.agulha_mm || "";
      inputAgulhaBanco.value = mm;
    }

    if (resumo) {
      const largAm = formatarMedidaLimpa(lerNumero("amostra-largura") || 0);
      const altAm = formatarMedidaLimpa(lerNumero("amostra-altura") || 0);
      const ptsAm = lerNumero("amostra-pontos") || 0;
      const carrAm = lerNumero("amostra-carreiras") || 0;
      let htmlResumo = `<strong>Tensão:</strong> ${ptsAm} pts × ${carrAm || "—"} carr (${largAm}×${altAm} ${unidadeAtual})<br><strong>Resultado:</strong> ${ultimoResultado.pontosInt} pontos × ${ultimoResultado.carreirasInt} carreiras`;
      if (ultimoResultado.consumo && !ultimoResultado.consumo.incompleto) {
        htmlResumo += `<br><strong>Consumo:</strong> ~${Math.round(ultimoResultado.consumo.gramas)}g / ~${Math.round(ultimoResultado.consumo.metros)}m`;
      }
      resumo.innerHTML = htmlResumo;
    }

    if (modal) modal.style.display = "flex";
    setTimeout(() => document.getElementById("input-nome-projeto-amostra")?.focus(), 80);
  }

  function fecharModalSalvar() {
    const modal = document.getElementById("modal-salvar-amostra");
    if (modal) modal.style.display = "none";
  }

  async function salvarAmostraProjeto(e) {
    e.preventDefault();
    const inputNome = document.getElementById("input-nome-projeto-amostra");
    const inputNotas = document.getElementById("input-notas-projeto-amostra");
    const nomeProjeto = (inputNome?.value || "").trim();

    if (!nomeProjeto) {
      const campo = document.getElementById("campo-nome-projeto-amostra");
      if (campo) {
        campo.classList.remove("campo-erro-amostra");
        void campo.offsetWidth;
        campo.classList.add("campo-erro-amostra");
      }
      inputNome?.focus();
      return;
    }

    const largAm = lerNumero("amostra-largura") || 10;
    const altAm = lerNumero("amostra-altura") || 10;
    const ptsAm = lerNumero("amostra-pontos") || 0;
    const carrAm = lerNumero("amostra-carreiras") || 0;

    const registro = {
      id: Date.now(),
      projeto: nomeProjeto,
      notas: (inputNotas?.value || "").trim(),
      modo: modoAtual,
      unidade: unidadeAtual,
      amostra: {
        largura: largAm,
        altura: altAm,
        pontos: ptsAm,
        carreiras: carrAm
      },
      meta: {
        largura: lerNumero("meta-largura") || 0,
        altura: lerNumero("meta-altura") || 0,
        recPtsBase: lerNumero("receita-amostra-pontos") || 0,
        recCarrBase: lerNumero("receita-amostra-carreiras") || 0,
        recTotalPts: lerNumero("receita-total-pontos") || 0,
        recTotalCarr: lerNumero("receita-total-carreiras") || 0
      },
      resultado: {
        pontos: ultimoResultado.pontosInt,
        carreiras: ultimoResultado.carreirasInt
      },
      consumo: ultimoResultado.consumo && !ultimoResultado.consumo.incompleto ? ultimoResultado.consumo : null,
      salvo_em: new Date().toISOString()
    };

    amostrasSalvas.unshift(registro);
    persistirAmostrasSalvas();
    renderizarAmostrasSalvas();

    // Se a opção estiver marcada, também cadastra no Banco de Amostras (IndexedDB)
    const salvarNoBanco = Boolean(document.getElementById("check-salvar-tambem-banco")?.checked);
    let salvouNoBanco = false;

    if (salvarNoBanco && typeof BancoDadosPT !== "undefined" && ptsAm > 0) {
      try {
        const fatorCm = unidadeAtual === "pol" ? CM_POR_POLEGADA : 1;
        const largCm = Math.round(largAm * fatorCm * 10) / 10;
        const altCm = Math.round(altAm * fatorCm * 10) / 10;

        const nomePontoBanco =
          (document.getElementById("input-banco-ponto-rapido")?.value || "").trim() || nomeProjeto;
        const fioBanco =
          (document.getElementById("input-banco-fio-rapido")?.value || "").trim() ||
          registro.notas ||
          "Fio não informado";
        const agulhaMmBanco = parseFloat(document.getElementById("input-banco-agulha-rapido")?.value) || 4.0;

        const novoModeloBanco = {
          nome: nomePontoBanco,
          tecnica: tecnicaAtiva || "croche",
          categoria: "basico",
          tensao: "medio",
          fio: fioBanco,
          agulha_mm: agulhaMmBanco,
          largura_cm: largCm > 0 ? largCm : 10,
          altura_cm: altCm > 0 ? altCm : 10,
          pontos: Math.round(ptsAm),
          carreiras: carrAm > 0 ? Math.round(carrAm) : 1,
          peso_g: null,
          metros: null,
          foto_url: "",
          link_referencia: "",
          anotacoes: `Cadastrado automaticamente pela Calculadora de Amostra (Projeto: ${nomeProjeto}).`,
          favorito: false,
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        };

        await BancoDadosPT.salvar(STORE_AMOSTRAS, novoModeloBanco);
        salvouNoBanco = true;

        window.dispatchEvent(
          new CustomEvent("ponto-trama:banco-amostras-atualizado", {
            detail: { origem: "calculadora" }
          })
        );
      } catch (err) {
        console.warn("Não foi possível cadastrar também no Banco de Amostras:", err);
      }
    }

    fecharModalSalvar();
    mostrarToast(
      salvouNoBanco
        ? `📌 Salvo em "${nomeProjeto}" e no Banco de Amostras!`
        : `📌 Amostra salva em "${nomeProjeto}"!`
    );
  }

  function carregarAmostraNoFormulario(registro) {
    if (!registro) return;
    if (registro.unidade && registro.unidade !== unidadeAtual) {
      alternarUnidade(registro.unidade);
    }
    if (registro.modo && registro.modo !== modoAtual) {
      alternarModo(registro.modo);
    }

    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v > 0 ? v : "";
    };

    setVal("amostra-largura", registro.amostra?.largura);
    setVal("amostra-altura", registro.amostra?.altura);
    setVal("amostra-pontos", registro.amostra?.pontos);
    setVal("amostra-carreiras", registro.amostra?.carreiras);
    setVal("meta-largura", registro.meta?.largura);
    setVal("meta-altura", registro.meta?.altura);
    setVal("receita-amostra-pontos", registro.meta?.recPtsBase);
    setVal("receita-amostra-carreiras", registro.meta?.recCarrBase);
    setVal("receita-total-pontos", registro.meta?.recTotalPts);
    setVal("receita-total-carreiras", registro.meta?.recTotalCarr);

    calcularTensaodoPonto(false);
    mostrarToast(`📂 Amostra "${registro.projeto}" carregada!`);
  }

  function renderizarAmostrasSalvas() {
    const bloco = document.getElementById("bloco-amostras-salvas");
    const lista = document.getElementById("lista-amostras-salvas");
    const qtdEl = document.getElementById("qtd-amostras-salvas");
    if (!bloco || !lista) return;

    if (amostrasSalvas.length === 0) {
      bloco.style.display = "none";
      lista.innerHTML = "";
      return;
    }

    bloco.style.display = "flex";
    if (qtdEl) qtdEl.textContent = String(amostrasSalvas.length);
    lista.innerHTML = "";

    amostrasSalvas.forEach((reg) => {
      const item = document.createElement("div");
      item.className = "item-amostra-salva";
      const resumo = `${reg.amostra?.pontos || 0}pts×${reg.amostra?.carreiras || 0}c → ${reg.resultado?.pontos || 0} pts / ${reg.resultado?.carreiras || 0} carr`;
      item.innerHTML = `
        <div class="info-amostra-salva" title="Clique para carregar esta amostra">
          <span class="nome-amostra-salva">${escapeHtml(reg.projeto)}${reg.notas ? ` • ${escapeHtml(reg.notas)}` : ""}</span>
          <span class="detalhe-amostra-salva">${escapeHtml(resumo)}</span>
        </div>
        <button type="button" class="btn-remover-salva" title="Remover amostra salva" aria-label="Remover ${escapeHtml(reg.projeto)}">&times;</button>
      `;

      item.querySelector(".info-amostra-salva")?.addEventListener("click", () => carregarAmostraNoFormulario(reg));
      item.querySelector(".btn-remover-salva")?.addEventListener("click", () => {
        amostrasSalvas = amostrasSalvas.filter((a) => a.id !== reg.id);
        persistirAmostrasSalvas();
        renderizarAmostrasSalvas();
      });

      lista.appendChild(item);
    });
  }

  // API pública chamada pelo Banco de Amostras ("Usar na Calculadora")
  async function carregarDoBancoDeAmostras(amostra) {
    if (!amostra) return;
    if (!jaInicializado) {
      await init();
    }
    if (!modoAvancadoAtivo) {
      alternarModoAvancado(true);
    }
    await sincronizarDadosIntegrados();

    pontoSelecionadoId = `banco:${amostra.id}`;
    const selPonto = document.getElementById("avancado-select-ponto");
    if (selPonto) selPonto.value = pontoSelecionadoId;

    amostraBancoSelecionada = amostra;
    atualizarBotoesTecnica(amostra.tecnica || "croche", false);
    aplicarMedidasDeAmostraBanco(amostra);
    calcularTensaodoPonto(false);
    mostrarToast(`📚 "${amostra.nome}" carregada na calculadora!`);
  }

  // ==========================================================================
  // PARTE 4: EVENTOS E INICIALIZAÇÃO
  // ==========================================================================

  function vincularEventos() {
    // 1. Toggle Modo Avançado
    document.getElementById("btn-modo-avancado-amostra")?.addEventListener("click", () => alternarModoAvancado());

    // Atalho para ir ao Banco de Amostras
    document.getElementById("btn-ir-banco-amostras")?.addEventListener("click", () => {
      const btnBanco = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="banco-amostras"]');
      if (btnBanco && typeof BarraLateral !== "undefined" && typeof BarraLateral.alternarFerramenta === "function") {
        BarraLateral.alternarFerramenta(btnBanco);
      }
    });

    // Selects do Modo Avançado (Fio, Agulha, Técnica, Ponto Base)
    document.getElementById("avancado-select-fio")?.addEventListener("change", (e) => {
      fioSelecionado = fiosInventario.find((f) => String(f.id) === e.target.value) || null;
      atualizarTarjaMateriaisAvancado();
      calcularTensaodoPonto(false);
    });

    document.getElementById("avancado-select-agulha")?.addEventListener("change", (e) => {
      agulhaSelecionada = agulhasInventario.find((a) => String(a.id) === e.target.value) || null;
      if (agulhaSelecionada) {
        const tipoAg = agulhaSelecionada.atributos?.tipo || "";
        if (tipoAg.startsWith("trico")) {
          atualizarBotoesTecnica("trico", !amostraBancoSelecionada);
        } else if (tipoAg === "croche") {
          atualizarBotoesTecnica("croche", !amostraBancoSelecionada);
        }
      }
      atualizarTarjaMateriaisAvancado();
      calcularTensaodoPonto(false);
    });

    document.querySelectorAll(".pills-tecnica-avancado .btn-tec-av").forEach((btn) => {
      btn.addEventListener("click", () => atualizarBotoesTecnica(btn.dataset.tecnica, true));
    });

    document.getElementById("avancado-select-ponto")?.addEventListener("change", () => {
      sincronizarModeloSelecionado(true);
      calcularTensaodoPonto(false);
    });

    // Mini-formulário "+ Adicionar ponto" na listinha
    const boxNovoPonto = document.getElementById("box-novo-ponto-rapido");
    document.getElementById("btn-toggle-novo-ponto-lista")?.addEventListener("click", () => {
      if (!boxNovoPonto) return;
      const aberto = boxNovoPonto.style.display === "flex";
      boxNovoPonto.style.display = aberto ? "none" : "flex";
      if (!aberto) {
        document.getElementById("select-novo-ponto-tecnica").value = tecnicaAtiva;
        document.getElementById("input-novo-ponto-nome")?.focus();
      }
    });

    document.getElementById("btn-cancelar-novo-ponto")?.addEventListener("click", () => {
      if (boxNovoPonto) boxNovoPonto.style.display = "none";
    });

    document.getElementById("btn-salvar-novo-ponto")?.addEventListener("click", () => {
      const inputNome = document.getElementById("input-novo-ponto-nome");
      const selTec = document.getElementById("select-novo-ponto-tecnica");
      const selCons = document.getElementById("select-novo-ponto-consumo");
      const nome = (inputNome?.value || "").trim();

      if (!nome) {
        inputNome?.focus();
        mostrarToast("Digite o nome do ponto para adicionar na listinha.");
        return;
      }

      const novoPonto = {
        id: `custom:${Date.now()}`,
        nome,
        tecnica: selTec?.value || "croche",
        fatorConsumo: parseFloat(selCons?.value) || 1.0
      };

      pontosCustomLista.push(novoPonto);
      pontoSelecionadoId = novoPonto.id;
      amostraBancoSelecionada = null;
      salvarPontosCustomLista();
      atualizarBotoesTecnica(novoPonto.tecnica, false);

      if (inputNome) inputNome.value = "";
      if (boxNovoPonto) boxNovoPonto.style.display = "none";

      calcularTensaodoPonto(false);
      mostrarToast(`✓ "${nome}" adicionado na listinha de pontos!`);
    });

    // 2. Abas de Modo (Sliding Pill)
    document.querySelectorAll("#seletor-modo-amostra .btn-modo-amostra").forEach((btn) => {
      btn.addEventListener("click", () => alternarModo(btn.dataset.modo));
    });

    // 3. Toggle de Unidade cm / pol (Sliding Pill)
    document.querySelectorAll("#toggle-unidade-amostra .btn-unidade-amostra").forEach((btn) => {
      btn.addEventListener("click", () => alternarUnidade(btn.dataset.unidade));
    });

    // 4. Steppers (- e +)
    document.querySelectorAll("#secao-amostra .btn-stepper-am").forEach((btn) => {
      btn.addEventListener("click", () => {
        const alvoId = btn.dataset.alvo;
        const delta = parseFloat(btn.dataset.delta) || 0;
        const input = document.getElementById(alvoId);
        if (!input) return;

        const min = parseFloat(input.min);
        const atual = parseFloat(input.value) || 0;
        let proximo = Math.round((atual + delta) * 100) / 100;
        if (!isNaN(min)) proximo = Math.max(min, proximo);
        else proximo = Math.max(0, proximo);

        input.value = proximo;
        calcularTensaodoPonto(false);
      });
    });

    // 5. Cálculo em tempo real ao digitar
    [
      "amostra-largura",
      "amostra-altura",
      "amostra-pontos",
      "amostra-carreiras",
      "meta-largura",
      "meta-altura",
      "receita-amostra-pontos",
      "receita-amostra-carreiras",
      "receita-total-pontos",
      "receita-total-carreiras"
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => calcularTensaodoPonto(false));
    });

    // 6. Botões Calcular / Limpar / Exato / Copiar / Salvar
    document.getElementById("btn-calcular-amostra")?.addEventListener("click", () => {
      const ok = calcularTensaodoPonto(true);
      if (ok) {
        const painel = document.getElementById("painel-resultado-amostra");
        if (painel && window.innerWidth < 980) {
          painel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        const elPts = document.getElementById("resultado-amostra-pontos");
        if (elPts && typeof Animacoes !== "undefined" && typeof Animacoes.animarPulso === "function") {
          Animacoes.animarPulso(elPts);
        }
      }
    });

    document.getElementById("btn-limpar-amostra")?.addEventListener("click", limparCampos);
    document.getElementById("check-valor-exato-amostra")?.addEventListener("change", atualizarPainelResultados);
    document.getElementById("btn-copiar-amostra")?.addEventListener("click", copiarResultado);
    document.getElementById("btn-salvar-projeto-amostra")?.addEventListener("click", abrirModalSalvar);

    // 7. Modais (Ajuda e Salvar)
    const modalAjuda = document.getElementById("modal-ajuda-amostra");
    document.getElementById("btn-ajuda-amostra")?.addEventListener("click", () => {
      if (modalAjuda) modalAjuda.style.display = "flex";
    });
    document.getElementById("btn-fechar-ajuda-amostra")?.addEventListener("click", () => {
      if (modalAjuda) modalAjuda.style.display = "none";
    });
    document.getElementById("btn-entendi-ajuda-amostra")?.addEventListener("click", () => {
      if (modalAjuda) modalAjuda.style.display = "none";
    });
    modalAjuda?.addEventListener("click", (e) => {
      if (e.target === modalAjuda) modalAjuda.style.display = "none";
    });

    const modalSalvar = document.getElementById("modal-salvar-amostra");
    document.getElementById("btn-fechar-salvar-amostra")?.addEventListener("click", fecharModalSalvar);
    document.getElementById("btn-cancelar-salvar-amostra")?.addEventListener("click", fecharModalSalvar);
    document.getElementById("form-salvar-amostra")?.addEventListener("submit", salvarAmostraProjeto);
    document.getElementById("check-salvar-tambem-banco")?.addEventListener("change", (e) => {
      const box = document.getElementById("campos-extra-salvar-banco");
      if (box) box.style.display = e.target.checked ? "flex" : "none";
    });
    modalSalvar?.addEventListener("click", (e) => {
      if (e.target === modalSalvar) fecharModalSalvar();
    });

    // 8. Re-sincroniza inventários quando houver mudanças ou ao abrir a aba
    window.addEventListener("ponto-trama:biblioteca-atualizada", sincronizarDadosIntegrados);
    window.addEventListener("ponto-trama:banco-amostras-atualizado", sincronizarDadosIntegrados);
    document
      .querySelector('.barraLateral .botaoFerramenta[data-ferramenta="amostra"]')
      ?.addEventListener("click", () => {
        if (modoAvancadoAtivo) sincronizarDadosIntegrados();
      });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (modalSalvar && modalSalvar.style.display === "flex") fecharModalSalvar();
      if (modalAjuda && modalAjuda.style.display === "flex") modalAjuda.style.display = "none";
    });

    window.addEventListener("resize", atualizarTextoBotaoCalcular);
  }

  async function init() {
    if (jaInicializado) return;
    jaInicializado = true;
    vincularEventos();
    carregarPontosCustomLista();
    carregarAmostrasSalvas();
    await sincronizarDadosIntegrados();

    let modoSalvo = false;
    try {
      modoSalvo = localStorage.getItem(STORAGE_MODO_AVANCADO) === "true";
    } catch {
      modoSalvo = false;
    }
    if (modoSalvo) {
      alternarModoAvancado(true);
    }

    atualizarVisualizacaoAmostraEFitas();
    atualizarTextoBotaoCalcular();
  }

  return {
    init,
    calcular: calcularTensaodoPonto,
    alternarModoAvancado,
    carregarDoBancoDeAmostras,
    obterAmostrasSalvas: () => [...amostrasSalvas]
  };
})();
