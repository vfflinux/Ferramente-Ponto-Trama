// ==========================================================================
// PONTO & TRAMA (ÑANDUOBYETÉ) — ECOSSISTEMA VIVO DO ATELIÊ (MOTOR v4)
// - 7 espécies vetoriais com articulação INDIVIDUAL das 8 patas, incluindo:
//     * Tarântula Golias 2.0 (146 px, viewBox 180×180, cerdas em 2 camadas,
//       quelíceras articuladas que abrem no bote/defesa, fóvea e fiandeiras)
//     * Aranha Tecelã de Canto (Argiope) ancorada nas teias reais dos cantos
// - 5 presas vivas animadas (Mosca, Mosquito, Barata, Lagartinho, Lagarta)
// - Escala de Raridade em 4 níveis:
//     1. Comum (64%): passeio normal de aranhas
//     2. Incomum (22%): mosca / mosquito e caçadas das aranhas menores
//     3. Raro (10%): barata + Tarântula Golias ou encontro entre 2 aranhas
//     4. Muito Raro / Lendário (4%): lagartinho ou lagarta gigante + Golias
// - 7 hábitos de caça biologicamente distintos + interações Aranha ↔ Aranha.
// - 100% offline, 60 FPS GPU-acelerado, 0% CPU em repouso e acessibilidade total.
// ==========================================================================

