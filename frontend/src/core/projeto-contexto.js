// ==========================================================================
// PONTO & TRAMA - CONTEXTO CENTRAL DO PROJETO ATIVO
// Liga o Gerenciador de Projetos a todas as outras ferramentas do sistema:
// - Contador de Carreiras
// - Receitas e Anotações
// - Calculadora de Precificação
// - Calculadora de Amostra
// - Inventário de Fios & Agulhas e Acessórios
//
// Quando o usuário cria um novo projeto ou clica em "Retirar" na pasta do
// projeto, os dados são distribuídos automaticamente para todas as
// ferramentas e qualquer edição feita nelas é salva de volta no projeto.
// ==========================================================================

const ProjetoContexto = (() => {
  const STORAGE_ATIVO_ID = "ponto_trama_projeto_ativo_id";
  const STORE_PROJETOS = "projetos";

  let projetoAtivo = null;
  let projetoAtivoId = null;
  let hidratando = false;
  let timerSalvar = null;
  let timerIndicadorSalvo = null;
  let promessaSalvarAtual = Promise.resolve();

  const METADADOS_STATUS = {
    na_fila: { rotulo: "Na Fila", cor: "#7aa2f7", classe: "status-na-fila" },
    em_andamento: { rotulo: "Em Andamento", cor: "#f6c945", classe: "status-em-andamento" },
    pausado: { rotulo: "Pausado", cor: "#b48ead", classe: "status-pausado" },
    concluido: { rotulo: "Concluído", cor: "#3dd68c", classe: "status-concluido" }
  };

  const METADADOS_CATEGORIA = {
    amigurumi: { rotulo: "Amigurumi", icone: "🧸" },
    vestuario: { rotulo: "Vestuário", icone: "🧶" },
    decoracao: { rotulo: "Decoração", icone: "🏡" },
    acessorios: { rotulo: "Acessórios", icone: "👜" }
  };

  function normalizarProjeto(bruto = {}) {
    const p = bruto && typeof bruto === "object" ? { ...bruto } : {};
    const status = METADADOS_STATUS[p.status] ? p.status : "na_fila";
    const tecnicaPadrao =
      typeof Configuracoes !== "undefined" && typeof Configuracoes.obterTecnicaEfetiva === "function"
        ? Configuracoes.obterTecnicaEfetiva()
        : "croche";
    const tecnica = p.tecnica === "trico" ? "trico" : p.tecnica === "croche" ? "croche" : tecnicaPadrao;
    const catPadrao = tecnica === "trico" ? "vestuario" : "amigurumi";
    const categoria = METADADOS_CATEGORIA[p.categoria] ? p.categoria : catPadrao;

    const materiaisOrig = p.materiais && typeof p.materiais === "object" ? p.materiais : {};
    const receitaOrig = p.receita && typeof p.receita === "object" ? p.receita : {};

    const normalizado = {
      ...p,
      nome: String(p.nome || "").trim(),
      tecnica,
      categoria,
      cliente: String(p.cliente || "").trim(),
      status,
      foto_capa: p.foto_capa || "",
      data_inicio: p.data_inicio || "",
      prazo_estimado: p.prazo_estimado || p.data_entrega || "",
      data_entrega: p.prazo_estimado || p.data_entrega || "",
      progresso_modo: p.progresso_modo === "manual" ? "manual" : "auto",
      progresso_manual: Math.max(0, Math.min(100, Number(p.progresso_manual) || 0)),
      tempo_gasto_seg: Math.max(0, Math.floor(Number(p.tempo_gasto_seg) || 0)),
      arquivado: Boolean(p.arquivado),
      agulha_id: p.agulha_id !== undefined && p.agulha_id !== "" && p.agulha_id !== null ? Number(p.agulha_id) : null,
      amostra_id: p.amostra_id !== undefined && p.amostra_id !== "" && p.amostra_id !== null ? Number(p.amostra_id) : null,
      observacoes: String(p.observacoes || ""),
      etapas: Array.isArray(p.etapas)
        ? p.etapas.map((et, i) => ({
            id: et.id || `et-${Date.now()}-${i}`,
            titulo: String(et.titulo || "").trim(),
            concluida: Boolean(et.concluida)
          })).filter((et) => et.titulo)
        : [],
      materiais: {
        fios: Array.isArray(materiaisOrig.fios) ? materiaisOrig.fios.map((f) => ({ ...f })) : [],
        agulha_id:
          materiaisOrig.agulha_id !== undefined && materiaisOrig.agulha_id !== null && materiaisOrig.agulha_id !== ""
            ? Number(materiaisOrig.agulha_id)
            : p.agulha_id !== undefined && p.agulha_id !== null && p.agulha_id !== ""
              ? Number(p.agulha_id)
              : null,
        agulha_mm: String(materiaisOrig.agulha_mm || "").trim(),
        agulha_nome: String(materiaisOrig.agulha_nome || "").trim(),
        baixa_estoque_realizada: Boolean(materiaisOrig.baixa_estoque_realizada)
      },
      contadores: Array.isArray(p.contadores) && p.contadores.length > 0
        ? p.contadores.map((c, idx) => ({
            id: String(c.id || idx + 1),
            nome: String(c.nome || `Contador ${idx + 1}`),
            carreiras: Math.max(0, parseInt(c.carreiras, 10) || 0),
            pontosPorCarreira: Math.max(0, parseInt(c.pontosPorCarreira, 10) || 0),
            meta: Math.max(0, parseInt(c.meta, 10) || 0)
          }))
        : [{ id: "1", nome: "Carreiras", carreiras: 0, pontosPorCarreira: 0, meta: 0 }],
      receita: {
        modo: receitaOrig.modo === "arquivo" ? "arquivo" : "texto",
        texto: String(receitaOrig.texto || ""),
        linha_atual: Math.max(0, parseInt(receitaOrig.linha_atual, 10) || 0),
        arquivo_nome: String(receitaOrig.arquivo_nome || ""),
        arquivo_tipo: String(receitaOrig.arquivo_tipo || ""),
        arquivo_url: String(receitaOrig.arquivo_url || ""),
        regua_pct:
          receitaOrig.regua_pct !== undefined && !isNaN(Number(receitaOrig.regua_pct))
            ? Math.max(2, Math.min(96, Number(receitaOrig.regua_pct)))
            : 18
      },
      galeria: Array.isArray(p.galeria) ? p.galeria.map((g) => ({ ...g })) : [],
      amostra: p.amostra && typeof p.amostra === "object" ? { ...p.amostra } : {},
      precificacao: p.precificacao && typeof p.precificacao === "object" ? { ...p.precificacao } : {},
      grafico: p.grafico && typeof p.grafico === "object" ? { ...p.grafico } : {},
      criado_em: p.criado_em || new Date().toISOString(),
      atualizado_em: p.atualizado_em || new Date().toISOString()
    };

    if (p.id !== undefined && p.id !== null && p.id !== "" && !Number.isNaN(Number(p.id))) {
      normalizado.id = Number(p.id);
    } else {
      delete normalizado.id;
    }

    return normalizado;
  }

  function calcularProgresso(projeto) {
    if (!projeto) return 0;
    if (projeto.progresso_modo === "manual") {
      return Math.max(0, Math.min(100, Math.round(Number(projeto.progresso_manual) || 0)));
    }
    const etapas = Array.isArray(projeto.etapas) ? projeto.etapas : [];
    if (etapas.length > 0) {
      const feitas = etapas.filter((e) => e.concluida).length;
      return Math.round((feitas / etapas.length) * 100);
    }
    return projeto.status === "concluido" ? 100 : 0;
  }

  function formatarTempo(segundosTotais) {
    const s = Math.max(0, Math.floor(Number(segundosTotais) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const segs = s % 60;
    return [hrs, mins, segs].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function segundosParaHoras(segundosTotais) {
    const s = Math.max(0, Number(segundosTotais) || 0);
    return Math.round((s / 3600) * 100) / 100;
  }

  function obterProjetoAtivo() {
    return projetoAtivo;
  }

  function obterProjetoAtivoId() {
    return projetoAtivoId;
  }

  function estaHidratando() {
    return hidratando;
  }

  function lerIdSalvoStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_ATIVO_ID);
      if (!raw) return null;
      const n = Number(raw);
      return isNaN(n) ? null : n;
    } catch {
      return null;
    }
  }

  function salvarIdStorage(id) {
    try {
      if (id === null || id === undefined) localStorage.removeItem(STORAGE_ATIVO_ID);
      else localStorage.setItem(STORAGE_ATIVO_ID, String(id));
    } catch {
      // ignora
    }
  }

  // Atualiza a barra global que indica qual projeto está "retirado" na bancada
  function atualizarBarraGlobal(salvando = false) {
    const barra = document.getElementById("barra-projeto-ativo-global");
    if (!barra) return;

    const secaoHome = document.getElementById("secao-home");
    const estaNaHome = secaoHome && secaoHome.style.display !== "none";

    if (!projetoAtivo || estaNaHome) {
      barra.style.display = "none";
      return;
    }

    const metaStatus = METADADOS_STATUS[projetoAtivo.status] || METADADOS_STATUS.na_fila;
    const progresso = calcularProgresso(projetoAtivo);

    const nomeEl = document.getElementById("barra-ativo-nome");
    const pontoEl = document.getElementById("barra-ativo-status-dot");
    const progEl = document.getElementById("barra-ativo-progresso");
    const syncEl = document.getElementById("barra-ativo-sync");

    if (nomeEl) nomeEl.textContent = projetoAtivo.nome || "Projeto sem título";
    if (pontoEl) pontoEl.style.backgroundColor = metaStatus.cor;
    if (progEl) progEl.textContent = `${progresso}%`;
    if (syncEl) {
      syncEl.textContent = salvando ? "Salvando na pasta..." : "✓ Salvo na pasta";
      syncEl.classList.toggle("salvando", salvando);
    }

    barra.style.display = "flex";
  }

  function sinalizarSalvoNaBarra() {
    atualizarBarraGlobal(false);
    const syncEl = document.getElementById("barra-ativo-sync");
    if (syncEl) {
      syncEl.classList.add("destaque-salvo");
      if (timerIndicadorSalvo) clearTimeout(timerIndicadorSalvo);
      timerIndicadorSalvo = setTimeout(() => {
        syncEl.classList.remove("destaque-salvo");
      }, 1100);
    }
  }

  // Marca agulha vinculada como "Em uso" no Inventário de Agulhas (se existir)
  async function sincronizarAgulhaEmUso(projeto) {
    if (typeof Configuracoes !== "undefined" && Configuracoes.obter("autoAgulhaUso") === false) return;
    if (typeof BancoDadosPT === "undefined") return;
    const agulhaId = projeto?.materiais?.agulha_id || projeto?.agulha_id;
    if (!agulhaId) return;

    try {
      const itens = await BancoDadosPT.obterTodos("itens_biblioteca");
      const agulha = (itens || []).find((i) => Number(i.id) === Number(agulhaId));
      if (!agulha) return;

      const attr = agulha.atributos && typeof agulha.atributos === "object" ? { ...agulha.atributos } : {};
      if (attr.em_uso && attr.em_uso_projeto_nome === projeto.nome) return;

      attr.em_uso = true;
      attr.em_uso_projeto_id = projeto.id ?? null;
      attr.em_uso_projeto_nome = projeto.nome;
      await BancoDadosPT.salvar("itens_biblioteca", {
        ...agulha,
        atributos: attr,
        atualizado_em: new Date().toISOString()
      });
      window.dispatchEvent(new CustomEvent("ponto-trama:biblioteca-atualizada"));
    } catch {
      // ignora silenciosamente
    }
  }

  // Distribui os dados do projeto para as ferramentas já abertas (as demais carregam sob demanda no primeiro clique)
  function distribuirParaFerramentas(projeto) {
    if (!projeto) return;
    const normalizado = normalizarProjeto(projeto);
    const jaAberta = (chave) =>
      typeof PontoTramaApp === "undefined" ||
      typeof PontoTramaApp.estaInicializado !== "function" ||
      PontoTramaApp.estaInicializado(chave);

    hidratando = true;
    const executarSeguro = (nome, fn) => {
      try {
        fn();
      } catch (err) {
        console.warn(`Aviso ao distribuir projeto para ${nome}:`, err);
      }
    };
    try {
      if (jaAberta("contador-carreiras") && typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.carregarDoProjeto === "function") {
        executarSeguro("ContadorCarreiras", () => ContadorCarreiras.carregarDoProjeto(normalizado));
      }
      if (jaAberta("receitas") && typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.carregarDoProjeto === "function") {
        executarSeguro("LeitorReceitas", () => LeitorReceitas.carregarDoProjeto(normalizado));
      }
      if (jaAberta("precificacao") && typeof CalculadoraPrecificacao !== "undefined" && typeof CalculadoraPrecificacao.carregarDoProjeto === "function") {
        executarSeguro("CalculadoraPrecificacao", () => CalculadoraPrecificacao.carregarDoProjeto(normalizado));
      }
      if (jaAberta("amostra") && typeof CalculadoraAmostra !== "undefined" && typeof CalculadoraAmostra.carregarDoProjeto === "function") {
        executarSeguro("CalculadoraAmostra", () => CalculadoraAmostra.carregarDoProjeto(normalizado));
      }
      if (jaAberta("editor-graficos") && typeof EditorGraficos !== "undefined" && typeof EditorGraficos.carregarDoProjeto === "function") {
        executarSeguro("EditorGraficos", () => EditorGraficos.carregarDoProjeto(normalizado));
      }
    } finally {
      setTimeout(() => {
        hidratando = false;
      }, 60);
    }

    sincronizarAgulhaEmUso(normalizado);
  }

  // "Retira" a pasta do projeto: define como ativo na bancada e distribui para todas as ferramentas
  async function retirarProjeto(projeto, opcoes = {}) {
    if (!projeto) return null;
    const normalizado = normalizarProjeto(projeto);
    projetoAtivo = normalizado;
    projetoAtivoId = normalizado.id ?? null;
    salvarIdStorage(projetoAtivoId);

    distribuirParaFerramentas(normalizado);
    atualizarBarraGlobal(false);

    window.dispatchEvent(
      new CustomEvent("ponto-trama:projeto-ativo-mudou", {
        detail: { projeto: projetoAtivo, origem: opcoes.origem || "retirar" }
      })
    );

    return projetoAtivo;
  }

  function guardarProjeto() {
    projetoAtivo = null;
    projetoAtivoId = null;
    salvarIdStorage(null);
    atualizarBarraGlobal(false);

    window.dispatchEvent(
      new CustomEvent("ponto-trama:projeto-ativo-mudou", {
        detail: { projeto: null, origem: "guardar" }
      })
    );
  }

  // Salva alterações vindas de qualquer ferramenta de volta na pasta do projeto ativo
  function atualizarSecaoAtiva(chaveSecao, valor, opcoes = {}) {
    if (hidratando || !projetoAtivo || projetoAtivo.id === undefined) return;

    if (chaveSecao === "tempo_gasto_seg") {
      projetoAtivo.tempo_gasto_seg = Math.max(0, Math.floor(Number(valor) || 0));
    } else if (chaveSecao === "contadores" || chaveSecao === "etapas" || chaveSecao === "galeria") {
      projetoAtivo[chaveSecao] = Array.isArray(valor) ? valor : [];
    } else if (chaveSecao === "receita" || chaveSecao === "amostra" || chaveSecao === "precificacao" || chaveSecao === "materiais" || chaveSecao === "grafico") {
      projetoAtivo[chaveSecao] = { ...(projetoAtivo[chaveSecao] || {}), ...(valor || {}) };
    } else {
      projetoAtivo[chaveSecao] = valor;
    }

    projetoAtivo.atualizado_em = new Date().toISOString();
    atualizarBarraGlobal(true);

    // Notifica imediatamente o workspace/gerenciador para manter telas sincronizadas em tempo real
    window.dispatchEvent(
      new CustomEvent("ponto-trama:projeto-atualizado", {
        detail: { projeto: projetoAtivo, secao: chaveSecao, origem: opcoes.origem || "" }
      })
    );

    const persistir = () => {
      if (!projetoAtivo || typeof BancoDadosPT === "undefined") return;
      const snapshot = normalizarProjeto(projetoAtivo);
      promessaSalvarAtual = promessaSalvarAtual
        .then(() => BancoDadosPT.salvar(STORE_PROJETOS, snapshot))
        .then((salvo) => {
          if (salvo && projetoAtivo && Number(salvo.id) === Number(projetoAtivo.id)) {
            projetoAtivo = normalizarProjeto(salvo);
          }
          sinalizarSalvoNaBarra();
        })
        .catch((err) => {
          console.warn("Erro ao sincronizar projeto ativo:", err);
          atualizarBarraGlobal(false);
        });
    };

    if (opcoes.imediato) {
      if (timerSalvar) clearTimeout(timerSalvar);
      persistir();
    } else {
      if (timerSalvar) clearTimeout(timerSalvar);
      timerSalvar = setTimeout(persistir, 240);
    }
  }

  // Mantém a referência em sincronia quando o Gerenciador de Projetos edita/exclui um projeto
  function sincronizarExterno(projetoAtualizado, excluidoId = null) {
    if (excluidoId !== null && projetoAtivoId !== null && Number(excluidoId) === Number(projetoAtivoId)) {
      guardarProjeto();
      return;
    }
    if (projetoAtualizado && projetoAtivoId !== null && Number(projetoAtualizado.id) === Number(projetoAtivoId)) {
      projetoAtivo = normalizarProjeto(projetoAtualizado);
      atualizarBarraGlobal(false);
    }
  }

  async function restaurarProjetoAtivoInicial() {
    const idSalvo = lerIdSalvoStorage();
    if (!idSalvo || typeof BancoDadosPT === "undefined") {
      atualizarBarraGlobal(false);
      return null;
    }
    try {
      const lista = await BancoDadosPT.obterTodos(STORE_PROJETOS);
      const encontrado = (lista || []).find((p) => Number(p.id) === Number(idSalvo));
      if (encontrado) {
        projetoAtivo = normalizarProjeto(encontrado);
        projetoAtivoId = projetoAtivo.id;
        atualizarBarraGlobal(false);
        return projetoAtivo;
      }
      salvarIdStorage(null);
    } catch {
      // ignora
    }
    return null;
  }

  function vincularBarraGlobal() {
    document.getElementById("btn-barra-abrir-workspace")?.addEventListener("click", () => {
      if (!projetoAtivo) return;
      const btnProj = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="projetos"]');
      if (btnProj && typeof BarraLateral !== "undefined") {
        BarraLateral.alternarFerramenta(btnProj);
      }
      setTimeout(() => {
        if (typeof GerenciadorProjetos !== "undefined" && typeof GerenciadorProjetos.abrirWorkspacePorId === "function") {
          GerenciadorProjetos.abrirWorkspacePorId(projetoAtivo.id);
        }
      }, 40);
    });

    document.getElementById("btn-barra-guardar-projeto")?.addEventListener("click", () => {
      guardarProjeto();
    });

    window.addEventListener("ponto-trama:ferramenta-alterada", () => {
      atualizarBarraGlobal(false);
    });
  }

  function init() {
    vincularBarraGlobal();
    restaurarProjetoAtivoInicial();
  }

  return {
    init,
    METADADOS_STATUS,
    METADADOS_CATEGORIA,
    normalizarProjeto,
    calcularProgresso,
    formatarTempo,
    segundosParaHoras,
    obterProjetoAtivo,
    obterProjetoAtivoId,
    estaHidratando,
    retirarProjeto,
    guardarProjeto,
    distribuirParaFerramentas,
    atualizarSecaoAtiva,
    sincronizarExterno,
    atualizarBarraGlobal,
    restaurarProjetoAtivoInicial
  };
})();
