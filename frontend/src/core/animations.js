// ==========================================================================
// PONTO & TRAMA - MÓDULO DE ANIMAÇÕES E EFEITOS GLOBAIS
// Concentra as funções de efeitos visuais, transições e animações da interface.
// ==========================================================================

const Animacoes = {
  // FLIP Helper: Anima o deslizamento suave de um ou mais elementos quando outros são adicionados/removidos
  animarDeslocamento(alvo, callbackMudanca) {
    if (!alvo) {
      if (typeof callbackMudanca === "function") callbackMudanca();
      return;
    }
    const elementos =
      alvo instanceof NodeList || Array.isArray(alvo)
        ? Array.from(alvo).filter(Boolean)
        : [alvo];

    if (elementos.length === 0) {
      if (typeof callbackMudanca === "function") callbackMudanca();
      return;
    }

    const posicoesAntes = elementos.map((el) => ({
      el,
      rect: el.getBoundingClientRect()
    }));

    if (typeof callbackMudanca === "function") callbackMudanca();

    posicoesAntes.forEach(({ el, rect: rectAntes }) => {
      const rectDepois = el.getBoundingClientRect();
      const deltaX = rectAntes.left - rectDepois.left;

      if (deltaX !== 0) {
        el.style.transition = "none";
        el.style.transform = `translateX(${deltaX}px)`;
        // Força reflow no navegador
        void el.offsetHeight;
        el.style.transition = "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.transform = "";
      }
    });
  },

  // Efeito de Alarme Visual: faz a tela piscar entre cor original e vermelho e mostra o banner
  dispararAlarmeVisual(mensagem) {
    const conteudoPrincipal = document.getElementById("conteudo-principal");
    const bannerAlarme = document.getElementById("banner-alarme");
    const textoAlertaMeta = document.getElementById("texto-alerta-meta");

    if (conteudoPrincipal) {
      conteudoPrincipal.classList.add("alarme-tela-ativa");
    }
    document.body.classList.add("alarme-tela-ativa");

    if (bannerAlarme) {
      if (textoAlertaMeta) {
        textoAlertaMeta.textContent = mensagem || "Meta de carreiras atingida!";
      }
      bannerAlarme.style.display = "flex";
    }
  },

  // Silencia o efeito de alarme visual
  silenciarAlarmeVisual() {
    const conteudoPrincipal = document.getElementById("conteudo-principal");
    const bannerAlarme = document.getElementById("banner-alarme");

    if (conteudoPrincipal) {
      conteudoPrincipal.classList.remove("alarme-tela-ativa");
    }
    document.body.classList.remove("alarme-tela-ativa");

    if (bannerAlarme) {
      bannerAlarme.style.display = "none";
    }
  },

  // Animação de saída de elemento com classe de animação e callback de remoção
  animarSaida(elemento, classeAnimacao, duracaoMs, callback) {
    if (!elemento) return;
    elemento.classList.add(classeAnimacao);
    setTimeout(() => {
      if (typeof callback === "function") callback();
    }, duracaoMs || 250);
  },

  // Efeito de pulso para valores recalculados
  animarPulso(elemento) {
    if (!elemento) return;
    elemento.classList.remove("pulso-atualizacao");
    void elemento.offsetHeight;
    elemento.classList.add("pulso-atualizacao");
  }
};
