// ==========================================================================
// FERRAMENTA: CONTADOR DE CARREIRAS
// Inclui Contadores Vinculados com Lembrete de Motivo (estilo KnitCompanion)
// e integração direta com o Leitor Interativo de Receitas (+1 automático).
// ==========================================================================

const ContadorCarreiras = (() => {
  let contadorIdCounter = 1;

  // ==========================================================================
  // PARTE 1: OPERAÇÕES E LÓGICA (Cálculos, Estado e Dados)
  // ==========================================================================

  // Cálculo de pontos: carreiras * pontosPorCarreira
  function calcularPontos(carreiras, pontosPorCarreira) {
    const c = Math.max(0, parseInt(carreiras, 10) || 0);
    const p = Math.max(0, parseInt(pontosPorCarreira, 10) || 0);
    return c * p;
  }

  // Verificação de meta de carreiras
  function verificarMeta(carreiras, meta) {
    const c = Math.max(0, parseInt(carreiras, 10) || 0);
    const m = parseInt(meta, 10);
    if (!isNaN(m) && m > 0) {
      return { definida: true, meta: m, atingida: c >= m };
    }
    return { definida: false, meta: 0, atingida: false };
  }

  // Avaliação do contador vinculado de motivo & lembrete periódico
  function avaliarMotivoVinculado(carreiras, cada, ciclo, texto) {
    const c = Math.max(0, parseInt(carreiras, 10) || 0);
    const nCada = Math.max(0, parseInt(cada, 10) || 0);
    const nCiclo = Math.max(0, parseInt(ciclo, 10) || 0);
    const msg = String(texto || "").trim();

    const cicloPos = nCiclo > 0 ? (c === 0 ? 0 : ((c - 1) % nCiclo) + 1) : 0;
    const disparado = c > 0 && nCada > 0 && c % nCada === 0;
    const textoAlerta = disparado
      ? `✨ Carr. ${c}: ${msg || `Ação a cada ${nCada} carreiras!`}`
      : "";

    return {
      nCada,
      nCiclo,
      cicloPos,
      disparado,
      textoAlerta
    };
  }

  // Atualiza cálculos de pontos, lembrete de motivo e verifica disparo de alarme
  function atualizarContador(card) {
    if (!card) return;
    const inputCarreiras = card.querySelector(".input-carreiras");
    const inputPontos = card.querySelector(".input-pontos-carreira");
    const totalPontosElem = card.querySelector(".valor-total-pontos");
    const inputMeta = card.querySelector(".input-meta");
    const badgeStatus = card.querySelector(".badge-status-alarme");
    const nomeContador = (card.querySelector(".nome-contador")?.value || "Contador").trim();

    let carreiras = parseInt(inputCarreiras.value, 10);
    if (isNaN(carreiras) || carreiras < 0) {
      carreiras = 0;
      inputCarreiras.value = 0;
    }

    let pontosPorCarreira = parseInt(inputPontos.value, 10);
    if (isNaN(pontosPorCarreira) || pontosPorCarreira < 0) {
      pontosPorCarreira = 0;
    }

    // 3# Cálculo de Pontos
    const total = calcularPontos(carreiras, pontosPorCarreira);
    if (totalPontosElem) {
      totalPontosElem.textContent = total.toLocaleString("pt-BR");
    }

    // 4# Checagem de Meta
    const statusMeta = verificarMeta(carreiras, inputMeta.value);
    if (statusMeta.definida) {
      if (statusMeta.atingida) {
        dispararAlarmeCard(card, `${nomeContador} atingiu a meta de ${statusMeta.meta} carreiras!`);
        if (badgeStatus) {
          badgeStatus.textContent = "Meta atingida!";
          badgeStatus.className = "badge-status-alarme disparado";
        }
      } else {
        if (badgeStatus) {
          badgeStatus.textContent = `Meta: ${statusMeta.meta}`;
          badgeStatus.className = "badge-status-alarme ativo";
        }
        removerAlarmeCard(card);
      }
    } else {
      if (badgeStatus) {
        badgeStatus.textContent = "Sem meta";
        badgeStatus.className = "badge-status-alarme";
      }
      removerAlarmeCard(card);
    }

    // 5# Contador Vinculado de Motivo & Lembrete (estilo KnitCompanion)
    const inpCada = card.querySelector(".input-motivo-cada");
    const inpCiclo = card.querySelector(".input-motivo-ciclo");
    const inpTexto = card.querySelector(".input-motivo-texto");
    const badgeCiclo = card.querySelector(".badge-ciclo-motivo");
    const alertaMotivo = card.querySelector(".alerta-motivo-card");

    const infoMotivo = avaliarMotivoVinculado(
      carreiras,
      inpCada?.value,
      inpCiclo?.value,
      inpTexto?.value
    );

    if (badgeCiclo) {
      if (infoMotivo.nCiclo > 0) {
        badgeCiclo.textContent = `Motivo ${infoMotivo.cicloPos}/${infoMotivo.nCiclo}`;
        badgeCiclo.classList.add("visivel");
      } else if (infoMotivo.nCada > 0) {
        const faltam = carreiras === 0 ? infoMotivo.nCada : infoMotivo.nCada - (carreiras % infoMotivo.nCada);
        badgeCiclo.textContent = infoMotivo.disparado ? `A cada ${infoMotivo.nCada} • Agora!` : `Próx. em ${faltam}`;
        badgeCiclo.classList.add("visivel");
      } else {
        badgeCiclo.textContent = "";
        badgeCiclo.classList.remove("visivel");
      }
    }

    if (alertaMotivo) {
      if (infoMotivo.disparado) {
        alertaMotivo.textContent = infoMotivo.textoAlerta;
        alertaMotivo.classList.add("ativo");
        if (card.dataset.ultimaCarrMotivo !== String(carreiras)) {
          card.dataset.ultimaCarrMotivo = String(carreiras);
          if (typeof Configuracoes !== "undefined") {
            Configuracoes.vibrar([24, 45, 24]);
          }
        }
      } else {
        alertaMotivo.textContent = "";
        alertaMotivo.classList.remove("ativo");
        card.dataset.ultimaCarrMotivo = "";
      }
    }

    salvarEstadoContadores();
    if (cardTelaToda === card) {
      atualizarTelaToda();
    }
  }

  function incrementarCarreiras(card) {
    const inputCarreiras = card.querySelector(".input-carreiras");
    let val = parseInt(inputCarreiras.value, 10) || 0;
    inputCarreiras.value = val + 1;
    if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(18);
    atualizarContador(card);
  }

  function decrementarCarreiras(card) {
    const inputCarreiras = card.querySelector(".input-carreiras");
    let val = parseInt(inputCarreiras.value, 10) || 0;
    if (val > 0) {
      inputCarreiras.value = val - 1;
      if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(12);
      atualizarContador(card);
    }
  }

  function zerarContador(card) {
    const inputCarreiras = card.querySelector(".input-carreiras");
    inputCarreiras.value = 0;
    atualizarContador(card);
  }

  // ==========================================================================
  // PARTE 2: ANIMAÇÕES E EFEITOS (Efeitos Visuais e Transições)
  // ==========================================================================

  function dispararAlarmeCard(card, mensagem) {
    const jaDisparado = card.classList.contains("alarme-disparado");
    card.classList.add("alarme-disparado");
    const visualAtivo = typeof Configuracoes === "undefined" || Configuracoes.obter("alertaVisual") !== false;
    if (visualAtivo) {
      Animacoes.dispararAlarmeVisual(mensagem);
    }
    if (!jaDisparado && typeof Configuracoes !== "undefined") {
      Configuracoes.tocarSomAlarme(false);
      Configuracoes.vibrar([100, 60, 100]);
    }
  }

  function removerAlarmeCard(card) {
    card.classList.remove("alarme-disparado");
    const algumDisparado = document.querySelector(".card-contador.alarme-disparado");
    if (!algumDisparado) {
      Animacoes.silenciarAlarmeVisual();
    }
  }

  // 2# Cria novo card com animação de inflar
  function criarElementoContador(id) {
    const card = document.createElement("article");
    card.className = "card-contador animar-inflar";
    card.id = `contador-${id}`;
    card.dataset.id = id;

    card.innerHTML = `
      <div class="card-topo">
        <input type="text" class="nome-contador" value="Contador #${id}" title="Clique para renomear" />
        <button type="button" class="btn-expandir-contador" title="Abrir em modo Toque na Tela Toda" aria-label="Abrir em modo Toque na Tela Toda">⛶</button>
        <button type="button" class="btn-remover-contador" title="Remover este contador">✕</button>
      </div>

      <div class="secao-carreiras">
        <span class="label-secao">Carreiras</span>
        <div class="controle-carreiras">
          <button
            type="button"
            class="btn-toque btn-menos"
            id="btn-menos-${id}"
            title="Diminuir 1 carreira"
            aria-label="Diminuir 1 carreira"
          >
            −
          </button>
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="input-carreiras"
            id="carreiras-${id}"
            value="0"
            aria-label="Número de carreiras"
            title="Número de carreiras (clique para digitar manualmente)"
          />
          <button
            type="button"
            class="btn-toque btn-mais"
            id="btn-mais-${id}"
            title="Adicionar 1 carreira"
            aria-label="Adicionar 1 carreira"
          >
            +
          </button>
        </div>
      </div>

      <div class="linha-zerar">
        <button type="button" class="btn-zerar" id="btn-zerar-${id}" title="Zerar contador">
          <svg
            class="icone-zerar"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
          <span>Zerar</span>
        </button>
      </div>

      <div class="secao-calculo">
        <div class="linha-input-pontos">
          <label for="pontos-carreira-${id}" class="label-pontos">Pontos por carreira:</label>
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            id="pontos-carreira-${id}"
            class="input-pontos-carreira"
            value="0"
            placeholder="0"
            aria-label="Pontos por carreira"
          />
        </div>
        <div class="linha-total-pontos">
          <span class="label-total">Total no trabalho:</span>
          <div>
            <span class="valor-total-pontos" id="total-pontos-${id}">0</span>
            <span class="unidade-pontos">pontos</span>
          </div>
        </div>
      </div>

      <div class="secao-alarme">
        <div class="linha-meta">
          <label for="meta-${id}" class="label-meta">Avisar na carreira:</label>
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            id="meta-${id}"
            class="input-meta"
            placeholder="0"
            aria-label="Meta de carreiras para disparar alarme"
            title="Clique para digitar a carreira de aviso"
          />
        </div>
      </div>

      <div class="secao-motivo-vinculado">
        <div class="motivo-cabecalho">
          <button type="button" class="btn-toggle-motivo" aria-expanded="false" title="Configurar lembrete periódico ou repetição de motivo">
            🔗 Motivo &amp; Lembrete ▾
          </button>
          <span class="badge-ciclo-motivo"></span>
        </div>
        <div class="alerta-motivo-card" role="status" aria-live="polite"></div>
        <div class="motivo-config-corpo">
          <div class="motivo-grid-2">
            <div class="motivo-campo">
              <label for="motivo-cada-${id}">Avisar a cada (carr.)</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" id="motivo-cada-${id}" class="input-motivo-cada" placeholder="Ex: 4" />
            </div>
            <div class="motivo-campo">
              <label for="motivo-ciclo-${id}">Ciclo motivo (carr.)</label>
              <input type="text" inputmode="numeric" pattern="[0-9]*" id="motivo-ciclo-${id}" class="input-motivo-ciclo" placeholder="Ex: 8" />
            </div>
          </div>
          <div class="motivo-campo">
            <label for="motivo-texto-${id}">Lembrete exibido na carreira certa</label>
            <input type="text" id="motivo-texto-${id}" class="input-motivo-texto" placeholder="Ex: Fazer aumento! / Trocar cor" />
          </div>
        </div>
      </div>
    `;

    return card;
  }

  // ==========================================================================
  // PERSISTÊNCIA EM LOCALSTORAGE
  // ==========================================================================
  const CHAVE_STORAGE = "ponto_trama_contadores_estado";

  function salvarEstadoContadores() {
    try {
      const areaContadores = document.getElementById("area-contadores");
      if (!areaContadores) return;
      const cards = areaContadores.querySelectorAll(".card-contador");
      const dados = [];

      cards.forEach((card) => {
        const id = card.dataset.id || card.id.replace("contador-", "") || "1";
        const nome = (card.querySelector(".nome-contador")?.value || "").trim();
        const carreiras = parseInt(card.querySelector(".input-carreiras")?.value, 10) || 0;
        const pontosPorCarreira = parseInt(card.querySelector(".input-pontos-carreira")?.value, 10) || 0;
        const meta = parseInt(card.querySelector(".input-meta")?.value, 10) || 0;
        const motivoCada = parseInt(card.querySelector(".input-motivo-cada")?.value, 10) || 0;
        const motivoCiclo = parseInt(card.querySelector(".input-motivo-ciclo")?.value, 10) || 0;
        const motivoTexto = (card.querySelector(".input-motivo-texto")?.value || "").trim();

        dados.push({
          id,
          nome,
          carreiras,
          pontosPorCarreira,
          meta,
          motivoCada,
          motivoCiclo,
          motivoTexto
        });
      });

      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));

      if (dados.length > 0) {
        window.dispatchEvent(
          new CustomEvent("ponto-trama:contador-alterado", {
            detail: { carreiras: dados[0].carreiras, origem: "contador-carreiras" }
          })
        );
      }

      if (
        typeof ProjetoContexto !== "undefined" &&
        !ProjetoContexto.estaHidratando() &&
        ProjetoContexto.obterProjetoAtivo()
      ) {
        ProjetoContexto.atualizarSecaoAtiva("contadores", dados, { origem: "contador-carreiras" });
      }
    } catch (e) {
      console.warn("Erro ao persistir contadores no localStorage:", e);
    }
  }

  function renderizarListaContadores(dados) {
    if (!Array.isArray(dados) || dados.length === 0) return false;
    const areaContadores = document.getElementById("area-contadores");
    if (!areaContadores) return false;

    areaContadores.innerHTML = "";
    let maxId = 1;

    dados.forEach((item, index) => {
      const idStr = String(item.id || index + 1);
      const numId = parseInt(idStr, 10);
      if (!isNaN(numId) && numId > maxId) maxId = numId;

      const card = criarElementoContador(idStr);
      const inputNome = card.querySelector(".nome-contador");
      if (inputNome && item.nome) inputNome.value = item.nome;

      const inputCarreiras = card.querySelector(".input-carreiras");
      if (inputCarreiras) inputCarreiras.value = item.carreiras || 0;

      const inputPontos = card.querySelector(".input-pontos-carreira");
      if (inputPontos) inputPontos.value = item.pontosPorCarreira || 0;

      const inputMeta = card.querySelector(".input-meta");
      if (inputMeta && item.meta > 0) inputMeta.value = item.meta;

      const inputMotivoCada = card.querySelector(".input-motivo-cada");
      if (inputMotivoCada && item.motivoCada > 0) inputMotivoCada.value = item.motivoCada;

      const inputMotivoCiclo = card.querySelector(".input-motivo-ciclo");
      if (inputMotivoCiclo && item.motivoCiclo > 0) inputMotivoCiclo.value = item.motivoCiclo;

      const inputMotivoTexto = card.querySelector(".input-motivo-texto");
      if (inputMotivoTexto && item.motivoTexto) inputMotivoTexto.value = item.motivoTexto;

      const btnRemover = card.querySelector(".btn-remover-contador");
      if (btnRemover && dados.length === 1) {
        btnRemover.style.display = "none";
      }

      areaContadores.appendChild(card);
      configurarEventosCard(card);
    });

    contadorIdCounter = maxId;
    atualizarVisibilidadeBotoesRemover();
    return true;
  }

  function carregarDoProjeto(projeto) {
    if (!projeto) return;
    const lista =
      Array.isArray(projeto.contadores) && projeto.contadores.length > 0
        ? projeto.contadores
        : [{ id: "1", nome: projeto.nome || "Carreiras", carreiras: 0, pontosPorCarreira: 0, meta: 0 }];
    renderizarListaContadores(lista);
  }

  function carregarEstadoContadores() {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (!salvo) return false;
      const dados = JSON.parse(salvo);
      return renderizarListaContadores(dados);
    } catch (e) {
      console.warn("Erro ao carregar contadores do localStorage:", e);
      return false;
    }
  }

  function atualizarVisibilidadeBotoesRemover() {
    const areaContadores = document.getElementById("area-contadores");
    if (!areaContadores) return;
    const cards = areaContadores.querySelectorAll(".card-contador");
    cards.forEach((c) => {
      let btn = c.querySelector(".btn-remover-contador");
      if (!btn && cards.length > 1) {
        const topo = c.querySelector(".card-topo");
        if (topo) {
          btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn-remover-contador";
          btn.title = "Remover este contador";
          btn.textContent = "✕";
          btn.addEventListener("click", () => removerContador(c));
          topo.appendChild(btn);
        }
      } else if (btn) {
        btn.style.display = cards.length <= 1 ? "none" : "";
      }
    });
  }

  function adicionarNovoContador() {
    contadorIdCounter++;
    const areaContadores = document.getElementById("area-contadores");
    if (!areaContadores) return;

    const cardsExistentes = areaContadores.querySelectorAll(".card-contador");
    const novoCard = criarElementoContador(contadorIdCounter);

    Animacoes.animarDeslocamento(cardsExistentes, () => {
      areaContadores.appendChild(novoCard);
    });

    configurarEventosCard(novoCard);
    atualizarVisibilidadeBotoesRemover();
    salvarEstadoContadores();
    novoCard.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
  }

  function removerContador(card) {
    if (!card) return;
    const areaContadores = document.getElementById("area-contadores");
    const todosCards = areaContadores ? areaContadores.querySelectorAll(".card-contador") : [];

    if (todosCards.length <= 1) return;

    card.classList.remove("animar-inflar");
    card.classList.add("animar-desinflar");

    setTimeout(() => {
      const outrosCards = Array.from(todosCards).filter((c) => c !== card);
      Animacoes.animarDeslocamento(outrosCards, () => {
        card.remove();
        removerAlarmeCard(card);
        atualizarVisibilidadeBotoesRemover();
        salvarEstadoContadores();
      });
    }, 320);
  }

  // ==========================================================================
  // MODO "TOQUE NA TELA TODA" COM CADEADO DE SEGURANÇA
  // ==========================================================================
  let cardTelaToda = null;
  let telaTodaTravada = true;
  let confirmarZerarPendente = false;

  function atualizarTelaToda() {
    if (!cardTelaToda) return;
    const nome = (cardTelaToda.querySelector(".nome-contador")?.value || "Contador").trim();
    const carreiras = parseInt(cardTelaToda.querySelector(".input-carreiras")?.value, 10) || 0;
    const ptsCarr = parseInt(cardTelaToda.querySelector(".input-pontos-carreira")?.value, 10) || 0;
    const meta = parseInt(cardTelaToda.querySelector(".input-meta")?.value, 10) || 0;
    const motivoCada = parseInt(cardTelaToda.querySelector(".input-motivo-cada")?.value, 10) || 0;
    const motivoCiclo = parseInt(cardTelaToda.querySelector(".input-motivo-ciclo")?.value, 10) || 0;
    const motivoTexto = (cardTelaToda.querySelector(".input-motivo-texto")?.value || "").trim();

    const elNome = document.getElementById("tela-toda-nome");
    const elMeta = document.getElementById("tela-toda-meta");
    const elNum = document.getElementById("tela-toda-numero");
    const elPts = document.getElementById("tela-toda-pontos");
    const elMotivo = document.getElementById("tela-toda-motivo");
    const ov = document.getElementById("overlay-contador-tela-toda");

    if (elNome) elNome.textContent = nome;
    if (elNum) elNum.textContent = String(carreiras);
    if (elPts) {
      elPts.textContent = ptsCarr > 0 ? `${(carreiras * ptsCarr).toLocaleString("pt-BR")} pontos no total` : "";
    }
    if (elMeta) {
      if (meta > 0 && carreiras >= meta) {
        elMeta.textContent = `🔔 Meta atingida (${meta} carreiras)!`;
      } else if (meta > 0) {
        elMeta.textContent = `Meta: ${carreiras} / ${meta} carreiras`;
      } else {
        elMeta.textContent = "Toque em qualquer lugar da tela para somar +1";
      }
    }

    if (elMotivo) {
      const infoM = avaliarMotivoVinculado(carreiras, motivoCada, motivoCiclo, motivoTexto);
      if (infoM.disparado) {
        elMotivo.textContent = infoM.textoAlerta;
        elMotivo.classList.add("visivel", "disparado");
      } else if (infoM.nCiclo > 0) {
        elMotivo.textContent = `🔗 Motivo: carreira ${infoM.cicloPos} de ${infoM.nCiclo}`;
        elMotivo.classList.add("visivel");
        elMotivo.classList.remove("disparado");
      } else if (infoM.nCada > 0) {
        const faltam = carreiras === 0 ? infoM.nCada : infoM.nCada - (carreiras % infoM.nCada);
        elMotivo.textContent = `🔗 Próximo lembrete em ${faltam} carr.`;
        elMotivo.classList.add("visivel");
        elMotivo.classList.remove("disparado");
      } else {
        elMotivo.textContent = "";
        elMotivo.classList.remove("visivel", "disparado");
      }
    }

    if (ov) {
      ov.classList.toggle("meta-atingida", meta > 0 && carreiras >= meta);
    }
  }

  function atualizarBotoesCadeadoTelaToda() {
    const btnCad = document.getElementById("btn-tela-toda-cadeado");
    const btnZerar = document.getElementById("btn-tela-toda-zerar");
    if (btnCad) {
      btnCad.classList.toggle("travado", telaTodaTravada);
      btnCad.setAttribute("aria-pressed", telaTodaTravada ? "true" : "false");
      btnCad.textContent = telaTodaTravada ? "🔒 Travado" : "🔓 Destravado";
    }
    if (btnZerar) {
      btnZerar.disabled = telaTodaTravada;
      if (telaTodaTravada) {
        confirmarZerarPendente = false;
        btnZerar.textContent = "↺ Zerar";
        btnZerar.classList.remove("confirmando");
      }
    }
  }

  function abrirTelaToda(card) {
    const alvo = card || document.querySelector(".card-contador");
    if (!alvo) return;
    cardTelaToda = alvo;
    telaTodaTravada = true;
    confirmarZerarPendente = false;
    atualizarBotoesCadeadoTelaToda();
    atualizarTelaToda();
    const ov = document.getElementById("overlay-contador-tela-toda");
    if (ov) ov.style.display = "flex";
  }

  function fecharTelaToda() {
    const ov = document.getElementById("overlay-contador-tela-toda");
    if (ov) ov.style.display = "none";
    cardTelaToda = null;
    confirmarZerarPendente = false;
  }

  function vincularRepeticaoPressaoLonga(botao, acao) {
    if (!botao) return;
    let timerEspera = null;
    let timerIntervalo = null;
    let repetiu = false;

    const parar = () => {
      clearTimeout(timerEspera);
      clearInterval(timerIntervalo);
      timerEspera = null;
      timerIntervalo = null;
    };

    botao.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      repetiu = false;
      parar();
      timerEspera = setTimeout(() => {
        repetiu = true;
        acao();
        timerIntervalo = setInterval(acao, 110);
      }, 420);
    });

    botao.addEventListener("pointerup", parar);
    botao.addEventListener("pointercancel", parar);
    botao.addEventListener("pointerleave", parar);
    botao.addEventListener("click", (e) => {
      if (repetiu) {
        e.preventDefault();
        e.stopImmediatePropagation();
        repetiu = false;
      }
    }, true);
  }

  function configurarEventosCard(card) {
    if (!card) return;
    const inputNome = card.querySelector(".nome-contador");
    const inputCarreiras = card.querySelector(".input-carreiras");
    const btnMais = card.querySelector(".btn-mais");
    const btnMenos = card.querySelector(".btn-menos");
    const btnZerar = card.querySelector(".btn-zerar");
    const inputPontos = card.querySelector(".input-pontos-carreira");
    const inputMeta = card.querySelector(".input-meta");
    const btnRemover = card.querySelector(".btn-remover-contador");
    const btnExpandir = card.querySelector(".btn-expandir-contador");

    // Motivo vinculado
    const btnToggleMotivo = card.querySelector(".btn-toggle-motivo");
    const corpoMotivo = card.querySelector(".motivo-config-corpo");
    const inputMotivoCada = card.querySelector(".input-motivo-cada");
    const inputMotivoCiclo = card.querySelector(".input-motivo-ciclo");
    const inputMotivoTexto = card.querySelector(".input-motivo-texto");

    if (inputNome) inputNome.addEventListener("input", salvarEstadoContadores);
    if (btnMais) {
      btnMais.addEventListener("click", () => incrementarCarreiras(card));
      vincularRepeticaoPressaoLonga(btnMais, () => incrementarCarreiras(card));
    }
    if (btnMenos) {
      btnMenos.addEventListener("click", () => decrementarCarreiras(card));
      vincularRepeticaoPressaoLonga(btnMenos, () => decrementarCarreiras(card));
    }
    if (inputCarreiras) inputCarreiras.addEventListener("input", () => atualizarContador(card));
    if (btnZerar) btnZerar.addEventListener("click", () => zerarContador(card));
    if (inputPontos) inputPontos.addEventListener("input", () => atualizarContador(card));
    if (inputMeta) inputMeta.addEventListener("input", () => atualizarContador(card));
    if (btnRemover) btnRemover.addEventListener("click", () => removerContador(card));
    if (btnExpandir) btnExpandir.addEventListener("click", () => abrirTelaToda(card));

    if (btnToggleMotivo && corpoMotivo) {
      btnToggleMotivo.addEventListener("click", () => {
        const aberto = corpoMotivo.classList.toggle("aberto");
        btnToggleMotivo.setAttribute("aria-expanded", aberto ? "true" : "false");
        btnToggleMotivo.textContent = aberto ? "🔗 Motivo & Lembrete ▴" : "🔗 Motivo & Lembrete ▾";
      });
    }
    if (inputMotivoCada) inputMotivoCada.addEventListener("input", () => atualizarContador(card));
    if (inputMotivoCiclo) inputMotivoCiclo.addEventListener("input", () => atualizarContador(card));
    if (inputMotivoTexto) inputMotivoTexto.addEventListener("input", () => atualizarContador(card));

    atualizarContador(card);
  }

  function init() {
    const btnAdicionarContador = document.getElementById("btn-adicionar-contador");
    const btnSilenciarAlarme = document.getElementById("btn-silenciar-alarme");

    if (btnAdicionarContador) {
      btnAdicionarContador.addEventListener("click", adicionarNovoContador);
    }

    if (btnSilenciarAlarme) {
      btnSilenciarAlarme.addEventListener("click", () => Animacoes.silenciarAlarmeVisual());
    }

    // Eventos do modo Toque na Tela Toda
    document.getElementById("btn-contador-tela-toda-topo")?.addEventListener("click", () => {
      abrirTelaToda(document.querySelector(".card-contador"));
    });
    document.getElementById("btn-tela-toda-sair")?.addEventListener("click", fecharTelaToda);
    const zonaTelaToda = document.getElementById("zona-toque-tela-toda");
    let swipeTelaToda = null;
    let ignorarProximoClickTelaToda = false;

    const pulsarNumeroTelaToda = () => {
      const numEl = document.getElementById("tela-toda-numero");
      if (numEl) {
        numEl.classList.remove("pulso");
        void numEl.offsetWidth;
        numEl.classList.add("pulso");
      }
    };

    zonaTelaToda?.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        swipeTelaToda = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      },
      { passive: true }
    );

    zonaTelaToda?.addEventListener(
      "touchend",
      (e) => {
        if (!swipeTelaToda || !cardTelaToda || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - swipeTelaToda.x;
        const dy = e.changedTouches[0].clientY - swipeTelaToda.y;
        swipeTelaToda = null;

        if (dy >= 55 || dx <= -55) {
          ignorarProximoClickTelaToda = true;
          decrementarCarreiras(cardTelaToda);
          atualizarTelaToda();
          pulsarNumeroTelaToda();
          if (typeof Configuracoes !== "undefined") Configuracoes.vibrar([12, 30, 12]);
          setTimeout(() => { ignorarProximoClickTelaToda = false; }, 260);
        } else if (dy <= -55 || dx >= 55) {
          ignorarProximoClickTelaToda = true;
          incrementarCarreiras(cardTelaToda);
          atualizarTelaToda();
          pulsarNumeroTelaToda();
          setTimeout(() => { ignorarProximoClickTelaToda = false; }, 260);
        }
      },
      { passive: true }
    );

    zonaTelaToda?.addEventListener("click", () => {
      if (!cardTelaToda || ignorarProximoClickTelaToda) return;
      incrementarCarreiras(cardTelaToda);
      atualizarTelaToda();
      pulsarNumeroTelaToda();
    });
    document.getElementById("btn-tela-toda-menos")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!cardTelaToda) return;
      decrementarCarreiras(cardTelaToda);
      atualizarTelaToda();
    });
    document.getElementById("btn-tela-toda-cadeado")?.addEventListener("click", (e) => {
      e.stopPropagation();
      telaTodaTravada = !telaTodaTravada;
      atualizarBotoesCadeadoTelaToda();
      if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(14);
    });
    document.getElementById("btn-tela-toda-zerar")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!cardTelaToda || telaTodaTravada) return;
      const btnZ = e.currentTarget;
      if (!confirmarZerarPendente) {
        confirmarZerarPendente = true;
        btnZ.textContent = "Confirmar?";
        btnZ.classList.add("confirmando");
        return;
      }
      zerarContador(cardTelaToda);
      telaTodaTravada = true;
      atualizarBotoesCadeadoTelaToda();
      atualizarTelaToda();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && cardTelaToda) {
        fecharTelaToda();
      }
    });

    const projAtivo = typeof ProjetoContexto !== "undefined" ? ProjetoContexto.obterProjetoAtivo() : null;
    if (projAtivo) {
      carregarDoProjeto(projAtivo);
      return;
    }

    const restaurado = carregarEstadoContadores();
    if (!restaurado) {
      const contadorInicial = document.getElementById("contador-1");
      if (contadorInicial) {
        configurarEventosCard(contadorInicial);
      }
      atualizarVisibilidadeBotoesRemover();
    }
  }

  function definirCarreiraPrincipal(valor, origem = "externo") {
    const card = document.querySelector(".card-contador");
    const n = Math.max(0, parseInt(valor, 10) || 0);
    if (!card) {
      try {
        const bruto = localStorage.getItem(CHAVE_STORAGE);
        const lista = bruto ? JSON.parse(bruto) : [{ id: "1", nome: "Contador Principal", carreiras: 0, pontosPorCarreira: 0, meta: 0 }];
        if (Array.isArray(lista) && lista.length > 0) {
          lista[0].carreiras = n;
          localStorage.setItem(CHAVE_STORAGE, JSON.stringify(lista));
          window.dispatchEvent(new CustomEvent("ponto-trama:contador-alterado", { detail: { carreiras: n, origem } }));
          if (typeof ProjetoContexto !== "undefined" && !ProjetoContexto.estaHidratando() && ProjetoContexto.obterProjetoAtivo()) {
            ProjetoContexto.atualizarSecaoAtiva("contadores", lista, { origem });
          }
        }
      } catch {
        // ignora
      }
      return;
    }
    const inputCarreiras = card.querySelector(".input-carreiras");
    if (!inputCarreiras || Number(inputCarreiras.value) === n) return;
    inputCarreiras.value = n;
    atualizarContador(card);
    if (cardTelaToda === card) atualizarTelaToda();
  }

  function incrementarPrincipal(origem = "receitas") {
    const card = document.querySelector(".card-contador");
    if (card) {
      const inp = card.querySelector(".input-carreiras");
      const atual = parseInt(inp?.value, 10) || 0;
      definirCarreiraPrincipal(atual + 1, origem);
      return;
    }
    try {
      const bruto = localStorage.getItem(CHAVE_STORAGE);
      const lista = bruto ? JSON.parse(bruto) : [{ id: "1", nome: "Contador Principal", carreiras: 0, pontosPorCarreira: 0, meta: 0 }];
      const atual = Array.isArray(lista) && lista[0] ? parseInt(lista[0].carreiras, 10) || 0 : 0;
      definirCarreiraPrincipal(atual + 1, origem);
    } catch {
      // ignora
    }
  }

  function decrementarPrincipal(origem = "receitas") {
    const card = document.querySelector(".card-contador");
    if (card) {
      const inp = card.querySelector(".input-carreiras");
      const atual = parseInt(inp?.value, 10) || 0;
      definirCarreiraPrincipal(Math.max(0, atual - 1), origem);
      return;
    }
    try {
      const bruto = localStorage.getItem(CHAVE_STORAGE);
      const lista = bruto ? JSON.parse(bruto) : [{ id: "1", nome: "Contador Principal", carreiras: 0, pontosPorCarreira: 0, meta: 0 }];
      const atual = Array.isArray(lista) && lista[0] ? parseInt(lista[0].carreiras, 10) || 0 : 0;
      definirCarreiraPrincipal(Math.max(0, atual - 1), origem);
    } catch {
      // ignora
    }
  }

  return {
    init,
    carregarDoProjeto,
    atualizarContador,
    incrementarCarreiras,
    decrementarCarreiras,
    zerarContador,
    definirCarreiraPrincipal,
    incrementarPrincipal,
    decrementarPrincipal,
    abrirTelaToda
  };
})();