const AranhasAtelie = (() => {
  const MAX_INSTANCIAS = {
    desligado: 0,
    raro: 1,
    discreto: 1,
    vivo: 2
  };

  const INTERVALOS_MS = {
    raro: [95000, 195000],
    discreto: [38000, 78000],
    vivo: [14000, 30000]
  };

  // Escala progressiva de raridade por modo (caçadas menos frequentes e Golias verdadeiramente lendária!)
  const PROBABILIDADES_EVENTO = {
    raro: {
      lendarioGolias: 0.007, // 0,7% — Golias × Lagartinho / Lagarta Gigante
      raroBarataEncontro: 0.028, // 2,8% — Barata / Encontro (~1,1% Golias × Barata)
      incomumInseto: 0.070, // 7,0% — Mosca / Mosquito (~40% vira caçada)
      chanceCacaInseto: 0.40,
      chanceCacaBarata: 0.40
    },
    discreto: {
      lendarioGolias: 0.012, // 1,2% — Golias × Lagartinho / Lagarta Gigante
      raroBarataEncontro: 0.043, // 4,3% — Barata / Encontro (~2,0% Golias × Barata)
      incomumInseto: 0.115, // 11,5% — Mosca / Mosquito (~45% vira caçada)
      chanceCacaInseto: 0.45,
      chanceCacaBarata: 0.46
    },
    vivo: {
      lendarioGolias: 0.022, // 2,2% — Golias × Lagartinho / Lagarta Gigante
      raroBarataEncontro: 0.073, // 7,3% — Encontro entre aranhas + Golias × Barata
      incomumInseto: 0.145, // 14,5% — Mosca / Mosquito (~55% vira caçada)
      chanceCacaInseto: 0.55,
      chanceCacaBarata: 0.44
    }
  };

  // Helper para criar cada pata articulada com pivô exato na junta do cefalotórax
  function pata(lado, par, ox, oy, conteudo) {
    return `<g class="pata-art" data-lado="${lado}" data-par="${par}" style="transform-origin:${ox}px ${oy}px">${conteudo}</g>`;
  }

  // Helper para gerar cerdas (setas sensoriais) ao longo de uma polilinha
  function gerarCerdasPolilinha(pts, compMin, compMax, densidade = 5.0, inclinacao = 0.52, seed = 1) {
    let d = "";
    for (let s = 0; s < pts.length - 1; s++) {
      const [x1, y1] = pts[s];
      const [x2, y2] = pts[s + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 3) continue;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const passos = Math.max(2, Math.floor(len / densidade));
      for (let k = 1; k <= passos; k++) {
        const t = k / (passos + 0.45);
        const bx = x1 + dx * t;
        const by = y1 + dy * t;
        const fatorSeg = 1 - (s / pts.length) * 0.28;
        const vari = (((k * 17 + s * 11 + seed * 7) % 10) / 10);
        const comp = (compMin + vari * (compMax - compMin)) * fatorSeg;
        for (const side of [-1, 1]) {
          const angDesvio = inclinacao + (vari - 0.5) * 0.22;
          const ex = bx + (nx * side + ux * angDesvio) * comp;
          const ey = by + (ny * side + uy * angDesvio) * comp;
          d += `M${bx.toFixed(1)} ${by.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} `;
        }
      }
    }
    return d;
  }

  // ==========================================================================
  // 1. CATÁLOGO DAS 7 ESPÉCIES DE ARANHAS (8 PATAS ARTICULADAS)
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

  // Pata hiperdetalhada da Tarântula Golias 2.0 (viewBox 180×180, cerdas em 2 camadas + escópula + garras)
  function pataTarantulaGolias(lado, par, pts) {
    const [ox, oy] = pts[0];
    const [kx, ky] = pts[1];
    const [tx, ty] = pts[2];
    const [mx, my] = pts[3];
    const [fx, fy] = pts[4];
    const cerdasCurtas = gerarCerdasPolilinha(pts, 2.4, 3.8, 3.3, 0.45, par + 1);
    const cerdasLongas = gerarCerdasPolilinha(pts, 4.8, 7.6, 6.2, 0.62, par + 5);

    const p1x = ox + (kx - ox) * 0.84;
    const p1y = oy + (ky - oy) * 0.84;
    const p2x = kx + (tx - kx) * 0.22;
    const p2y = ky + (ty - ky) * 0.22;
    const j2x = tx + (mx - tx) * 0.16;
    const j2y = ty + (my - ty) * 0.16;
    const dtx = fx - mx;
    const dty = fy - my;
    const dlen = Math.max(1, Math.hypot(dtx, dty));
    const ux = dtx / dlen;
    const uy = dty / dlen;
    const nx = -uy;
    const ny = ux;
    const garra1x = fx + (ux * 2.8 + nx * 1.6);
    const garra1y = fy + (uy * 2.8 + ny * 1.6);
    const garra2x = fx + (ux * 2.8 - nx * 1.6);
    const garra2y = fy + (uy * 2.8 - ny * 1.6);

    return pata(
      lado,
      par,
      ox,
      oy,
      `
        <path d="${cerdasLongas}" stroke="currentColor" stroke-width="0.95" opacity="0.72" stroke-linecap="round"/>
        <path d="${cerdasCurtas}" stroke="currentColor" stroke-width="1.05" opacity="0.86" stroke-linecap="round"/>
        <path d="M${ox} ${oy} L${kx} ${ky}" stroke="currentColor" stroke-width="8.8" stroke-linecap="round"/>
        <path d="M${ox} ${oy} L${kx} ${ky}" stroke="var(--aranha-corpo)" stroke-width="4.6" stroke-linecap="round"/>
        <path d="M${ox} ${oy} L${kx} ${ky}" stroke="var(--aranha-acento)" stroke-width="1.15" opacity="0.48" stroke-linecap="round"/>
        <path d="M${kx} ${ky} L${tx} ${ty}" stroke="currentColor" stroke-width="7.0" stroke-linecap="round"/>
        <path d="M${kx} ${ky} L${tx} ${ty}" stroke="var(--aranha-corpo)" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M${tx} ${ty} L${mx} ${my}" stroke="currentColor" stroke-width="5.2" stroke-linecap="round"/>
        <path d="M${tx} ${ty} L${mx} ${my}" stroke="var(--aranha-corpo)" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M${mx} ${my} L${fx} ${fy}" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M${p1x.toFixed(1)} ${p1y.toFixed(1)} L${kx} ${ky} L${p2x.toFixed(1)} ${p2y.toFixed(1)}" stroke="var(--aranha-acento)" stroke-width="3.0" stroke-linecap="round" opacity="0.92"/>
        <path d="M${tx} ${ty} L${j2x.toFixed(1)} ${j2y.toFixed(1)}" stroke="var(--aranha-acento)" stroke-width="2.2" stroke-linecap="round" opacity="0.78"/>
        <path d="M${mx} ${my} L${fx} ${fy}" stroke="var(--aranha-acento)" stroke-width="2.1" stroke-linecap="round" opacity="0.7"/>
        <circle cx="${fx}" cy="${fy}" r="2.3" fill="currentColor" stroke="none"/>
        <path d="M${fx} ${fy} L${garra1x.toFixed(1)} ${garra1y.toFixed(1)} M${fx} ${fy} L${garra2x.toFixed(1)} ${garra2y.toFixed(1)}" stroke="var(--aranha-acento)" stroke-width="1.15" stroke-linecap="round"/>
      `
    );
  }

  function svgTarantulaGolias() {
    // Coroa dupla de 48 cerdas radiais (veludo curto + tricobótrios longos) ao redor do abdômen
    let cerdasAbdCurtas = "";
    let cerdasAbdLongas = "";
    const totalAbd = 48;
    for (let i = 0; i < totalAbd; i++) {
      const a = (i / totalAbd) * Math.PI * 2;
      const sx = 90 + Math.cos(a) * 25;
      const sy = 124 + Math.sin(a) * 30;
      const desv = Math.sin(i * 2.7) * 0.14;
      const compC = 3.2 + (i % 3) * 0.9;
      cerdasAbdCurtas += `M${sx.toFixed(1)} ${sy.toFixed(1)} L${(sx + Math.cos(a + desv) * compC).toFixed(1)} ${(sy + Math.sin(a + desv) * compC).toFixed(1)} `;
      if (i % 2 === 0) {
        const compL = 6.2 + (i % 4) * 0.95;
        cerdasAbdLongas += `M${sx.toFixed(1)} ${sy.toFixed(1)} L${(sx + Math.cos(a - desv) * compL).toFixed(1)} ${(sy + Math.sin(a - desv) * compL).toFixed(1)} `;
      }
    }

    // Franja de 28 cerdas contornando a carapaça
    let cerdasCef = "";
    const totalCef = 28;
    for (let i = 0; i < totalCef; i++) {
      const a = (i / totalCef) * Math.PI * 2;
      const sx = 90 + Math.cos(a) * 20.5;
      const sy = 74 + Math.sin(a) * 18.5;
      const comp = 3.0 + (i % 2) * 1.4;
      cerdasCef += `M${sx.toFixed(1)} ${sy.toFixed(1)} L${(sx + Math.cos(a) * comp).toFixed(1)} ${(sy + Math.sin(a) * comp).toFixed(1)} `;
    }

    // Cerdas em 2 camadas nos pedipalpos gigantes
    const palpoEsq = [[79, 59], [66, 44], [61, 27], [65, 14]];
    const palpoDir = [[101, 59], [114, 44], [119, 27], [115, 14]];
    const cerdasPalpos =
      gerarCerdasPolilinha(palpoEsq, 2.5, 4.6, 3.6, 0.52, 2) +
      gerarCerdasPolilinha(palpoDir, 2.5, 4.6, 3.6, 0.52, 3);

    // Micro-cerdas nas fiandeiras traseiras
    const fiandEsq = [[81, 151], [75, 163], [71, 174]];
    const fiandDir = [[99, 151], [105, 163], [109, 174]];
    const cerdasFiand =
      gerarCerdasPolilinha(fiandEsq, 1.8, 2.8, 4.2, 0.45, 4) +
      gerarCerdasPolilinha(fiandDir, 1.8, 2.8, 4.2, 0.45, 5);

    return `
      <svg viewBox="0 0 180 180" class="aranha-svg especie-tarantula-golias" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          ${pataTarantulaGolias(-1, 0, [[73, 64], [47, 44], [30, 26], [20, 14], [14, 6]])}
          ${pataTarantulaGolias(1, 0, [[107, 64], [133, 44], [150, 26], [160, 14], [166, 6]])}
          ${pataTarantulaGolias(-1, 1, [[71, 72], [38, 61], [20, 48], [10, 36], [5, 27]])}
          ${pataTarantulaGolias(1, 1, [[109, 72], [142, 61], [160, 48], [170, 36], [175, 27]])}
          ${pataTarantulaGolias(-1, 2, [[71, 81], [40, 91], [22, 108], [12, 122], [7, 132]])}
          ${pataTarantulaGolias(1, 2, [[109, 81], [140, 91], [158, 108], [168, 122], [173, 132]])}
          ${pataTarantulaGolias(-1, 3, [[74, 88], [49, 116], [35, 142], [26, 159], [20, 171]])}
          ${pataTarantulaGolias(1, 3, [[106, 88], [131, 116], [145, 142], [154, 159], [160, 171]])}
        </g>

        <g class="aranha-palpos" style="transform-origin:90px 59px" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="${cerdasPalpos}" stroke="currentColor" stroke-width="0.95" opacity="0.82"/>
          <path d="M79 59 L66 44 L61 27 L65 14" stroke="currentColor" stroke-width="6.0"/>
          <path d="M79 59 L66 44 L61 27" stroke="var(--aranha-corpo)" stroke-width="2.8"/>
          <path d="M70 48 L64 38 M62 30 L63 22" stroke="var(--aranha-acento)" stroke-width="2.4" opacity="0.88"/>
          <circle cx="65" cy="14" r="2.2" fill="currentColor" stroke="none"/>
          <path d="M101 59 L114 44 L119 27 L115 14" stroke="currentColor" stroke-width="6.0"/>
          <path d="M101 59 L114 44 L119 27" stroke="var(--aranha-corpo)" stroke-width="2.8"/>
          <path d="M110 48 L116 38 M118 30 L117 22" stroke="var(--aranha-acento)" stroke-width="2.4" opacity="0.88"/>
          <circle cx="115" cy="14" r="2.2" fill="currentColor" stroke="none"/>
        </g>

        <g class="aranha-abdomen" style="transform-origin:90px 94px">
          <path d="${cerdasAbdLongas}" fill="none" stroke="currentColor" stroke-width="0.95" stroke-linecap="round" opacity="0.72"/>
          <path d="${cerdasAbdCurtas}" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" opacity="0.88"/>
          <ellipse cx="90" cy="124" rx="25.5" ry="30.5" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="3.0"/>
          <ellipse cx="90" cy="126" rx="18" ry="21" fill="var(--aranha-acento)" fill-opacity="0.18" stroke="var(--aranha-acento)" stroke-width="1.25" stroke-dasharray="2.4 2.4"/>
          <path d="M78 110 Q90 104 102 110 M74 119 Q90 113 106 119 M74 128 Q90 122 106 128 M77 137 Q90 132 103 137 M82 145 Q90 141 98 145" fill="none" stroke="var(--aranha-acento)" stroke-width="1.65" stroke-linecap="round" opacity="0.78"/>
          <path d="M77 104 L73 111 M103 104 L107 111 M71 117 L67 125 M109 117 L113 125 M73 133 L69 140 M107 133 L111 140 M84 115 L82 120 M96 115 L98 120 M85 130 L83 135 M95 130 L97 135" stroke="currentColor" stroke-width="0.95" stroke-linecap="round" opacity="0.56"/>
          <g fill="none" stroke="currentColor" stroke-linecap="round">
            <path d="${cerdasFiand}" stroke="currentColor" stroke-width="0.85" opacity="0.76"/>
            <path d="M81 151 L75 163 L71 174" stroke-width="4.0"/>
            <path d="M81 151 L75 163" stroke="var(--aranha-acento)" stroke-width="1.7" opacity="0.8"/>
            <path d="M99 151 L105 163 L109 174" stroke-width="4.0"/>
            <path d="M99 151 L105 163" stroke="var(--aranha-acento)" stroke-width="1.7" opacity="0.8"/>
          </g>
        </g>

        <g class="aranha-cefalotorax" style="transform-origin:90px 76px">
          <path d="${cerdasCef}" fill="none" stroke="currentColor" stroke-width="1.0" stroke-linecap="round" opacity="0.76"/>
          <!-- Quelíceras articuladas que se abrem no bote e na postura defensiva -->
          <g class="golias-quelicera-esq" style="transform-origin:85px 57px">
            <path d="M81 58 L79.5 44 Q84.5 40 88.8 45 L88.8 58 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>
            <path d="M80 49 L77 46 M80 53 L76.5 51" stroke="currentColor" stroke-width="0.95" stroke-linecap="round" opacity="0.8"/>
            <path d="M83.5 43 Q85.5 37 88 35.5" fill="none" stroke="var(--aranha-acento)" stroke-width="2.2" stroke-linecap="round"/>
          </g>
          <g class="golias-quelicera-dir" style="transform-origin:95px 57px">
            <path d="M99 58 L100.5 44 Q95.5 40 91.2 45 L91.2 58 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>
            <path d="M100 49 L103 46 M100 53 L103.5 51" stroke="currentColor" stroke-width="0.95" stroke-linecap="round" opacity="0.8"/>
            <path d="M96.5 43 Q94.5 37 92 35.5" fill="none" stroke="var(--aranha-acento)" stroke-width="2.2" stroke-linecap="round"/>
          </g>

          <ellipse cx="90" cy="74" rx="21" ry="19" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.9"/>
          <path d="M77 67 Q90 61 103 67" fill="none" stroke="currentColor" stroke-width="1.15" opacity="0.45"/>
          <path d="M84 76 Q90 80 96 76" fill="none" stroke="var(--aranha-acento)" stroke-width="2.8" stroke-linecap="round"/>
          <path d="M90 75.5 L75 63 M90 75.5 L105 63 M90 75.5 L72 72 M90 75.5 L108 72 M90 75.5 L73 82 M90 75.5 L107 82 M90 75.5 L80 89 M90 75.5 L100 89" fill="none" stroke="var(--aranha-acento)" stroke-width="1.35" stroke-linecap="round" opacity="0.64"/>
          <g class="aranha-olhos-vivos" style="transform-origin:90px 59px">
            <ellipse cx="90" cy="59.5" rx="6.2" ry="3.3" fill="currentColor" fill-opacity="0.28"/>
            <circle cx="87.8" cy="58.6" r="1.45" fill="currentColor"/>
            <circle cx="92.2" cy="58.6" r="1.45" fill="currentColor"/>
            <circle cx="85.2" cy="59.8" r="1.05" fill="currentColor" opacity="0.88"/>
            <circle cx="94.8" cy="59.8" r="1.05" fill="currentColor" opacity="0.88"/>
            <circle cx="86.8" cy="61.0" r="0.85" fill="currentColor" opacity="0.8"/>
            <circle cx="93.2" cy="61.0" r="0.85" fill="currentColor" opacity="0.8"/>
            <circle cx="88.3" cy="58.1" r="0.55" fill="var(--aranha-brilho-olho)"/>
            <circle cx="92.7" cy="58.1" r="0.55" fill="var(--aranha-brilho-olho)"/>
          </g>
        </g>
      </svg>
    `;
  }

  function svgTecelaCanto() {
    return `
      <svg viewBox="0 0 120 120" class="aranha-svg especie-tecela-canto" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          ${pata(-1, 0, 53, 45, `<path d="M53 45 L33 26 L18 11 L10 3" stroke-width="2.2"/><path d="M40 33 L35 28 M26 19 L21 14" stroke="var(--aranha-acento)" stroke-width="2.7"/>`)}
          ${pata(1, 0, 67, 45, `<path d="M67 45 L87 26 L102 11 L110 3" stroke-width="2.2"/><path d="M80 33 L85 28 M94 19 L99 14" stroke="var(--aranha-acento)" stroke-width="2.7"/>`)}
          ${pata(-1, 1, 52, 49, `<path d="M52 49 L27 36 L11 23 L4 14" stroke-width="2.1"/><path d="M36 41 L30 37 M19 29 L14 25" stroke="var(--aranha-acento)" stroke-width="2.6"/>`)}
          ${pata(1, 1, 68, 49, `<path d="M68 49 L93 36 L109 23 L116 14" stroke-width="2.1"/><path d="M84 41 L90 37 M101 29 L106 25" stroke="var(--aranha-acento)" stroke-width="2.6"/>`)}
          ${pata(-1, 2, 52, 55, `<path d="M52 55 L28 65 L14 79 L6 90" stroke-width="2.0"/><path d="M36 62 L30 65 M20 73 L15 78" stroke="var(--aranha-acento)" stroke-width="2.5"/>`)}
          ${pata(1, 2, 68, 55, `<path d="M68 55 L92 65 L106 79 L114 90" stroke-width="2.0"/><path d="M84 62 L90 65 M100 73 L105 78" stroke="var(--aranha-acento)" stroke-width="2.5"/>`)}
          ${pata(-1, 3, 53, 59, `<path d="M53 59 L34 81 L22 101 L15 116" stroke-width="2.2"/><path d="M40 74 L36 79 M28 91 L24 97" stroke="var(--aranha-acento)" stroke-width="2.7"/>`)}
          ${pata(1, 3, 67, 59, `<path d="M67 59 L86 81 L98 101 L105 116" stroke-width="2.2"/><path d="M80 74 L84 79 M92 91 L96 97" stroke="var(--aranha-acento)" stroke-width="2.7"/>`)}
        </g>
        <g class="aranha-palpos" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M56 39 L52 30 L55 25"></path>
          <path d="M64 39 L68 30 L65 25"></path>
        </g>
        <g class="aranha-abdomen">
          <path d="M60 56 C71 58 77 66 74 75 C77 83 72 94 60 105 C48 94 43 83 46 75 C43 66 49 58 60 56 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"></path>
          <path d="M49 67 Q60 63 71 67 M47 76 Q60 72 73 76 M50 86 Q60 82 70 86 M54 94 Q60 91 66 94" fill="none" stroke="var(--aranha-acento)" stroke-width="2" stroke-linecap="round"></path>
          <polygon points="60,64 65,75 60,86 55,75" fill="var(--aranha-acento)" fill-opacity="0.34" stroke="currentColor" stroke-width="1.2"></polygon>
          <circle cx="52" cy="75" r="1.35" fill="currentColor"></circle>
          <circle cx="68" cy="75" r="1.35" fill="currentColor"></circle>
          <path d="M58 105 L57 109 M62 105 L63 109" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
        </g>
        <g class="aranha-cefalotorax">
          <ellipse cx="60" cy="47" rx="8.5" ry="9.5" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2"></ellipse>
          <path d="M55 47 Q60 51 65 47" fill="none" stroke="var(--aranha-acento)" stroke-width="1.6" stroke-linecap="round"></path>
          <g class="aranha-olhos-vivos">
            <circle cx="57.2" cy="40" r="1.45" fill="currentColor"></circle>
            <circle cx="62.8" cy="40" r="1.45" fill="currentColor"></circle>
            <circle cx="54.2" cy="41.8" r="1" fill="currentColor" opacity="0.82"></circle>
            <circle cx="65.8" cy="41.8" r="1" fill="currentColor" opacity="0.82"></circle>
          </g>
        </g>
      </svg>
    `;
  }

  const ESPECIES = [
    {
      id: "nandu",
      nome: "Ñanduobyeté (Tecelã Oficial)",
      raridade: "comum",
      pesoSorteio: 1.45,
      tamanho: 54,
      velocidadeBase: 72,
      fatorPassada: 0.19,
      ampPata: 10.5,
      estiloCaca: "nandu_laco",
      presasAlvo: ["mosca", "mosquito"],
      comportamentosPausa: ["banho_completo", "soneca_espreguica", "grooming", "probing", "ancorar_seda"],
      movimentos: ["rapel_fio", "contorno_card", "travessia_curva", "patrulha_borda", "espiadinha"],
      gerarSvg: svgNanduobyete
    },
    {
      id: "papa_moscas",
      nome: "Papa-Moscas Curiosa",
      raridade: "comum",
      pesoSorteio: 1.35,
      tamanho: 40,
      velocidadeBase: 98,
      fatorPassada: 0.27,
      ampPata: 11.5,
      curiosaCursor: true,
      estiloCaca: "papa_salto",
      presasAlvo: ["mosca", "mosquito"],
      comportamentosPausa: ["curiosa", "soneca_espreguica", "grooming", "probing"],
      movimentos: ["saltinhos", "contorno_card", "espiadinha", "patrulha_borda", "travessia_curva"],
      gerarSvg: svgPapaMoscas
    },
    {
      id: "tecela_renda",
      nome: "Tecelã-de-Renda",
      raridade: "incomum",
      pesoSorteio: 0.82,
      tamanho: 62,
      velocidadeBase: 52,
      fatorPassada: 0.14,
      ampPata: 9.2,
      rastroSeda: true,
      podeCamuflarGalhinho: true,
      estiloCaca: "renda_arremesso",
      presasAlvo: ["mosquito", "mosca"],
      comportamentosPausa: ["banho_completo", "ancorar_seda", "probing", "grooming"],
      movimentos: ["patrulha_borda", "contorno_card", "travessia_curva", "rapel_fio"],
      gerarSvg: svgTecelaRenda
    },
    {
      id: "caranguejo",
      nome: "Aranha-Caranguejo",
      raridade: "incomum",
      pesoSorteio: 0.78,
      tamanho: 44,
      velocidadeBase: 64,
      fatorPassada: 0.2,
      ampPata: 11,
      podeCamuflarGalhinho: true,
      estiloCaca: "caranguejo_abraco",
      presasAlvo: ["mosca", "mosquito"],
      comportamentosPausa: ["soneca_espreguica", "probing", "grooming"],
      movimentos: ["lateral_caranguejo", "contorno_card", "espiadinha", "patrulha_borda"],
      gerarSvg: svgCaranguejo
    },
    {
      id: "filhote",
      nome: "Filhote Tecelão",
      raridade: "incomum",
      pesoSorteio: 0.72,
      tamanho: 30,
      velocidadeBase: 60,
      fatorPassada: 0.24,
      ampPata: 10,
      estiloCaca: "filhote_curioso",
      presasAlvo: ["mosquito", "mosca"],
      comportamentosPausa: ["probing"],
      movimentos: ["ballooning", "rapel_fio"],
      gerarSvg: svgFilhote
    },
    {
      id: "tarantula_golias",
      nome: "Tarântula Golias (Comedora-de-Pássaros)",
      raridade: "lendaria",
      pesoSorteio: 0.14,
      tamanho: 146,
      velocidadeBase: 36,
      fatorPassada: 0.095,
      ampPata: 8.2,
      posturaDefensiva: true,
      estiloCaca: "golias_emboscada",
      presasAlvo: ["barata", "lagartinho", "lagarta"],
      comportamentosPausa: ["banho_completo", "soneca_espreguica", "escovar_cerdas", "probing"],
      movimentos: ["travessia_curva", "contorno_card", "patrulha_borda", "espiadinha"],
      gerarSvg: svgTarantulaGolias
    },
    {
      id: "tecela_canto",
      nome: "Aranha Tecelã (Guardiã das Teias de Canto)",
      raridade: "comum",
      pesoSorteio: 1.35,
      tamanho: 58,
      velocidadeBase: 56,
      fatorPassada: 0.15,
      ampPata: 9.6,
      guardiaTeia: true,
      rastroSeda: true,
      estiloCaca: "tecela_teia",
      presasAlvo: ["mosquito", "mosca"],
      comportamentosPausa: ["postura_x", "beliscar_teia", "ancorar_seda"],
      movimentos: ["repouso_teia_canto", "repouso_teia_canto", "repouso_teia_canto", "rapel_fio", "patrulha_borda"],
      gerarSvg: svgTecelaCanto
    }
  ];

  // ==========================================================================
  // 2. CATÁLOGO DAS 5 PRESAS VIVAS ANIMADAS
  // ==========================================================================

  function svgMosca() {
    return `
      <svg viewBox="0 0 80 80" class="presa-svg presa-mosca" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path class="presa-pata-f-esq" style="transform-origin:35px 31px" d="M35 31 L24 22 L21 15"/>
          <path class="presa-pata-f-dir" style="transform-origin:45px 31px" d="M45 31 L56 22 L59 15"/>
          <path d="M34 39 L20 40 L15 45 M46 39 L60 40 L65 45"/>
          <path d="M35 46 L23 56 L19 64 M45 46 L57 56 L61 64"/>
        </g>
        <g class="presa-asa-esq" style="transform-origin:36px 35px">
          <ellipse cx="22" cy="44" rx="14" ry="7.5" transform="rotate(-28 22 44)" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.35"/>
          <path d="M35 36 L15 48 M31 40 L18 42" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
        </g>
        <g class="presa-asa-dir" style="transform-origin:44px 35px">
          <ellipse cx="58" cy="44" rx="14" ry="7.5" transform="rotate(28 58 44)" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.35"/>
          <path d="M45 36 L65 48 M49 40 L62 42" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
        </g>
        <ellipse cx="40" cy="52" rx="9" ry="12" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2"/>
        <path d="M33 48 Q40 45 47 48 M32 54 Q40 51 48 54" fill="none" stroke="var(--aranha-acento)" stroke-width="1.4" opacity="0.8"/>
        <ellipse cx="40" cy="36" rx="7.5" ry="8" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2"/>
        <path d="M37 31 L37 41 M43 31 L43 41" stroke="var(--aranha-acento)" stroke-width="1.2" opacity="0.75"/>
        <circle cx="36" cy="25" r="4.2" fill="var(--aranha-acento)" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="44" cy="25" r="4.2" fill="var(--aranha-acento)" stroke="currentColor" stroke-width="1.5"/>
        <g class="presa-casulo-seda" opacity="0">
          <ellipse cx="40" cy="43" rx="13" ry="19" fill="currentColor" fill-opacity="0.26" stroke="currentColor" stroke-width="1.6"/>
          <path d="M29 36 L51 42 M28 45 L52 50 M31 53 L49 56 M32 32 L48 35" stroke="currentColor" stroke-width="1.2" opacity="0.85"/>
        </g>
      </svg>
    `;
  }

  function svgMosquito() {
    return `
      <svg viewBox="0 0 80 80" class="presa-svg presa-mosquito" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.88">
          <path d="M37 34 L21 20 L11 12 M43 34 L59 20 L69 12"/>
          <path d="M36 39 L16 38 L7 43 M44 39 L64 38 L73 43"/>
          <path d="M37 44 L20 58 L11 71 M43 44 L60 58 L69 71"/>
        </g>
        <g class="presa-asa-esq" style="transform-origin:38px 36px">
          <ellipse cx="24" cy="42" rx="15" ry="4.2" transform="rotate(-20 24 42)" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.15"/>
        </g>
        <g class="presa-asa-dir" style="transform-origin:42px 36px">
          <ellipse cx="56" cy="42" rx="15" ry="4.2" transform="rotate(20 56 42)" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.15"/>
        </g>
        <path d="M40 24 L40 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M38 25 L34 18 M42 25 L46 18" stroke="var(--aranha-acento)" stroke-width="1.1" stroke-linecap="round"/>
        <ellipse cx="40" cy="54" rx="3.4" ry="13.5" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.6"/>
        <path d="M37 47 L43 47 M37 52 L43 52 M37 57 L43 57 M37.5 62 L42.5 62" stroke="var(--aranha-acento)" stroke-width="1.2"/>
        <ellipse cx="40" cy="36" rx="4.4" ry="6" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.7"/>
        <circle cx="40" cy="27" r="3.4" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.6"/>
        <g class="presa-casulo-seda" opacity="0">
          <ellipse cx="40" cy="44" rx="10" ry="18" fill="currentColor" fill-opacity="0.28" stroke="currentColor" stroke-width="1.5"/>
          <path d="M32 36 L48 41 M31 45 L49 50 M33 54 L47 57" stroke="currentColor" stroke-width="1.15" opacity="0.85"/>
        </g>
      </svg>
    `;
  }

  function svgBarata() {
    return `
      <svg viewBox="0 0 110 110" class="presa-svg presa-barata" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <g class="pata-presa" data-lado="-1" data-par="0" style="transform-origin:45px 38px">
            <path d="M45 38 L29 29 L21 19" stroke-width="2.4"/><path d="M29 29 L25 32 M25 24 L21 26" stroke-width="1"/>
          </g>
          <g class="pata-presa" data-lado="1" data-par="0" style="transform-origin:65px 38px">
            <path d="M65 38 L81 29 L89 19" stroke-width="2.4"/><path d="M81 29 L85 32 M85 24 L89 26" stroke-width="1"/>
          </g>
          <g class="pata-presa" data-lado="-1" data-par="1" style="transform-origin:42px 52px">
            <path d="M42 52 L22 50 L13 42" stroke-width="2.4"/><path d="M24 50 L21 54 M18 46 L14 49" stroke-width="1"/>
          </g>
          <g class="pata-presa" data-lado="1" data-par="1" style="transform-origin:68px 52px">
            <path d="M68 52 L88 50 L97 42" stroke-width="2.4"/><path d="M86 50 L89 54 M92 46 L96 49" stroke-width="1"/>
          </g>
          <g class="pata-presa" data-lado="-1" data-par="2" style="transform-origin:43px 68px">
            <path d="M43 68 L24 79 L16 93" stroke-width="2.6"/><path d="M26 78 L22 83 M20 86 L15 88" stroke-width="1"/>
          </g>
          <g class="pata-presa" data-lado="1" data-par="2" style="transform-origin:67px 68px">
            <path d="M67 68 L86 79 L94 93" stroke-width="2.6"/><path d="M84 78 L88 83 M90 86 L95 88" stroke-width="1"/>
          </g>
        </g>
        <!-- Antenas longas e articuladas que varrem o caminho -->
        <g class="presa-antena-esq" style="transform-origin:50px 26px" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round">
          <path d="M50 26 Q38 14 22 4"/>
        </g>
        <g class="presa-antena-dir" style="transform-origin:60px 26px" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round">
          <path d="M60 26 Q72 14 88 4"/>
        </g>
        <!-- Cercos traseiros -->
        <path d="M49 92 L45 101 M61 92 L65 101" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <!-- Corpo oval segmentado com asas brilhantes (tegminas) -->
        <ellipse cx="55" cy="64" rx="16.5" ry="29" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.3"/>
        <path d="M55 38 L55 91" stroke="var(--aranha-acento)" stroke-width="1.4" opacity="0.72"/>
        <path d="M42 52 Q55 48 68 52 M40 62 Q55 58 70 62 M41 72 Q55 68 69 72 M44 82 Q55 78 66 82" fill="none" stroke="var(--aranha-acento)" stroke-width="1.35" opacity="0.65"/>
        <!-- Escudo pronotal sobre a cabeça -->
        <path d="M42 40 C42 26 68 26 68 40 C62 43 48 43 42 40 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.2"/>
        <ellipse cx="55" cy="34" rx="7.5" ry="4.5" fill="var(--aranha-acento)" fill-opacity="0.32" stroke="var(--aranha-acento)" stroke-width="1.1"/>
        <g class="presa-casulo-seda" opacity="0">
          <ellipse cx="55" cy="60" rx="20" ry="33" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.5"/>
        </g>
      </svg>
    `;
  }

  function svgLagartinho() {
    // Lagartinho / Lagartixa detalhada (~porte da Tarântula Golias!) com 4 patas em leque, língua bífida e cauda sinuosa em 3 segmentos
    return `
      <svg viewBox="0 0 180 180" class="presa-svg presa-lagartinho" aria-hidden="true">
        <!-- Patas dianteiras e traseiras com dedinhos em leque -->
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <g class="pata-presa" data-lado="-1" data-par="0" style="transform-origin:81px 55px">
            <path d="M81 55 L63 49 L55 38" stroke-width="5.2"/>
            <path d="M81 55 L63 49 L55 38" stroke="var(--aranha-corpo)" stroke-width="2.2"/>
            <path d="M55 38 L48 33 M55 38 L50 30 M55 38 L55 29 M55 38 L60 32" stroke-width="1.5"/>
          </g>
          <g class="pata-presa" data-lado="1" data-par="0" style="transform-origin:99px 55px">
            <path d="M99 55 L117 49 L125 38" stroke-width="5.2"/>
            <path d="M99 55 L117 49 L125 38" stroke="var(--aranha-corpo)" stroke-width="2.2"/>
            <path d="M125 38 L132 33 M125 38 L130 30 M125 38 L125 29 M125 38 L120 32" stroke-width="1.5"/>
          </g>
          <g class="pata-presa" data-lado="-1" data-par="1" style="transform-origin:82px 94px">
            <path d="M82 94 L62 100 L56 112" stroke-width="5.6"/>
            <path d="M82 94 L62 100 L56 112" stroke="var(--aranha-corpo)" stroke-width="2.4"/>
            <path d="M56 112 L48 114 M56 112 L50 119 M56 112 L56 121 M56 112 L62 118" stroke-width="1.5"/>
          </g>
          <g class="pata-presa" data-lado="1" data-par="1" style="transform-origin:98px 94px">
            <path d="M98 94 L118 100 L124 112" stroke-width="5.6"/>
            <path d="M98 94 L118 100 L124 112" stroke="var(--aranha-corpo)" stroke-width="2.4"/>
            <path d="M124 112 L132 114 M124 112 L130 119 M124 112 L124 121 M124 112 L118 118" stroke-width="1.5"/>
          </g>
        </g>

        <!-- Cauda articulada em 3 segmentos aninhados (ondulação em S realista!) -->
        <g class="lagarto-cauda-1" style="transform-origin:90px 102px">
          <path d="M84 102 Q90 114 86 126 L94 126 Q90 114 96 102 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M90 105 L90 124" stroke="var(--aranha-acento)" stroke-width="1.6" stroke-dasharray="3 3"/>
          <g class="lagarto-cauda-2" style="transform-origin:90px 125px">
            <path d="M86 125 L87.5 149 L92.5 149 L94 125 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.0" stroke-linejoin="round"/>
            <path d="M90 127 L90 147" stroke="var(--aranha-acento)" stroke-width="1.35" stroke-dasharray="2.5 2.5"/>
            <g class="lagarto-cauda-3" style="transform-origin:90px 148px">
              <path d="M87.5 148 L90 174 L92.5 148 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </g>
          </g>
        </g>

        <!-- Tronco escamado -->
        <path d="M90 42 C101 44 104 60 102 76 C100 90 98 100 90 104 C82 100 80 90 78 76 C76 60 79 44 90 42 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.5"/>
        <path d="M90 46 L90 100" stroke="var(--aranha-acento)" stroke-width="2.0" stroke-linecap="round"/>
        <path d="M82 54 L90 59 L98 54 M81 65 L90 70 L99 65 M81 76 L90 81 L99 76 M83 87 L90 92 L97 87" fill="none" stroke="var(--aranha-acento)" stroke-width="1.55" stroke-linecap="round" opacity="0.82"/>

        <!-- Cabeça triangular + língua bífida -->
        <g class="lagarto-cabeca" style="transform-origin:90px 44px">
          <g class="lagarto-lingua" style="transform-origin:90px 16px" opacity="0">
            <path d="M90 16 L90 8 L87 4 M90 8 L93 4" fill="none" stroke="var(--aranha-acento)" stroke-width="1.7" stroke-linecap="round"/>
          </g>
          <path d="M90 15 C97 19 101 31 98 42 Q90 46 82 42 C79 31 83 19 90 15 Z" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M86 30 L90 36 L94 30" fill="none" stroke="var(--aranha-acento)" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="83.5" cy="27.5" r="2.7" fill="currentColor"/>
          <circle cx="96.5" cy="27.5" r="2.7" fill="currentColor"/>
          <circle cx="83.2" cy="26.8" r="0.95" fill="var(--aranha-brilho-olho)"/>
          <circle cx="96.8" cy="26.8" r="0.95" fill="var(--aranha-brilho-olho)"/>
        </g>
        <g class="presa-casulo-seda" opacity="0"></g>
      </svg>
    `;
  }

  function svgLagarta() {
    // Lagarta Gigante (Mandarová / Sphingidae) — 7 segmentos com onda peristáltica real + chifrinho caudal!
    const segs = [
      { y: 44, rx: 14.5, ry: 11, idx: 0, patas: "torax" },
      { y: 61, rx: 16.5, ry: 12, idx: 1, patas: "torax" },
      { y: 79, rx: 18.0, ry: 12.5, idx: 2, patas: "pseudo" },
      { y: 97, rx: 18.2, ry: 12.5, idx: 3, patas: "pseudo" },
      { y: 115, rx: 17.5, ry: 12, idx: 4, patas: "pseudo" },
      { y: 132, rx: 15.8, ry: 11.5, idx: 5, patas: "pseudo" },
      { y: 147, rx: 13.0, ry: 10.5, idx: 6, patas: "cauda" }
    ];
    const segsSvg = segs.map((s) => {
      const pExtra =
        s.patas === "torax"
          ? `<path d="M${90 - s.rx} ${s.y} L${90 - s.rx - 7} ${s.y - 3} M${90 + s.rx} ${s.y} L${90 + s.rx + 7} ${s.y - 3}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`
          : s.patas === "pseudo"
            ? `<circle cx="${90 - s.rx - 2.2}" cy="${s.y + 1}" r="3.2" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.8"/><circle cx="${90 + s.rx + 2.2}" cy="${s.y + 1}" r="3.2" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="1.8"/>`
            : `<path d="M90 ${s.y + 7} Q94 ${s.y + 17} 90 ${s.y + 24}" fill="none" stroke="var(--aranha-acento)" stroke-width="3.2" stroke-linecap="round"/>`;
      return `
        <g class="lagarta-seg" data-seg="${s.idx}" style="transform-origin:90px ${s.y}px">
          ${pExtra}
          <ellipse cx="90" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.4"/>
          <path d="M${90 - s.rx + 4} ${s.y + 2} L${90 - 4} ${s.y - 5} M${90 + s.rx - 4} ${s.y + 2} L${90 + 4} ${s.y - 5}" stroke="var(--aranha-acento)" stroke-width="1.9" stroke-linecap="round" opacity="0.88"/>
          <circle cx="${90 - s.rx + 5}" cy="${s.y + 1}" r="1.55" fill="currentColor" opacity="0.78"/>
          <circle cx="${90 + s.rx - 5}" cy="${s.y + 1}" r="1.55" fill="currentColor" opacity="0.78"/>
        </g>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 180 180" class="presa-svg presa-lagarta" aria-hidden="true">
        ${segsSvg}
        <g class="lagarta-cabeca" style="transform-origin:90px 30px">
          <path d="M84 22 L80 13 M96 22 L100 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <ellipse cx="90" cy="29" rx="12" ry="10.5" fill="var(--aranha-corpo)" stroke="currentColor" stroke-width="2.5"/>
          <path d="M85 26 Q90 31 95 26" fill="none" stroke="var(--aranha-acento)" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="84.5" cy="24.5" r="1.8" fill="currentColor"/>
          <circle cx="95.5" cy="24.5" r="1.8" fill="currentColor"/>
        </g>
        <g class="presa-casulo-seda" opacity="0"></g>
      </svg>
    `;
  }

  const PRESAS_CATALOGO = {
    mosca: {
      id: "mosca",
      nome: "Mosca Doméstica",
      porte: "pequeno",
      tamanho: 26,
      velocidadeBase: 145,
      voadora: true,
      gerarSvg: svgMosca
    },
    mosquito: {
      id: "mosquito",
      nome: "Mosquito",
      porte: "pequeno",
      tamanho: 28,
      velocidadeBase: 112,
      voadora: true,
      gerarSvg: svgMosquito
    },
    barata: {
      id: "barata",
      nome: "Barata",
      porte: "medio",
      tamanho: 54,
      velocidadeBase: 92,
      voadora: false,
      gerarSvg: svgBarata
    },
    lagartinho: {
      id: "lagartinho",
      nome: "Lagartinho",
      porte: "gigante",
      tamanho: 142,
      velocidadeBase: 68,
      voadora: false,
      gerarSvg: svgLagartinho
    },
    lagarta: {
      id: "lagarta",
      nome: "Lagarta Gigante",
      porte: "gigante",
      tamanho: 132,
      velocidadeBase: 28,
      voadora: false,
      gerarSvg: svgLagarta
    }
  };

  // ==========================================================================
  // 3. ESTADO DO MOTOR, FÍSICA SUAVE & PONTEIRO
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
  let cursorAtual = { x: -9999, y: -9999, ativo: false, ultimoMovX: -9999, ultimoMovY: -9999, paradoTempo: 0 };
  let scrollImpulso = 0;

  const ativas = [];
  const presasAtivas = [];
  const efeitosSolo = [];

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
    return window.innerWidth <= 768 ? 0.78 : 1;
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

  function lerpAngulo(atual, alvo, f) {
    const diff = ((alvo - atual + 540) % 360) - 180;
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

  function bordaMaisProxima(x, y, margem) {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    return [
      { d: x, x: -margem, y },
      { d: W - x, x: W + margem, y },
      { d: y, x, y: -margem },
      { d: H - y, x, y: H + margem }
    ].sort((a, b) => a.d - b.d)[0];
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

  function criarOndaVibracao(x, y, tipo = "solo") {
    if (!camadaEl) return;
    const onda = document.createElement("span");
    onda.className = tipo === "teia" ? "onda-vibracao-caca teia" : tipo === "impacto" ? "onda-vibracao-caca impacto" : "onda-vibracao-caca";
    onda.style.left = `${x.toFixed(1)}px`;
    onda.style.top = `${y.toFixed(1)}px`;
    camadaEl.appendChild(onda);
    setTimeout(() => {
      if (onda.parentNode) onda.parentNode.removeChild(onda);
    }, tipo === "impacto" ? 650 : 900);
  }

  function registrarEfeitoSolo(el, duracaoMs = 7000) {
    if (!el) return;
    efeitosSolo.push(el);
    setTimeout(() => {
      el.classList.add("desvanecendo");
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = efeitosSolo.indexOf(el);
        if (idx !== -1) efeitosSolo.splice(idx, 1);
      }, 900);
    }, duracaoMs);
  }

  // Tapete circular de seda tecido pela Tarântula Golias durante a "Dança da Seda"
  function criarTapeteSedaGolias(x, y) {
    const wrap = document.createElement("div");
    wrap.className = "tapete-seda-golias";
    wrap.style.left = `${x.toFixed(1)}px`;
    wrap.style.top = `${y.toFixed(1)}px`;
    wrap.innerHTML = `
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round">
          <ellipse cx="60" cy="60" rx="48" ry="44" stroke-width="1.05" opacity="0.42"/>
          <path d="M60 60 C68 56 72 66 64 72 C52 78 44 64 52 50 C62 36 82 44 82 62 C82 82 56 90 42 76 C28 62 36 34 58 28 C82 22 98 46 92 70" stroke-width="1.35" opacity="0.72"/>
          <path d="M22 52 Q60 44 98 56 M24 70 Q60 76 96 66 M48 22 Q58 60 50 98 M72 22 Q64 60 74 96" stroke-width="0.9" opacity="0.45"/>
        </g>
      </svg>
    `;
    garantirCamada().appendChild(wrap);
    return wrap;
  }

  // Bolus: bolinha seca e amassada de exoesqueleto descartada após digestão externa
  function criarBolusExoesqueleto(x, y) {
    const el = document.createElement("span");
    el.className = "bolus-exoesqueleto";
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
    garantirCamada().appendChild(el);
    registrarEfeitoSolo(el, 6200);
    return el;
  }

  // 1. Gota translúcida de orvalho (com reflexo especular)
  function criarGotaOrvalho(x, y) {
    const el = document.createElement("div");
    el.className = "gota-orvalho-atelie";
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
    el.innerHTML = `
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <ellipse cx="16" cy="17" rx="11.5" ry="10" fill="var(--aranha-acento)" fill-opacity="0.28" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.72"/>
        <ellipse cx="12.5" cy="13.5" rx="3.4" ry="2.1" transform="rotate(-26 12.5 13.5)" fill="#ffffff" fill-opacity="0.78"/>
        <circle cx="20.5" cy="20.5" r="1.3" fill="#ffffff" fill-opacity="0.45"/>
      </svg>
    `;
    garantirCamada().appendChild(el);
    efeitosSolo.push(el);
    return el;
  }

  // 2. Micro-nuvem de pelos urticantes (Tipo III — defesa real da Tarântula Golias!)
  function lancarParticulasUrticantes(x, y, angFrenteDeg) {
    const camada = garantirCamada();
    // Lança em cone para trás/lados do abdômen
    const baseRad = ((angFrenteDeg + 90) * Math.PI) / 180;
    for (let k = 0; k < 14; k++) {
      const p = document.createElement("span");
      p.className = "particula-urticante";
      const ang = baseRad + rand(-1.05, 1.05);
      const dist = rand(38, 92);
      p.style.left = `${x.toFixed(1)}px`;
      p.style.top = `${y.toFixed(1)}px`;
      p.style.setProperty("--ux", `${(Math.cos(ang) * dist).toFixed(1)}px`);
      p.style.setProperty("--uy", `${(Math.sin(ang) * dist).toFixed(1)}px`);
      p.style.setProperty("--urot", `${Math.round(rand(-140, 140))}deg`);
      camada.appendChild(p);
      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
      }, 1450);
    }
  }

  // 11. Exúvia (casca translúcida vazia deixada na Ecdise / Troca de Exoesqueleto)
  function criarExuviaAranha(inst) {
    const el = document.createElement("div");
    el.className = "exuvia-aranha";
    el.style.width = `${inst.tamPx}px`;
    el.style.height = `${inst.tamPx}px`;
    const meia = inst.tamPx / 2;
    el.style.transform = `translate3d(${(inst.estado.x - meia).toFixed(2)}px, ${(inst.estado.y - meia).toFixed(2)}px, 0) rotate(${inst.estado.angulo.toFixed(2)}deg)`;
    el.innerHTML = inst.especie.gerarSvg();
    garantirCamada().appendChild(el);
    registrarEfeitoSolo(el, 7400);
    return el;
  }

  // 12. Ooteca (casulo esférico prateado de ovos carregado pela Ñanduobyeté Mãe)
  function criarOotecaSeda() {
    const el = document.createElement("div");
    el.className = "ooteca-seda";
    el.innerHTML = `
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="10.5" fill="var(--aranha-tinta)" fill-opacity="0.82" stroke="var(--aranha-acento)" stroke-width="1.5"/>
        <path d="M6 12 Q14 7 22 12 M5.5 16 Q14 21 22.5 16 M10 5 Q14 14 10 23" fill="none" stroke="var(--aranha-corpo)" stroke-width="0.95" opacity="0.45"/>
        <circle cx="10.5" cy="10" r="2.2" fill="#ffffff" fill-opacity="0.55"/>
      </svg>
    `;
    garantirCamada().appendChild(el);
    efeitosSolo.push(el);
    return el;
  }

  // 9. Descoberta de cards visíveis reais na interface para caminhar pelas bordas (Tigmotaxia)
  function encontrarCardVisivelParaContorno() {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const seletores = ".home-hero-card, .home-boas-vindas, .pasta-card, .card-fio, .card-amostra, .bloco-precificacao, .card-config, .metrica-card";
    const candidatos = [];
    document.querySelectorAll(seletores).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 130 || r.height < 85) return;
      if (r.left < 18 || r.right > W - 18 || r.top < 24 || r.bottom > H - 24) return;
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.2) return;
      candidatos.push({ el, rect: r });
    });
    if (candidatos.length === 0) return null;
    return candidatos[Math.floor(Math.random() * candidatos.length)];
  }

  // Distância mínima de um ponto (px, py) até um segmento (x1, y1)-(x2, y2)
  function distPontoSegmento(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const l2 = vx * vx + vy * vy;
    if (l2 < 1) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / l2));
    return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
  }

  function criarSvgFio(classeExtra = "") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", classeExtra ? `aranha-fio-dinamico ${classeExtra}` : "aranha-fio-dinamico");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.35");
    path.setAttribute("stroke-dasharray", "3 3");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    garantirCamada().appendChild(svg);
    return { svg, path };
  }

  // ==========================================================================
  // 4. DETECÇÃO DE TEIAS DE CANTO VISÍVEIS & COREOGRAFIAS DE PASSEIO
  // ==========================================================================

  function calcularAncoraElemento(el, canto, offsetX, offsetY) {
    if (!el || !document.body.contains(el)) return null;
    const rect = el.getBoundingClientRect();
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    if (rect.width < 32 || rect.height < 32) return null;
    if (rect.bottom < 34 || rect.top > H - 34 || rect.right < 34 || rect.left > W - 34) return null;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.04) return null;

    if (canto === "top-right") {
      const vx = Math.min(W - 2, rect.right);
      const vy = Math.max(2, rect.top);
      return {
        vx,
        vy,
        px: Math.max(24, Math.min(W - 24, vx - offsetX)),
        py: Math.max(24, Math.min(H - 24, vy + offsetY)),
        anguloRepouso: 225,
        raioTeia: Math.max(54, Math.min(130, rect.width * 0.72))
      };
    }
    const vx = Math.max(2, rect.left);
    const vy = Math.max(2, rect.top);
    return {
      vx,
      vy,
      px: Math.max(24, Math.min(W - 24, vx + offsetX)),
      py: Math.max(24, Math.min(H - 24, vy + offsetY)),
      anguloRepouso: 135,
      raioTeia: Math.max(54, Math.min(130, rect.width * 0.72))
    };
  }

  function encontrarTeiasDeCantoVisiveis() {
    const candidatas = [];
    document.querySelectorAll(".teia-hero-decor").forEach((el) => {
      const a = calcularAncoraElemento(el, "top-right", 62, 58);
      if (a) candidatas.push({ ...a, el, canto: "top-right", offsetX: 62, offsetY: 58, teiaPropria: false, peso: 2.2 });
    });

    const teiaSidebar = document.querySelector(".teia-sidebar-topo");
    if (teiaSidebar) {
      const rect = teiaSidebar.getBoundingClientRect();
      if (rect.width >= 58) {
        const ox = Math.round(rect.width * 0.44);
        const oy = Math.round(rect.height * 0.44);
        const a = calcularAncoraElemento(teiaSidebar, "top-left", ox, oy);
        if (a) candidatas.push({ ...a, el: teiaSidebar, canto: "top-left", offsetX: ox, offsetY: oy, teiaPropria: false, peso: 1.9 });
      }
    }

    document.querySelectorAll(".cabecalho").forEach((el) => {
      const a = calcularAncoraElemento(el, "top-left", 48, 38);
      if (a) candidatas.push({ ...a, el, canto: "top-left", offsetX: 48, offsetY: 38, teiaPropria: false, peso: 1.6 });
    });

    document.querySelectorAll(".svg-vazio-artesanal").forEach((el) => {
      const a = calcularAncoraElemento(el, "top-right", 28, 28);
      if (a) candidatas.push({ ...a, el, canto: "top-right", offsetX: 28, offsetY: 28, teiaPropria: false, peso: 1.0 });
    });

    if (candidatas.length > 0) {
      const total = candidatas.reduce((s, c) => s + c.peso, 0);
      let r = Math.random() * total;
      for (const c of candidatas) {
        r -= c.peso;
        if (r <= 0) return c;
      }
      return candidatas[0];
    }

    const W = window.innerWidth || 1200;
    const usarDir = Math.random() < 0.65;
    return usarDir
      ? { el: null, canto: "top-right", vx: W - 2, vy: 2, px: W - 66, py: 62, anguloRepouso: 225, raioTeia: 112, teiaPropria: true }
      : { el: null, canto: "top-left", vx: 2, vy: 2, px: 66, py: 62, anguloRepouso: 135, raioTeia: 112, teiaPropria: true };
  }

  function criarEstadoCoreografia(tipo, especie, opcoes = {}) {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const margem = Math.round(especie.tamanho * 1.15);

    if (tipo === "contorno_card") {
      const alvoCard = opcoes.cardAlvo || encontrarCardVisivelParaContorno();
      if (alvoCard) {
        const r = alvoCard.rect;
        const quinas = [
          { x: r.left, y: r.top },
          { x: r.right, y: r.top },
          { x: r.right, y: r.bottom },
          { x: r.left, y: r.bottom }
        ];
        const iniIdx = Math.floor(Math.random() * 4);
        const sentido = Math.random() < 0.5 ? 1 : -1;
        const waypoints = [];
        for (let k = 0; k < 4; k++) {
          waypoints.push(quinas[(iniIdx + k * sentido + 8) % 4]);
        }
        const entrada = bordaMaisProxima(waypoints[0].x, waypoints[0].y, margem);
        const saida = bordaMaisProxima(waypoints[waypoints.length - 1].x, waypoints[waypoints.length - 1].y, margem);
        const rota = [{ x: entrada.x, y: entrada.y }, ...waypoints, { x: saida.x, y: saida.y }];
        const ang0 = (Math.atan2(rota[1].y - rota[0].y, rota[1].x - rota[0].x) * 180) / Math.PI + 90;
        return {
          tipo: "contorno_card",
          elCard: alvoCard.el,
          rota,
          idxAtual: 1,
          x: rota[0].x,
          y: rota[0].y,
          angulo: ang0,
          anguloAlvo: ang0,
          pausaRestante: 0,
          pausaFeita: false
        };
      }
      // Se não há card enquadrado no momento, cai suavemente em patrulha_borda
      tipo = "patrulha_borda";
    }

    if (tipo === "repouso_teia_canto") {
      const ancora = opcoes.ancoraForcada || encontrarTeiasDeCantoVisiveis();
      const angChegada = (Math.atan2(ancora.py - ancora.vy, ancora.px - ancora.vx) * 180) / Math.PI + 90;
      return {
        tipo,
        elAlvo: ancora.el,
        canto: ancora.canto,
        offsetX: ancora.offsetX || 62,
        offsetY: ancora.offsetY || 58,
        teiaPropria: Boolean(ancora.teiaPropria),
        raioTeia: ancora.raioTeia || 98,
        vx: ancora.vx,
        vy: ancora.vy,
        px: ancora.px,
        py: ancora.py,
        x: opcoes.iniciarNoCentro ? ancora.px : ancora.vx,
        y: opcoes.iniciarNoCentro ? ancora.py : ancora.vy,
        angulo: opcoes.iniciarNoCentro ? ancora.anguloRepouso : angChegada,
        anguloAlvo: opcoes.iniciarNoCentro ? ancora.anguloRepouso : angChegada,
        anguloRepouso: ancora.anguloRepouso,
        fase: opcoes.iniciarNoCentro ? "aguardando_em_x" : "chegando",
        t: 0,
        tempoFase: 0,
        duracaoReparo: rand(2.3, 3.4),
        duracaoVigilia: rand(8.5, 13.5),
        progressoSeda: opcoes.iniciarNoCentro ? 1 : 0,
        proximoBelisco: rand(1.8, 3.6),
        beliscoRestante: 0,
        vibracaoRestante: 0,
        cooldownVibracao: 0,
        temTeiaCanto: true
      };
    }

    if (tipo === "rapel_fio") {
      const xBase = opcoes.xBase != null ? opcoes.xBase : rand(Math.max(100, W * 0.16), Math.max(180, W - 90));
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
        const y = H - rand(34, 62);
        const dir = Math.random() < 0.5;
        p0 = { x: dir ? -margem : W + margem, y };
        p3 = { x: dir ? W + margem : -margem, y: y + rand(-8, 8) };
        p1 = { x: W * (dir ? 0.33 : 0.66), y: y + rand(-12, 12) };
        p2 = { x: W * (dir ? 0.66 : 0.33), y: y + rand(-12, 12) };
      } else {
        const x = W - rand(32, 58);
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

    // "travessia_curva", "saltinhos" ou ponto customizado (para encontros/caçadas)
    const bordaPonto = (lado) => {
      if (lado === 0) return { x: -margem, y: rand(H * 0.16, H * 0.84) };
      if (lado === 1) return { x: W + margem, y: rand(H * 0.16, H * 0.84) };
      if (lado === 2) return { x: rand(W * 0.18, W * 0.86), y: -margem };
      return { x: rand(W * 0.18, W * 0.86), y: H + margem };
    };
    const ladoIni = opcoes.ladoIni != null ? opcoes.ladoIni : Math.floor(Math.random() * 4);
    let ladoFim = opcoes.ladoFim != null ? opcoes.ladoFim : (ladoIni + 1 + Math.floor(Math.random() * 3)) % 4;
    if (ladoFim === ladoIni) ladoFim = (ladoIni + 1) % 4;

    const p0 = opcoes.p0 || bordaPonto(ladoIni);
    const p3 = opcoes.p3 || bordaPonto(ladoFim);
    const p1 = opcoes.p1 || { x: rand(W * 0.18, W * 0.82), y: rand(H * 0.18, H * 0.82) };
    const p2 = opcoes.p2 || { x: rand(W * 0.18, W * 0.82), y: rand(H * 0.18, H * 0.82) };
    const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y) * 1.24;
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
      faseSalto: "andando",
      saltoT: 0,
      proximoSaltoT: rand(0.16, 0.3)
    };
  }

  // ==========================================================================
  // 5. CRIAÇÃO DE INSTÂNCIAS (ARANHAS & PRESAS)
  // ==========================================================================

  function escolherEspecieEMovimento(especieForcada = null, movForcado = null) {
    let esp = especieForcada ? ESPECIES.find((e) => e.id === especieForcada) : null;
    if (!esp) {
      const pool = ESPECIES.filter((e) => e.id !== ultimaEspecieId);
      const lista = pool.length > 0 ? pool : ESPECIES;
      // Quanto mais rara a espécie (e no modo "raro"), mais difícil de ser sorteada espontaneamente!
      const pesoEfetivo = (e) => {
        const base = e.pesoSorteio || 1;
        if (modoAtual === "raro" && e.raridade === "lendaria") return base * 0.55;
        if (modoAtual === "raro" && e.raridade === "incomum") return base * 0.82;
        return base;
      };
      const somaPesos = lista.reduce((s, e) => s + pesoEfetivo(e), 0);
      let r = Math.random() * somaPesos;
      esp = lista[0];
      for (const item of lista) {
        r -= pesoEfetivo(item);
        if (r <= 0) {
          esp = item;
          break;
        }
      }
    }

    let mov = movForcado && esp.movimentos.includes(movForcado) ? movForcado : null;
    if (!mov) {
      if (esp.id === "tecela_canto" && (especieForcada || Math.random() < 0.78)) {
        mov = "repouso_teia_canto";
      } else {
        const movs = esp.movimentos.filter((m) => m !== ultimoMovimento);
        const lista = movs.length > 0 ? movs : esp.movimentos;
        const chanceEvitarTravessia = modoAtual === "raro" ? 0.78 : modoAtual === "discreto" ? 0.58 : 0;
        if (chanceEvitarTravessia > 0 && !especieForcada && Math.random() < chanceEvitarTravessia) {
          const discretos = lista.filter((m) => m !== "travessia_curva");
          mov = discretos.length > 0
            ? discretos[Math.floor(Math.random() * discretos.length)]
            : lista[0];
        } else {
          mov = lista[Math.floor(Math.random() * lista.length)];
        }
      }
    }

    ultimaEspecieId = esp.id;
    ultimoMovimento = mov;
    return { especie: esp, movimento: mov };
  }

  function sortearComportamentoPausa(especie) {
    const lista = especie.comportamentosPausa || ["probing"];
    return lista[Math.floor(Math.random() * lista.length)];
  }

  function gerarAranha(especieForcada = null, movForcado = null, ignorarFoco = false, opcoesEstado = {}) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) {
      return null;
    }

    const limite = ignorarFoco ? 4 : MAX_INSTANCIAS[modoAtual] || 0;
    if (ativas.length >= limite) return null;

    garantirCamada();
    const { especie, movimento } = escolherEspecieEMovimento(especieForcada, movForcado);
    const estado = criarEstadoCoreografia(movimento, especie, opcoesEstado);
    const escalaTela = obterEscalaTela();
    const tamPx = Math.round(especie.tamanho * escalaTela);

    const wrap = document.createElement("div");
    wrap.className = `aranha-viva-ator especie-${especie.id}`;
    wrap.style.width = `${tamPx}px`;
    wrap.style.height = `${tamPx}px`;
    wrap.innerHTML = especie.gerarSvg();

    let fioSvg = null;
    let fioPath = null;
    let estabPath = null;
    if (estado.temFio || estado.temFioVento || estado.temTeiaCanto) {
      fioSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fioSvg.setAttribute("class", estado.temTeiaCanto ? "aranha-fio-dinamico teia-canto-efemera" : "aranha-fio-dinamico");
      fioPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      fioPath.setAttribute("fill", "none");
      fioPath.setAttribute("stroke", "currentColor");
      fioPath.setAttribute("stroke-width", estado.temTeiaCanto ? "1.15" : "1.35");
      fioPath.setAttribute("stroke-dasharray", estado.temTeiaCanto ? "none" : "3 3");
      fioPath.setAttribute("stroke-linecap", "round");
      fioSvg.appendChild(fioPath);

      if (estado.temTeiaCanto) {
        estabPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        estabPath.setAttribute("class", "aranha-estabilimento-seda");
        estabPath.setAttribute("fill", "none");
        estabPath.setAttribute("stroke", "currentColor");
        estabPath.setAttribute("stroke-width", "1.6");
        estabPath.setAttribute("stroke-linecap", "round");
        estabPath.setAttribute("stroke-linejoin", "round");
        fioSvg.appendChild(estabPath);
      }
      camadaEl.appendChild(fioSvg);
    }

    camadaEl.appendChild(wrap);

    const patas = Array.from(wrap.querySelectorAll(".pata-art")).map((el) => {
      const lado = Number(el.dataset.lado) || 1;
      const par = Number(el.dataset.par) || 0;
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
      estabPath,
      patas,
      palpos: wrap.querySelector(".aranha-palpos"),
      abdomen: wrap.querySelector(".aranha-abdomen"),
      cefalo: wrap.querySelector(".aranha-cefalotorax"),
      queliceraEsq: wrap.querySelector(".golias-quelicera-esq"),
      queliceraDir: wrap.querySelector(".golias-quelicera-dir"),
      tamPx,
      tempoVida: 0,
      fasePassada: 0,
      comportamentoAtual: sortearComportamentoPausa(especie),
      tempoComportamento: 0,
      ancoraMarcada: false,
      defesaRestante: 0,
      defesaFeita: false,
      urticanteFeito: false,
      camuflagemRestante: 0,
      camuflagemFeita: false,
      atencaoClique: null,
      scrollAgachada: 0,
      balancoScroll: 0,
      curiosidadeFeita: false,
      acaoEspecial: null,
      fugindo: false,
      fugaAlvo: null,
      tempoUltimoRastro: 0,
      caca: null,
      interacao: null,
      cooldownInteracao: 0
    };

    ativas.push(instancia);
    iniciarLoop();
    return instancia;
  }

  function gerarPresa(tipoPresa, opcoes = {}) {
    const def = PRESAS_CATALOGO[tipoPresa];
    if (!def) return null;
    garantirCamada();

    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const escalaTela = obterEscalaTela();
    const tamPx = Math.round(def.tamanho * escalaTela);
    const margem = Math.round(tamPx * 1.05);

    // Origem na borda e ponto de pouso/passagem no centro do palco
    const esq = opcoes.daEsquerda != null ? opcoes.daEsquerda : Math.random() < 0.5;
    const x0 = opcoes.x0 != null ? opcoes.x0 : (esq ? -margem : W + margem);
    const y0 = opcoes.y0 != null ? opcoes.y0 : rand(H * 0.22, H * 0.78);
    const alvoX = opcoes.alvoX != null ? opcoes.alvoX : rand(W * 0.28, W * 0.72);
    const alvoY = opcoes.alvoY != null ? opcoes.alvoY : rand(H * 0.26, H * 0.76);
    const xSaida = opcoes.xSaida != null ? opcoes.xSaida : (esq ? W + margem : -margem);
    const ySaida = opcoes.ySaida != null ? opcoes.ySaida : rand(H * 0.2, H * 0.8);

    const wrap = document.createElement("div");
    wrap.className = `presa-viva-ator presa-${def.id}`;
    wrap.style.width = `${tamPx}px`;
    wrap.style.height = `${tamPx}px`;
    wrap.innerHTML = def.gerarSvg();
    camadaEl.appendChild(wrap);

    const ang0 = (Math.atan2(alvoY - y0, alvoX - x0) * 180) / Math.PI + 90;

    const presa = {
      uid: ++contadorInstancia,
      def,
      wrap,
      tamPx,
      asaEsq: wrap.querySelector(".presa-asa-esq"),
      asaDir: wrap.querySelector(".presa-asa-dir"),
      pataFEsq: wrap.querySelector(".presa-pata-f-esq"),
      pataFDir: wrap.querySelector(".presa-pata-f-dir"),
      antenaEsq: wrap.querySelector(".presa-antena-esq"),
      antenaDir: wrap.querySelector(".presa-antena-dir"),
      patas: Array.from(wrap.querySelectorAll(".pata-presa")).map((el) => ({
        el,
        lado: Number(el.dataset.lado) || 1,
        par: Number(el.dataset.par) || 0
      })),
      cauda1: wrap.querySelector(".lagarto-cauda-1"),
      cauda2: wrap.querySelector(".lagarto-cauda-2"),
      cauda3: wrap.querySelector(".lagarto-cauda-3"),
      lingua: wrap.querySelector(".lagarto-lingua"),
      cabecaLagarto: wrap.querySelector(".lagarto-cabeca"),
      segsLagarta: Array.from(wrap.querySelectorAll(".lagarta-seg")),
      cabecaLagarta: wrap.querySelector(".lagarta-cabeca"),
      casuloEl: wrap.querySelector(".presa-casulo-seda"),
      tempoVida: 0,
      faseMarcha: 0,
      modo: opcoes.modoInicial || "livre", // livre | pousada | alerta | defesa_presa | evadindo | presa_na_teia | capturada | escapando
      x: x0,
      y: y0,
      velocidadeX: 0,
      velocidadeY: 0,
      alvoX,
      alvoY,
      xSaida,
      ySaida,
      angulo: ang0,
      anguloAlvo: ang0,
      tempoPausa: 0,
      duracaoPouso: opcoes.duracaoPouso || rand(4.5, 7.5),
      jaPousou: false,
      vibrandoPresa: false,
      lutaIntensidade: 1,
      casuloProgresso: 0,
      cacador: null,
      linguaTimer: rand(1.4, 3.0),
      linguaAtiva: 0,
      sprintRestante: rand(1.2, 2.2),
      pausaSprint: 0,
      teiaAncora: opcoes.teiaAncora || null,
      // IA de percepção, alerta, esquiva e defesa da presa
      esquivasRestantes: opcoes.esquivasRestantes != null ? opcoes.esquivasRestantes : (def.voadora ? 2 : 1),
      tempoAlerta: 0,
      tempoDefesaPresa: 0,
      tempoEvadindo: 0,
      cooldownAlerta: 0,
      microGiroTimer: rand(0.9, 2.0),
      ultimoPulsoVib: 0,
      puloEvadeT: 0,
      origemEvadeX: x0,
      origemEvadeY: y0,
      escalaExtraX: 1,
      escalaExtraY: 1,
      // Comportamento de "barata tonta": mudanças constantes de direção + paradas súbitas!
      barataDirAng: Math.atan2(alvoY - y0, alvoX - x0),
      barataTrocaDirTimer: rand(0.32, 0.72),
      barataPausaTimer: 0,
      barataTempoErrando: 0
    };

    presasAtivas.push(presa);
    iniciarLoop();
    return presa;
  }

  function limparFioCaca(inst) {
    if (inst && inst.caca) {
      if (inst.caca.fioSvg) {
        if (inst.caca.fioSvg.parentNode) inst.caca.fioSvg.parentNode.removeChild(inst.caca.fioSvg);
        inst.caca.fioSvg = null;
        inst.caca.fioPath = null;
      }
      if (inst.caca.tapeteEl) {
        registrarEfeitoSolo(inst.caca.tapeteEl, 1200);
        inst.caca.tapeteEl = null;
      }
    }
  }

  function removerPresa(presa) {
    if (!presa) return;
    if (presa.wrap && presa.wrap.parentNode) presa.wrap.parentNode.removeChild(presa.wrap);
    if (presa.cacador && presa.cacador.caca && presa.cacador.caca.presa === presa) {
      limparFioCaca(presa.cacador);
      presa.cacador.caca = null;
    }
    const idx = presasAtivas.indexOf(presa);
    if (idx !== -1) presasAtivas.splice(idx, 1);
  }

  function limparAcaoEspecial(inst) {
    if (!inst || !inst.acaoEspecial) return;
    const ac = inst.acaoEspecial;
    if (ac.gotaEl && ac.gotaEl.parentNode) ac.gotaEl.parentNode.removeChild(ac.gotaEl);
    if (ac.ootecaEl && ac.ootecaEl.parentNode) ac.ootecaEl.parentNode.removeChild(ac.ootecaEl);
    inst.acaoEspecial = null;
  }

  function removerInstancia(inst) {
    if (!inst) return;
    limparFioCaca(inst);
    limparAcaoEspecial(inst);
    if (inst.caca && inst.caca.presa) {
      const p = inst.caca.presa;
      if (p.modo === "capturada") {
        removerPresa(p);
      } else {
        p.cacador = null;
        if (p.modo === "pousada") p.modo = "escapando";
      }
      inst.caca = null;
    }
    if (inst.wrap && inst.wrap.parentNode) inst.wrap.parentNode.removeChild(inst.wrap);
    if (inst.fioSvg && inst.fioSvg.parentNode) inst.fioSvg.parentNode.removeChild(inst.fioSvg);
    const idx = ativas.indexOf(inst);
    if (idx !== -1) ativas.splice(idx, 1);
  }

  function limparTodas() {
    while (ativas.length > 0) removerInstancia(ativas[0]);
    while (presasAtivas.length > 0) removerPresa(presasAtivas[0]);
    while (efeitosSolo.length > 0) {
      const el = efeitosSolo.pop();
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ==========================================================================
  // 6. DIRETOR DE CENAS DE CAÇA, ESCALA DE RARIDADE & ENCONTROS
  // ==========================================================================

  function vincularCaca(aranha, presa, podeEscapar = false, opcoes = {}) {
    if (!aranha || !presa) return;
    const estilo = aranha.especie.estiloCaca || "nandu_laco";
    presa.cacador = aranha;
    aranha.caca = {
      presa,
      estilo,
      fase:
        estilo === "tecela_teia"
          ? "aguardando_teia"
          : estilo === "caranguejo_abraco"
            ? "emboscada_imovel"
            : estilo === "golias_emboscada"
              ? (opcoes.comTocaFios ? "chegando_toca" : "armando_fios")
              : "detectando",
      tempoFase: 0,
      tempoTotal: 0,
      podeEscapar,
      furtiva: estilo === "caranguejo_abraco" || estilo === "golias_emboscada",
      congeladaFurtiva: 0,
      cicloEspreita: 0,
      ladoFlanqueio: Math.random() < 0.5 ? 1 : -1,
      rajadasSeda: 0,
      alvoFuga: null,
      fioSvg: null,
      fioPath: null,
      pontoSaltoIni: null,
      saltoT: 0,
      fioArremessoT: 0,
      // Exclusivo da sequência científica de 6 etapas da Tarântula Golias
      pontoEmboscada: opcoes.pontoEmboscada || { x: aranha.estado.x, y: aranha.estado.y },
      fiosAlarme: [],
      pulsoFioAlarme: 0,
      passosAlinhamento: 0,
      angAlvoAlinhamento: aranha.estado.angulo,
      tapeteEl: null,
      dancaAngIni: 0,
      bolusCriado: false
    };
  }

  function iniciarCenaCaca(especieId, tipoPresa, ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) {
      return null;
    }
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const podeEscapar = !ignorarFoco && Math.random() < 0.16;

    // Caso especial 1: Aranha Tecelã de Canto emboscando inseto na teia de canto!
    if (especieId === "tecela_canto") {
      const ancora = encontrarTeiasDeCantoVisiveis();
      const aranha = gerarAranha("tecela_canto", "repouso_teia_canto", true, {
        ancoraForcada: ancora,
        iniciarNoCentro: true
      });
      if (!aranha) return null;

      const sgn = ancora.canto === "top-right" ? -1 : 1;
      const alvoTeiaX = Math.max(26, Math.min(W - 26, ancora.px + sgn * 36));
      const alvoTeiaY = Math.max(26, Math.min(H - 26, ancora.py + 30));
      const presa = gerarPresa(tipoPresa || "mosquito", {
        x0: W * 0.5 + rand(-120, 120),
        y0: H * 0.62 + rand(-80, 80),
        alvoX: alvoTeiaX,
        alvoY: alvoTeiaY,
        teiaAncora: ancora
      });
      vincularCaca(aranha, presa, false);
      return { aranha, presa, titulo: `${aranha.especie.nome} × ${presa.def.nome}` };
    }

    // Caso especial 2: Tarântula Golias (Emboscada Terrestre Oportunista com Fios de Alarme!)
    if (especieId === "tarantula_golias") {
      const goliasNaDir = Math.random() < 0.5;
      const emboscadaX = goliasNaDir ? W * rand(0.62, 0.72) : W * rand(0.28, 0.38);
      const emboscadaY = H * rand(0.42, 0.68);
      const margemG = 148;
      const xGoliasIni = goliasNaDir ? W + margemG * 0.7 : -margemG * 0.7;

      // Presa entra do lado oposto rumo à região de caça
      const alvoPresaX = goliasNaDir ? emboscadaX - rand(115, 165) : emboscadaX + rand(115, 165);
      const alvoPresaY = Math.max(95, Math.min(H - 95, emboscadaY + rand(-70, 70)));
      const presa = gerarPresa(tipoPresa || "barata", {
        daEsquerda: goliasNaDir,
        y0: Math.max(95, Math.min(H - 95, emboscadaY + rand(-90, 90))),
        alvoX: alvoPresaX,
        alvoY: alvoPresaY,
        duracaoPouso: 10
      });
      if (!presa) return null;

      const aranha = gerarAranha("tarantula_golias", "travessia_curva", true, {
        p0: { x: xGoliasIni, y: emboscadaY },
        p1: { x: emboscadaX, y: emboscadaY },
        p2: { x: emboscadaX, y: emboscadaY },
        p3: { x: goliasNaDir ? -margemG : W + margemG, y: emboscadaY }
      });
      if (!aranha) {
        removerPresa(presa);
        return null;
      }

      vincularCaca(aranha, presa, podeEscapar, {
        comTocaFios: true,
        pontoEmboscada: { x: emboscadaX, y: emboscadaY }
      });
      return { aranha, presa, titulo: `${aranha.especie.nome} × ${presa.def.nome}` };
    }

    // Demais cenas de caça: palco central bem visível
    const palcoX = rand(W * 0.34, W * 0.66);
    const palcoY = rand(H * 0.36, H * 0.72);
    const daEsquerda = Math.random() < 0.5;
    const espDef = ESPECIES.find((e) => e.id === especieId) || ESPECIES[0];
    const margemAranha = Math.round(espDef.tamanho * 1.1);

    const presa = gerarPresa(tipoPresa, {
      daEsquerda,
      alvoX: palcoX,
      alvoY: palcoY,
      duracaoPouso: tipoPresa === "lagarta" || tipoPresa === "lagartinho" ? 8.5 : 6.8
    });
    if (!presa) return null;

    const xAranha = daEsquerda ? W + margemAranha : -margemAranha;
    const yAranha = Math.max(80, Math.min(H - 80, palcoY + rand(-70, 70)));
    const aranha = gerarAranha(especieId, "travessia_curva", true, {
      p0: { x: xAranha, y: yAranha },
      p1: { x: lerp(xAranha, palcoX, 0.4), y: yAranha },
      p2: { x: lerp(xAranha, palcoX, 0.75), y: palcoY },
      p3: { x: daEsquerda ? -margemAranha : W + margemAranha, y: palcoY }
    });
    if (!aranha) {
      removerPresa(presa);
      return null;
    }

    if (especieId === "caranguejo") {
      aranha.estado.x = palcoX + (daEsquerda ? 54 : -54);
      aranha.estado.y = palcoY + rand(-18, 18);
    }

    vincularCaca(aranha, presa, podeEscapar);
    return { aranha, presa, titulo: `${aranha.especie.nome} × ${presa.def.nome}` };
  }

  function iniciarEncontroAranhas(comGolias = false, ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) {
      return null;
    }
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const yEnc = rand(H * 0.34, H * 0.68);
    const xCentro = rand(W * 0.42, W * 0.58);

    const esp1Id = comGolias ? "tarantula_golias" : ["nandu", "papa_moscas", "caranguejo"][Math.floor(Math.random() * 3)];
    const esp2Pool = ["nandu", "papa_moscas", "tecela_renda", "caranguejo"].filter((id) => id !== esp1Id);
    const esp2Id = esp2Pool[Math.floor(Math.random() * esp2Pool.length)];

    const a1 = gerarAranha(esp1Id, "travessia_curva", true, {
      p0: { x: -110, y: yEnc + rand(-24, 24) },
      p1: { x: xCentro - 120, y: yEnc },
      p2: { x: xCentro + 120, y: yEnc },
      p3: { x: W + 120, y: yEnc + rand(-30, 30) }
    });
    const a2 = gerarAranha(esp2Id, "travessia_curva", true, {
      p0: { x: W + 90, y: yEnc + rand(-24, 24) },
      p1: { x: xCentro + 120, y: yEnc },
      p2: { x: xCentro - 120, y: yEnc },
      p3: { x: -110, y: yEnc + rand(-30, 30) }
    });

    if (!a1 || !a2) return null;
    return { aranha1: a1, aranha2: a2, titulo: `Encontro: ${a1.especie.nome} & ${a2.especie.nome}` };
  }

  // ==========================================================================
  // 6B. CENAS DOS NOVOS COMPORTAMENTOS VIVOS (ORVALHO, CORTEJO, ECDISE, OOTECA)
  // ==========================================================================

  // 1. Cena: Beber Gota de Orvalho
  function iniciarCenaBeberOrvalho(especieId = null, ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) return null;
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const espId = especieId || (Math.random() < 0.35 ? "tarantula_golias" : "nandu");
    const gx = Math.random() < 0.5 ? rand(110, Math.min(260, W * 0.28)) : rand(Math.max(W - 260, W * 0.72), W - 90);
    const gy = rand(H * 0.32, H * 0.76);
    const gotaEl = criarGotaOrvalho(gx, gy);
    const entrada = bordaMaisProxima(gx, gy, espId === "tarantula_golias" ? 150 : 76);

    const aranha = gerarAranha(espId, "travessia_curva", true, {
      p0: { x: entrada.x, y: entrada.y },
      p1: { x: gx, y: gy },
      p2: { x: gx, y: gy },
      p3: { x: entrada.x, y: entrada.y }
    });
    if (!aranha) {
      if (gotaEl.parentNode) gotaEl.parentNode.removeChild(gotaEl);
      return null;
    }
    aranha.acaoEspecial = { tipo: "beber_orvalho", fase: "indo", gotaEl, gx, gy, tempo: 0 };
    return { aranha, titulo: `${aranha.especie.nome} bebendo gota de orvalho` };
  }

  // 2. Cena teste: Nuvem de Pelos Urticantes da Tarântula Golias
  function iniciarCenaNuvemUrticante() {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const cx = W * 0.52;
    const cy = H * 0.54;
    const aranha = gerarAranha("tarantula_golias", "travessia_curva", true, {
      p0: { x: -150, y: cy },
      p1: { x: cx, y: cy },
      p2: { x: cx, y: cy },
      p3: { x: W + 150, y: cy }
    });
    if (!aranha) return null;
    aranha.estado.x = cx - 95;
    aranha.estado.y = cy;
    aranha.defesaFeita = true;
    aranha.urticanteFeito = true;
    aranha.acaoEspecial = { tipo: "chute_urticante", fase: "aviso", tempo: 0, particulasLancadas: false };
    return { aranha, titulo: "Tarântula Golias — Nuvem de Pelos Urticantes" };
  }

  // 3. Cena teste: Camuflagem de "Galhinho" (Postura Tetragnatha)
  function iniciarCenaCamuflagemGalhinho() {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const aranha = gerarAranha(Math.random() < 0.6 ? "tecela_renda" : "caranguejo", "travessia_curva", true, {
      p0: { x: W * 0.36, y: H * 0.56 },
      p1: { x: W * 0.5, y: H * 0.52 },
      p2: { x: W * 0.65, y: H * 0.48 },
      p3: { x: W + 90, y: H * 0.46 }
    });
    if (!aranha) return null;
    aranha.camuflagemRestante = 3.4;
    aranha.camuflagemFeita = true;
    return { aranha, titulo: `${aranha.especie.nome} — Camuflagem de Galhinho` };
  }

  // 10. Cena Rara: Dança de Cortejo da Papa-Moscas (Maratus / Salticidae)
  function iniciarCenaDancaCortejo(ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) return null;
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const cx = rand(W * 0.38, W * 0.62);
    const cy = rand(H * 0.38, H * 0.68);

    const dancarino = gerarAranha("papa_moscas", "travessia_curva", true, {
      p0: { x: -60, y: cy + 36 },
      p1: { x: cx, y: cy + 36 },
      p2: { x: cx, y: cy + 36 },
      p3: { x: W + 70, y: cy + 36 }
    });
    const observadora = gerarAranha("papa_moscas", "travessia_curva", true, {
      p0: { x: W + 60, y: cy - 36 },
      p1: { x: cx, y: cy - 36 },
      p2: { x: cx, y: cy - 36 },
      p3: { x: -70, y: cy - 36 }
    });
    if (!dancarino || !observadora) return null;

    dancarino.estado.x = cx - 95;
    dancarino.estado.y = cy + 34;
    observadora.estado.x = cx + 95;
    observadora.estado.y = cy - 34;

    dancarino.acaoEspecial = { tipo: "danca_cortejo", papel: "dancarino", parceira: observadora, centroX: cx, centroY: cy, tempo: 0, duracao: 4.6 };
    observadora.acaoEspecial = { tipo: "danca_cortejo", papel: "observadora", parceira: dancarino, centroX: cx, centroY: cy, tempo: 0, duracao: 4.6 };
    dancarino.cooldownInteracao = 12;
    observadora.cooldownInteracao = 12;
    return { dancarino, observadora, titulo: "Dança de Cortejo da Papa-Moscas!" };
  }

  // 11. Cena Lendária: Troca de Exoesqueleto / Ecdise (deixa Exúvia translúcida!)
  function iniciarCenaEcdise(especieId = null, ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) return null;
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const pool = ["nandu", "tecela_renda", "tarantula_golias"];
    const espId = especieId || pool[Math.floor(Math.random() * pool.length)];
    const alvoX = rand(W * 0.3, W * 0.7);
    const alvoY = rand(H * 0.34, H * 0.7);
    const entrada = bordaMaisProxima(alvoX, alvoY, espId === "tarantula_golias" ? 155 : 80);

    const aranha = gerarAranha(espId, "travessia_curva", true, {
      p0: { x: entrada.x, y: entrada.y },
      p1: { x: alvoX, y: alvoY },
      p2: { x: alvoX, y: alvoY },
      p3: { x: entrada.x, y: entrada.y }
    });
    if (!aranha) return null;
    aranha.acaoEspecial = { tipo: "ecdise_muda", fase: "indo", alvoX, alvoY, tempo: 0, exuviaCriada: false };
    return { aranha, titulo: `${aranha.especie.nome} — Troca de Exoesqueleto (Ecdise)` };
  }

  // 12. Cena Lendária: Ñanduobyeté Mãe com Ooteca & Filhotinhos em Ballooning!
  function iniciarCenaMaeOoteca(ignorarFoco = false) {
    if (!ignorarFoco && (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida())) return null;
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const esq = Math.random() < 0.5;
    const yLinha = rand(H * 0.44, H * 0.72);
    const aranha = gerarAranha("nandu", "travessia_curva", true, {
      p0: { x: esq ? -75 : W + 75, y: yLinha },
      p1: { x: W * (esq ? 0.35 : 0.65), y: yLinha - 18 },
      p2: { x: W * (esq ? 0.65 : 0.35), y: yLinha + 18 },
      p3: { x: esq ? W + 85 : -85, y: yLinha }
    });
    if (!aranha) return null;
    const ootecaEl = criarOotecaSeda();
    aranha.acaoEspecial = {
      tipo: "mae_ooteca",
      fase: "caminhando",
      ootecaEl,
      pontoEclosaoX: W * rand(0.42, 0.58),
      filhotesSoltos: 0,
      tempoEclosao: 0,
      tempo: 0
    };
    return { aranha, titulo: "Ñanduobyeté Mãe com Ooteca & Filhotinhos!" };
  }

  // Escala de Raridade Natural Progressiva (caçadas menos frequentes e Tarântula Golias Lendária!)
  function dispararEventoNatural() {
    if (modoAtual === "desligado" || animacoesReduzidasAtivas() || emZonaDeFocoProtegida()) return;
    if (ativas.length >= (MAX_INSTANCIAS[modoAtual] || 0)) return;

    const probs = PROBABILIDADES_EVENTO[modoAtual] || PROBABILIDADES_EVENTO.discreto;
    const limLendario = 1 - probs.lendarioGolias;
    const limRaro = limLendario - probs.raroBarataEncontro;
    const limIncomum = limRaro - probs.incomumInseto;
    const r = Math.random();

    // Nível 4 — Lendário (0,7% a 2,2%): Golias × Lagartinho/Lagarta, Ecdise ou Mãe com Ooteca!
    if (r >= limLendario && presasAtivas.length === 0) {
      const subL = Math.random();
      if (subL < 0.56) {
        const presaGigante = Math.random() < 0.5 ? "lagartinho" : "lagarta";
        iniciarCenaCaca("tarantula_golias", presaGigante, false);
      } else if (subL < 0.78) {
        iniciarCenaEcdise(null, false);
      } else {
        iniciarCenaMaeOoteca(false);
      }
      return;
    }

    // Nível 3 — Raro (2,8% a 7,3%): Barata, Encontro, ou Dança de Cortejo da Papa-Moscas
    if (r >= limRaro && presasAtivas.length === 0) {
      if (modoAtual === "vivo" && ativas.length === 0 && Math.random() < 0.32) {
        iniciarCenaDancaCortejo(false);
      } else if (modoAtual === "vivo" && ativas.length === 0 && Math.random() < 0.5) {
        iniciarEncontroAranhas(Math.random() < 0.16, false);
      } else if (Math.random() < probs.chanceCacaBarata) {
        iniciarCenaCaca("tarantula_golias", "barata", false);
      } else {
        gerarPresa("barata");
      }
      return;
    }

    // Nível 2 — Incomum (7% a 14,5%): Mosca/Mosquito ou Gota de Orvalho
    if (r >= limIncomum && presasAtivas.length === 0) {
      if (Math.random() < 0.24) {
        iniciarCenaBeberOrvalho(null, false);
        return;
      }
      const inseto = Math.random() < 0.52 ? "mosca" : "mosquito";
      if (Math.random() < probs.chanceCacaInseto) {
        const cacadores = inseto === "mosquito"
          ? ["tecela_canto", "tecela_renda", "papa_moscas", "nandu", "filhote"]
          : ["papa_moscas", "caranguejo", "nandu", "tecela_canto", "tecela_renda"];
        const escolhido = cacadores[Math.floor(Math.random() * cacadores.length)];
        iniciarCenaCaca(escolhido, inseto, false);
      } else {
        gerarPresa(inseto);
      }
      return;
    }

    // Nível 1 — Comum (~76% a ~89,5%): Passeio tranquilo de uma das 7 espécies (com Golias ~1-2%!)
    gerarAranha();
  }

  // ==========================================================================
  // 7. CINEMÁTICA E IA DE SOBREVIVÊNCIA DAS 5 PRESAS (ALERTA, EVASÃO, DEFESA, LUTA)
  // ==========================================================================

  function escolherPontoEvasao(presa, predX, predY, distMin, distMax) {
    const W = window.innerWidth || 1200;
    const H = window.innerHeight || 800;
    const margem = Math.max(74, presa.tamPx * 0.72);
    const dx = presa.x - predX;
    const dy = presa.y - predY;
    const angBase = Math.atan2(dy, dx);
    // Tenta escapar num ângulo lateral-oposto (zigue-zague natural) mantendo dentro da tela!
    const desvio = (Math.random() < 0.5 ? 1 : -1) * rand(0.42, 0.95);
    const dist = rand(distMin, distMax);
    let nx = presa.x + Math.cos(angBase + desvio) * dist;
    let ny = presa.y + Math.sin(angBase + desvio) * dist;

    if (nx < margem || nx > W - margem || ny < margem || ny > H - margem) {
      // Se bateu perto da borda, redireciona suavemente para o lado oposto dentro do palco
      nx = Math.max(margem, Math.min(W - margem, W * 0.5 + rand(-W * 0.24, W * 0.24)));
      ny = Math.max(margem, Math.min(H - margem, H * 0.5 + rand(-H * 0.22, H * 0.22)));
    }
    return { x: nx, y: ny };
  }

  function animarAnatomiaPresa(presa, dt, movendo) {
    const t = presa.tempoVida;
    const id = presa.def.id;
    const intensidadeLuta = presa.modo === "capturada" ? presa.lutaIntensidade : 1;

    // 1. Mosca & Mosquito: asas vibrantes + alerta (asas abertas) + esfregar patinhas
    if (id === "mosca" || id === "mosquito") {
      const voando = presa.modo === "livre" || presa.modo === "evadindo" || presa.modo === "escapando";
      const alerta = presa.modo === "alerta";
      // Na teia, alterna rajadas de luta desesperada (0.55s) com pausas exaustas (0.3s)!
      const cicloTeiaAtivo = presa.modo === "presa_na_teia" && ((t % 0.85) < 0.56);
      const debatendo = cicloTeiaAtivo || (presa.modo === "capturada" && presa.vibrandoPresa && intensidadeLuta > 0.08);
      const ampAsa = voando ? 34 : debatendo ? 30 * intensidadeLuta : alerta ? 16 : 3.5;
      const freqAsa = voando ? 72 : debatendo ? 58 : alerta ? 26 : 3;
      const offsetAsa = alerta ? 14 : 0;
      const angA = offsetAsa + Math.sin(t * freqAsa) * ampAsa;
      if (presa.asaEsq) presa.asaEsq.style.transform = `rotate(${(-angA).toFixed(1)}deg)`;
      if (presa.asaDir) presa.asaDir.style.transform = `rotate(${angA.toFixed(1)}deg)`;

      // Mosca pousada e tranquila esfrega as patinhas dianteiras; em alerta para na hora!
      if (id === "mosca") {
        if (presa.modo === "pousada") {
          const esfrega = Math.sin(t * 18) * 14;
          if (presa.pataFEsq) presa.pataFEsq.style.transform = `rotate(${(16 + esfrega).toFixed(1)}deg)`;
          if (presa.pataFDir) presa.pataFDir.style.transform = `rotate(${(-16 - esfrega).toFixed(1)}deg)`;
        } else {
          if (presa.pataFEsq) presa.pataFEsq.style.transform = "rotate(0deg)";
          if (presa.pataFDir) presa.pataFDir.style.transform = "rotate(0deg)";
        }
      }
    }

    // 2. Barata: radar de antenas (assimétricas explorando, apontadas/tremendo em alerta) + marcha 3+3
    if (id === "barata") {
      if (presa.modo === "alerta") {
        const trem = Math.sin(t * 36) * 8;
        if (presa.antenaEsq) presa.antenaEsq.style.transform = `rotate(${(14 + trem).toFixed(1)}deg)`;
        if (presa.antenaDir) presa.antenaDir.style.transform = `rotate(${(-14 - trem).toFixed(1)}deg)`;
      } else {
        const varr = Math.sin(t * (movendo ? 18 : 9)) * 22;
        if (presa.antenaEsq) presa.antenaEsq.style.transform = `rotate(${varr.toFixed(1)}deg)`;
        if (presa.antenaDir) presa.antenaDir.style.transform = `rotate(${(-varr * 0.85 + Math.cos(t * 11) * 10).toFixed(1)}deg)`;
      }
      if (movendo) presa.faseMarcha += dt * (presa.modo === "evadindo" ? 46 : 34);
      for (let i = 0; i < presa.patas.length; i++) {
        const p = presa.patas[i];
        const fase = (p.par % 2 === 0 ? (p.lado === -1 ? 0 : Math.PI) : (p.lado === -1 ? Math.PI : 0));
        const ang = movendo
          ? Math.sin(presa.faseMarcha + fase) * 18
          : presa.vibrandoPresa && intensidadeLuta > 0.08
            ? Math.sin(t * 28 + fase) * 18 * intensidadeLuta
            : 0;
        p.el.style.transform = `rotate(${ang.toFixed(1)}deg)`;
      }
    }

    // 3. Lagartinho: marcha diagonal + alerta (ponta da cauda tremendo + flexão) + chicoteada de cauda na luta!
    if (id === "lagartinho") {
      if (movendo) presa.faseMarcha += dt * (presa.modo === "evadindo" ? 24 : 16);
      const emAlerta = presa.modo === "alerta";
      const emLuta = presa.modo === "capturada" && presa.vibrandoPresa && intensidadeLuta > 0.06;
      const ampC1 = emLuta ? 26 * intensidadeLuta : movendo ? (presa.modo === "evadindo" ? 24 : 18) : emAlerta ? 4 : 5;
      const ampC3 = emLuta ? 34 * intensidadeLuta : emAlerta ? 22 : ampC1 * 1.25;
      const freqCauda = emLuta ? t * 28 : movendo ? presa.faseMarcha : emAlerta ? t * 22 : t * 2.4;
      if (presa.cauda1) presa.cauda1.style.transform = `rotate(${(Math.sin(freqCauda) * ampC1).toFixed(1)}deg)`;
      if (presa.cauda2) presa.cauda2.style.transform = `rotate(${(Math.sin(freqCauda - 1.05) * ampC1 * 1.15).toFixed(1)}deg)`;
      if (presa.cauda3) presa.cauda3.style.transform = `rotate(${(Math.sin(freqCauda - 2.0) * ampC3).toFixed(1)}deg)`;

      for (let i = 0; i < presa.patas.length; i++) {
        const p = presa.patas[i];
        const fase = (p.par === 0 ? (p.lado === -1 ? 0 : Math.PI) : (p.lado === -1 ? Math.PI : 0));
        const ang = movendo
          ? Math.sin(presa.faseMarcha + fase) * 22
          : emLuta
            ? Math.sin(t * 24 + fase) * 18 * intensidadeLuta
            : 0;
        p.el.style.transform = `rotate(${ang.toFixed(1)}deg)`;
      }

      if (presa.cabecaLagarto) {
        const scan = emAlerta ? Math.sin(t * 10) * 12 : movendo ? Math.sin(presa.faseMarcha) * 5 : Math.sin(t * 2.2) * 8;
        presa.cabecaLagarto.style.transform = `rotate(${scan.toFixed(1)}deg)`;
      }

      // Língua bífida sai rapidamente quando tranquilo ou em alerta!
      if (presa.lingua && presa.modo !== "capturada") {
        presa.linguaTimer -= dt;
        if (presa.linguaTimer <= 0 && presa.linguaAtiva <= 0) {
          presa.linguaAtiva = 0.3;
          presa.linguaTimer = emAlerta ? rand(0.9, 1.6) : rand(2.2, 4.4);
        }
        if (presa.linguaAtiva > 0) {
          presa.linguaAtiva -= dt;
          const p = Math.sin(Math.max(0, presa.linguaAtiva / 0.3) * Math.PI);
          presa.lingua.style.opacity = p.toFixed(2);
          presa.lingua.style.transform = `scaleY(${(0.4 + p * 0.95).toFixed(2)})`;
        } else {
          presa.lingua.style.opacity = "0";
        }
      }
    }

    // 4. Lagarta Gigante: onda peristáltica + postura defensiva "Esfinge" + contorção na luta!
    if (id === "lagarta") {
      if (movendo) presa.faseMarcha += dt * (presa.modo === "evadindo" ? 8.2 : 5.8);
      const emEsfinge = presa.modo === "defesa_presa";
      const emLuta = presa.modo === "capturada" && presa.vibrandoPresa && intensidadeLuta > 0.06;
      for (let i = 0; i < presa.segsLagarta.length; i++) {
        const seg = presa.segsLagarta[i];
        if (emEsfinge && i <= 2) {
          // Arqueia e balança os 3 segmentos dianteiros (postura defensiva Sphingidae!)
          const balanco = Math.sin(t * 14) * (10 - i * 2.8);
          seg.style.transform = `translate(${balanco.toFixed(1)}px, ${(3 - i) * 1.4}px) scale(${(1.08 - i * 0.02).toFixed(3)}, 0.88)`;
        } else {
          const onda = movendo
            ? Math.sin(presa.faseMarcha - (6 - i) * 0.72)
            : emLuta
              ? Math.sin(t * 18 + i * 0.9) * 1.15 * intensidadeLuta
              : Math.sin(t * 1.8 + i * 0.4) * 0.25;
          const sx = 1 + onda * 0.085;
          const sy = 1 - onda * 0.1;
          const dy = onda * 2.6;
          const rotC = emLuta ? Math.sin(t * 15 + i) * 8 * intensidadeLuta : 0;
          seg.style.transform = `translateY(${dy.toFixed(2)}px) rotate(${rotC.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        }
      }
      if (presa.cabecaLagarta) {
        const tateio = emEsfinge ? Math.sin(t * 16) * 24 : Math.sin(t * 3.8) * 10;
        presa.cabecaLagarta.style.transform = `rotate(${tateio.toFixed(1)}deg)`;
      }
    }

    if (presa.casuloEl) {
      presa.casuloEl.style.opacity = Math.max(0, Math.min(1, presa.casuloProgresso)).toFixed(2);
    }
  }

  function atualizarPresa(presa, dt) {
    presa.tempoVida += dt;
    if (presa.cooldownAlerta > 0) presa.cooldownAlerta -= dt;
    presa.escalaExtraX = 1;
    presa.escalaExtraY = 1;

    let movendo = false;
    let terminado = false;
    const prevX = presa.x;
    const prevY = presa.y;
    const pred = presa.cacador && ativas.includes(presa.cacador) ? presa.cacador : null;

    // Detecção ativa do predador enquanto a presa está tranquila/pousada/livre
    if (
      pred &&
      !pred.fugindo &&
      presa.esquivasRestantes > 0 &&
      presa.cooldownAlerta <= 0 &&
      (presa.modo === "pousada" || presa.modo === "livre") &&
      presa.casuloProgresso < 0.2
    ) {
      const c = pred.caca;
      // Aranha-Caranguejo ultra-furtiva ou predador congelado em estátua NÃO dispara o alerta!
      const predFurtivo = c && (c.furtiva || c.congeladaFurtiva > 0 || c.fase === "aguardando_teia");
      const distPred = Math.hypot(pred.estado.x - presa.x, pred.estado.y - presa.y);
      const raioAlerta = presa.def.id === "lagartinho" ? 275 : presa.def.id === "barata" ? 240 : presa.def.id === "lagarta" ? 215 : 172;

      if (!predFurtivo && distPred < raioAlerta) {
        if (presa.def.id === "lagarta") {
          presa.modo = "defesa_presa";
          presa.tempoDefesaPresa = 0.92;
        } else {
          presa.modo = "alerta";
          presa.tempoAlerta = presa.def.voadora ? rand(0.42, 0.65) : rand(0.45, 0.72);
        }
        // Vira de lado ou na direção do predador ao perceber perigo
        const angPred = (Math.atan2(pred.estado.y - presa.y, pred.estado.x - presa.x) * 180) / Math.PI + 90;
        presa.anguloAlvo = presa.def.id === "lagartinho" ? angPred + 72 : angPred;
      }
    }

    if (presa.modo === "capturada") {
      animarAnatomiaPresa(presa, dt, false);
    } else if (presa.modo === "presa_na_teia") {
      // Luta em ciclos alternados na teia de canto + emite ondas de vibração radiais!
      const emRajada = (presa.tempoVida % 0.85) < 0.56;
      const vib = presa.casuloProgresso > 0.72 ? 0.25 : emRajada ? 3.1 : 0.45;
      presa.x = presa.alvoX + Math.sin(presa.tempoVida * 48) * vib;
      presa.y = presa.alvoY + Math.cos(presa.tempoVida * 41) * vib;
      presa.anguloAlvo = presa.angulo + Math.sin(presa.tempoVida * 22) * (emRajada ? 16 : 2);
      presa.ultimoPulsoVib += dt;
      if (emRajada && presa.casuloProgresso < 0.65 && presa.ultimoPulsoVib >= 0.42) {
        presa.ultimoPulsoVib = 0;
        criarOndaVibracao(presa.alvoX, presa.alvoY, "teia");
      }
      animarAnatomiaPresa(presa, dt, false);
    } else if (presa.modo === "alerta") {
      presa.tempoAlerta -= dt;
      // Lagartinho faz 2 micro-flexões territoriais rápidas em alerta!
      if (presa.def.id === "lagartinho") {
        const flex = Math.sin(presa.tempoVida * 16) * 0.05;
        presa.escalaExtraX = 1 + flex;
        presa.escalaExtraY = 1 - flex * 0.6;
      }
      if (presa.tempoAlerta <= 0) {
        const distPred = pred ? Math.hypot(pred.estado.x - presa.x, pred.estado.y - presa.y) : 999;
        const raioEvasao = presa.def.id === "lagartinho" ? 235 : presa.def.id === "barata" ? 205 : 155;
        if (pred && distPred < raioEvasao && presa.esquivasRestantes > 0) {
          // Dispara manobra evasiva curta!
          presa.esquivasRestantes -= 1;
          presa.cooldownAlerta = 2.6;
          const dest = escolherPontoEvasao(
            presa,
            pred.estado.x,
            pred.estado.y,
            presa.def.voadora ? 110 : 155,
            presa.def.voadora ? 185 : 240
          );
          presa.origemEvadeX = presa.x;
          presa.origemEvadeY = presa.y;
          presa.alvoX = dest.x;
          presa.alvoY = dest.y;
          presa.puloEvadeT = 0;
          presa.tempoEvadindo = 0;
          presa.modo = "evadindo";
          if (!presa.def.voadora) criarOndaVibracao(presa.x, presa.y, "solo");
        } else {
          presa.cooldownAlerta = 1.6;
          presa.modo = presa.def.voadora ? "pousada" : "livre";
        }
      }
      animarAnatomiaPresa(presa, dt, false);
    } else if (presa.modo === "defesa_presa") {
      // Lagarta Gigante em postura defensiva "Esfinge" antes de rastejar em curva evasiva!
      presa.tempoDefesaPresa -= dt;
      if (presa.tempoDefesaPresa <= 0) {
        presa.esquivasRestantes -= 1;
        presa.cooldownAlerta = 3.2;
        if (pred) {
          const dest = escolherPontoEvasao(presa, pred.estado.x, pred.estado.y, 110, 165);
          presa.alvoX = dest.x;
          presa.alvoY = dest.y;
        }
        presa.tempoEvadindo = 0;
        presa.modo = "evadindo";
      }
      animarAnatomiaPresa(presa, dt, false);
    } else if (presa.modo === "evadindo") {
      presa.tempoEvadindo += dt;
      movendo = true;
      const fatorFio = Math.max(0.28, 1 - presa.casuloProgresso * 0.85);

      if (presa.def.voadora) {
        // Voo evasivo curto em arco ("hop-flight") com elevação visual!
        presa.puloEvadeT = Math.min(1, presa.puloEvadeT + dt * 1.65 * fatorFio);
        const ease = 1 - Math.pow(1 - presa.puloEvadeT, 2);
        const arco = Math.sin(presa.puloEvadeT * Math.PI);
        presa.x = lerp(presa.origemEvadeX, presa.alvoX, ease);
        presa.y = lerp(presa.origemEvadeY, presa.alvoY, ease) - arco * 24;
        presa.escalaExtraX = 1 + arco * 0.22;
        presa.escalaExtraY = 1 + arco * 0.22;
        presa.anguloAlvo = (Math.atan2(presa.alvoY - presa.origemEvadeY, presa.alvoX - presa.origemEvadeX) * 180) / Math.PI + 90;
        if (presa.puloEvadeT >= 1) {
          presa.modo = "pousada";
          presa.tempoPausa = 0;
        }
      } else {
        // Fuga terrestre em zigue-zague (Barata / Lagartinho / Lagarta) emitindo ondas no chão!
        const dx = presa.alvoX - presa.x;
        const dy = presa.alvoY - presa.y;
        const dist = Math.hypot(dx, dy);
        const multVel = presa.def.id === "lagartinho" ? 1.85 : presa.def.id === "barata" ? 1.7 : 1.45;
        const vel = presa.def.velocidadeBase * multVel * fatorFio;
        if (dist <= vel * dt + 14 || presa.tempoEvadindo >= 2.6) {
          presa.modo = "pousada";
          presa.tempoPausa = 0;
        } else {
          const zig = presa.def.id === "barata" ? Math.sin(presa.tempoVida * 16) * 44 : presa.def.id === "lagartinho" ? Math.sin(presa.tempoVida * 9) * 32 : 0;
          presa.x += ((dx / dist) * vel - (dy / dist) * zig) * dt;
          presa.y += ((dy / dist) * vel + (dx / dist) * zig) * dt;
          presa.anguloAlvo = (Math.atan2(presa.y - prevY, presa.x - prevX) * 180) / Math.PI + 90;

          presa.ultimoPulsoVib += dt;
          if (presa.ultimoPulsoVib >= 0.48) {
            presa.ultimoPulsoVib = 0;
            criarOndaVibracao(presa.x, presa.y, "solo");
          }
        }
      }
      animarAnatomiaPresa(presa, dt, movendo);
    } else if (presa.modo === "pousada") {
      presa.tempoPausa += dt;
      // Barata não fica parada por muito tempo: logo volta a errar como "barata tonta"!
      if (presa.def.id === "barata") {
        if (presa.tempoPausa >= rand(0.45, 0.85)) {
          presa.modo = "livre";
          presa.barataPausaTimer = 0;
          presa.barataDirAng += (Math.random() < 0.5 ? 1 : -1) * rand(0.7, 1.9);
        }
      } else if (presa.def.id === "mosca") {
        presa.microGiroTimer -= dt;
        if (presa.microGiroTimer <= 0) {
          presa.microGiroTimer = rand(1.1, 2.3);
          presa.anguloAlvo += (Math.random() < 0.5 ? 1 : -1) * rand(28, 62);
        }
      }
      if (presa.tempoPausa >= presa.duracaoPouso && (!pred || pred.fugindo)) {
        presa.modo = "escapando";
      }
      animarAnatomiaPresa(presa, dt, false);
    } else if (presa.modo === "escapando") {
      movendo = true;
      const dx = presa.xSaida - presa.x;
      const dy = presa.ySaida - presa.y;
      const dist = Math.hypot(dx, dy);
      const multEsc = presa.def.voadora ? 1.9 : 1.85;
      const vel = presa.def.velocidadeBase * multEsc;
      if (dist <= vel * dt + 10) {
        terminado = true;
      } else {
        const zig = presa.def.voadora ? Math.sin(presa.tempoVida * 11) * 45 : Math.sin(presa.tempoVida * 10) * 20;
        presa.x += ((dx / dist) * vel - (dy / dist) * zig) * dt;
        presa.y += ((dy / dist) * vel + (dx / dist) * zig) * dt;
        presa.anguloAlvo = (Math.atan2(presa.y - prevY, presa.x - prevX) * 180) / Math.PI + 90;
      }
      animarAnatomiaPresa(presa, dt, movendo);
    } else if (presa.def.id === "barata") {
      // Comportamento autêntico de "barata tonta": muda de direção toda hora + paradas súbitas!
      const W = window.innerWidth || 1200;
      const H = window.innerHeight || 800;
      const margem = 68;
      presa.barataTempoErrando += dt;

      if (presa.barataPausaTimer > 0) {
        // Parada súbita com antenas varrendo o ambiente!
        presa.barataPausaTimer -= dt;
        if (presa.barataPausaTimer <= 0) {
          // Escolhe nova direção brusca ao retomar a corrida
          presa.barataDirAng += (Math.random() < 0.5 ? 1 : -1) * rand(0.65, 2.05);
          presa.barataTrocaDirTimer = rand(0.32, 0.78);
        }
      } else {
        movendo = true;
        presa.barataTrocaDirTimer -= dt;
        if (presa.barataTrocaDirTimer <= 0) {
          if (Math.random() < 0.38) {
            // Parada súbita aleatória
            presa.barataPausaTimer = rand(0.28, 0.72);
          } else {
            // Guinada repentina de "barata tonta"!
            presa.barataDirAng += (Math.random() < 0.5 ? 1 : -1) * rand(0.62, 1.95);
            // Se há uma Tarântula Golias esperando nos fios de alarme, atrai suavemente após alguns segundos
            if (pred && pred.caca && pred.caca.fase === "esperando_fios" && presa.barataTempoErrando > 2.6) {
              const angAlvoFios = Math.atan2(pred.estado.y - presa.y, pred.estado.x - presa.x);
              const diff = Math.atan2(Math.sin(angAlvoFios - presa.barataDirAng), Math.cos(angAlvoFios - presa.barataDirAng));
              presa.barataDirAng += diff * rand(0.45, 0.8);
            }
          }
          presa.barataTrocaDirTimer = rand(0.3, 0.75);
        }

        // Mantém a barata tonta dentro da tela rebatendo suavemente nas margens
        if (presa.x < margem && Math.cos(presa.barataDirAng) < 0) {
          presa.barataDirAng = rand(-0.9, 0.9);
        } else if (presa.x > W - margem && Math.cos(presa.barataDirAng) > 0) {
          presa.barataDirAng = Math.PI + rand(-0.9, 0.9);
        }
        if (presa.y < margem && Math.sin(presa.barataDirAng) < 0) {
          presa.barataDirAng = Math.PI * 0.5 + rand(-0.9, 0.9);
        } else if (presa.y > H - margem && Math.sin(presa.barataDirAng) > 0) {
          presa.barataDirAng = -Math.PI * 0.5 + rand(-0.9, 0.9);
        }

        const velBarata = presa.def.velocidadeBase * rand(1.05, 1.32);
        presa.x += Math.cos(presa.barataDirAng) * velBarata * dt;
        presa.y += Math.sin(presa.barataDirAng) * velBarata * dt;
        presa.anguloAlvo = (presa.barataDirAng * 180) / Math.PI + 90;

        // Emite vibrações no chão percebidas pelos tricobótrios da Tarântula Golias
        presa.ultimoPulsoVib += dt;
        if (presa.ultimoPulsoVib >= 0.62) {
          presa.ultimoPulsoVib = 0;
          criarOndaVibracao(presa.x, presa.y, "solo");
        }
      }

      if (!pred && presa.barataTempoErrando > 9.5) {
        presa.modo = "escapando";
      }
      animarAnatomiaPresa(presa, dt, movendo);
    } else {
      const dx = presa.alvoX - presa.x;
      const dy = presa.alvoY - presa.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 14) {
        movendo = true;
        let vel = presa.def.velocidadeBase;
        if (presa.def.id === "lagarta") {
          vel *= 0.65 + Math.max(0, Math.sin(presa.faseMarcha)) * 0.85;
        }
        const ond = presa.def.voadora
          ? Math.sin(presa.tempoVida * (presa.def.id === "mosquito" ? 6.5 : 9)) * 38
          : presa.def.id === "lagartinho"
            ? Math.sin(presa.tempoVida * 4.5) * 14
            : 0;
        presa.x += ((dx / dist) * vel - (dy / dist) * ond) * dt;
        presa.y += ((dy / dist) * vel + (dx / dist) * ond) * dt;
        presa.anguloAlvo = (Math.atan2(presa.y - prevY, presa.x - prevX) * 180) / Math.PI + 90;

        if (!presa.def.voadora && pred && pred.especie.id === "tarantula_golias") {
          presa.ultimoPulsoVib += dt;
          if (presa.ultimoPulsoVib >= 0.78) {
            presa.ultimoPulsoVib = 0;
            criarOndaVibracao(presa.x, presa.y, "solo");
          }
        }
      } else {
        if (presa.teiaAncora) {
          presa.modo = "presa_na_teia";
          criarOndaVibracao(presa.alvoX, presa.alvoY, "teia");
        } else if (presa.def.voadora || !presa.jaPousou) {
          presa.jaPousou = true;
          presa.modo = "pousada";
          presa.tempoPausa = 0;
        } else {
          presa.modo = "escapando";
        }
      }
      animarAnatomiaPresa(presa, dt, movendo);
    }

    if (terminado) {
      removerPresa(presa);
      return;
    }

    // Vetor velocidade instantâneo (usado na interceptação preditiva da Tarântula Golias!)
    presa.velocidadeX = lerp(presa.velocidadeX, (presa.x - prevX) / Math.max(0.004, dt), dt * 10);
    presa.velocidadeY = lerp(presa.velocidadeY, (presa.y - prevY) / Math.max(0.004, dt), dt * 10);

    presa.angulo = lerpAngulo(presa.angulo, presa.anguloAlvo, dt * 11);
    const meia = presa.tamPx / 2;
    presa.wrap.style.transform = `translate3d(${(presa.x - meia).toFixed(2)}px, ${(presa.y - meia).toFixed(2)}px, 0) rotate(${presa.angulo.toFixed(2)}deg) scale(${presa.escalaExtraX.toFixed(3)}, ${presa.escalaExtraY.toFixed(3)})`;
  }

  // ==========================================================================
  // 8. MÁQUINA DE ESTADOS DAS 7 ESTRATÉGIAS DE CAÇA + INTERAÇÕES ARANHA↔ARANHA
  // ==========================================================================

  function atualizarCaca(inst, dt, flags) {
    const c = inst.caca;
    const p = c.presa;
    const st = inst.estado;
    if (!p || !presasAtivas.includes(p)) {
      limparFioCaca(inst);
      inst.caca = null;
      return false;
    }

    c.tempoFase += dt;
    c.tempoTotal = (c.tempoTotal || 0) + dt;
    // Timeout de segurança: impede qualquer caçada infinita se a janela redimensionar
    if (c.tempoTotal > 32 && p.modo !== "capturada") {
      p.modo = "escapando";
      p.cacador = null;
      limparFioCaca(inst);
      inst.caca = null;
      return false;
    }

    const dx = p.x - st.x;
    const dy = p.y - st.y;
    const dist = Math.hypot(dx, dy);
    const angParaPresa = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

    // ----------------------------------------------------------------------
    // ESTILO A: ARANHA TECELÃ DE CANTO (Duplo Belisco → Corrida → Casulo → Pausa no Centro)
    // ----------------------------------------------------------------------
    if (c.estilo === "tecela_teia") {
      if (c.fase === "aguardando_teia") {
        flags.andando = false;
        flags.emPosturaX = true;
        st.anguloAlvo = st.anguloRepouso + Math.sin(inst.tempoVida) * 2.5;
        if (p.modo === "presa_na_teia") {
          c.fase = "beliscando_alvo";
          c.tempoFase = 0;
          st.vibracaoRestante = 0.55;
        }
      } else if (c.fase === "beliscando_alvo") {
        // Duplo belisco diagnóstico nos fios radiais para medir o tamanho da presa!
        flags.andando = false;
        flags.emPosturaX = true;
        flags.beliscando = (c.tempoFase < 0.38) || (c.tempoFase > 0.55 && c.tempoFase < 0.92);
        st.anguloAlvo = angParaPresa;
        if (c.tempoFase >= 1.0) {
          c.fase = "correndo_teia";
          c.tempoFase = 0;
        }
      } else if (c.fase === "correndo_teia") {
        const vel = inst.especie.velocidadeBase * 2.05;
        st.anguloAlvo = angParaPresa;
        if (dist <= 16) {
          c.fase = "enrolando_seda";
          c.tempoFase = 0;
          p.vibrandoPresa = true;
          p.lutaIntensidade = 1;
        } else {
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
        }
      } else if (c.fase === "enrolando_seda") {
        // 0.25s mordida inicial, depois gira rapidamente puxando seda prateada!
        flags.enrolandoSeda = true;
        const frac = Math.min(1, Math.max(0, (c.tempoFase - 0.22) / 2.15));
        p.casuloProgresso = frac;
        p.lutaIntensidade = Math.max(0, 1 - frac * 1.1);
        const angGiro = c.tempoFase * 6.4;
        const raioGiro = c.tempoFase < 0.22 ? 6 : 12;
        st.x = p.alvoX + Math.cos(angGiro) * raioGiro;
        st.y = p.alvoY + Math.sin(angGiro) * raioGiro;
        st.anguloAlvo = (angGiro * 180) / Math.PI + 180;
        if (c.tempoFase > 0.22 && Math.random() < dt * 2.6) criarRastroPonto(p.x, p.y, true);
        if (frac >= 1) {
          p.modo = "capturada";
          p.vibrandoPresa = false;
          p.lutaIntensidade = 0;
          c.fase = "levando_ao_centro";
          c.tempoFase = 0;
        }
      } else if (c.fase === "levando_ao_centro") {
        const cx = st.px - st.x;
        const cy = st.py - st.y;
        const dC = Math.hypot(cx, cy);
        const vel = inst.especie.velocidadeBase * 0.95;
        if (dC <= 8) {
          c.fase = "pausa_centro_teia";
          c.tempoFase = 0;
        } else {
          st.x += (cx / dC) * vel * dt;
          st.y += (cy / dC) * vel * dt;
          st.anguloAlvo = (Math.atan2(cy, cx) * 180) / Math.PI + 90;
        }
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        p.x = st.x + Math.cos(rad) * 18;
        p.y = st.y + Math.sin(rad) * 18;
        p.anguloAlvo = st.angulo;
      } else if (c.fase === "pausa_centro_teia") {
        // Segura o casulo no coração da teia de canto antes de guardar!
        flags.andando = false;
        flags.emPosturaX = true;
        st.anguloAlvo = st.anguloRepouso;
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        p.x = st.x + Math.cos(rad) * 18;
        p.y = st.y + Math.sin(rad) * 18;
        p.anguloAlvo = st.angulo;
        if (c.tempoFase >= 1.45) {
          c.fase = "partindo_com_casulo";
          st.fase = "partindo";
          st.t = 0;
          st.origemPartidaX = st.x;
          st.origemPartidaY = st.y;
        }
      } else if (c.fase === "partindo_com_casulo") {
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        p.x = st.x + Math.cos(rad) * 18;
        p.y = st.y + Math.sin(rad) * 18;
        p.anguloAlvo = st.angulo;
        return false;
      }
      return true;
    }

    // ----------------------------------------------------------------------
    // ESTILO B: ARANHA-CARANGUEJO (Furtividade Ultra-Lenta em "U" → Pinça Relâmpago!)
    // ----------------------------------------------------------------------
    if (c.estilo === "caranguejo_abraco") {
      c.furtiva = true;
      if (c.fase === "emboscada_imovel") {
        flags.andando = false;
        flags.emboscadaBracos = true;
        st.anguloAlvo = angParaPresa;
        if (p.modo === "pousada" || dist < 96) {
          c.fase = "espreitando";
          c.tempoFase = 0;
        }
      } else if (c.fase === "espreitando") {
        flags.emboscadaBracos = true;
        st.anguloAlvo = angParaPresa;
        // Rastejo ultra-lento que NÃO dispara o alerta da mosca até o instante da pinça!
        const vel = inst.especie.velocidadeBase * (p.modo === "evadindo" ? 0.95 : 0.48);
        if (dist <= 32) {
          if (c.podeEscapar) {
            p.modo = "escapando";
            inst.caca = null;
            return false;
          }
          c.fase = "contendo";
          c.tempoFase = 0;
          p.modo = "capturada";
          p.vibrandoPresa = true;
          p.lutaIntensidade = 1;
        } else {
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
        }
      }
    }

    // ----------------------------------------------------------------------
    // ESTILO C: TARÂNTULA GOLIAS — SEQUÊNCIA BIOLÓGICA COMPLETA DE 6 ETAPAS
    // 1. Detecção tátil por vibração no solo (tricobótrios, sem linhas tracejadas)
    // 2. Congelamento & Alinhamento em pequenos ajustes discretos + pressão hidráulica
    // 3. Bote Hidráulico explosivo (frações de segundo)
    // 4. Contenção puxando para baixo & Injeção de veneno (picareta vertical das quelíceras)
    // 5. A "Dança da Seda" (gira em círculo balançando o abdômen tecendo tapete de seda)
    // 6. Digestão externa, sucção bombeadora & descarte do Bolus!
    // ----------------------------------------------------------------------
    if (c.estilo === "golias_emboscada") {
      if (c.fase === "chegando_toca") {
        // Entra da borda até o ponto de emboscada terrestre oportunista
        const ex = c.pontoEmboscada.x - st.x;
        const ey = c.pontoEmboscada.y - st.y;
        const ed = Math.hypot(ex, ey);
        const vel = inst.especie.velocidadeBase * 1.45;
        if (ed <= 14 || c.tempoFase >= 2.8) {
          c.fase = "armando_fios";
          c.tempoFase = 0;
        } else {
          st.x += (ex / ed) * vel * dt;
          st.y += (ey / ed) * vel * dt;
          st.anguloAlvo = (Math.atan2(ey, ex) * 180) / Math.PI + 90;
        }
      } else if (c.fase === "armando_fios") {
        // ETAPA 1a: Posiciona-se imóvel voltada para a área de vibração (sem desenhar tracejado!)
        flags.andando = false;
        st.anguloAlvo = angParaPresa;
        if (c.tempoFase >= 0.45) {
          c.fase = "esperando_fios";
          c.tempoFase = 0;
        }
      } else if (c.fase === "esperando_fios") {
        // ETAPA 1b: Totalmente imóvel (terrestre oportunista) sentindo vibrações pelos tricobótrios!
        flags.andando = false;
        c.furtiva = true;

        const noRaioSensorial = dist < inst.tamPx * 1.46;
        if (noRaioSensorial || c.tempoFase >= 6.8) {
          // Detecção visual 100% por ondas suaves de vibração no solo!
          criarOndaVibracao(p.x, p.y, "solo");
          criarOndaVibracao(st.x, st.y, "solo");
          c.pulsoFioAlarme = 0.45;
          c.fase = "congelando_alinhando";
          c.tempoFase = 0;
          c.passosAlinhamento = 0;
          c.angAlvoAlinhamento = st.angulo;
        }
      } else if (c.fase === "congelando_alinhando") {
        // ETAPA 2: Congelamento total (0.42s) → Alinhamento em 3 pequenos ajustes discretos + pressão hidráulica!
        flags.andando = false;
        c.furtiva = true;
        if (c.pulsoFioAlarme > 0) {
          c.pulsoFioAlarme -= dt;
          if (c.pulsoFioAlarme <= 0) {
            criarOndaVibracao(st.x, st.y, "solo");
          }
        }

        if (c.tempoFase < 0.42) {
          // Congelada completamente imóvel para não assustar a presa
          st.anguloAlvo = st.angulo;
        } else if (c.tempoFase < 1.35) {
          // Gira o corpo devagar em 3 micro-ajustes discretos até alinhar o cefalotórax com o alvo!
          const passoAtual = Math.min(3, Math.floor((c.tempoFase - 0.42) / 0.31) + 1);
          if (passoAtual > c.passosAlinhamento) {
            c.passosAlinhamento = passoAtual;
            const frac = passoAtual / 3;
            c.angAlvoAlinhamento = lerpAngulo(st.angulo, angParaPresa, frac);
          }
          st.anguloAlvo = c.angAlvoAlinhamento;
          // Começa a erguer ligeiramente pedipalpos e par I acumulando pressão de hemolinfa!
          flags.acumulandoPressao = true;
          const pComp = Math.min(1, (c.tempoFase - 0.42) / 0.93);
          flags.escalaX = 1 + pComp * 0.045;
          flags.escalaY = 1 - pComp * 0.055;
        } else {
          // Pronta: se presa está na distância ideal, dispara bote hidráulico; senão se aproxima furtivamente!
          c.furtiva = false;
          const distIdeal = p.def.porte === "gigante" ? 168 : 148;
          if (dist <= distIdeal) {
            c.fase = "bote_hidraulico";
            c.tempoFase = 0;
            c.pontoSaltoIni = { x: st.x, y: st.y };
            c.alvoBote = { x: p.x + p.velocidadeX * 0.14, y: p.y + p.velocidadeY * 0.14 };
          } else {
            c.fase = "espreitando";
            c.tempoFase = 0;
          }
        }
      } else if (c.fase === "espreitando") {
        // Caso a presa tenha se afastado um pouco, faz aproximação curta antes do bote hidráulico
        const prevT = p.modo === "evadindo" ? 0.35 : 0.12;
        const idx = p.x + p.velocidadeX * prevT - st.x;
        const idy = p.y + p.velocidadeY * prevT - st.y;
        const idist = Math.max(1, Math.hypot(idx, idy));
        st.anguloAlvo = (Math.atan2(idy, idx) * 180) / Math.PI + 90;

        const distBote = p.def.porte === "gigante" ? 156 : 134;
        const vel = inst.especie.velocidadeBase * (p.modo === "evadindo" ? 1.9 : 1.25);
        if (dist <= distBote) {
          c.fase = "armando";
          c.tempoFase = 0;
        } else {
          st.x += (idx / idist) * vel * dt;
          st.y += (idy / idist) * vel * dt;
        }
      } else if (c.fase === "armando") {
        // Breve acúmulo de pressão antes do bote hidráulico após perseguição curta
        flags.andando = false;
        flags.acumulandoPressao = true;
        flags.presasAbertas = true;
        st.anguloAlvo = angParaPresa;
        const prog = Math.min(1, c.tempoFase / 0.42);
        flags.escalaX = 1 + prog * 0.05;
        flags.escalaY = 1 - prog * 0.06;
        if (c.tempoFase >= 0.42) {
          if (c.podeEscapar) {
            p.modo = "escapando";
            limparFioCaca(inst);
            inst.caca = null;
            return false;
          }
          c.fase = "bote_hidraulico";
          c.tempoFase = 0;
          c.pontoSaltoIni = { x: st.x, y: st.y };
          c.alvoBote = { x: p.x + p.velocidadeX * 0.12, y: p.y + p.velocidadeY * 0.12 };
        }
      } else if (c.fase === "bote_hidraulico") {
        // ETAPA 3: O BOTE HIDRÁULICO — explosão de velocidade em ~0.26s estendendo as patas por hemolinfa!
        flags.andando = false;
        flags.boteHidraulico = true;
        flags.presasAbertas = true;
        limparFioCaca(inst);
        const durBote = 0.27;
        const frac = Math.min(1, c.tempoFase / durBote);
        const ease = 1 - Math.pow(1 - frac, 3);
        const alvoX = lerp(c.alvoBote.x, p.x, 0.55);
        const alvoY = lerp(c.alvoBote.y, p.y, 0.55);
        st.x = lerp(c.pontoSaltoIni.x, alvoX, ease);
        st.y = lerp(c.pontoSaltoIni.y, alvoY, ease);
        st.anguloAlvo = (Math.atan2(alvoY - c.pontoSaltoIni.y, alvoX - c.pontoSaltoIni.x) * 180) / Math.PI + 90;

        // Extensão hidráulica: corpo alonga na arrancada + elevação sutil de sombra
        const pico = Math.sin(frac * Math.PI);
        flags.escalaX = 1 - pico * 0.06;
        flags.escalaY = 1 + pico * 0.11;
        flags.sombraExtra = pico * 11;

        if (frac >= 1) {
          criarOndaVibracao(p.x, p.y, "impacto");
          c.fase = "contendo_picareta";
          c.tempoFase = 0;
          p.modo = "capturada";
          p.vibrandoPresa = true;
          p.lutaIntensidade = 1;
        }
      } else if (c.fase === "contendo_picareta") {
        // ETAPA 4: Contenção puxando para baixo + 2 golpes verticais de picareta das quelíceras (veneno!)
        flags.andando = false;
        flags.contendoPresa = true;
        const durCont = p.def.porte === "gigante" ? 2.25 : 1.75;
        const prog = Math.min(1, c.tempoFase / durCont);
        const golpe1 = c.tempoFase >= 0.14 && c.tempoFase <= 0.44;
        const golpe2 = c.tempoFase >= 0.62 && c.tempoFase <= 0.92;
        flags.golpePicareta = golpe1 || golpe2;
        flags.presasAbertas = c.tempoFase < 0.14 || (c.tempoFase > 0.44 && c.tempoFase < 0.62);

        if (flags.golpePicareta) {
          // Movimento vertical de picareta cravando as presas!
          const pulsoP = Math.sin(((golpe1 ? c.tempoFase - 0.14 : c.tempoFase - 0.62) / 0.3) * Math.PI);
          flags.escalaY = 1 - pulsoP * 0.07;
          flags.escalaX = 1 + pulsoP * 0.05;
        }

        // Veneno paralisa rapidamente o sistema nervoso da presa (1 -> 0)
        p.lutaIntensidade = Math.max(0, Math.pow(1 - prog, 1.6));
        p.vibrandoPresa = p.lutaIntensidade > 0.06;

        // Puxa a presa para baixo do cefalotórax/quelíceras!
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        const distPuxada = lerp(inst.tamPx * 0.36, inst.tamPx * 0.24, Math.min(1, prog * 2.2));
        const tremor = p.lutaIntensidade * (p.def.porte === "gigante" ? 2.8 : 1.7);
        p.x = st.x + Math.cos(rad) * distPuxada + Math.sin(inst.tempoVida * 34) * tremor;
        p.y = st.y + Math.sin(rad) * distPuxada - Math.cos(inst.tempoVida * 31) * tremor * 0.7;
        p.anguloAlvo = st.angulo + (p.def.porte === "gigante" ? 74 : 50);

        if (c.tempoFase >= durCont) {
          p.vibrandoPresa = false;
          p.lutaIntensidade = 0;
          c.fase = "danca_da_seda";
          c.tempoFase = 0;
          c.dancaAngIni = st.angulo;
          c.tapeteEl = criarTapeteSedaGolias(st.x, st.y);
        }
      } else if (c.fase === "danca_da_seda") {
        // ETAPA 5: A "DANÇA DA SEDA" — gira em círculos lentos balançando o abdômen tecendo tapete no chão!
        flags.andando = true;
        flags.dancaSeda = true;
        flags.contendoPresa = true;
        const durDanca = 3.5;
        const frac = Math.min(1, c.tempoFase / durDanca);
        // Gira ~390 graus devagar no mesmo lugar
        st.anguloAlvo = c.dancaAngIni + frac * 390;
        st.angulo = lerpAngulo(st.angulo, st.anguloAlvo, dt * 7);
        // Pequenos passinhos circulares que animam a marcha das 8 patas
        inst.fasePassada += dt * 5.2;

        // Tapete de seda vai aparecendo progressivamente sob a Tarântula!
        if (c.tapeteEl) {
          c.tapeteEl.style.opacity = (frac * 0.78).toFixed(3);
          c.tapeteEl.style.transform = `translate(-50%, -50%) scale(${(0.38 + frac * 0.62).toFixed(3)}) rotate(${(frac * 35).toFixed(1)}deg)`;
        }
        if (Math.random() < dt * 2.4) {
          const radT = ((st.angulo + 90) * Math.PI) / 180;
          criarRastroPonto(st.x + Math.cos(radT) * (inst.tamPx * 0.28), st.y + Math.sin(radT) * (inst.tamPx * 0.28), false);
        }

        // Mantém a presa firme sob as quelíceras enquanto gira
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        p.x = st.x + Math.cos(rad) * (inst.tamPx * 0.24);
        p.y = st.y + Math.sin(rad) * (inst.tamPx * 0.24);
        p.anguloAlvo = st.angulo + 65;

        if (frac >= 1) {
          c.fase = "digestao_succao";
          c.tempoFase = 0;
        }
      } else if (c.fase === "digestao_succao") {
        // ETAPA 6: DIGESTÃO EXTERNA & SUCÇÃO BOMBEADORA → Presa encolhe até virar o BOLUS!
        flags.andando = false;
        flags.digestaoSuccao = true;
        const durDig = 3.3;
        const frac = Math.min(1, c.tempoFase / durDig);

        const rad = ((st.angulo - 90) * Math.PI) / 180;
        p.x = st.x + Math.cos(rad) * (inst.tamPx * 0.23);
        p.y = st.y + Math.sin(rad) * (inst.tamPx * 0.23);
        p.anguloAlvo = st.angulo + 65;

        // Presa vai sendo liquefeita e compactada até virar uma bolinha seca (bolus)!
        const escPresa = Math.max(0.24, 1 - frac * 0.76);
        p.escalaExtraX = escPresa;
        p.escalaExtraY = escPresa;
        if (p.wrap) p.wrap.style.opacity = (0.92 - frac * 0.52).toFixed(2);

        if (frac >= 1) {
          // Descarta o BOLUS seco sobre o tapete de seda e encerra a refeição!
          const bx = p.x;
          const by = p.y;
          removerPresa(p);
          criarBolusExoesqueleto(bx, by);
          if (c.tapeteEl) {
            registrarEfeitoSolo(c.tapeteEl, 6200);
            c.tapeteEl = null;
          }
          // Pausa breve limpando os pedipalpos e depois parte serenamente para a toca na borda!
          inst.caca = null;
          inst.comportamentoAtual = "grooming";
          st.pausaRestante = 1.05;
          st.pausaFeita = true;
          const saida = bordaMaisProxima(st.x, st.y, inst.tamPx * 1.35);
          st.p0 = { x: st.x, y: st.y };
          st.p1 = { x: lerp(st.x, saida.x, 0.35), y: lerp(st.y, saida.y, 0.35) };
          st.p2 = { x: lerp(st.x, saida.x, 0.7), y: lerp(st.y, saida.y, 0.7) };
          st.p3 = { x: saida.x, y: saida.y };
          st.t = 0;
          st.duracao = Math.max(4.5, Math.hypot(saida.x - st.x, saida.y - st.y) / inst.especie.velocidadeBase);
          return false;
        }
      }
      return true;
    }

    // ----------------------------------------------------------------------
    // ESTILO D: PAPA-MOSCAS (Stop-and-Go + Paralaxe de Distância → Dragline → Salto!)
    // ----------------------------------------------------------------------
    if (c.estilo === "papa_salto") {
      if (c.fase === "detectando") {
        flags.andando = false;
        flags.paralaxe = true;
        st.anguloAlvo = angParaPresa;
        inst.comportamentoAtual = "curiosa";
        if (c.tempoFase >= 0.65) {
          c.fase = "espreitando";
          c.tempoFase = 0;
          c.cicloEspreita = 0;
        }
      } else if (c.fase === "espreitando") {
        st.anguloAlvo = angParaPresa;
        // Se a mosca está voando em evasão, apenas acompanha com os olhos até pousar!
        if (p.modo === "evadindo" || p.modo === "alerta") {
          flags.andando = false;
          flags.paralaxe = true;
          c.congeladaFurtiva = 0.1;
          return true;
        }
        c.congeladaFurtiva = 0;
        // Espreita felina Stop-and-Go: 0.44s andando → 0.30s congelada medindo distância!
        c.cicloEspreita = (c.cicloEspreita + dt) % 0.74;
        const pausando = c.cicloEspreita > 0.44;
        if (pausando) {
          flags.andando = false;
          flags.paralaxe = true;
          c.congeladaFurtiva = 0.08;
        } else {
          const vel = inst.especie.velocidadeBase * 0.76;
          if (dist <= 122) {
            c.fase = "armando";
            c.tempoFase = 0;
            criarRastroPonto(st.x, st.y, true);
            c.pontoSaltoIni = { x: st.x, y: st.y };
            const fio = criarSvgFio();
            c.fioSvg = fio.svg;
            c.fioPath = fio.path;
          } else {
            st.x += (dx / dist) * vel * dt;
            st.y += (dy / dist) * vel * dt;
          }
        }
      } else if (c.fase === "armando") {
        flags.andando = false;
        flags.agachando = true;
        st.anguloAlvo = angParaPresa;
        // Se a mosca decolou durante o agachamento, cancela o salto e volta a rastrear!
        if (p.modo === "evadindo") {
          limparFioCaca(inst);
          c.fase = "espreitando";
          c.tempoFase = 0;
          return true;
        }
        const prog = Math.min(1, c.tempoFase / 0.52);
        flags.escalaX = 1 + prog * 0.1;
        flags.escalaY = 1 - prog * 0.16;
        if (c.tempoFase >= 0.52) {
          if (c.podeEscapar) {
            p.modo = "escapando";
            limparFioCaca(inst);
            inst.caca = null;
            return false;
          }
          c.fase = "bote";
          c.tempoFase = 0;
          c.saltoT = 0;
        }
      } else if (c.fase === "bote") {
        flags.andando = false;
        flags.noAr = true;
        c.saltoT = Math.min(1, c.saltoT + dt * 2.9);
        const arco = Math.sin(c.saltoT * Math.PI);
        st.x = lerp(c.pontoSaltoIni.x, p.x, c.saltoT);
        st.y = lerp(c.pontoSaltoIni.y, p.y, c.saltoT) - arco * 18;
        flags.escalaX = 1 + arco * 0.22;
        flags.escalaY = 1 + arco * 0.26;
        flags.sombraExtra = arco * 14;
        if (c.fioPath) {
          c.fioPath.setAttribute("d", `M ${c.pontoSaltoIni.x.toFixed(1)} ${c.pontoSaltoIni.y.toFixed(1)} L ${st.x.toFixed(1)} ${st.y.toFixed(1)}`);
        }
        if (c.saltoT >= 1) {
          limparFioCaca(inst);
          c.fase = "contendo";
          c.tempoFase = 0;
          p.modo = "capturada";
          p.vibrandoPresa = true;
          p.lutaIntensidade = 1;
        }
      }
    }

    // ----------------------------------------------------------------------
    // ESTILO E: TECELÃ-DE-RENDA (Distância Tática + 3 Rajadas de Fios em Arco!)
    // ----------------------------------------------------------------------
    if (c.estilo === "renda_arremesso") {
      if (c.fase === "detectando") {
        flags.andando = false;
        st.anguloAlvo = angParaPresa;
        if (c.tempoFase >= 0.5) {
          c.fase = "espreitando";
          c.tempoFase = 0;
        }
      } else if (c.fase === "espreitando") {
        st.anguloAlvo = angParaPresa;
        const vel = inst.especie.velocidadeBase * 1.45;
        if (dist <= 74) {
          c.fase = "arremessando_seda";
          c.tempoFase = 0;
          c.rajadasSeda = 0;
          const fio = criarSvgFio();
          c.fioSvg = fio.svg;
          c.fioPath = fio.path;
        } else {
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
        }
      } else if (c.fase === "arremessando_seda") {
        flags.andando = false;
        flags.arremessandoSeda = true;
        // Mantém distância segura recuando suavemente se a presa vier perto demais
        if (dist < 56) {
          st.x -= (dx / Math.max(1, dist)) * 32 * dt;
          st.y -= (dy / Math.max(1, dist)) * 32 * dt;
        }
        st.anguloAlvo = angParaPresa + 148;
        const frac = Math.min(1, c.tempoFase / 1.85);
        // 3 rajadas nítidas de seda (33% -> 66% -> 100%)
        const rajadaAtual = Math.min(3, Math.floor(frac * 3) + 1);
        if (rajadaAtual > c.rajadasSeda) {
          c.rajadasSeda = rajadaAtual;
          criarRastroPonto(p.x, p.y, true);
        }
        p.casuloProgresso = frac;
        p.vibrandoPresa = frac < 0.8;
        p.lutaIntensidade = Math.max(0, 1 - frac);
        if (c.fioPath) {
          const arco1 = Math.sin(c.tempoFase * 15) * 16;
          const arco2 = Math.cos(c.tempoFase * 13) * 12;
          const mx = (st.x + p.x) * 0.5;
          const my = (st.y + p.y) * 0.5;
          c.fioPath.setAttribute(
            "d",
            `M ${st.x.toFixed(1)} ${st.y.toFixed(1)} Q ${(mx + arco1).toFixed(1)} ${(my - arco1).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)} M ${st.x.toFixed(1)} ${st.y.toFixed(1)} Q ${(mx - arco2).toFixed(1)} ${(my + arco2).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          );
        }
        if (frac >= 1) {
          limparFioCaca(inst);
          c.fase = "bote";
          c.tempoFase = 0;
        }
      } else if (c.fase === "bote") {
        st.anguloAlvo = angParaPresa;
        const vel = inst.especie.velocidadeBase * 1.3;
        if (dist <= 24) {
          c.fase = "contendo";
          c.tempoFase = 0;
          p.modo = "capturada";
          p.vibrandoPresa = false;
          p.lutaIntensidade = 0;
        } else {
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
        }
      }
    }

    // ----------------------------------------------------------------------
    // ESTILO F & G: ÑANDUOBYETÉ (Flanqueio em Arco + Laço) e FILHOTE (Aprendiz!)
    // ----------------------------------------------------------------------
    if (c.estilo === "nandu_laco" || c.estilo === "filhote_curioso") {
      if (c.fase === "detectando") {
        flags.andando = false;
        st.anguloAlvo = angParaPresa;
        if (c.tempoFase >= 0.48) {
          c.fase = "espreitando";
          c.tempoFase = 0;
        }
      } else if (c.fase === "espreitando") {
        // Ñanduobyeté descreve arco de flanqueio lateral para surpreender pelo flanco!
        const flanco = c.estilo === "nandu_laco" && dist > 65 ? c.ladoFlanqueio * 0.42 : 0;
        const angAprox = Math.atan2(dy, dx) + flanco;
        st.anguloAlvo = (angAprox * 180) / Math.PI + 90;
        const vel = inst.especie.velocidadeBase * 1.48;
        if (dist <= 46) {
          if (c.estilo === "filhote_curioso" && p.def.id === "mosca") {
            // Filhote se assusta quando a mosca grande entra em alerta e vibra as asas!
            p.modo = "alerta";
            p.tempoAlerta = 0.5;
            inst.caca = null;
            acionarFuga(inst);
            return false;
          }
          c.fase = "bote";
          c.tempoFase = 0;
        } else {
          st.x += Math.cos(angAprox) * vel * dt;
          st.y += Math.sin(angAprox) * vel * dt;
        }
      } else if (c.fase === "bote") {
        st.anguloAlvo = angParaPresa;
        const vel = inst.especie.velocidadeBase * 2.45;
        if (dist <= 22) {
          criarRastroPonto(p.x, p.y, true);
          c.fase = "contendo";
          c.tempoFase = 0;
          p.modo = "capturada";
          p.vibrandoPresa = true;
          p.lutaIntensidade = 1;
        } else {
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
        }
      }
    }

    // ----------------------------------------------------------------------
    // FASES FINAIS: DUELO DE CONTENÇÃO (PARALISIA GRADUAL) → ARRASTE COM PESO!
    // ----------------------------------------------------------------------
    if (c.fase === "contendo") {
      flags.andando = false;
      flags.contendoPresa = true;
      const durCont = p.def.porte === "gigante" ? 2.25 : p.def.porte === "medio" ? 1.45 : 1.05;
      const progCont = Math.min(1, c.tempoFase / durCont);
      // Luta intensa no início e acalma suavemente (efeito realista de contenção/veneno!)
      p.lutaIntensidade = Math.max(0, Math.pow(1 - progCont, 1.35));
      p.vibrandoPresa = p.lutaIntensidade > 0.08;
      if (c.estilo === "golias_emboscada") flags.presasAbertas = progCont < 0.42;

      // Reação física sutil do corpo do predador segurando uma presa grande se debatendo!
      if (p.def.porte === "gigante" && p.lutaIntensidade > 0.1) {
        st.anguloAlvo = st.angulo + Math.sin(inst.tempoVida * 22) * 3.8 * p.lutaIntensidade;
      }

      const rad = ((st.angulo - 90) * Math.PI) / 180;
      const offsetBoca = inst.tamPx * (p.def.porte === "gigante" ? 0.34 : 0.36);
      const tremor = p.lutaIntensidade * (p.def.porte === "gigante" ? 3.2 : 1.8);
      p.x = st.x + Math.cos(rad) * offsetBoca + Math.sin(inst.tempoVida * 34) * tremor;
      p.y = st.y + Math.sin(rad) * offsetBoca - Math.cos(inst.tempoVida * 31) * tremor * 0.7;
      p.anguloAlvo = st.angulo + (p.def.porte === "gigante" ? 74 : 45);

      if (c.tempoFase >= durCont) {
        p.vibrandoPresa = false;
        p.lutaIntensidade = 0;
        c.fase = "levando";
        c.tempoFase = 0;
        c.alvoFuga = bordaMaisProxima(st.x, st.y, inst.tamPx * 1.4);
      }
    } else if (c.fase === "levando") {
      const alvo = c.alvoFuga || bordaMaisProxima(st.x, st.y, inst.tamPx * 1.4);
      const fx = alvo.x - st.x;
      const fy = alvo.y - st.y;
      const dF = Math.hypot(fx, fy);
      // Peso real: carregar Lagartinho ou Lagarta Gigante deixa a Tarântula Golias mais lenta e cadenciada!
      const pesoPresa = p.def.porte === "gigante" ? 0.68 : p.def.porte === "medio" ? 0.86 : 0.96;
      const vel = inst.especie.velocidadeBase * pesoPresa;
      if (dF <= vel * dt + 10) {
        flags.terminado = true;
      } else {
        st.x += (fx / dF) * vel * dt;
        st.y += (fy / dF) * vel * dt;
        st.anguloAlvo = (Math.atan2(fy, fx) * 180) / Math.PI + 90;
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        const offsetBoca = inst.tamPx * (p.def.porte === "gigante" ? 0.34 : 0.36);
        p.x = st.x + Math.cos(rad) * offsetBoca;
        p.y = st.y + Math.sin(rad) * offsetBoca;
        p.anguloAlvo = st.angulo + (p.def.porte === "gigante" ? 76 : 45);
      }
    }

    return true;
  }

  let ultimoCheckEncontrosTs = 0;
  function verificarEncontrosEntreAranhas() {
    if (ativas.length < 2) return;
    const agora = performance.now();
    if (agora - ultimoCheckEncontrosTs < 140) return;
    ultimoCheckEncontrosTs = agora;

    for (let i = 0; i < ativas.length; i++) {
      const a = ativas[i];
      if (a.fugindo || a.caca || a.interacao || a.cooldownInteracao > 0 || a.defesaRestante > 0) continue;
      if (a.estado.tipo === "ballooning" || a.estado.tipo === "rapel_fio") continue;

      for (let j = i + 1; j < ativas.length; j++) {
        const b = ativas[j];
        if (b.fugindo || b.caca || b.interacao || b.cooldownInteracao > 0 || b.defesaRestante > 0) continue;
        if (b.estado.tipo === "ballooning" || b.estado.tipo === "rapel_fio") continue;

        const dist = Math.hypot(a.estado.x - b.estado.x, a.estado.y - b.estado.y);
        const raioEncontro = (a.tamPx + b.tamPx) * 0.78 + 45;
        if (dist < raioEncontro) {
          const aGolias = a.especie.id === "tarantula_golias";
          const bGolias = b.especie.id === "tarantula_golias";

          if (a.especie.id === "papa_moscas" && b.especie.id === "papa_moscas" && !a.acaoEspecial && !b.acaoEspecial) {
            // 10. Encontro entre duas Papa-Moscas dispara automaticamente a Dança de Cortejo!
            const cx = (a.estado.x + b.estado.x) * 0.5;
            const cy = (a.estado.y + b.estado.y) * 0.5;
            a.acaoEspecial = { tipo: "danca_cortejo", papel: "dancarino", parceira: b, centroX: cx, centroY: cy, tempo: 0, duracao: 4.5 };
            b.acaoEspecial = { tipo: "danca_cortejo", papel: "observadora", parceira: a, centroX: cx, centroY: cy, tempo: 0, duracao: 4.5 };
          } else if (aGolias !== bGolias) {
            const gigante = aGolias ? a : b;
            const menor = aGolias ? b : a;
            gigante.interacao = { tipo: "aviso_territorial", tempo: 0, duracao: 0.95, outro: menor };
            menor.interacao = { tipo: "recuo_hierarquia", tempo: 0, duracao: 0.65, outro: gigante };
          } else {
            a.interacao = { tipo: "cumprimento", tempo: 0, duracao: 1.35, outro: b };
            b.interacao = { tipo: "cumprimento", tempo: 0, duracao: 1.35, outro: a };
          }
          a.cooldownInteracao = 7;
          b.cooldownInteracao = 7;
          break;
        }
      }
    }
  }

  // Se uma presa solta passa perto de uma aranha compatível já na tela, a aranha decide caçar!
  function verificarOportunidadesDeCaca() {
    if (ativas.length === 0 || presasAtivas.length === 0) return;
    for (let i = 0; i < presasAtivas.length; i++) {
      const p = presasAtivas[i];
      if (p.cacador || p.modo === "capturada" || p.modo === "escapando") continue;
      for (let j = 0; j < ativas.length; j++) {
        const a = ativas[j];
        if (a.caca || a.fugindo || a.interacao || a.defesaRestante > 0) continue;
        if (!a.especie.presasAlvo || !a.especie.presasAlvo.includes(p.def.id)) continue;
        const d = Math.hypot(a.estado.x - p.x, a.estado.y - p.y);
        if (d < 340) {
          vincularCaca(a, p, Math.random() < 0.22);
          break;
        }
      }
    }
  }

  // ==========================================================================
  // 9. MOTOR DE FÍSICA, CINEMÁTICA DAS PATAS & COMPORTAMENTOS NATURAIS
  // ==========================================================================

  function acionarFuga(inst) {
    if (inst.fugindo) return;
    const st = inst.estado;

    // 3. Camuflagem de "Galhinho" (Tetragnatha): Tecelã-de-Renda e Aranha-Caranguejo às vezes congelam esticadas em linha reta!
    if (inst.especie.podeCamuflarGalhinho && !inst.camuflagemFeita && !inst.caca && !inst.acaoEspecial && Math.random() < 0.55) {
      inst.camuflagemFeita = true;
      inst.camuflagemRestante = 2.8;
      return;
    }

    // Se estava espreitando presa quando o cursor chegou perto, a presa pode escapar!
    if (inst.caca && inst.caca.presa && inst.caca.presa.modo !== "capturada") {
      inst.caca.presa.modo = "escapando";
      inst.caca.presa.cacador = null;
      limparFioCaca(inst);
      inst.caca = null;
    }

    if (inst.especie.posturaDefensiva && !inst.defesaFeita) {
      inst.defesaFeita = true;
      inst.defesaRestante = 1.35;
      if (cursorAtual.ativo) {
        st.anguloAlvo = (Math.atan2(cursorAtual.y - st.y, cursorAtual.x - st.x) * 180) / Math.PI + 90;
      }
      return;
    }

    // 2. Defesa Nível 2 da Tarântula Golias: se o cursor insistir perto dela após a postura defensiva, solta nuvem de pelos urticantes!
    if (inst.especie.posturaDefensiva && inst.defesaFeita && !inst.urticanteFeito && cursorAtual.ativo) {
      const distC = Math.hypot(cursorAtual.x - st.x, cursorAtual.y - st.y);
      if (distC < 125) {
        inst.urticanteFeito = true;
        inst.acaoEspecial = { tipo: "chute_urticante", fase: "chutando", tempo: 0, particulasLancadas: false };
        return;
      }
    }

    limparAcaoEspecial(inst);
    inst.fugindo = true;
    inst.interacao = null;

    if (st.tipo === "rapel_fio") {
      st.fase = "subindo";
      return;
    }
    if (st.tipo === "espiadinha") {
      st.fase = "saindo";
      return;
    }
    if (st.tipo === "repouso_teia_canto") {
      st.fase = "partindo";
      st.t = 0;
      st.origemPartidaX = st.x;
      st.origemPartidaY = st.y;
      return;
    }

    const alvo = bordaMaisProxima(st.x, st.y, inst.tamPx * 1.4);
    inst.fugaAlvo = { x: alvo.x, y: alvo.y };
    if (inst.especie.id === "papa_moscas") {
      st.faseSalto = "no_ar";
      st.saltoT = 0;
    }
  }

  function animarPatasEComportamentos(inst, dt, andando, desloc, noAr, agachando, extras = {}) {
    const t = inst.tempoVida;
    const amp = inst.especie.ampPata || 10;
    const emDefesa = Boolean(extras.emDefesa);
    const emPosturaX = Boolean(extras.emPosturaX);
    const beliscando = Boolean(extras.beliscando);
    const vibrandoTeia = Boolean(extras.vibrandoTeia);
    const presasAbertas = Boolean(extras.presasAbertas);
    const armandoBoteGolias = Boolean(extras.armandoBoteGolias);
    const contendoPresa = Boolean(extras.contendoPresa);
    const emboscadaBracos = Boolean(extras.emboscadaBracos);
    const arremessandoSeda = Boolean(extras.arremessandoSeda);
    const cumprimentando = Boolean(extras.cumprimentando);
    const paralaxe = Boolean(extras.paralaxe);
    const acumulandoPressao = Boolean(extras.acumulandoPressao);
    const boteHidraulico = Boolean(extras.boteHidraulico);
    const golpePicareta = Boolean(extras.golpePicareta);
    const dancaSeda = Boolean(extras.dancaSeda);
    const digestaoSuccao = Boolean(extras.digestaoSuccao);
    const camuflagemGalhinho = Boolean(extras.camuflagemGalhinho);
    const chuteUrticante = Boolean(extras.chuteUrticante);
    const bebendoAgua = Boolean(extras.bebendoAgua);
    const dancaCortejo = Boolean(extras.dancaCortejo);
    const ecdiseContraindo = Boolean(extras.ecdiseContraindo);
    const tateandoCursor = Boolean(extras.tateandoCursor);
    const espreguicando = Boolean(extras.espreguicando);
    const encolhida = Boolean(extras.encolhida);

    // 0. Quelíceras articuladas da Tarântula Golias (abrem na defesa/bote, fecham na picareta e trituram na digestão!)
    if (inst.queliceraEsq && inst.queliceraDir) {
      let angQ = 0;
      let syQ = 1;
      if (golpePicareta) {
        // Movimento vertical de picareta cravando as presas!
        angQ = 4;
        syQ = 1.18;
      } else if (digestaoSuccao) {
        // Trituração lenta com a base das quelíceras durante digestão externa
        angQ = 6 + Math.sin(t * 7.5) * 4.5;
      } else if (emDefesa || presasAbertas) {
        angQ = 17 + Math.sin(t * 28) * 2.5;
      } else if (contendoPresa) {
        angQ = 7;
      }
      inst.queliceraEsq.style.transform = `rotate(${(-angQ).toFixed(1)}deg) scaleY(${syQ.toFixed(2)})`;
      inst.queliceraDir.style.transform = `rotate(${angQ.toFixed(1)}deg) scaleY(${syQ.toFixed(2)})`;
    }

    // 1. Respiração sutil contínua no abdômen (ou balanço na Dança da Seda / bombeamento na Sucção!)
    if (inst.abdomen) {
      let escX = 1 + Math.sin(t * 2.1 + inst.uid) * 0.018;
      let escY = 1 - Math.sin(t * 2.1 + inst.uid) * 0.015;
      let rotAbd = andando ? Math.sin(inst.fasePassada * 0.5) * 2.2 : 0;

      if (dancaSeda) {
        rotAbd = Math.sin(t * 7.8) * 19;
        escX = 1 + Math.sin(t * 7.8) * 0.035;
        escY = 1.03;
      } else if (dancaCortejo) {
        // 10. Dança de Cortejo Maratus: abdômen erguido balançando amplamente de um lado para o outro!
        rotAbd = Math.sin(t * 10.5) * 23;
        escX = 1.05;
        escY = 0.94;
      } else if (ecdiseContraindo) {
        // 11. Ecdise: contrações metabólicas lentas bombeando hemolinfa
        const cM = Math.sin(t * 4.2);
        escX = 1 + cM * 0.075;
        escY = 1 - cM * 0.065;
        rotAbd = Math.sin(t * 2.1) * 3;
      } else if (bebendoAgua || digestaoSuccao) {
        // 1. Capilaridade / 6. Estômago bombeador: pulsação rítmica suave
        const bomba = Math.sin(t * (bebendoAgua ? 4.4 : 5.2));
        escX = 1 + bomba * 0.048;
        escY = 1 - bomba * 0.04;
        rotAbd = Math.sin(t * 2.6) * 1.6;
      } else if (encolhida) {
        // 5. Soneca: respiração bem lenta
        escX = 1 + Math.sin(t * 0.95) * 0.012;
        escY = 1 - Math.sin(t * 0.95) * 0.01;
      } else if (camuflagemGalhinho) {
        escX = 0.9;
        escY = 1.06;
        rotAbd = 0;
      } else if (emDefesa || armandoBoteGolias || acumulandoPressao) {
        escX = 1.045;
        escY = 0.945;
        rotAbd = Math.sin(t * 28) * 1.4;
      } else if (!andando && inst.comportamentoAtual === "ancorar_seda") {
        const tap = Math.sin(Math.min(1, inst.tempoComportamento * 1.4) * Math.PI);
        escY = 1 + tap * 0.08;
        escX = 1 - tap * 0.04;
        if (!inst.ancoraMarcada && inst.tempoComportamento > 0.35) {
          inst.ancoraMarcada = true;
          criarRastroPonto(inst.estado.x, inst.estado.y, true);
        }
      } else if (!andando && inst.comportamentoAtual === "escovar_cerdas") {
        rotAbd = Math.sin(inst.tempoComportamento * 5.2) * 3.5;
      }
      inst.abdomen.style.transform = `rotate(${rotAbd.toFixed(2)}deg) scale(${escX.toFixed(3)}, ${escY.toFixed(3)})`;
    }

    // 2. Micro-inclinação do cefalotórax & pedipalpos
    let rotCefalo = 0;
    let rotPalpos = Math.sin(t * 4.2 + inst.uid) * 3.5;

    if (emDefesa || armandoBoteGolias) {
      rotCefalo = Math.sin(t * 36) * 2.4;
      rotPalpos = Math.sin(t * 38) * 11;
    } else if (acumulandoPressao) {
      rotCefalo = 0;
      rotPalpos = Math.sin(t * 14) * 5;
    } else if (camuflagemGalhinho) {
      rotCefalo = 0;
      rotPalpos = 0;
    } else if (tateandoCursor) {
      rotCefalo = Math.sin(t * 4.5) * 11;
      rotPalpos = Math.sin(t * 14) * 9;
    } else if (bebendoAgua) {
      rotCefalo = Math.sin(t * 4.4) * 1.8;
      rotPalpos = Math.sin(t * 8.8) * 6;
    } else if (dancaCortejo) {
      rotCefalo = Math.sin(t * 10.5) * 6;
      rotPalpos = Math.sin(t * 18) * 12;
    } else if (digestaoSuccao) {
      rotCefalo = Math.sin(t * 5.2) * 2.2;
      rotPalpos = Math.sin(t * 7.5) * 9;
    } else if (contendoPresa) {
      rotCefalo = Math.sin(t * 14) * 3.2;
      rotPalpos = Math.sin(t * 22) * 12;
    } else if (paralaxe) {
      // Paralaxe real de Salticidae: inclina o cefalotórax lateralmente para medir distância exata!
      rotCefalo = Math.sin(t * 7.5) * 10;
      rotPalpos = Math.sin(t * 14) * 7;
    } else if (cumprimentando) {
      rotCefalo = Math.sin(t * 6) * 5;
      rotPalpos = Math.sin(t * 18) * 11;
    } else if (vibrandoTeia) {
      rotCefalo = Math.sin(t * 26) * 3;
      rotPalpos = Math.sin(t * 24) * 6;
    } else if (!andando && !noAr) {
      inst.tempoComportamento += dt;
      if (inst.comportamentoAtual === "grooming") {
        rotCefalo = Math.sin(inst.tempoComportamento * 4.5) * 4;
        rotPalpos = Math.sin(inst.tempoComportamento * 12) * 11;
      } else if (inst.comportamentoAtual === "curiosa") {
        rotCefalo = Math.sin(inst.tempoComportamento * 2.6) * 8;
        rotPalpos = Math.sin(inst.tempoComportamento * 9) * 7;
      } else if (inst.comportamentoAtual === "probing") {
        rotCefalo = Math.sin(inst.tempoComportamento * 2.2) * 4.5;
      } else if (inst.comportamentoAtual === "escovar_cerdas") {
        rotCefalo = Math.sin(inst.tempoComportamento * 2.4) * 2.5;
        rotPalpos = Math.sin(inst.tempoComportamento * 6.5) * 5;
      }
    } else {
      inst.tempoComportamento = 0;
      inst.ancoraMarcada = false;
    }

    if (inst.cefalo) inst.cefalo.style.transform = `rotate(${rotCefalo.toFixed(2)}deg)`;
    if (inst.palpos) inst.palpos.style.transform = `rotate(${rotPalpos.toFixed(2)}deg)`;

    // 3. Cinemática Individual das 8 Patas
    if (andando && desloc > 0.02) {
      inst.fasePassada += desloc * inst.especie.fatorPassada;
    }

    for (let i = 0; i < inst.patas.length; i++) {
      const p = inst.patas[i];
      let alvoAng = 0;

      if (camuflagemGalhinho) {
        // 3. Postura Tetragnatha: todas as 8 patas alinhadas rente ao eixo do corpo (galhinho imóvel!)
        if (p.par === 0) alvoAng = p.lado * -34;
        else if (p.par === 1) alvoAng = p.lado * -46;
        else if (p.par === 2) alvoAng = p.lado * 44;
        else alvoAng = p.lado * 32;
      } else if (chuteUrticante) {
        // 2. Tarântula Golias raspa vigorosamente o 4º par traseiro no abdômen lançando pelos urticantes!
        if (p.par === 3) alvoAng = p.lado * (-22 + Math.sin(t * 44 + (p.lado === 1 ? Math.PI : 0)) * 16);
        else alvoAng = p.lado * -6;
      } else if (dancaCortejo) {
        // 10. Dança de Cortejo Maratus: 3º par bem erguido + 1º par acenando no ritmo!
        if (p.par === 2) alvoAng = p.lado * (-26 + Math.sin(t * 12) * 8);
        else if (p.par === 0) alvoAng = p.lado * (-18 + Math.sin(t * 14 + p.lado) * 10);
        else alvoAng = Math.sin(t * 10 + p.faseBase) * 6;
      } else if (tateandoCursor) {
        // 6. Papa-Moscas tateia suavemente a pontinha do cursor parado com o 1º par!
        if (p.par === 0 && p.lado === 1) alvoAng = -22 + Math.sin(t * 12) * 9;
        else if (p.par === 0) alvoAng = 14;
        else alvoAng = Math.sin(t * 2 + p.faseBase) * 2;
      } else if (espreguicando) {
        // 5. Espreguiçada pós-soneca ou pós-ecdise: estica par I para frente e par IV para trás!
        if (p.par === 0) alvoAng = p.lado * -22;
        else if (p.par === 3) alvoAng = p.lado * 20;
        else alvoAng = p.lado * 4;
      } else if (encolhida) {
        // 5. Soneca encolhida: recolhe as patas perto do corpo
        alvoAng = p.par <= 1 ? p.lado * 10 : p.lado * -10;
      } else if (bebendoAgua) {
        // 1. Apoia patas dianteiras na borda da gota de orvalho
        if (p.par === 0) alvoAng = p.lado * -15;
        else alvoAng = Math.sin(t * 1.4 + p.faseBase) * 1.5;
      } else if (boteHidraulico) {
        // Etapa 3 — Extensão hidráulica por hemolinfa: todas as patas projetam-se para frente/trás no salto!
        alvoAng = p.par <= 1 ? p.lado * -24 : p.lado * 18;
      } else if (acumulandoPressao) {
        // Etapa 2 — Ergue ligeiramente o 1º par acumulando pressão interna para o bote hidráulico!
        if (p.par === 0) alvoAng = p.lado * -16;
        else if (p.par >= 2) alvoAng = p.lado * -8;
        else alvoAng = p.lado * -5;
      } else if (digestaoSuccao) {
        // Etapa 6 — Patas dianteiras apoiam suavemente a presa sob as quelíceras durante a sucção
        if (p.par === 0) alvoAng = p.lado * (-18 + Math.sin(t * 5.2) * 2.5);
        else if (p.par === 1) alvoAng = p.lado * -10;
        else alvoAng = Math.sin(t * 2.4 + p.faseBase) * 1.5;
      } else if (emDefesa || armandoBoteGolias) {
        if (p.par === 0) alvoAng = p.lado * (-22 + Math.sin(t * 34 + p.lado) * 4.5);
        else if (p.par === 1) alvoAng = p.lado * (-14 + Math.sin(t * 30) * 3);
        else alvoAng = p.lado * 7;
      } else if (contendoPresa) {
        // Abraça firmemente a presa com os pares dianteiros I e II!
        if (p.par === 0) alvoAng = p.lado * (-24 + Math.sin(t * 18) * 3.5);
        else if (p.par === 1) alvoAng = p.lado * (-14 + Math.cos(t * 16) * 2.5);
        else alvoAng = p.lado * 5;
      } else if (emboscadaBracos) {
        // Aranha-Caranguejo: abre bem os pares I e II em "U" de emboscada!
        if (p.par === 0) alvoAng = p.lado * -22;
        else if (p.par === 1) alvoAng = p.lado * -16;
        else alvoAng = p.lado * 4;
      } else if (arremessandoSeda) {
        // Tecelã-de-Renda: movimenta rapidamente o 4º par traseiro arremessando seda!
        if (p.par === 3) alvoAng = p.lado * (14 + Math.sin(t * 24 + (p.lado === 1 ? Math.PI : 0)) * 18);
        else alvoAng = Math.sin(t * 4 + p.faseBase) * 3;
      } else if (paralaxe) {
        // Papa-Moscas congelada na espreita: patas dianteiras alertas e tensas durante a paralaxe!
        if (p.par === 0) alvoAng = p.lado * (-10 + Math.sin(t * 7.5) * 3.5);
        else alvoAng = Math.sin(t * 7.5) * 2.5;
      } else if (cumprimentando) {
        // Cumprimento tátil: tamborilamento alternado com o 1º par de patas!
        if (p.par === 0) alvoAng = p.lado * (-14 + Math.sin(t * 16 + (p.lado === 1 ? Math.PI : 0)) * 12);
        else alvoAng = Math.sin(t * 2 + p.faseBase) * 2;
      } else if (vibrandoTeia) {
        const baseX = p.par === 0 ? 11 : p.par === 1 ? -14 : p.par === 2 ? 14 : -10;
        alvoAng = p.lado * (baseX + Math.sin(t * 32 + p.par) * 5);
      } else if (emPosturaX) {
        const baseX = p.par === 0 ? 11 : p.par === 1 ? -15 : p.par === 2 ? 15 : -10;
        alvoAng = p.lado * baseX + Math.sin(t * 1.5 + p.faseBase) * 1.4;
        if (beliscando && p.par === 0 && p.lado === 1) {
          alvoAng += Math.sin(t * 14) * 9.5;
        }
      } else if (agachando) {
        alvoAng = p.par >= 2 ? p.lado * -13 : p.lado * 7;
      } else if (noAr) {
        alvoAng = p.par <= 1 ? p.lado * -16 : p.lado * 12;
      } else if (andando && desloc > 0.02) {
        const fatorPar = p.par === 0 || p.par === 3 ? 1.1 : 0.92;
        alvoAng = Math.sin(inst.fasePassada + p.faseBase) * amp * fatorPar;
      } else if (inst.estado.tipo === "ballooning") {
        alvoAng = Math.sin(t * 2.2 + p.faseBase) * 5;
      } else {
        if (inst.comportamentoAtual === "banho_completo") {
          // 4. Higiene completa pata-a-pata: puxa 0-esq → 0-dir → 1-esq → 1-dir até as quelíceras!
          const seq = [
            { par: 0, lado: -1 },
            { par: 0, lado: 1 },
            { par: 1, lado: -1 },
            { par: 1, lado: 1 }
          ];
          const atual = seq[Math.floor(inst.tempoComportamento / 0.72) % seq.length];
          if (p.par === atual.par && p.lado === atual.lado) {
            alvoAng = p.lado * (-25 + Math.sin(inst.tempoComportamento * 13) * 8);
          } else {
            alvoAng = Math.sin(t * 1.3 + p.faseBase) * 1.5;
          }
        } else if (inst.comportamentoAtual === "soneca_espreguica") {
          // 5. Soneca encolhida (0-1.6s) → Espreguiçada par I (1.6-2.2s) → par IV (2.2-2.8s)
          const tm = inst.tempoComportamento;
          if (tm < 1.6) {
            alvoAng = p.par <= 1 ? p.lado * 11 : p.lado * -11;
          } else if (tm < 2.2) {
            alvoAng = p.par === 0 ? p.lado * -22 : 0;
          } else {
            alvoAng = p.par === 3 ? p.lado * 20 : 0;
          }
        } else if (inst.comportamentoAtual === "grooming" && p.par === 0) {
          const ladoAtivo = Math.floor(inst.tempoComportamento / 0.85) % 2 === 0 ? -1 : 1;
          alvoAng = p.lado === ladoAtivo
            ? p.lado * (-18 + Math.sin(inst.tempoComportamento * 16) * 7)
            : p.lado * -3;
        } else if (inst.comportamentoAtual === "escovar_cerdas" && p.par === 3) {
          const ladoAtivo = Math.floor(inst.tempoComportamento / 1.05) % 2 === 0 ? -1 : 1;
          alvoAng = p.lado === ladoAtivo
            ? p.lado * (-16 + Math.sin(inst.tempoComportamento * 11) * 7.5)
            : p.lado * 2;
        } else if (inst.comportamentoAtual === "probing" && p.par === 0) {
          alvoAng = Math.sin(inst.tempoComportamento * 4.2 + (p.lado === 1 ? Math.PI : 0)) * 12;
        } else {
          alvoAng = Math.sin(t * 1.4 + p.faseBase) * 1.8;
        }
      }

      p.angAtual = lerp(p.angAtual, alvoAng, Math.min(1, dt * 15));
      p.el.style.transform = `rotate(${p.angAtual.toFixed(2)}deg)`;
    }
  }

  function desenharTeiaCantoDinamica(inst, st) {
    if (!inst.fioPath) return;
    const opSeda = Math.max(0, Math.min(1, st.progressoSeda));
    if (inst.fioSvg) inst.fioSvg.style.opacity = (0.44 * opSeda).toFixed(3);

    const dx = st.px - st.vx;
    const dy = st.py - st.vy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;
    const vib = st.vibracaoRestante > 0 ? Math.sin(inst.tempoVida * 38) * 3.8 : st.beliscoRestante > 0 ? Math.sin(inst.tempoVida * 16) * 1.8 : 0;

    let dTeia = `M ${st.vx.toFixed(1)} ${st.vy.toFixed(1)} Q ${((st.vx + st.x) * 0.5 + nx * vib).toFixed(1)} ${((st.vy + st.y) * 0.5 + ny * vib).toFixed(1)} ${st.x.toFixed(1)} ${st.y.toFixed(1)}`;
    if (st.teiaPropria) {
      const r = st.raioTeia;
      const sgn = st.canto === "top-right" ? -1 : 1;
      for (const ang of [0.12, 0.5, 0.92, 1.32]) {
        dTeia += ` M ${st.vx.toFixed(1)} ${st.vy.toFixed(1)} L ${(st.vx + sgn * Math.cos(ang) * r).toFixed(1)} ${(st.vy + Math.sin(ang) * r).toFixed(1)}`;
      }
      for (const f of [0.34, 0.62, 0.9]) {
        const rr = r * f;
        dTeia += ` M ${(st.vx + sgn * rr).toFixed(1)} ${(st.vy + 2).toFixed(1)} Q ${(st.vx + sgn * rr * 0.68 + nx * vib * 0.5).toFixed(1)} ${(st.vy + rr * 0.68 + ny * vib * 0.5).toFixed(1)} ${(st.vx + sgn * 2).toFixed(1)} ${(st.vy + rr).toFixed(1)}`;
      }
    }
    inst.fioPath.setAttribute("d", dTeia);

    if (inst.estabPath) {
      const passos = Math.floor(opSeda * 7);
      if (passos >= 2) {
        const ampZ = 4.6;
        const compZ = 34;
        const xIni = st.px - ux * (compZ * 0.5);
        const yIni = st.py - uy * (compZ * 0.5);
        let dZ = `M ${xIni.toFixed(1)} ${yIni.toFixed(1)}`;
        for (let k = 1; k <= passos; k++) {
          const frac = k / 7;
          const lado = k % 2 === 0 ? -1 : 1;
          dZ += ` L ${(xIni + ux * (compZ * frac) + nx * (lado * ampZ + vib * 0.6)).toFixed(1)} ${(yIni + uy * (compZ * frac) + ny * (lado * ampZ + vib * 0.6)).toFixed(1)}`;
        }
        inst.estabPath.setAttribute("d", dZ);
      } else {
        inst.estabPath.setAttribute("d", "");
      }
    }
  }

  // Controlador unificado das 6 ações especiais ricas (Orvalho, Urticante, Tatear Cursor, Cortejo, Ecdise, Mãe com Ooteca)
  function atualizarAcaoEspecial(inst, dt, flags) {
    const ac = inst.acaoEspecial;
    const st = inst.estado;
    if (!ac) return false;
    ac.tempo += dt;

    // 1. BEBER GOTA DE ORVALHO
    if (ac.tipo === "beber_orvalho") {
      if (ac.fase === "indo") {
        const dx = ac.gx - st.x;
        const dy = ac.gy - st.y;
        const dist = Math.hypot(dx, dy);
        const distBoca = inst.tamPx * 0.42;
        if (dist <= distBoca + 6) {
          ac.fase = "bebendo";
          ac.tempo = 0;
        } else {
          const vel = inst.especie.velocidadeBase * 1.15;
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
          st.anguloAlvo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        }
      } else if (ac.fase === "bebendo") {
        flags.andando = false;
        flags.bebendoAgua = true;
        st.anguloAlvo = (Math.atan2(ac.gy - st.y, ac.gx - st.x) * 180) / Math.PI + 90;
        const frac = Math.min(1, ac.tempo / 3.2);
        if (ac.gotaEl) {
          const sc = Math.max(0.1, 1 - frac * 0.9);
          ac.gotaEl.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(3)})`;
          ac.gotaEl.style.opacity = (0.92 - frac * 0.72).toFixed(2);
        }
        if (frac >= 1) {
          if (ac.gotaEl && ac.gotaEl.parentNode) ac.gotaEl.parentNode.removeChild(ac.gotaEl);
          ac.gotaEl = null;
          ac.fase = "limpando";
          ac.tempo = 0;
        }
      } else {
        flags.andando = false;
        inst.comportamentoAtual = "grooming";
        if (ac.tempo >= 0.95) {
          const saida = bordaMaisProxima(st.x, st.y, inst.tamPx * 1.3);
          st.p0 = { x: st.x, y: st.y };
          st.p1 = { x: lerp(st.x, saida.x, 0.4), y: lerp(st.y, saida.y, 0.4) };
          st.p2 = { x: lerp(st.x, saida.x, 0.7), y: lerp(st.y, saida.y, 0.7) };
          st.p3 = { x: saida.x, y: saida.y };
          st.t = 0;
          st.duracao = Math.max(4.0, Math.hypot(saida.x - st.x, saida.y - st.y) / inst.especie.velocidadeBase);
          inst.acaoEspecial = null;
          return false;
        }
      }
      return true;
    }

    // 2. NUVEM DE PELOS URTICANTES (Tarântula Golias)
    if (ac.tipo === "chute_urticante") {
      flags.andando = false;
      if (ac.fase === "aviso") {
        flags.emDefesa = true;
        if (ac.tempo >= 0.75) {
          ac.fase = "chutando";
          ac.tempo = 0;
        }
      } else {
        flags.chuteUrticante = true;
        if (!ac.particulasLancadas && ac.tempo >= 0.16) {
          ac.particulasLancadas = true;
          lancarParticulasUrticantes(st.x, st.y, st.angulo);
        }
        if (ac.tempo >= 0.72) {
          inst.acaoEspecial = null;
          acionarFuga(inst);
          return false;
        }
      }
      return true;
    }

    // 6. PAPA-MOSCAS CURIOSA TATEANDO CURSOR PARADO
    if (ac.tipo === "tatear_cursor") {
      if (ac.fase === "aproximando") {
        const dx = ac.cx - st.x;
        const dy = ac.cy - st.y;
        const dist = Math.hypot(dx, dy);
        st.anguloAlvo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (dist <= 30 || ac.tempo >= 3.0) {
          ac.fase = "tateando";
          ac.tempo = 0;
        } else {
          const vel = inst.especie.velocidadeBase * 0.52;
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
        }
      } else if (ac.fase === "tateando") {
        flags.andando = false;
        flags.tateandoCursor = true;
        st.anguloAlvo = (Math.atan2(ac.cy - st.y, ac.cx - st.x) * 180) / Math.PI + 90;
        if (ac.tempo >= 0.72) {
          ac.fase = "pulinho_tras";
          ac.tempo = 0;
          ac.origX = st.x;
          ac.origY = st.y;
          const dx = st.x - ac.cx;
          const dy = st.y - ac.cy;
          const d = Math.max(1, Math.hypot(dx, dy));
          ac.destX = st.x + (dx / d) * 56;
          ac.destY = st.y + (dy / d) * 56;
        }
      } else {
        flags.andando = false;
        flags.noAr = true;
        const frac = Math.min(1, ac.tempo / 0.36);
        const arco = Math.sin(frac * Math.PI);
        st.x = lerp(ac.origX, ac.destX, frac);
        st.y = lerp(ac.origY, ac.destY, frac) - arco * 12;
        flags.escalaX = 1 + arco * 0.16;
        flags.escalaY = 1 + arco * 0.2;
        flags.sombraExtra = arco * 8;
        if (frac >= 1) {
          inst.curiosidadeFeita = true;
          inst.acaoEspecial = null;
          return false;
        }
      }
      return true;
    }

    // 10. DANÇA DE CORTEJO DA PAPA-MOSCAS (Maratus / Salticidae)
    if (ac.tipo === "danca_cortejo") {
      const outra = ac.parceira && ativas.includes(ac.parceira) ? ac.parceira : null;
      if (!outra || ac.tempo >= ac.duracao) {
        inst.acaoEspecial = null;
        return false;
      }
      if (ac.papel === "dancarino") {
        flags.dancaCortejo = true;
        // Passinhos laterais em arco (zig-zag) de frente para a parceira!
        const alvoX = ac.centroX + Math.sin(ac.tempo * 3.1) * 44;
        const alvoY = ac.centroY + 38 - Math.abs(Math.sin(ac.tempo * 3.1)) * 10;
        st.x = lerp(st.x, alvoX, Math.min(1, dt * 6.5));
        st.y = lerp(st.y, alvoY, Math.min(1, dt * 6.5));
        st.anguloAlvo = (Math.atan2(outra.estado.y - st.y, outra.estado.x - st.x) * 180) / Math.PI + 90;
      } else {
        flags.andando = false;
        flags.paralaxe = true;
        st.x = lerp(st.x, ac.centroX, Math.min(1, dt * 4));
        st.y = lerp(st.y, ac.centroY - 34, Math.min(1, dt * 4));
        st.anguloAlvo = (Math.atan2(outra.estado.y - st.y, outra.estado.x - st.x) * 180) / Math.PI + 90;
      }
      return true;
    }

    // 11. TROCA DE EXOESQUELETO / ECDISE (Lendário!)
    if (ac.tipo === "ecdise_muda") {
      if (ac.fase === "indo") {
        const dx = ac.alvoX - st.x;
        const dy = ac.alvoY - st.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 10) {
          ac.fase = "contraindo";
          ac.tempo = 0;
        } else {
          const vel = inst.especie.velocidadeBase * 1.1;
          st.x += (dx / dist) * vel * dt;
          st.y += (dy / dist) * vel * dt;
          st.anguloAlvo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        }
      } else if (ac.fase === "contraindo") {
        flags.andando = false;
        flags.ecdiseContraindo = true;
        const pulso = Math.sin(ac.tempo * 4.2);
        flags.escalaX = 1 + pulso * 0.05;
        flags.escalaY = 1 - pulso * 0.04;
        if (ac.tempo >= 2.1) {
          criarExuviaAranha(inst);
          inst.wrap.classList.add("recem-mudada");
          ac.fase = "saindo_casca";
          ac.tempo = 0;
          ac.origX = st.x;
          ac.origY = st.y;
        }
      } else if (ac.fase === "saindo_casca") {
        // Desliza lentamente para frente saindo de dentro da exúvia vazia!
        const rad = ((st.angulo - 90) * Math.PI) / 180;
        const frac = Math.min(1, ac.tempo / 1.3);
        const ease = 1 - Math.pow(1 - frac, 2);
        const avanco = inst.tamPx * 0.78;
        st.x = ac.origX + Math.cos(rad) * avanco * ease;
        st.y = ac.origY + Math.sin(rad) * avanco * ease;
        if (frac >= 1) {
          ac.fase = "espreguicando";
          ac.tempo = 0;
        }
      } else {
        flags.andando = false;
        flags.espreguicando = true;
        flags.escalaY = 1 + Math.sin(Math.min(1, ac.tempo / 1.1) * Math.PI) * 0.07;
        if (ac.tempo >= 1.15) {
          const saida = bordaMaisProxima(st.x, st.y, inst.tamPx * 1.35);
          st.p0 = { x: st.x, y: st.y };
          st.p1 = { x: lerp(st.x, saida.x, 0.4), y: lerp(st.y, saida.y, 0.4) };
          st.p2 = { x: lerp(st.x, saida.x, 0.7), y: lerp(st.y, saida.y, 0.7) };
          st.p3 = { x: saida.x, y: saida.y };
          st.t = 0;
          st.duracao = Math.max(4.5, Math.hypot(saida.x - st.x, saida.y - st.y) / inst.especie.velocidadeBase);
          inst.acaoEspecial = null;
          return false;
        }
      }
      return true;
    }

    // 12. ÑANDUOBYETÉ MÃE COM OOTECA & FILHOTINHOS EM BALLOONING (Lendário!)
    if (ac.tipo === "mae_ooteca") {
      // Atualiza posição da ooteca esférica colada às fiandeiras (atrás do abdômen!)
      const atualizarOoteca = (escala = 1) => {
        if (!ac.ootecaEl) return;
        const radTras = ((st.angulo + 90) * Math.PI) / 180;
        const ox = st.x + Math.cos(radTras) * (inst.tamPx * 0.36);
        const oy = st.y + Math.sin(radTras) * (inst.tamPx * 0.36);
        ac.ootecaEl.style.transform = `translate3d(${(ox - 12).toFixed(1)}px, ${(oy - 12).toFixed(1)}px, 0) scale(${escala.toFixed(3)})`;
      };

      if (ac.fase === "caminhando") {
        atualizarOoteca(1);
        if (Math.abs(st.x - ac.pontoEclosaoX) < 28) {
          ac.fase = "eclodindo";
          ac.tempoEclosao = 0;
        }
        return false; // Continua a caminhada normal da curva Bézier
      } else if (ac.fase === "eclodindo") {
        flags.andando = false;
        ac.tempoEclosao += dt;
        const pulso = 1 + Math.sin(ac.tempoEclosao * 10) * 0.09;
        atualizarOoteca(pulso * (1 - ac.filhotesSoltos * 0.14));

        const desejados = Math.min(3, Math.floor(ac.tempoEclosao / 0.55) + 1);
        if (desejados > ac.filhotesSoltos) {
          ac.filhotesSoltos = desejados;
          const W = window.innerWidth || 1200;
          const filh = gerarAranha("filhote", "ballooning", true);
          if (filh) {
            filh.estado.x0 = st.x + rand(-10, 10);
            filh.estado.y0 = st.y + rand(-6, 6);
            filh.estado.x1 = st.x + (Math.random() < 0.5 ? -1 : 1) * rand(220, Math.max(320, W * 0.45));
            filh.estado.y1 = -60;
            filh.estado.x = filh.estado.x0;
            filh.estado.y = filh.estado.y0;
            filh.estado.duracao = rand(7.5, 11);
          }
          criarRastroPonto(st.x, st.y, true);
        }

        if (ac.tempoEclosao >= 2.2) {
          if (ac.ootecaEl && ac.ootecaEl.parentNode) ac.ootecaEl.parentNode.removeChild(ac.ootecaEl);
          ac.ootecaEl = null;
          ac.fase = "seguindo";
          inst.acaoEspecial = null;
          return false;
        }
        return true;
      }
      return false;
    }

    return false;
  }

  function atualizarInstancia(inst, dt) {
    const st = inst.estado;
    inst.tempoVida += dt;
    if (inst.cooldownInteracao > 0) inst.cooldownInteracao -= dt;
    if (inst.scrollAgachada > 0) inst.scrollAgachada = Math.max(0, inst.scrollAgachada - dt);
    if (Math.abs(inst.balancoScroll) > 0.05) inst.balancoScroll = lerp(inst.balancoScroll, 0, Math.min(1, dt * 4.5));

    const prevX = st.x;
    const prevY = st.y;
    const flags = {
      escalaX: 1,
      escalaY: 1,
      sombraExtra: 0,
      andando: true,
      noAr: false,
      agachando: false,
      emDefesa: false,
      emPosturaX: false,
      beliscando: false,
      vibrandoTeia: false,
      presasAbertas: false,
      armandoBoteGolias: false,
      contendoPresa: false,
      emboscadaBracos: false,
      arremessandoSeda: false,
      cumprimentando: false,
      camuflagemGalhinho: false,
      chuteUrticante: false,
      bebendoAgua: false,
      dancaCortejo: false,
      ecdiseContraindo: false,
      tateandoCursor: false,
      espreguicando: false,
      encolhida: false,
      terminado: false
    };

    // 0. Camuflagem de "Galhinho" (Tetragnatha) — imóvel em linha reta até o perigo passar!
    if (inst.camuflagemRestante > 0) {
      inst.camuflagemRestante -= dt;
      flags.andando = false;
      flags.camuflagemGalhinho = true;
      flags.escalaX = 0.88;
      flags.escalaY = 1.07;
    } else if (inst.defesaRestante > 0) {
      inst.defesaRestante -= dt;
      flags.andando = false;
      flags.emDefesa = true;
      const pulsoDef = Math.sin(Math.min(1, (1.35 - Math.max(0, inst.defesaRestante)) * 2.2) * Math.PI * 0.5);
      flags.escalaX = 1 + pulsoDef * 0.05;
      flags.escalaY = 1 + pulsoDef * 0.08;
      flags.sombraExtra = 6 * pulsoDef;
      if (inst.defesaRestante <= 0) {
        inst.defesaRestante = 0;
        acionarFuga(inst);
      }
    } else if (inst.atencaoClique && inst.atencaoClique.tempo > 0) {
      // 8. Reação à vibração de cliques na bancada!
      inst.atencaoClique.tempo -= dt;
      flags.andando = false;
      flags.paralaxe = true;
      st.anguloAlvo = (Math.atan2(inst.atencaoClique.y - st.y, inst.atencaoClique.x - st.x) * 180) / Math.PI + 90;
      if (inst.atencaoClique.tempo <= 0) inst.atencaoClique = null;
    } else if (inst.acaoEspecial && atualizarAcaoEspecial(inst, dt, flags)) {
      // Ação especial (orvalho, urticante, tatear cursor, cortejo, ecdise, mãe com ooteca) assumiu este frame
    } else if (inst.interacao) {
      // 0.5 Interação social / territorial Aranha ↔ Aranha
      const inter = inst.interacao;
      inter.tempo += dt;
      const outro = inter.outro;
      if (outro && ativas.includes(outro)) {
        st.anguloAlvo = (Math.atan2(outro.estado.y - st.y, outro.estado.x - st.x) * 180) / Math.PI + 90;
      }
      if (inter.tipo === "cumprimento") {
        flags.andando = false;
        flags.cumprimentando = true;
      } else if (inter.tipo === "aviso_territorial") {
        flags.andando = false;
        flags.emDefesa = true;
      } else if (inter.tipo === "recuo_hierarquia") {
        // Recua de costas com respeito diante da Tarântula Golias!
        if (outro && ativas.includes(outro)) {
          const rx = st.x - outro.estado.x;
          const ry = st.y - outro.estado.y;
          const rd = Math.max(1, Math.hypot(rx, ry));
          st.x += (rx / rd) * inst.especie.velocidadeBase * 1.1 * dt;
          st.y += (ry / rd) * inst.especie.velocidadeBase * 1.1 * dt;
        }
      }
      if (inter.tempo >= inter.duracao) {
        const eraRecuo = inter.tipo === "recuo_hierarquia";
        inst.interacao = null;
        if (eraRecuo) acionarFuga(inst);
      }
    } else if (inst.fugindo && inst.fugaAlvo) {
      const dx = inst.fugaAlvo.x - st.x;
      const dy = inst.fugaAlvo.y - st.y;
      const dist = Math.hypot(dx, dy);
      const multFuga = inst.especie.posturaDefensiva ? 1.85 : 2.75;
      st.velEscalar = lerp(st.velEscalar || 1, multFuga, dt * 8);
      const velFuga = inst.especie.velocidadeBase * st.velEscalar;
      if (dist <= velFuga * dt + 8) {
        flags.terminado = true;
      } else {
        st.x += (dx / dist) * velFuga * dt;
        st.y += (dy / dist) * velFuga * dt;
        st.anguloAlvo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      }
      if (st.faseSalto === "no_ar") {
        flags.noAr = true;
        flags.andando = false;
        st.saltoT += dt * 3.4;
        if (st.saltoT >= 1) {
          st.faseSalto = "andando";
        } else {
          const arco = Math.sin(st.saltoT * Math.PI);
          flags.escalaX = 1 + arco * 0.2;
          flags.escalaY = 1 + arco * 0.24;
          flags.sombraExtra = arco * 9;
        }
      }
    } else if (inst.caca && atualizarCaca(inst, dt, flags)) {
      // Caça ativa assumiu o controle deste frame
    } else if (st.tipo === "contorno_card") {
      // 9. Tigmotaxia: caminha exatamente pelas arestas e quinas de 90° de um card real da tela!
      if (st.pausaRestante > 0) {
        flags.andando = false;
        st.pausaRestante -= dt;
      } else {
        const alvo = st.rota[st.idxAtual];
        if (!alvo) {
          flags.terminado = true;
        } else {
          const dx = alvo.x - st.x;
          const dy = alvo.y - st.y;
          const dist = Math.hypot(dx, dy);
          const vel = inst.especie.velocidadeBase * 0.92;
          if (dist <= vel * dt + 5) {
            st.x = alvo.x;
            st.y = alvo.y;
            st.idxAtual += 1;
            if (!st.pausaFeita && st.idxAtual === 3) {
              st.pausaFeita = true;
              st.pausaRestante = rand(1.4, 2.5);
              inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
            }
            if (st.idxAtual >= st.rota.length) flags.terminado = true;
          } else {
            st.x += (dx / dist) * vel * dt;
            st.y += (dy / dist) * vel * dt;
            st.anguloAlvo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          }
        }
      }
    } else if (st.tipo === "repouso_teia_canto") {
      if (st.elAlvo) {
        const viva = calcularAncoraElemento(st.elAlvo, st.canto, st.offsetX, st.offsetY);
        if (!viva) {
          if (st.fase !== "partindo") {
            st.fase = "partindo";
            st.t = 0;
            st.origemPartidaX = st.x;
            st.origemPartidaY = st.y;
          }
        } else {
          st.vx = viva.vx;
          st.vy = viva.vy;
          st.px = viva.px;
          st.py = viva.py;
        }
      }

      if (st.cooldownVibracao > 0) st.cooldownVibracao -= dt;

      if (st.fase === "chegando") {
        st.t = Math.min(1, st.t + dt * 0.62);
        const ease = 1 - Math.pow(1 - st.t, 3);
        st.x = lerp(st.vx, st.px, ease);
        st.y = lerp(st.vy, st.py, ease);
        st.progressoSeda = Math.min(0.45, ease * 0.45);
        st.anguloAlvo = (Math.atan2(st.py - st.vy, st.px - st.vx) * 180) / Math.PI + 90;
        if (st.t >= 1) {
          st.fase = "reparando_teia";
          st.tempoFase = 0;
        }
      } else if (st.fase === "reparando_teia") {
        st.tempoFase += dt;
        const frac = Math.min(1, st.tempoFase / st.duracaoReparo);
        const angArco = frac * Math.PI * 2;
        const raioArco = 11 * Math.sin(frac * Math.PI);
        st.x = st.px + Math.cos(angArco) * raioArco;
        st.y = st.py + Math.sin(angArco) * raioArco;
        st.anguloAlvo = (Math.atan2(Math.cos(angArco), -Math.sin(angArco)) * 180) / Math.PI + 90;
        st.progressoSeda = Math.min(1, 0.45 + frac * 0.55);
        if (frac > 0.35 && frac < 0.72 && Math.random() < dt * 1.4) {
          criarRastroPonto(st.x, st.y, true);
        }
        if (st.tempoFase >= st.duracaoReparo) {
          st.fase = "aguardando_em_x";
          st.tempoFase = 0;
          st.progressoSeda = 1;
        }
      } else if (st.fase === "aguardando_em_x") {
        flags.andando = false;
        flags.emPosturaX = true;
        st.tempoFase += dt;
        st.progressoSeda = 1;

        if (st.vibracaoRestante > 0) {
          st.vibracaoRestante -= dt;
          flags.vibrandoTeia = true;
          const osc = Math.sin(inst.tempoVida * 38) * 3.8;
          st.x = st.px + osc;
          st.y = st.py + osc * 0.65;
          flags.escalaX = 1 + Math.sin(inst.tempoVida * 38) * 0.04;
          flags.escalaY = 1 - Math.sin(inst.tempoVida * 38) * 0.04;
          st.anguloAlvo = st.anguloRepouso + Math.sin(inst.tempoVida * 30) * 6;
        } else {
          st.x = lerp(st.x, st.px, Math.min(1, dt * 8));
          st.y = lerp(st.y, st.py, Math.min(1, dt * 8));
          st.anguloAlvo = st.anguloRepouso + Math.sin(st.tempoFase * 0.9) * 3.2;

          st.proximoBelisco -= dt;
          if (st.proximoBelisco <= 0 && st.beliscoRestante <= 0) {
            st.beliscoRestante = 0.85;
            st.proximoBelisco = rand(2.6, 4.8);
          }
          if (st.beliscoRestante > 0) {
            st.beliscoRestante -= dt;
            flags.beliscando = true;
          }
        }

        if (st.tempoFase >= st.duracaoVigilia) {
          st.fase = "partindo";
          st.t = 0;
          st.origemPartidaX = st.x;
          st.origemPartidaY = st.y;
        }
      } else {
        const multPartida = inst.fugindo ? 2.1 : 0.85;
        st.t = Math.min(1, st.t + dt * multPartida);
        const ease = st.t * st.t;
        const ox = st.origemPartidaX != null ? st.origemPartidaX : st.px;
        const oy = st.origemPartidaY != null ? st.origemPartidaY : st.py;
        const destinoX = st.canto === "top-right" ? st.vx + inst.tamPx * 0.7 : st.vx - inst.tamPx * 0.7;
        const destinoY = st.vy - inst.tamPx * 0.7;
        st.x = lerp(ox, destinoX, ease);
        st.y = lerp(oy, destinoY, ease);
        st.progressoSeda = Math.max(0, 1 - ease * 1.15);
        st.anguloAlvo = (Math.atan2(destinoY - oy, destinoX - ox) * 180) / Math.PI + 90;
        if (st.t >= 1) flags.terminado = true;
      }
    } else if (st.tipo === "rapel_fio") {
      st.balancoTempo += dt;
      const balanco = Math.sin(st.balancoTempo * 1.55) * (st.fase === "inspecionando" ? 11 : 4.5);
      if (st.fase === "descendo") {
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
        flags.andando = false;
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
        if (st.y <= -inst.tamPx * 1.25) flags.terminado = true;
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
        flags.andando = false;
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
        if (st.t >= 1) flags.terminado = true;
      }
    } else if (st.tipo === "lateral_caranguejo") {
      if (st.pausaRestante > 0) {
        flags.andando = false;
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
            flags.terminado = true;
          }
        }
      }
    } else if (st.tipo === "ballooning") {
      flags.andando = false;
      st.t += dt / st.duracao;
      if (st.t >= 1) {
        flags.terminado = true;
      } else {
        st.x = lerp(st.x0, st.x1, st.t);
        st.y = lerp(st.y0, st.y1, st.t) + Math.sin(st.t * Math.PI * st.freqOnda) * st.ampOnda;
        st.anguloAlvo = Math.sin(st.t * Math.PI * st.freqOnda) * 16 + (st.x1 > st.x0 ? 22 : -22);
      }
    } else {
      if (st.pausaRestante > 0) {
        flags.andando = false;
        st.velEscalar = lerp(st.velEscalar, 0, dt * 10);
        st.pausaRestante -= dt;

        if (inst.especie.curiosaCursor && cursorAtual.ativo) {
          const dCursor = Math.hypot(cursorAtual.x - st.x, cursorAtual.y - st.y);
          if (dCursor >= 100 && dCursor <= 310) {
            st.anguloAlvo = (Math.atan2(cursorAtual.y - st.y, cursorAtual.x - st.x) * 180) / Math.PI + 90;
          }
        }
      } else {
        let alvoVel = 0.88 + Math.sin(inst.tempoVida * 2.6 + inst.uid) * 0.16;

        if (st.tipo === "saltinhos") {
          if (st.faseSalto === "andando" && st.t >= st.proximoSaltoT && st.t < 0.84) {
            st.faseSalto = "agachando";
            st.saltoT = 0;
            st.proximoSaltoT = st.t + rand(0.18, 0.28);
          }

          if (st.faseSalto === "agachando") {
            flags.andando = false;
            flags.agachando = true;
            alvoVel = 0;
            st.saltoT += dt * 3.4;
            const p = Math.min(1, st.saltoT);
            flags.escalaX = 1 + p * 0.09;
            flags.escalaY = 1 - p * 0.14;
            if (st.saltoT >= 1) {
              st.faseSalto = "no_ar";
              st.saltoT = 0;
            }
          } else if (st.faseSalto === "no_ar") {
            flags.andando = false;
            flags.noAr = true;
            alvoVel = 2.35;
            st.saltoT += dt * 2.5;
            const arco = Math.sin(Math.min(1, st.saltoT) * Math.PI);
            flags.escalaX = 1 + arco * 0.18;
            flags.escalaY = 1 + arco * 0.24;
            flags.sombraExtra = arco * 12;
            if (st.saltoT >= 1) {
              st.faseSalto = "aterrissando";
              st.saltoT = 0;
            }
          } else if (st.faseSalto === "aterrissando") {
            flags.andando = false;
            alvoVel = 0.15;
            st.saltoT += dt * 5.2;
            const bounce = Math.sin(Math.min(1, st.saltoT) * Math.PI);
            flags.escalaX = 1 + bounce * 0.08;
            flags.escalaY = 1 - bounce * 0.08;
            if (st.saltoT >= 1) {
              st.faseSalto = "andando";
              st.pausaRestante = rand(0.75, 1.5);
              inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
            }
          }
        }

        st.velEscalar = lerp(st.velEscalar, alvoVel, Math.min(1, dt * (flags.noAr ? 14 : 6)));
        st.t += (dt * st.velEscalar) / st.duracao;

        if (!st.pausaFeita && st.faseSalto !== "no_ar" && st.faseSalto !== "agachando" && st.t >= st.pausaT) {
          st.pausaFeita = true;
          st.pausaRestante = rand(1.3, 2.5);
          inst.comportamentoAtual = sortearComportamentoPausa(inst.especie);
        }

        if (st.t >= 1) {
          flags.terminado = true;
        } else {
          const pos = pontoBezierCubica(st.t, st.p0, st.p1, st.p2, st.p3);
          const tan = derivadaBezierCubica(st.t, st.p0, st.p1, st.p2, st.p3);
          st.x = pos.x;
          st.y = pos.y;
          st.anguloAlvo = (Math.atan2(tan.y, tan.x) * 180) / Math.PI + 90;
        }
      }
    }

    if (flags.terminado) {
      removerInstancia(inst);
      return;
    }

    st.angulo = lerpAngulo(st.angulo, st.anguloAlvo, dt * (inst.fugindo ? 16 : 8));
    const desloc = Math.hypot(st.x - prevX, st.y - prevY);
    animarPatasEComportamentos(inst, dt, flags.andando, desloc, flags.noAr, flags.agachando, flags);

    if (inst.especie.rastroSeda && flags.andando && desloc > 0.18 && st.tipo !== "repouso_teia_canto") {
      inst.tempoUltimoRastro += dt;
      if (inst.tempoUltimoRastro >= 0.14) {
        inst.tempoUltimoRastro = 0;
        criarRastroPonto(st.x, st.y, false);
      }
    }

    if (inst.fioPath) {
      if (st.temTeiaCanto) {
        desenharTeiaCantoDinamica(inst, st);
      } else if (st.temFio) {
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

    const bobCorpo = flags.andando && desloc > 0.05 ? Math.sin(inst.fasePassada * 2) * (inst.especie.id === "tarantula_golias" ? 1.15 : 0.65) : 0;
    // 7. Inércia ao rolar a página (scroll): balanço pendular em fios + micro-agachada de aderência!
    const offsetScrollX = (st.tipo === "rapel_fio" || st.tipo === "ballooning") ? inst.balancoScroll : 0;
    if (inst.scrollAgachada > 0 && flags.andando) {
      const fS = Math.sin((inst.scrollAgachada / 0.24) * Math.PI);
      flags.escalaX *= 1 + fS * 0.06;
      flags.escalaY *= 1 - fS * 0.06;
    }
    const meia = inst.tamPx / 2;
    inst.wrap.style.transform = `translate3d(${(st.x - meia + offsetScrollX).toFixed(2)}px, ${(st.y - meia + bobCorpo).toFixed(2)}px, 0) rotate(${(st.angulo + offsetScrollX * 0.45).toFixed(2)}deg) scale(${flags.escalaX.toFixed(3)}, ${flags.escalaY.toFixed(3)})`;

    if (flags.sombraExtra > 0.1) {
      inst.wrap.style.filter = `drop-shadow(0 ${(4 + flags.sombraExtra).toFixed(1)}px ${(5 + flags.sombraExtra * 0.75).toFixed(1)}px var(--aranha-sombra))`;
    } else if (inst.wrap.style.filter) {
      inst.wrap.style.filter = "";
    }
  }

  function loopFrame(ts) {
    if (ativas.length === 0 && presasAtivas.length === 0) {
      rafId = null;
      return;
    }
    if (!ultimoFrameTs) ultimoFrameTs = ts;
    const dt = Math.min(0.05, Math.max(0.001, (ts - ultimoFrameTs) / 1000));
    ultimoFrameTs = ts;

    if (!document.hidden) {
      // 6. Rastreia cursor parado para despertar curiosidade da Papa-Moscas!
      if (cursorAtual.ativo) {
        const dMov = Math.hypot(cursorAtual.x - cursorAtual.ultimoMovX, cursorAtual.y - cursorAtual.ultimoMovY);
        if (dMov < 6) {
          cursorAtual.paradoTempo += dt;
          if (cursorAtual.paradoTempo >= 2.2) {
            for (let k = 0; k < ativas.length; k++) {
              const a = ativas[k];
              if (a.especie.id !== "papa_moscas" || a.curiosidadeFeita || a.fugindo || a.caca || a.acaoEspecial || a.interacao) continue;
              const dCur = Math.hypot(cursorAtual.x - a.estado.x, cursorAtual.y - a.estado.y);
              if (dCur >= 75 && dCur <= 265) {
                a.acaoEspecial = { tipo: "tatear_cursor", fase: "aproximando", cx: cursorAtual.x, cy: cursorAtual.y, tempo: 0 };
                break;
              }
            }
          }
        } else {
          cursorAtual.ultimoMovX = cursorAtual.x;
          cursorAtual.ultimoMovY = cursorAtual.y;
          cursorAtual.paradoTempo = 0;
        }
      }

      verificarEncontrosEntreAranhas();
      verificarOportunidadesDeCaca();
      for (let i = ativas.length - 1; i >= 0; i--) {
        atualizarInstancia(ativas[i], dt);
      }
      for (let i = presasAtivas.length - 1; i >= 0; i--) {
        atualizarPresa(presasAtivas[i], dt);
      }
    }

    if (ativas.length > 0 || presasAtivas.length > 0) {
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
  // 10. AGENDAMENTO, REAÇÃO AO PONTEIRO & API PÚBLICA
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
      ? modoAtual === "raro"
        ? rand(42000, 88000)
        : rand(Math.min(14000, faixa[0] * 0.45), Math.min(28000, faixa[0] * 0.85))
      : rand(faixa[0], faixa[1]);

    timerProxima = setTimeout(() => {
      if (!document.hidden && modoAtual !== "desligado" && !animacoesReduzidasAtivas()) {
        dispararEventoNatural();
      }
      agendarProxima(false);
    }, espera);
  }

  function lerConfiguracoes() {
    if (typeof Configuracoes !== "undefined" && typeof Configuracoes.obter === "function") {
      const m = Configuracoes.obter("aranhasAtelie");
      modoAtual = m === "desligado" || m === "raro" || m === "vivo" || m === "discreto" ? m : "discreto";
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

  function invocarCena(tipoCena) {
    switch (tipoCena) {
      case "caca_papa_mosca":
        return iniciarCenaCaca("papa_moscas", "mosca", true);
      case "caca_tecela_teia":
        return iniciarCenaCaca("tecela_canto", "mosquito", true);
      case "caca_caranguejo_mosca":
        return iniciarCenaCaca("caranguejo", "mosca", true);
      case "caca_renda_mosquito":
        return iniciarCenaCaca("tecela_renda", "mosquito", true);
      case "caca_nandu_mosca":
        return iniciarCenaCaca("nandu", "mosca", true);
      case "caca_filhote_mosquito":
        return iniciarCenaCaca("filhote", "mosquito", true);
      case "caca_golias_barata":
        return iniciarCenaCaca("tarantula_golias", "barata", true);
      case "caca_golias_lagartinho":
        return iniciarCenaCaca("tarantula_golias", "lagartinho", true);
      case "caca_golias_lagarta":
        return iniciarCenaCaca("tarantula_golias", "lagarta", true);
      case "encontro_aranhas":
        return iniciarEncontroAranhas(false, true);
      case "encontro_golias":
        return iniciarEncontroAranhas(true, true);
      case "beber_orvalho":
        return iniciarCenaBeberOrvalho(null, true);
      case "nuvem_urticante":
        return iniciarCenaNuvemUrticante();
      case "camuflagem_galhinho":
        return iniciarCenaCamuflagemGalhinho();
      case "contorno_card":
        return { aranha: gerarAranha("nandu", "contorno_card", true), titulo: "Ñanduobyeté contornando borda de card" };
      case "danca_cortejo":
        return iniciarCenaDancaCortejo(true);
      case "ecdise_muda":
        return iniciarCenaEcdise(null, true);
      case "mae_ooteca":
        return iniciarCenaMaeOoteca(true);
      default:
        return iniciarCenaCaca("papa_moscas", "mosca", true);
    }
  }

  let ultimoCheckCursorTs = 0;

  function processarPonteiro(clientX, clientY) {
    cursorAtual.x = clientX;
    cursorAtual.y = clientY;
    cursorAtual.ativo = true;

    if (!reagirCursor || (ativas.length === 0 && presasAtivas.length === 0)) return;
    const agora = performance.now();
    if (agora - ultimoCheckCursorTs < 75) return;
    ultimoCheckCursorTs = agora;

    for (let i = 0; i < ativas.length; i++) {
      const inst = ativas[i];
      if (inst.fugindo || inst.defesaRestante > 0) continue;
      // Durante contenção, dança da seda ou digestão, reduz susto acidental para não quebrar a cena
      if (inst.caca && ["contendo", "contendo_picareta", "danca_da_seda", "digestao_succao", "enrolando_seda"].includes(inst.caca.fase)) continue;

      const dist = Math.hypot(clientX - inst.estado.x, clientY - inst.estado.y);
      const raioFuga = inst.especie.posturaDefensiva ? 112 : 86;

      if (
        inst.estado.tipo === "repouso_teia_canto" &&
        inst.estado.fase === "aguardando_em_x" &&
        dist >= 88 &&
        dist <= 195 &&
        inst.estado.cooldownVibracao <= 0
      ) {
        inst.estado.vibracaoRestante = 0.72;
        inst.estado.cooldownVibracao = 2.6;
        continue;
      }

      if (dist < raioFuga) {
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
      if (e.pointerType === "mouse") processarPonteiro(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
      const t = e.touches?.[0];
      if (t) processarPonteiro(t.clientX, t.clientY);
    }, { passive: true });

    // 8. Reação à vibração de cliques na bancada
    window.addEventListener("pointerdown", (e) => {
      if (!reagirCursor || ativas.length === 0) return;
      for (let i = 0; i < ativas.length; i++) {
        const a = ativas[i];
        if (a.fugindo || a.caca || a.acaoEspecial || a.interacao || a.defesaRestante > 0 || a.camuflagemRestante > 0) continue;
        const d = Math.hypot(e.clientX - a.estado.x, e.clientY - a.estado.y);
        if (d >= 95 && d <= 460) {
          a.atencaoClique = { x: e.clientX, y: e.clientY, tempo: 0.65 };
        }
      }
    }, { passive: true });

    // 7. Inércia ao rolar a página (scroll)
    let ultimoScrollTs = 0;
    document.addEventListener("scroll", () => {
      if (ativas.length === 0) return;
      const agora = performance.now();
      if (agora - ultimoScrollTs < 85) return;
      ultimoScrollTs = agora;
      scrollImpulso = (Math.random() < 0.5 ? 1 : -1) * rand(10, 18);
      for (let i = 0; i < ativas.length; i++) {
        const a = ativas[i];
        if (a.estado.tipo === "rapel_fio" || a.estado.tipo === "ballooning") {
          a.balancoScroll = Math.max(-24, Math.min(24, a.balancoScroll + scrollImpulso));
        } else if (!a.fugindo && !a.acaoEspecial) {
          a.scrollAgachada = 0.24;
        }
      }
    }, { passive: true, capture: true });

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
    invocarCena,
    aplicarConfiguracao,
    limparTodas,
    ESPECIES: ESPECIES.map((e) => ({ id: e.id, nome: e.nome })),
    PRESAS: Object.values(PRESAS_CATALOGO).map((p) => ({ id: p.id, nome: p.nome }))
  };

  if (typeof window !== "undefined") {
    window.AranhasAtelie = api;
  }
  return api;
})();
