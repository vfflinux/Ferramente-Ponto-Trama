// ==========================================================================
// PONTO & TRAMA (ÑANDUOBYETÉ) — ARANHAS VIVAS DO ATELIÊ (MOTOR ORGÂNICO v2)
// - 5 espécies vetoriais com articulação INDIVIDUAL das 8 patas (pivô real
//   em cada junta coxal + onda metacrônica 4+4 sincronizada à velocidade real).
// - Física suave com inércia de aceleração/frenagem e rotação amortecida (lerp).
// - 5 comportamentos naturais autênticos:
//     1. Grooming (limpar as patinhas dianteiras com os pedipalpos)
//     2. Probing (tatear o caminho alternando patas frontais)
//     3. Olhar Curioso (Papa-Moscas acompanha o cursor à distância 105-290px!)
//     4. Crouch & Spring Landing (agacha antes do salto e amortece a queda)
//     5. Silk Anchor Tap (abaixa levemente o abdômen para ancorar ponto de seda)
// - 100% offline, 60 FPS GPU-acelerado, 0% CPU em repouso e acessibilidade total.
// ==========================================================================

const AranhasAtelie = (() => {
  const MAX_INSTANCIAS = {
    desligado: 0,
    discreto: 1,
    vivo: 2
  };

  const INTERVALOS_MS = {
    discreto: [34000, 72000],
    vivo: [11000, 26000]
  };

  // Helper para criar cada pata articulada com pivô exato na junta do cefalotórax
  function pata(lado, par, ox, oy, conteudo) {
    return `<g class="pata-art" data-lado="${lado}" data-par="${par}" style="transform-origin:${ox}px ${oy}px">${conteudo}</g>`;
  }

  // ==========================================================================
  // 1. CATÁLOGO DAS 5 ESPÉCIES COM 8 PATAS ARTICULADAS INDIVIDUALMENTE
  // ==========================================================================

  function svgNanduobyete() {
    return `
      <svg viewBox="0 0 120 120" class="aranha-svg especie-nandu" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          ${pata(-1, 0, 51, 43, `<path d="M51 43 L30 28 L17 14 L12 6" stroke-width="2.6"/><path d="M27 25 L21 19" stroke="var(--aranha-acento)" stroke-width="3.2"/>`)}
          ${pata(1, 0, 69, 43, `<path d="M69 43 L90 28 L103 14 L108 6" stroke-width="2.6"/><path d="M93 25 L99 19" stroke="var(--aranha-acento)" stroke-width="3.2"/>`)}
          ${pata(-1, 1, 50, 49, `<path d="M50 49 L25 41 L11 32 L5 24" stroke-width="2.4"/><path d="M22 39 L15 35" stroke="var(--aranha-acento)" stroke-width="3"/>`)}
          ${pata(1, 1, 70, 49, `<path d="M70 49 L95 41 L109 32 L115 24" stroke-width="2.4"/><path d="M98 39 L105 35" stroke="var(--aranha-acento)" stroke-width="3"/>`)}
          ${pata(-1, 2, 50, 56, `<path d="M50 56 L26 62 L13 74 L7 84" stroke-width="2.4"/><path d="M23 64 L17 70" stroke="var(--aranha-acento)" stroke-width="3"/>`)}
          ${pata(1, 2, 70, 56, `<path d="M70 56 L94 62 L107 74 L113 84" stroke-width="2.4"/><path d="M97 64 L103 70" stroke="var(--aranha-acento)" stroke-width="3"/>`)}
          ${pata(-1, 3, 51, 61, `<path d="M51 61 L32 79 L23 97 L18 111" stroke-width="2.6"/><path d="M30 83 L26 92" stroke="var(--aranha-acento)" stroke-width="3.2"/>`)}
          ${pata(1, 3, 69, 61, `<path d="M69 61 L88 79 L97 97 L102 111" stroke-width="2.6"/><path d="M90 83 L94 92" stroke="var(--aranha-acento)" stroke-width="3.2"/>`)}
        </g>
        <g class="aranha-palpos" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
          <path d="M55 37 L51 28 L54 22"></path>
          <path d="M65 37 L69 28 L66 22"></path>
        </g>
        <g class="aranha-abdomen">
          <path d="M60 58 L75 69 L72 90 L60 101 L48 90 L45 69 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"></path>
          <path d="M51 71 L60 64 L69 71" fill="none" stroke="var(--aranha-acento)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>
          <polygon points="60,72 67,79 60,86 53,79" fill="var(--aranha-acento)" fill-opacity="0.38" stroke="currentColor" stroke-width="1.5"></polygon>
          <path d="M52 89 L60 83 L68 89" fill="none" stroke="var(--aranha-acento)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path>
          <circle cx="53" cy="79" r="1.4" fill="currentColor"></circle>
          <circle cx="67" cy="79" r="1.4" fill="currentColor"></circle>
          <path d="M58 101 L57 105 M62 101 L63 105" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
        </g>
        <g class="aranha-cefalotorax">
          <path d="M60 33 L70 40 L69 54 L60 58 L51 54 L50 40 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2"></path>
          <path d="M54 41 L60 47 L66 41" fill="none" stroke="var(--aranha-acento)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
          <g class="aranha-olhos-vivos">
            <circle cx="57" cy="36.5" r="1.6" fill="currentColor"></circle>
            <circle cx="63" cy="36.5" r="1.6" fill="currentColor"></circle>
            <circle cx="53.5" cy="38.5" r="1.1" fill="currentColor" opacity="0.8"></circle>
            <circle cx="66.5" cy="38.5" r="1.1" fill="currentColor" opacity="0.8"></circle>
          </g>
        </g>
      </svg>
    `;
  }

  function svgPapaMoscas() {
    return `
      <svg viewBox="0 0 120 120" class="aranha-svg especie-papa-moscas" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          ${pata(-1, 0, 48, 44, `<path d="M48 44 L31 32 L24 22 L22 15" stroke-width="3.2"/>`)}
          ${pata(1, 0, 72, 44, `<path d="M72 44 L89 32 L96 22 L98 15" stroke-width="3.2"/>`)}
          ${pata(-1, 1, 47, 51, `<path d="M47 51 L29 45 L19 38 L15 32" stroke-width="2.8"/>`)}
          ${pata(1, 1, 73, 51, `<path d="M73 51 L91 45 L101 38 L105 32" stroke-width="2.8"/>`)}
          ${pata(-1, 2, 47, 59, `<path d="M47 59 L29 66 L20 76 L16 83" stroke-width="2.8"/>`)}
          ${pata(1, 2, 73, 59, `<path d="M73 59 L91 66 L100 76 L104 83" stroke-width="2.8"/>`)}
          ${pata(-1, 3, 49, 65, `<path d="M49 65 L34 80 L27 93 L25 102" stroke-width="3"/>`)}
          ${pata(1, 3, 71, 65, `<path d="M71 65 L86 80 L93 93 L95 102" stroke-width="3"/>`)}
        </g>
        <g class="aranha-palpos" fill="var(--aranha-acento)" fill-opacity="0.35" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <path d="M52 38 Q46 31 50 26 Q54 27 55 34"></path>
          <path d="M68 38 Q74 31 70 26 Q66 27 65 34"></path>
        </g>
        <g class="aranha-abdomen">
          <ellipse cx="60" cy="79" rx="18" ry="20" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.3"></ellipse>
          <path d="M47 72 Q60 66 73 72 M45 81 Q60 75 75 81 M49 90 Q60 85 71 90" fill="none" stroke="var(--aranha-acento)" stroke-width="2.2" stroke-linecap="round"></path>
        </g>
        <g class="aranha-cefalotorax">
          <rect x="44" y="34" width="32" height="26" rx="10" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.3"></rect>
          <path d="M50 47 L60 53 L70 47" fill="none" stroke="var(--aranha-acento)" stroke-width="2" stroke-linecap="round"></path>
          <g class="aranha-olhos-vivos">
            <circle cx="54.5" cy="37.5" r="4.2" fill="currentColor"></circle>
            <circle cx="65.5" cy="37.5" r="4.2" fill="currentColor"></circle>
            <circle cx="53.3" cy="36.2" r="1.35" fill="var(--aranha-brilho-olho)"></circle>
            <circle cx="64.3" cy="36.2" r="1.35" fill="var(--aranha-brilho-olho)"></circle>
            <circle cx="47.5" cy="40" r="2.2" fill="currentColor"></circle>
            <circle cx="72.5" cy="40" r="2.2" fill="currentColor"></circle>
          </g>
        </g>
      </svg>
    `;
  }

  function svgTecelaRenda() {
    return `
      <svg viewBox="0 0 120 120" class="aranha-svg especie-renda" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          ${pata(-1, 0, 54, 44, `<path d="M54 44 L31 24 L15 11 L7 4" stroke-width="1.9"/><circle cx="22" cy="17" r="2" fill="var(--aranha-acento)" stroke="none"/>`)}
          ${pata(1, 0, 66, 44, `<path d="M66 44 L89 24 L105 11 L113 4" stroke-width="1.9"/><circle cx="98" cy="17" r="2" fill="var(--aranha-acento)" stroke="none"/>`)}
          ${pata(-1, 1, 53, 48, `<path d="M53 48 L24 36 L8 24 L2 16" stroke-width="1.8"/><circle cx="16" cy="30" r="1.9" fill="var(--aranha-acento)" stroke="none"/>`)}
          ${pata(1, 1, 67, 48, `<path d="M67 48 L96 36 L112 24 L118 16" stroke-width="1.8"/><circle cx="104" cy="30" r="1.9" fill="var(--aranha-acento)" stroke="none"/>`)}
          ${pata(-1, 2, 53, 54, `<path d="M53 54 L26 62 L11 76 L4 88" stroke-width="1.8"/>`)}
          ${pata(1, 2, 67, 54, `<path d="M67 54 L94 62 L109 76 L116 88" stroke-width="1.8"/>`)}
          ${pata(-1, 3, 54, 57, `<path d="M54 57 L32 79 L19 100 L12 115" stroke-width="1.9"/><circle cx="25" cy="90" r="2" fill="var(--aranha-acento)" stroke="none"/>`)}
          ${pata(1, 3, 66, 57, `<path d="M66 57 L88 79 L101 100 L108 115" stroke-width="1.9"/><circle cx="95" cy="90" r="2" fill="var(--aranha-acento)" stroke="none"/>`)}
        </g>
        <g class="aranha-palpos" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M56 38 L53 29 M64 38 L67 29"></path>
        </g>
        <g class="aranha-abdomen">
          <path d="M60 55 C71 58 72 86 60 107 C48 86 49 58 60 55 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2"></path>
          <path d="M60 59 L60 102 M54 68 L66 78 M66 68 L54 78 M54 82 L66 92 M66 82 L54 92" fill="none" stroke="var(--aranha-acento)" stroke-width="1.5" opacity="0.85"></path>
        </g>
        <g class="aranha-cefalotorax">
          <ellipse cx="60" cy="46" rx="7.5" ry="9" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.9"></ellipse>
          <g class="aranha-olhos-vivos">
            <circle cx="57.5" cy="39" r="1.3" fill="currentColor"></circle>
            <circle cx="62.5" cy="39" r="1.3" fill="currentColor"></circle>
          </g>
        </g>
      </svg>
    `;
  }

  function svgCaranguejo() {
    return `
      <svg viewBox="0 0 120 120" class="aranha-svg especie-caranguejo" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          ${pata(-1, 0, 48, 47, `<path d="M48 47 L22 39 L10 26 L13 13" stroke-width="3"/>`)}
          ${pata(1, 0, 72, 47, `<path d="M72 47 L98 39 L110 26 L107 13" stroke-width="3"/>`)}
          ${pata(-1, 1, 48, 52, `<path d="M48 52 L22 51 L10 41 L8 29" stroke-width="2.8"/>`)}
          ${pata(1, 1, 72, 52, `<path d="M72 52 L98 51 L110 41 L112 29" stroke-width="2.8"/>`)}
          ${pata(-1, 2, 49, 60, `<path d="M49 60 L32 69 L24 79" stroke-width="2.3"/>`)}
          ${pata(1, 2, 71, 60, `<path d="M71 60 L88 69 L96 79" stroke-width="2.3"/>`)}
          ${pata(-1, 3, 51, 65, `<path d="M51 65 L38 79 L33 91" stroke-width="2.3"/>`)}
          ${pata(1, 3, 69, 65, `<path d="M69 65 L82 79 L87 91" stroke-width="2.3"/>`)}
        </g>
        <g class="aranha-palpos" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M55 40 L52 33 M65 40 L68 33"></path>
        </g>
        <g class="aranha-abdomen">
          <path d="M60 58 L79 71 L75 91 L60 98 L45 91 L41 71 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"></path>
          <path d="M60 63 L60 93 M47 74 L60 80 L73 74 M49 85 L60 89 L71 85" fill="none" stroke="var(--aranha-acento)" stroke-width="1.9" stroke-linecap="round"></path>
        </g>
        <g class="aranha-cefalotorax">
          <ellipse cx="60" cy="49" rx="12" ry="10" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.1"></ellipse>
          <g class="aranha-olhos-vivos">
            <circle cx="56" cy="42.5" r="1.4" fill="currentColor"></circle>
            <circle cx="64" cy="42.5" r="1.4" fill="currentColor"></circle>
            <circle cx="52" cy="44" r="1.1" fill="currentColor"></circle>
            <circle cx="68" cy="44" r="1.1" fill="currentColor"></circle>
          </g>
        </g>
      </svg>
    `;
  }

  function svgFilhote() {
    return `
      <svg viewBox="0 0 120 120" class="aranha-svg especie-filhote" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2">
          ${pata(-1, 0, 53, 48, `<path d="M53 48 L36 35 L25 22"/>`)}
          ${pata(1, 0, 67, 48, `<path d="M67 48 L84 35 L95 22"/>`)}
          ${pata(-1, 1, 53, 52, `<path d="M53 52 L32 46 L19 38"/>`)}
          ${pata(1, 1, 67, 52, `<path d="M67 52 L88 46 L101 38"/>`)}
          ${pata(-1, 2, 53, 57, `<path d="M53 57 L34 65 L23 76"/>`)}
          ${pata(1, 2, 67, 57, `<path d="M67 57 L86 65 L97 76"/>`)}
          ${pata(-1, 3, 54, 61, `<path d="M54 61 L38 77 L29 92"/>`)}
          ${pata(1, 3, 66, 61, `<path d="M66 61 L82 77 L91 92"/>`)}
        </g>
        <g class="aranha-abdomen">
          <polygon points="60,57 72,71 60,87 48,71" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"></polygon>
          <polygon points="60,64 65,71 60,78 55,71" fill="var(--aranha-acento)" fill-opacity="0.45"></polygon>
        </g>
        <g class="aranha-cefalotorax">
          <circle cx="60" cy="49" r="8" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.1"></circle>
          <g class="aranha-olhos-vivos">
            <circle cx="57.5" cy="45.5" r="1.5" fill="currentColor"></circle>
            <circle cx="62.5" cy="45.5" r="1.5" fill="currentColor"></circle>
          </g>
        </g>
      </svg>
    `;
  }

  const ESPECIES = [
    {
      id: "nandu",
      nome: "Ñanduobyeté (Tecelã Oficial)",
      tamanho: 54,
      velocidadeBase: 72,
      fatorPassada: 0.19,
      ampPata: 10.5,
      comportamentosPausa: ["grooming", "probing", "ancorar_seda"],
      movimentos: ["rapel_fio", "travessia_curva", "patrulha_borda", "espiadinha"],
      gerarSvg: svgNanduobyete
    },
    {
      id: "papa_moscas",
      nome: "Papa-Moscas Curiosa",
      tamanho: 40,
      velocidadeBase: 98,
      fatorPassada: 0.27,
      ampPata: 11.5,
      curiosaCursor: true,
      comportamentosPausa: ["curiosa", "grooming", "probing"],
      movimentos: ["saltinhos", "espiadinha", "patrulha_borda", "travessia_curva"],
      gerarSvg: svgPapaMoscas
    },
    {
      id: "tecela_renda",
      nome: "Tecelã-de-Renda",
      tamanho: 62,
      velocidadeBase: 52,
      fatorPassada: 0.14,
      ampPata: 9.2,
      rastroSeda: true,
      comportamentosPausa: ["ancorar_seda", "probing", "grooming"],
      movimentos: ["patrulha_borda", "travessia_curva", "rapel_fio"],
      gerarSvg: svgTecelaRenda
    },
    {
      id: "caranguejo",
      nome: "Aranha-Caranguejo",
      tamanho: 44,
      velocidadeBase: 64,
      fatorPassada: 0.2,
      ampPata: 11,
      comportamentosPausa: ["probing", "grooming"],
      movimentos: ["lateral_caranguejo", "espiadinha", "patrulha_borda"],
      gerarSvg: svgCaranguejo
    },
    {
      id: "filhote",
      nome: "Filhote Tecelão",
      tamanho: 30,
      velocidadeBase: 60,
      fatorPassada: 0.24,
      ampPata: 10,
      comportamentosPausa: ["probing"],
      movimentos: ["ballooning", "rapel_fio"],
      gerarSvg: svgFilhote
    }
  ];

  // ==========================================================================
  // 2. ESTADO DO MOTOR, FÍSICA SUAVE & PONTEIRO
  // ==========================================================================

  let jaInicializado = false;
  let camadaEl = null;
  let modoAtual = "discreto";
  let reagirCursor = true;
  let timerProxima = null;
  let rafId = null;
  let ultimoFrameTs = 0;
  let ultimaEspecieId = null;
  let ultimoMovimento = null;
  let contadorInstancia = 0;
  let cursorAtual = { x: -9999, y: -9999, ativo: false };

  const ativas = [];

  function animacoesReduzidasAtivas() {
    if (document.documentElement?.getAttribute("data-reduzir-animacoes") === "true") return true;
    if (typeof window !== "undefined" && window.matchMedia) {
      try {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      } catch {
        // ignora
      }
    }
    return false;
  }

  function emZonaDeFocoProtegida() {
    if (document.hidden) return true;
    const telaToda = document.getElementById("overlay-contador-tela-toda");
    if (telaToda && telaToda.style.display === "flex") return true;
    const buscaGlobal = document.getElementById("modal-busca-global");
    if (buscaGlobal && buscaGlobal.style.display === "flex") return true;
    const modais = document.querySelectorAll(
      ".modal-overlay-fio, .modal-overlay-cfg, .modal-overlay-proj, .modal-overlay-banco"
    );
    for (let i = 0; i < modais.length; i++) {
      const st = modais[i].style.display;
      if (st === "flex" || st === "block") return true;
    }
    return false;
  }

  function obterEscalaTela() {
    return window.innerWidth <= 768 ? 0.82 : 1;
  }

  function garantirCamada() {
    if (camadaEl && document.body.contains(camadaEl)) return camadaEl;
    camadaEl = document.getElementById("camada-aranhas-atelie");
    if (!camadaEl) {
      camadaEl = document.createElement("div");
      camadaEl.id = "camada-aranhas-atelie";
      camadaEl.className = "camada-aranhas-atelie";
      camadaEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(camadaEl);
    }
    return camadaEl;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(a, b, f) {
    return a + (b - a) * f;
  }

  // Interpolação angular pelo caminho mais curto (nunca gira 350° ao atravessar ±180°)
  function lerpAngulo(atual, alvo, f) {
    let diff = ((alvo - atual + 540) % 360) - 180;
    return atual + diff * Math.min(1, f);
  }

  function pontoBezierCubica(t, p0, p1, p2, p3) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    return {
      x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
      y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y
    };
  }

  function derivadaBezierCubica(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return {
      x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
      y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
    };
  }

  // ==========================================================================
  // 3. CONSTRUTORES DAS 7 COREOGRAFIAS ORGÂNICAS
  // ==========================================================================

  function criarEstadoCoreografia(tipo, especie) {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const margem = Math.round(especie.tamanho * 1.2);

    if (tipo === "rapel_fio") {
      const xBase = rand(Math.max(100, W * 0.16), Math.max(180, W - 90));
      const profundidade = rand(Math.min(140, H * 0.24), Math.min(320, H * 0.46));
      return {
        tipo,
        xBase,
        x: xBase,
        y: -margem,
        profundidade,
        fase: "descendo",
        tempoFase: 0,
        duracaoInspecao: rand(2.6, 4.4),
        angulo: 180,
        anguloAlvo: 180,
        balancoTempo: rand(0, 6),
        temFio: true,
        fioX: xBase,
        velEscalar: 0.2
      };
    }

    if (tipo === "espiadinha") {
      const lados = ["direita", "esquerda", "topo"];
      const lado = lados[Math.floor(Math.random() * lados.length)];
      let xFora, yFora, xEspia, yEspia, angulo;
      if (lado === "direita") {
        const y = rand(H * 0.18, H * 0.78);
        xFora = W + margem * 0.55;
        xEspia = W - especie.tamanho * 0.24;
        yFora = yEspia = y;
        angulo = -90;
      } else if (lado === "esquerda") {
        const y = rand(H * 0.18, H * 0.78);
        xFora = -margem * 0.55;
        xEspia = especie.tamanho * 0.24;
        yFora = yEspia = y;
        angulo = 90;
      } else {
        const x = rand(W * 0.2, W * 0.85);
        xFora = xEspia = x;
        yFora = -margem * 0.55;
        yEspia = especie.tamanho * 0.26;
        angulo = 180;
      }
      return {
        tipo,
        fase: "entrando",
        t: 0,
        tempoPausa: 0,
        duracaoPausa: rand(2.6, 4.2),
        xFora,
        yFora,
        xEspia,
        yEspia,
        x: xFora,
        y: yFora,
        angulo,
        anguloAlvo: angulo,
        anguloBase: angulo
      };
    }

    if (tipo === "lateral_caranguejo") {
      const noTopo = Math.random() < 0.45;
      const yFaixa = noTopo ? rand(56, 86) : H - rand(28, 56);
      const esqParaDir = Math.random() < 0.5;
      const xInicio = esqParaDir ? -margem : W + margem;
      const xFim = esqParaDir ? W + margem : -margem;
      const ang = noTopo ? 180 : 0;
      return {
        tipo,
        x: xInicio,
        y: yFaixa,
        xInicio,
        xFim,
        yBase: yFaixa,
        dir: esqParaDir ? 1 : -1,
        angulo: ang,
        anguloAlvo: ang,
        velEscalar: 0,
        pausaRestante: 0,
        tempoAtePausa: rand(2.0, 3.6)
      };
    }

    if (tipo === "ballooning") {
      const esqParaDir = Math.random() < 0.6;
      const x0 = esqParaDir ? -margem : W + margem;
      const x1 = esqParaDir ? W + margem : -margem;
      const y0 = rand(H * 0.1, H * 0.4);
      const y1 = rand(H * 0.28, H * 0.72);
      const ang = esqParaDir ? 26 : -26;
      return {
        tipo,
        t: 0,
        duracao: rand(12, 17),
        x0,
        x1,
        y0,
        y1,
        ampOnda: rand(20, 42),
        freqOnda: rand(2.0, 3.4),
        x: x0,
        y: y0,
        angulo: ang,
        anguloAlvo: ang,
        temFioVento: true
      };
    }

    if (tipo === "patrulha_borda") {
      const bordas = ["topo", "base", "direita"];
      const borda = bordas[Math.floor(Math.random() * bordas.length)];
      let p0, p1, p2, p3;
      if (borda === "topo") {
        const y = rand(54, 78);
        const dir = Math.random() < 0.5;
        p0 = { x: dir ? -margem : W + margem, y };
        p3 = { x: dir ? W + margem : -margem, y: y + rand(-10, 10) };
        p1 = { x: W * (dir ? 0.33 : 0.66), y: y + rand(-14, 16) };
        p2 = { x: W * (dir ? 0.66 : 0.33), y: y + rand(-14, 16) };
      } else if (borda === "base") {
        const y = H - rand(24, 48);
        const dir = Math.random() < 0.5;
        p0 = { x: dir ? -margem : W + margem, y };
        p3 = { x: dir ? W + margem : -margem, y: y + rand(-8, 8) };
        p1 = { x: W * (dir ? 0.33 : 0.66), y: y + rand(-12, 12) };
        p2 = { x: W * (dir ? 0.66 : 0.33), y: y + rand(-12, 12) };
      } else {
        const x = W - rand(22, 46);
        const cimaParaBaixo = Math.random() < 0.5;
        p0 = { x, y: cimaParaBaixo ? -margem : H + margem };
        p3 = { x: x + rand(-8, 8), y: cimaParaBaixo ? H + margem : -margem };
        p1 = { x: x + rand(-14, 14), y: H * (cimaParaBaixo ? 0.33 : 0.66) };
        p2 = { x: x + rand(-14, 14), y: H * (cimaParaBaixo ? 0.66 : 0.33) };
      }
      const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const tan0 = derivadaBezierCubica(0.01, p0, p1, p2, p3);
      const ang0 = (Math.atan2(tan0.y, tan0.x) * 180) / Math.PI + 90;
      return {
        tipo,
        t: 0,
        duracao: Math.max(7.5, dist / especie.velocidadeBase),
        p0,
        p1,
        p2,
        p3,
        x: p0.x,
        y: p0.y,
        angulo: ang0,
        anguloAlvo: ang0,
        velEscalar: 0.25,
        pausaT: rand(0.32, 0.68),
        pausaFeita: false,
        pausaRestante: 0
      };
    }

    // "travessia_curva" e "saltinhos"
    const bordaPonto = (lado) => {
      if (lado === 0) return { x: -margem, y: rand(H * 0.14, H * 0.86) };
      if (lado === 1) return { x: W + margem, y: rand(H * 0.14, H * 0.86) };
      if (lado === 2) return { x: rand(W * 0.16, W * 0.88), y: -margem };
      return { x: rand(W * 0.16, W * 0.88), y: H + margem };
    };
    const ladoIni = Math.floor(Math.random() * 4);
    let ladoFim = (ladoIni + 1 + Math.floor(Math.random() * 3)) % 4;
    if (ladoFim === ladoIni) ladoFim = (ladoIni + 1) % 4;

    const p0 = bordaPonto(ladoIni);
    const p3 = bordaPonto(ladoFim);
    const p1 = { x: rand(W * 0.18, W * 0.82), y: rand(H * 0.16, H * 0.84) };
    const p2 = { x: rand(W * 0.18, W * 0.82), y: rand(H * 0.16, H * 0.84) };
    const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y) * 1.28;
    const tan0 = derivadaBezierCubica(0.01, p0, p1, p2, p3);
    const ang0 = (Math.atan2(tan0.y, tan0.x) * 180) / Math.PI + 90;

    return {
      tipo,
      t: 0,
      duracao: Math.max(7.2, dist / especie.velocidadeBase),
      p0,
      p1,
      p2,
      p3,
      x: p0.x,
      y: p0.y,
      angulo: ang0,
      anguloAlvo: ang0,
      velEscalar: 0.25,
      pausaT: rand(0.28, 0.7),
      pausaFeita: false,
      pausaRestante: 0,
      // Exclusivo para Salticidae (agacha -> salta -> amortece!)
      faseSalto: "andando", // andando | agachando | no_ar | aterrissando
      saltoT: 0,
      proximoSaltoT: rand(0.16, 0.3)
    };
  }

  // ==========================================================================
  // 4. CRIAÇÃO DE INSTÂNCIA + RASTRO / ANCORAGEM DE SEDA
  // ==========================================================================

  function escolherEspecieEMovimento(especieForcada = null, movForcado = null) {
    let esp = especieForcada ? ESPECIES.find((e) => e.id === especieForcada) : null;
    if (!esp) {
      const pool = ESPECIES.filter((e) => e.id !== ultimaEspecieId);
      esp = pool[Math.floor(Math.random() * pool.length)] || ESPECIES[0];
    }

    let mov = movForcado && esp.movimentos.includes(movForcado) ? movForcado : null;
    if (!mov) {
      const movs = esp.movimentos.filter((m) => m !== ultimoMovimento);
      const lista = movs.length > 0 ? movs : esp.movimentos;
      if (modoAtual === "discreto" && !especieForcada && Math.random() < 0.55) {
        const discretos = lista.filter((m) => m !== "travessia_curva");
        mov = discretos.length > 0
          ? discretos[Math.floor(Math.random() * discretos.length)]
          : lista[0];
      } else {
        mov = lista[Math.floor(Math.random() * lista.length)];
      }
    }

    ultimaEspecieId = esp.id;
    ultimoMovimento = mov;
    return { especie: esp, movimento: mov };
  }

  function criarRastroPonto(x, y, ehAncora = false) {
    if (!camadaEl) return;
    const dot = document.createElement("span");
    dot.className = ehAncora ? "aranha-ancora-seda" : "aranha-rastro-seda";
    dot.style.left = `${x.toFixed(1)}px`;
    dot.style.top = `${y.toFixed(1)}px`;
    camadaEl.appendChild(dot);
    setTimeout(() => {
      if (dot.parentNode) dot.parentNode.removeChild(dot);
    }, ehAncora ? 3400 : 2600);
  }

  function sortearComportamentoPausa(especie) {
    const lista = especie.comportamentosPausa || ["probing"];
    return lista[Math.floor(Math.random() * lista.length)];
  }

  function gerarAranha(especieForcada = null, movForcado = null, ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) {
      return null;
    }

    const limite = ignorarFoco ? 3 : MAX_INSTANCIAS[modoAtual] || 0;
    if (ativas.length >= limite) return null;

    garantirCamada();
    const { especie, movimento } = escolherEspecieEMovimento(especieForcada, movForcado);
    const estado = criarEstadoCoreografia(movimento, especie);
    const escalaTela = obterEscalaTela();
    const tamPx = Math.round(especie.tamanho * escalaTela);

    const wrap = document.createElement("div");
    wrap.className = `aranha-viva-ator especie-${especie.id}`;
    wrap.style.width = `${tamPx}px`;
    wrap.style.height = `${tamPx}px`;
    wrap.innerHTML = especie.gerarSvg();

    let fioSvg = null;
    let fioPath = null;
    if (estado.temFio || estado.temFioVento) {
      fioSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fioSvg.setAttribute("class", "aranha-fio-dinamico");
      fioPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      fioPath.setAttribute("fill", "none");
      fioPath.setAttribute("stroke", "currentColor");
      fioPath.setAttribute("stroke-width", "1.35");
      fioPath.setAttribute("stroke-dasharray", "3 3");
      fioPath.setAttribute("stroke-linecap", "round");
      fioSvg.appendChild(fioPath);
      camadaEl.appendChild(fioSvg);
    }

    camadaEl.appendChild(wrap);

    // Mapeia cada uma das 8 patas individualmente com fase metacrônica realista
    const patas = Array.from(wrap.querySelectorAll(".pata-art")).map((el) => {
      const lado = Number(el.dataset.lado) || 1;
      const par = Number(el.dataset.par) || 0;
      // Marcha tetrapodal (4+4) + leve atraso metacrônico entre pares frontais e traseiros
      const grupoAlternado = (par % 2 === 0 ? (lado === -1 ? 0 : Math.PI) : (lado === -1 ? Math.PI : 0));
      const faseBase = grupoAlternado + par * 0.32;
      return { el, lado, par, faseBase, angAtual: 0 };
    });

    const instancia = {
      uid: ++contadorInstancia,
      especie,
      estado,
      wrap,
      fioSvg,
      fioPath,
      patas,
      palpos: wrap.querySelector(".aranha-palpos"),
      abdomen: wrap.querySelector(".aranha-abdomen"),
      cefalo: wrap.querySelector(".aranha-cefalotorax"),
      tamPx,
      tempoVida: 0,
      fasePassada: 0,
      comportamentoAtual: sortearComportamentoPausa(especie),
      tempoComportamento: 0,
      ancoraMarcada: false,
      fugindo: false,
      fugaAlvo: null,
      tempoUltimoRastro: 0
    };

    ativas.push(instancia);
    iniciarLoop();
    return instancia;
  }

  function removerInstancia(inst) {
    if (inst.wrap && inst.wrap.parentNode) inst.wrap.parentNode.removeChild(inst.wrap);
    if (inst.fioSvg && inst.fioSvg.parentNode) inst.fioSvg.parentNode.removeChild(inst.fioSvg);
    const idx = ativas.indexOf(inst);
    if (idx !== -1) ativas.splice(idx, 1);
  }

  function limparTodas() {
    while (ativas.length > 0) {
      removerInstancia(ativas[0]);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ==========================================================================
  // 5. MOTOR DE FÍSICA, CINEMÁTICA METACRÔNICA & 5 COMPORTAMENTOS NATURAIS
  // ==========================================================================

  function acionarFuga(inst) {
    if (inst.fugindo) return;
    inst.fugindo = true;
    const st = inst.estado;

    if (st.tipo === "rapel_fio") {
      st.fase = "subindo";
      return;
    }
    if (st.tipo === "espiadinha") {
      st.fase = "saindo";
      return;
    }

    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const m = inst.tamPx * 1.45;
    const dists = [
      { d: st.x, x: -m, y: st.y },
      { d: W - st.x, x: W + m, y: st.y },
      { d: st.y, x: st.x, y: -m },
      { d: H - st.y, x: st.x, y: H + m }
    ].sort((a, b) => a.d - b.d);

    inst.fugaAlvo = { x: dists[0].x, y: dists[0].y };
    if (inst.especie.id === "papa_moscas") {
      st.faseSalto = "no_ar";
      st.saltoT = 0;
    }
  }

  function animarPatasEComportamentos(inst, dt, andando, desloc, noAr, agachando) {
    const t = inst.tempoVida;
    const amp = inst.especie.ampPata || 10;

    // 1. Respiração sutil contínua no abdômen (sensação de ser vivo real)
    if (inst.abdomen) {
      let escX = 1 + Math.sin(t * 2.1 + inst.uid) * 0.018;
      let escY = 1 - Math.sin(t * 2.1 + inst.uid) * 0.015;
      let rotAbd = andando ? Math.sin(inst.fasePassada * 0.5) * 2.2 : 0;

      // Comportamento 5: Ancoragem de Seda (abaixa suavemente o abdômen)
      if (!andando && inst.comportamentoAtual === "ancorar_seda") {
        const tap = Math.sin(Math.min(1, inst.tempoComportamento * 1.4) * Math.PI);
        escY = 1 + tap * 0.08;
        escX = 1 - tap * 0.04;
        if (!inst.ancoraMarcada && inst.tempoComportamento > 0.35) {
          inst.ancoraMarcada = true;
          criarRastroPonto(inst.estado.x, inst.estado.y, true);
        }
      }
      inst.abdomen.style.transform = `rotate(${rotAbd.toFixed(2)}deg) scale(${escX.toFixed(3)}, ${escY.toFixed(3)})`;
    }

    // 2. Micro-inclinação curiosa do cefalotórax & pedipalpos
    let rotCefalo = 0;
    let rotPalpos = Math.sin(t * 4.2 + inst.uid) * 3.5;

    if (!andando && !noAr) {
      inst.tempoComportamento += dt;
      if (inst.comportamentoAtual === "grooming") {
        // Comportamento 1: Limpando as patinhas dianteiras!
        rotCefalo = Math.sin(inst.tempoComportamento * 4.5) * 4;
        rotPalpos = Math.sin(inst.tempoComportamento * 12) * 11;
      } else if (inst.comportamentoAtual === "curiosa") {
        // Comportamento 3: Inclinação curiosa da cabeça (Papa-Moscas)
        rotCefalo = Math.sin(inst.tempoComportamento * 2.6) * 8;
        rotPalpos = Math.sin(inst.tempoComportamento * 9) * 7;
      } else if (inst.comportamentoAtual === "probing") {
        // Comportamento 2: Tateando o terreno
        rotCefalo = Math.sin(inst.tempoComportamento * 2.2) * 4.5;
      }
    } else {
      inst.tempoComportamento = 0;
      inst.ancoraMarcada = false;
    }

    if (inst.cefalo) {
      inst.cefalo.style.transform = `rotate(${rotCefalo.toFixed(2)}deg)`;
    }
    if (inst.palpos) {
      inst.palpos.style.transform = `rotate(${rotPalpos.toFixed(2)}deg)`;
    }

    // 3. Cinemática Individual das 8 Patas
    if (andando && desloc > 0.02) {
      inst.fasePassada += desloc * inst.especie.fatorPassada;
    }

    for (let i = 0; i < inst.patas.length; i++) {
      const p = inst.patas[i];
      let alvoAng = 0;

      if (agachando) {
        // Puxa as patas traseiras para trás e tensiona as dianteiras antes do salto
        alvoAng = p.par >= 2 ? p.lado * -13 : p.lado * 7;
      } else if (noAr) {
        // Estica as patas dianteiras para frente durante o salto!
        alvoAng = p.par <= 1 ? p.lado * -16 : p.lado * 12;
      } else if (andando && desloc > 0.02) {
        // Onda metacrônica suave 4+4 sincronizada à velocidade
        const fatorPar = p.par === 0 || p.par === 3 ? 1.1 : 0.92;
        alvoAng = Math.sin(inst.fasePassada + p.faseBase) * amp * fatorPar;
      } else if (inst.estado.tipo === "ballooning") {
        // Flutuando no vento: patas relaxadas balançando devagar
        alvoAng = Math.sin(t * 2.2 + p.faseBase) * 5;
      } else {
        // Comportamentos naturais durante pausas!
        if (inst.comportamentoAtual === "grooming" && p.par === 0) {
          // Limpa a patinha esquerda depois a direita perto dos pedipalpos
          const ladoAtivo = Math.floor(inst.tempoComportamento / 0.85) % 2 === 0 ? -1 : 1;
          alvoAng = p.lado === ladoAtivo
            ? p.lado * (-18 + Math.sin(inst.tempoComportamento * 16) * 7)
            : p.lado * -3;
        } else if (inst.comportamentoAtual === "probing" && p.par === 0) {
          // Tateia o chão/ar alternando suavemente as 2 patas da frente
          alvoAng = Math.sin(inst.tempoComportamento * 4.2 + (p.lado === 1 ? Math.PI : 0)) * 12;
        } else {
          // Micro-ajuste orgânico de equilíbrio em repouso
          alvoAng = Math.sin(t * 1.4 + p.faseBase) * 1.8;
        }
      }

      p.angAtual = lerp(p.angAtual, alvoAng, Math.min(1, dt * 15));
      p.el.style.transform = `rotate(${p.angAtual.toFixed(2)}deg)`;
    }
  }

  function atualizarInstancia(inst, dt) {
    const st = inst.estado;
    inst.tempoVida += dt;
    const prevX = st.x;
    const prevY = st.y;
    let escalaX = 1;
    let escalaY = 1;
    let sombraExtra = 0;
    let andando = true;
    let noAr = false;
    let agachando = false;
    let terminado = false;

    // 1. Fuga rápida se o cursor chegou muito perto (< 88px)
    if (inst.fugindo && inst.fugaAlvo) {
      const dx = inst.fugaAlvo.x - st.x;
      const dy = inst.fugaAlvo.y - st.y;
      const dist = Math.hypot(dx, dy);
      st.velEscalar = lerp(st.velEscalar || 1, 2.75, dt * 8);
      const velFuga = inst.especie.velocidadeBase * st.velEscalar;
      if (dist <= velFuga * dt + 8) {
        terminado = true;
      } else {
        st.x += (dx / dist) * velFuga * dt;
        st.y += (dy / dist) * velFuga * dt;
        st.anguloAlvo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      }
      if (st.faseSalto === "no_ar") {
        noAr = true;
        andando = false;
        st.saltoT += dt * 3.4;
        if (st.saltoT >= 1) {
          st.faseSalto = "andando";
        } else {
          const arco = Math.sin(st.saltoT * Math.PI);
          escalaX = 1 + arco * 0.2;
          escalaY = 1 + arco * 0.24;
          sombraExtra = arco * 9;
        }
      }
    } else if (st.tipo === "rapel_fio") {
      st.balancoTempo += dt;
      const balanco = Math.sin(st.balancoTempo * 1.55) * (st.fase === "inspecionando" ? 11 : 4.5);
      if (st.fase === "descendo") {
        // Desacelera suavemente ao chegar na profundidade alvo
        const restante = Math.max(0, st.profundidade - st.y);
        const fatorFreio = Math.min(1, Math.max(0.18, restante / 75));
        st.velEscalar = lerp(st.velEscalar, 0.85 * fatorFreio, dt * 6);
        st.y += inst.especie.velocidadeBase * st.velEscalar * dt;
        st.x = st.xBase + balanco;
        st.anguloAlvo = 180 - balanco * 0.7;
        if (st.y >= st.profundidade - 1.5) {
          st.fase = "inspecionando";
          st.tempoFase = 0;
          inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
        }
      } else if (st.fase === "inspecionando") {
        andando = false;
        st.tempoFase += dt;
        st.x = st.xBase + balanco;
        st.anguloAlvo = 180 + Math.sin(st.tempoFase * 1.8) * 16;
        if (st.tempoFase >= st.duracaoInspecao) {
          st.fase = "subindo";
          st.velEscalar = 0.2;
        }
      } else {
        const alvoSubida = inst.fugindo ? 2.6 : 1.15;
        st.velEscalar = lerp(st.velEscalar, alvoSubida, dt * 5);
        st.y -= inst.especie.velocidadeBase * st.velEscalar * dt;
        st.x = st.xBase + balanco * 0.35;
        st.anguloAlvo = balanco * 0.5;
        if (st.y <= -inst.tamPx * 1.25) terminado = true;
      }
    } else if (st.tipo === "espiadinha") {
      if (st.fase === "entrando") {
        st.t = Math.min(1, st.t + dt * 0.72);
        const ease = 1 - Math.pow(1 - st.t, 3);
        st.x = lerp(st.xFora, st.xEspia, ease);
        st.y = lerp(st.yFora, st.yEspia, ease);
        if (st.t >= 1) {
          st.fase = "espiando";
          st.tempoPausa = 0;
          inst.comportamentoAtual = inst.especie.curiosaCursor ? "curiosa" : "probing";
        }
      } else if (st.fase === "espiando") {
        andando = false;
        st.tempoPausa += dt;
        st.anguloAlvo = st.anguloBase + Math.sin(st.tempoPausa * 2.1) * 10;
        if (st.tempoPausa >= st.duracaoPausa) {
          st.fase = "saindo";
          st.t = 0;
        }
      } else {
        const mult = inst.fugindo ? 2.5 : 0.95;
        st.t = Math.min(1, st.t + dt * mult);
        const ease = st.t * st.t;
        st.x = lerp(st.xEspia, st.xFora, ease);
        st.y = lerp(st.yEspia, st.yFora, ease);
        if (st.t >= 1) terminado = true;
      }
    } else if (st.tipo === "lateral_caranguejo") {
      if (st.pausaRestante > 0) {
        andando = false;
        st.velEscalar = lerp(st.velEscalar, 0, dt * 9);
        st.pausaRestante -= dt;
      } else {
        st.tempoAtePausa -= dt;
        if (st.tempoAtePausa <= 0) {
          st.pausaRestante = rand(1.1, 2.2);
          st.tempoAtePausa = rand(2.2, 4.0);
          inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
        } else {
          const pulso = 0.85 + Math.sin(inst.tempoVida * 3.1) * 0.18;
          st.velEscalar = lerp(st.velEscalar, pulso, dt * 5);
          st.x += st.dir * inst.especie.velocidadeBase * st.velEscalar * dt;
          st.y = st.yBase + Math.sin(st.x * 0.035) * 3.5;
          if ((st.dir > 0 && st.x >= st.xFim) || (st.dir < 0 && st.x <= st.xFim)) {
            terminado = true;
          }
        }
      }
    } else if (st.tipo === "ballooning") {
      andando = false;
      st.t += dt / st.duracao;
      if (st.t >= 1) {
        terminado = true;
      } else {
        st.x = lerp(st.x0, st.x1, st.t);
        st.y = lerp(st.y0, st.y1, st.t) + Math.sin(st.t * Math.PI * st.freqOnda) * st.ampOnda;
        st.anguloAlvo = Math.sin(st.t * Math.PI * st.freqOnda) * 16 + (st.x1 > st.x0 ? 22 : -22);
      }
    } else {
      // travessia_curva, patrulha_borda e saltinhos (com física suave de aceleração/frenagem!)
      if (st.pausaRestante > 0) {
        andando = false;
        st.velEscalar = lerp(st.velEscalar, 0, dt * 10);
        st.pausaRestante -= dt;

        // Comportamento 3: Olhar Curioso — Papa-Moscas acompanha o cursor à distância!
        if (inst.especie.curiosaCursor && cursorAtual.ativo) {
          const dCursor = Math.hypot(cursorAtual.x - st.x, cursorAtual.y - st.y);
          if (dCursor >= 100 && dCursor <= 310) {
            st.anguloAlvo = (Math.atan2(cursorAtual.y - st.y, cursorAtual.x - st.x) * 180) / Math.PI + 90;
          }
        }
      } else {
        let alvoVel = 0.88 + Math.sin(inst.tempoVida * 2.6 + inst.uid) * 0.16;

        // Ciclo completo realista do salto (Agacha -> Salta -> Aterrissa com mola!)
        if (st.tipo === "saltinhos") {
          if (st.faseSalto === "andando" && st.t >= st.proximoSaltoT && st.t < 0.84) {
            st.faseSalto = "agachando";
            st.saltoT = 0;
            st.proximoSaltoT = st.t + rand(0.18, 0.28);
          }

          if (st.faseSalto === "agachando") {
            andando = false;
            agachando = true;
            alvoVel = 0;
            st.saltoT += dt * 3.4;
            const p = Math.min(1, st.saltoT);
            escalaX = 1 + p * 0.09;
            escalaY = 1 - p * 0.14;
            if (st.saltoT >= 1) {
              st.faseSalto = "no_ar";
              st.saltoT = 0;
            }
          } else if (st.faseSalto === "no_ar") {
            andando = false;
            noAr = true;
            alvoVel = 2.35;
            st.saltoT += dt * 2.5;
            const arco = Math.sin(Math.min(1, st.saltoT) * Math.PI);
            escalaX = 1 + arco * 0.18;
            escalaY = 1 + arco * 0.24;
            sombraExtra = arco * 12;
            if (st.saltoT >= 1) {
              st.faseSalto = "aterrissando";
              st.saltoT = 0;
            }
          } else if (st.faseSalto === "aterrissando") {
            andando = false;
            alvoVel = 0.15;
            st.saltoT += dt * 5.2;
            const bounce = Math.sin(Math.min(1, st.saltoT) * Math.PI);
            escalaX = 1 + bounce * 0.08;
            escalaY = 1 - bounce * 0.08;
            if (st.saltoT >= 1) {
              st.faseSalto = "andando";
              st.pausaRestante = rand(0.75, 1.5);
              inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
            }
          }
        }

        // Suaviza aceleração e desaceleração (inércia orgânica)
        st.velEscalar = lerp(st.velEscalar, alvoVel, Math.min(1, dt * (noAr ? 14 : 6)));
        st.t += (dt * st.velEscalar) / st.duracao;

        if (!st.pausaFeita && st.faseSalto !== "no_ar" && st.faseSalto !== "agachando" && st.t >= st.pausaT) {
          st.pausaFeita = true;
          st.pausaRestante = rand(1.3, 2.5);
          inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
        }

        if (st.t >= 1) {
          terminado = true;
        } else {
          const pos = pontoBezierCubica(st.t, st.p0, st.p1, st.p2, st.p3);
          const tan = derivadaBezierCubica(st.t, st.p0, st.p1, st.p2, st.p3);
          st.x = pos.x;
          st.y = pos.y;
          st.anguloAlvo = (Math.atan2(tan.y, tan.x) * 180) / Math.PI + 90;
        }
      }
    }

    if (terminado) {
      removerInstancia(inst);
      return;
    }

    // Rotação suave por mola (nunca dá trancos!)
    st.angulo = lerpAngulo(st.angulo, st.anguloAlvo, dt * (inst.fugindo ? 16 : 7.5));

    const desloc = Math.hypot(st.x - prevX, st.y - prevY);
    animarPatasEComportamentos(inst, dt, andando, desloc, noAr, agachando);

    // Rastro sutil de fio de seda para Tecelã-de-Renda
    if (inst.especie.rastroSeda && andando && desloc > 0.18) {
      inst.tempoUltimoRastro += dt;
      if (inst.tempoUltimoRastro >= 0.14) {
        inst.tempoUltimoRastro = 0;
        criarRastroPonto(st.x, st.y, false);
      }
    }

    // Fio dinâmico (rapel ou ballooning)
    if (inst.fioPath) {
      if (st.temFio) {
        const yPonta = Math.max(0, st.y);
        const mx = (st.fioX + st.x) * 0.5;
        inst.fioPath.setAttribute(
          "d",
          `M ${st.fioX.toFixed(1)} 0 Q ${mx.toFixed(1)} ${(yPonta * 0.5).toFixed(1)} ${st.x.toFixed(1)} ${yPonta.toFixed(1)}`
        );
      } else if (st.temFioVento) {
        const dx = st.x1 > st.x0 ? -98 : 98;
        const dy = -92;
        const onda = Math.sin(inst.tempoVida * 2.8) * 18;
        inst.fioPath.setAttribute(
          "d",
          `M ${st.x.toFixed(1)} ${st.y.toFixed(1)} Q ${(st.x + dx * 0.5 + onda).toFixed(1)} ${(st.y + dy * 0.5).toFixed(1)} ${(st.x + dx).toFixed(1)} ${(st.y + dy).toFixed(1)}`
        );
      }
    }

    // Micro-balanço sutil do corpo ao caminhar
    const bobCorpo = andando && desloc > 0.05 ? Math.sin(inst.fasePassada * 2) * 0.65 : 0;
    const meia = inst.tamPx / 2;
    inst.wrap.style.transform = `translate3d(${(st.x - meia).toFixed(2)}px, ${(st.y - meia + bobCorpo).toFixed(2)}px, 0) rotate(${st.angulo.toFixed(2)}deg) scale(${escalaX.toFixed(3)}, ${escalaY.toFixed(3)})`;

    if (sombraExtra > 0.1) {
      inst.wrap.style.filter = `drop-shadow(0 ${(4 + sombraExtra).toFixed(1)}px ${(5 + sombraExtra * 0.75).toFixed(1)}px var(--aranha-sombra))`;
    } else if (inst.wrap.style.filter) {
      inst.wrap.style.filter = "";
    }
  }

  function loopFrame(ts) {
    if (ativas.length === 0) {
      rafId = null;
      return;
    }
    if (!ultimoFrameTs) ultimoFrameTs = ts;
    const dt = Math.min(0.05, Math.max(0.001, (ts - ultimoFrameTs) / 1000));
    ultimoFrameTs = ts;

    if (!document.hidden) {
      for (let i = ativas.length - 1; i >= 0; i--) {
        atualizarInstancia(ativas[i], dt);
      }
    }

    if (ativas.length > 0) {
      rafId = requestAnimationFrame(loopFrame);
    } else {
      rafId = null;
    }
  }

  function iniciarLoop() {
    if (rafId) return;
    ultimoFrameTs = 0;
    rafId = requestAnimationFrame(loopFrame);
  }

  // ==========================================================================
  // 6. AGENDAMENTO & REAÇÃO DE PROXIMIDADE
  // ==========================================================================

  function cancelarAgendamento() {
    if (timerProxima) {
      clearTimeout(timerProxima);
      timerProxima = null;
    }
  }

  function agendarProxima(primeiraVez = false) {
    cancelarAgendamento();
    if (modoAtual === "desligado" || animacoesReduzidasAtivas()) return;

    const faixa = INTERVALOS_MS[modoAtual] || INTERVALOS_MS.discreto;
    const espera = primeiraVez
      ? rand(Math.min(12000, faixa[0] * 0.45), Math.min(26000, faixa[0] * 0.85))
      : rand(faixa[0], faixa[1]);

    timerProxima = setTimeout(() => {
      if (!document.hidden && modoAtual !== "desligado" && !animacoesReduzidasAtivas()) {
        gerarAranha();
      }
      agendarProxima(false);
    }, espera);
  }

  function lerConfiguracoes() {
    if (typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function") {
      const m = Configuracoes.obter("aranhasAtelie");
      modoAtual = m === "desligado" || m === "vivo" || m === "discreto" ? m : "discreto";
      reagirCursor = Configuracoes.obter("aranhasReagirCursor") !== false;
    }
  }

  function aplicarConfiguracao() {
    lerConfiguracoes();
    if (modoAtual === "desligado" || animacoesReduzidasAtivas()) {
      cancelarAgendamento();
      limparTodas();
    } else {
      agendarProxima(false);
    }
  }

  function invocarAgora(especieId = null, movimento = null) {
    return gerarAranha(especieId, movimento, true);
  }

  let ultimoCheckCursorTs = 0;

  function processarPonteiro(clientX, clientY) {
    cursorAtual.x = clientX;
    cursorAtual.y = clientY;
    cursorAtual.ativo = true;

    if (!reagirCursor || ativas.length === 0) return;
    const agora = performance.now();
    if (agora - ultimoCheckCursorTs < 75) return;
    ultimoCheckCursorTs = agora;

    for (let i = 0; i < ativas.length; i++) {
      const inst = ativas[i];
      if (inst.fugindo) continue;
      const dist = Math.hypot(clientX - inst.estado.x, clientY - inst.estado.y);
      if (dist < 86) {
        acionarFuga(inst);
      }
    }
  }

  function init() {
    if (jaInicializado) return;
    jaInicializado = true;

    lerConfiguracoes();
    garantirCamada();

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") {
        processarPonteiro(e.clientX, e.clientY);
      }
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
      const t = e.touches?.[0];
      if (t) processarPonteiro(t.clientX, t.clientY);
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelarAgendamento();
      } else {
        ultimoFrameTs = 0;
        agendarProxima(false);
      }
    });

    window.addEventListener("ponto-trama:configuracoes-atualizadas", () => {
      aplicarConfiguracao();
    });

    if (modoAtual !== "desligado" && !animacoesReduzidasAtivas()) {
      agendarProxima(true);
    }
  }

  const api = {
    init,
    invocarAgora,
    aplicarConfiguracao,
    limparTodas,
    ESPECIES: ESPECIES.map((e) => ({ id: e.id, nome: e.nome }))
  };

  if (typeof window !== "undefined") {
    window.AranhasAtelie = api;
  }
  return api;
})();
