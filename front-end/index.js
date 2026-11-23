// ==========================================================================
// CONTADOR DE CARREIRAS - FRONT-END
// Suporte a múltiplos contadores simultâneos, animação fluida,
// cálculo de pontos em tempo real e alarme de meta com tela piscando.
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const areaContadores = document.getElementById("area-contadores");
  const btnAdicionarContador = document.getElementById("btn-adicionar-contador");
  const bannerAlarme = document.getElementById("banner-alarme");
  const textoAlertaMeta = document.getElementById("texto-alerta-meta");
  const btnSilenciarAlarme = document.getElementById("btn-silenciar-alarme");
  const conteudoPrincipal = document.getElementById("conteudo-principal");

  let contadorIdCounter = 1;

  // --------------------------------------------------------------------------
  // FLIP Helper: Anima o deslizamento suave do(s) contador(es) existente(s)
  // --------------------------------------------------------------------------
  function animarDeslocamento(elemento, callbackMudanca) {
    if (!elemento) {
      callbackMudanca();
      return;
    }
    const rectAntes = elemento.getBoundingClientRect();
    callbackMudanca();
    const rectDepois = elemento.getBoundingClientRect();
    const deltaX = rectAntes.left - rectDepois.left;

    if (deltaX !== 0) {
      elemento.style.transition = "none";
      elemento.style.transform = `translateX(${deltaX}px)`;
      // Força reflow no navegador
      void elemento.offsetHeight;
      elemento.style.transition = "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)";
      elemento.style.transform = "";
    }
  }

  // --------------------------------------------------------------------------
  // Atualiza cálculos de pontos e verifica disparo de alarme
  // --------------------------------------------------------------------------
  function atualizarContador(card) {
    const inputCarreiras = card.querySelector(".input-carreiras");
    const inputPontos = card.querySelector(".input-pontos-carreira");
    const totalPontosElem = card.querySelector(".valor-total-pontos");
    const inputMeta = card.querySelector(".input-meta");
    const badgeStatus = card.querySelector(".badge-status-alarme");
    const nomeContador = card.querySelector(".nome-contador").value || "Contador";

    let carreiras = parseInt(inputCarreiras.value, 10);
    if (isNaN(carreiras) || carreiras < 0) {
      carreiras = 0;
      inputCarreiras.value = 0;
    }

    let pontosPorCarreira = parseInt(inputPontos.value, 10);
    if (isNaN(pontosPorCarreira) || pontosPorCarreira < 0) {
      pontosPorCarreira = 0;
    }

    // 3# Cálculo de Pontos: carreiras * pontos
    const total = carreiras * pontosPorCarreira;
    totalPontosElem.textContent = total.toLocaleString("pt-BR");

    // 4# Verificação de Alarme / Meta
    const meta = parseInt(inputMeta.value, 10);
    if (!isNaN(meta) && meta > 0) {
      if (carreiras >= meta) {
        dispararAlarme(card, `${nomeContador} atingiu a meta de ${meta} carreiras!`);
        if (badgeStatus) {
          badgeStatus.textContent = "Meta atingida!";
          badgeStatus.className = "badge-status-alarme disparado";
        }
      } else {
        if (badgeStatus) {
          badgeStatus.textContent = `Meta: ${meta}`;
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
  }

  // --------------------------------------------------------------------------
  // Dispara o alarme visual (faz a tela piscar entre cor do site e vermelho)
  // --------------------------------------------------------------------------
  function dispararAlarme(card, mensagem) {
    card.classList.add("alarme-disparado");

    if (conteudoPrincipal) {
      conteudoPrincipal.classList.add("alarme-tela-ativa");
    }
    document.body.classList.add("alarme-tela-ativa");

    if (bannerAlarme) {
      textoAlertaMeta.textContent = mensagem || "Meta de carreiras atingida!";
      bannerAlarme.style.display = "flex";
    }
  }

  function removerAlarmeCard(card) {
    card.classList.remove("alarme-disparado");
    const algumDisparado = document.querySelector(".card-contador.alarme-disparado");
    if (!algumDisparado) {
      silenciarAlarme();
    }
  }

  function silenciarAlarme() {
    if (conteudoPrincipal) {
      conteudoPrincipal.classList.remove("alarme-tela-ativa");
    }
    document.body.classList.remove("alarme-tela-ativa");

    if (bannerAlarme) {
      bannerAlarme.style.display = "none";
    }
  }

  if (btnSilenciarAlarme) {
    btnSilenciarAlarme.addEventListener("click", silenciarAlarme);
  }

  // --------------------------------------------------------------------------
  // Configura os eventos de um Card de Contador (Requisitos 1#, 3# e 4#)
  // --------------------------------------------------------------------------
  function configurarEventosCard(card) {
    const inputCarreiras = card.querySelector(".input-carreiras");
    const btnMais = card.querySelector(".btn-mais");
    const btnMenos = card.querySelector(".btn-menos");
    const btnZerar = card.querySelector(".btn-zerar");
    const inputPontos = card.querySelector(".input-pontos-carreira");
    const inputMeta = card.querySelector(".input-meta");
    const btnTestarAlarme = card.querySelector(".btn-testar-alarme");
    const btnRemover = card.querySelector(".btn-remover-contador");

    // Adicionar 1 (+) na direita
    btnMais.addEventListener("click", () => {
      let val = parseInt(inputCarreiras.value, 10) || 0;
      inputCarreiras.value = val + 1;
      atualizarContador(card);
    });

    // Retirar 1 (−) na esquerda
    btnMenos.addEventListener("click", () => {
      let val = parseInt(inputCarreiras.value, 10) || 0;
      if (val > 0) {
        inputCarreiras.value = val - 1;
        atualizarContador(card);
      }
    });

    // Inserção manual de carreiras
    inputCarreiras.addEventListener("input", () => {
      atualizarContador(card);
    });

    // Botão simples de zerar
    btnZerar.addEventListener("click", () => {
      inputCarreiras.value = 0;
      atualizarContador(card);
    });

    // Inserção de pontos por carreira
    inputPontos.addEventListener("input", () => {
      atualizarContador(card);
    });

    // Inserção de meta
    inputMeta.addEventListener("input", () => {
      atualizarContador(card);
    });

    // Testar alarme visual (se existir)
    if (btnTestarAlarme) {
      btnTestarAlarme.addEventListener("click", () => {
        const nome = card.querySelector(".nome-contador").value || "Contador";
        dispararAlarme(card, `[Teste de Alarme] Piscar de tela ativado para ${nome}!`);
      });
    }

    // 2# Botão de remover contador secundário com animação fluida
    if (btnRemover) {
      btnRemover.addEventListener("click", () => {
        removerContador(card);
      });
    }

    // Atualização inicial
    atualizarContador(card);
  }

  // --------------------------------------------------------------------------
  // 2# Adicionar Novo Contador (Múltiplos contadores simultâneos)
  // Desliza o contador inicial e infla o novo com animação suave
  // --------------------------------------------------------------------------
  function criarElementoContador(id) {
    const card = document.createElement("article");
    card.className = "card-contador animar-inflar";
    card.id = `contador-${id}`;
    card.dataset.id = id;

    card.innerHTML = `
      <div class="card-topo">
        <input type="text" class="nome-contador" value="Contador #${id}" title="Clique para renomear" />
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
            type="number"
            class="input-carreiras"
            id="carreiras-${id}"
            value="0"
            min="0"
            step="1"
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
            type="number"
            id="pontos-carreira-${id}"
            class="input-pontos-carreira"
            value="0"
            min="0"
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
            type="number"
            id="meta-${id}"
            class="input-meta"
            placeholder="0"
            min="0"
            aria-label="Meta de carreiras para disparar alarme"
            title="Clique para digitar a carreira de aviso"
          />
        </div>
      </div>
    `;

    return card;
  }

  function adicionarNovoContador() {
    contadorIdCounter++;
    const contadorInicial = document.getElementById("contador-1");
    const novoCard = criarElementoContador(contadorIdCounter);

    // Desliza fluidamente o contador inicial para o lado enquanto o novo infla
    animarDeslocamento(contadorInicial, () => {
      areaContadores.appendChild(novoCard);
    });

    configurarEventosCard(novoCard);

    // Rola suavemente se necessário
    novoCard.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
  }

  function removerContador(card) {
    const contadorInicial = document.getElementById("contador-1");

    // Animação de desinflar
    card.classList.remove("animar-inflar");
    card.classList.add("animar-desinflar");

    setTimeout(() => {
      // Desliza fluidamente o contador inicial de volta para o centro
      animarDeslocamento(contadorInicial, () => {
        card.remove();
        removerAlarmeCard(card);
      });
    }, 320);
  }

  // --------------------------------------------------------------------------
  // Alternância entre ferramentas da Barra Lateral
  // Cada opção exibe seu espaço reservado correspondente.
  // Quando qualquer opção tirando "Contador de carreiras" for clicada,
  // oculta o contador com display: none. Ao clicar no contador, restaura com display.
  // --------------------------------------------------------------------------
  const botoesFerramenta = document.querySelectorAll(".barraLateral .botaoFerramenta");
  const todasSecoesFerramentas = document.querySelectorAll(".secao-ferramenta");
  const secaoContador = document.getElementById("secao-contador-carreiras");
  const conteinerContador = document.getElementById("conteiner-contador");

  botoesFerramenta.forEach((botao) => {
    botao.addEventListener("click", () => {
      const ferramenta = botao.dataset.ferramenta || (botao.getAttribute("title") || "").toLowerCase();
      const isContador = ferramenta === "contador-carreiras" || ferramenta.includes("contador");

      // Atualiza classe ativa na barra lateral
      botoesFerramenta.forEach((b) => b.classList.remove("ativo"));
      botao.classList.add("ativo");

      // Oculta todas as seções reservadas
      todasSecoesFerramentas.forEach((secao) => {
        secao.style.display = "none";
      });

      // Garante que o contador esteja oculto se outra opção foi clicada
      if (!isContador) {
        if (secaoContador) secaoContador.style.display = "none";
        if (conteinerContador) conteinerContador.style.display = "none";
      }

      // Exibe a seção reservada correspondente
      const secaoAlvo = document.getElementById(`secao-${ferramenta}`);
      if (secaoAlvo) {
        secaoAlvo.style.display = "flex";
      }

      // Se for o contador, restaura seu display flex
      if (isContador) {
        if (secaoContador) secaoContador.style.display = "flex";
        if (conteinerContador) conteinerContador.style.display = "flex";
      }
    });
  });

  // --------------------------------------------------------------------------
  // Inicialização
  // --------------------------------------------------------------------------
  if (btnAdicionarContador) {
    btnAdicionarContador.addEventListener("click", adicionarNovoContador);
  }

  const contadorInicial = document.getElementById("contador-1");
  if (contadorInicial) {
    configurarEventosCard(contadorInicial);
  }
});
