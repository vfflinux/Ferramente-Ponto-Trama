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
      left: el.getBoundingClientRect().left
    }));

    if (typeof callbackMudanca === "function") callbackMudanca();

    // Agrupa todas as leituras de layout antes das escritas (elimina N reflows forçados!)
    const deltas = [];
    for (let i = 0; i < posicoesAntes.length; i++) {
      const item = posicoesAntes[i];
      const deltaX = item.left - item.el.getBoundingClientRect().left;
      if (deltaX !== 0) {
        deltas.push({ el: item.el, deltaX });
      }
    }

    if (deltas.length === 0) return;

    for (let i = 0; i < deltas.length; i++) {
      const { el, deltaX } = deltas[i];
      el.style.transition = "none";
      el.style.transform = `translate3d(${deltaX}px, 0, 0)`;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (let i = 0; i < deltas.length; i++) {
          const { el } = deltas[i];
          el.style.transition = "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";
          el.style.transform = "";
        }
      });
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
