// ==========================================================================
// PONTO & TRAMA — FERRAMENTA: EDITOR DE GRÁFICOS (CROCHÊ / C2C / TAPESTRY / TRICÔ)
// - Motor HTML5 Canvas 60fps (RNF01) com zoom, pan, Undo/Redo, simetria H/V
// - Ferramentas: Pincel, Borracha, Balde (Flood Fill), Conta-gotas, Linha,
//   Retângulo, Elipse, Seleção (Copiar/Colar/Mover/Espelhar) (RF01-RF05)
// - Importador de Imagens: Foto e Pixel Art Quadriculada com Recorte (Crop),
//   Calibração de Malha (Grid Overlay + Detecção Automática), Amostragem
//   Central 45% (RN02), Limpeza/Mesclagem de Cores e Sugestão de Fios (RF06-RF13)
// - Modo Execução: Trava edição, destaque de carreira ativa (Carreira 1 na base,
//   RN01), leitura Plano/Circular & Destro/Canhoto, sincronização bidirecional
//   com o Contador de Carreiras, leitura em blocos marcáveis e Alto Contraste
// - Autosave local + salvamento em Projetos + Exportação PNG e PDF (RF21-RF22)
// ==========================================================================

const EditorGraficos = (() => {
  const STORAGE_AUTOSAVE = "ponto_trama_editor_graficos_autosave_v1";
  const MIN_DIM = 5;
  const MAX_DIM = 200; // RN04
  const MAX_HISTORICO = 50;
  const SIMBOLOS_PADRAO = ["", "●", "▲", "■", "★", "×", "◆", "✚", "○", "△", "□", "◇", "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "M", "N", "P", "R", "S", "T", "V", "W", "X", "Z"];

  const CORES_TEXTO_MAPA = {
    branco: "#ffffff", cru: "#f5efe0", creme: "#fcf1d0", bege: "#d9c2a3",
    preto: "#1c1c1c", cinza: "#808080", chumbo: "#4a4a4a", prata: "#c0c0c0",
    vermelho: "#c83232", vinho: "#6e1d2b", bordo: "#7a1f32", rosa: "#e87ea1",
    pink: "#d93878", salmao: "#f28f79", coral: "#ef6c57", laranja: "#e67e22",
    amarelo: "#f1c40f", mostarda: "#cfa024", dourado: "#d4af37",
    verde: "#2e8b57", musgo: "#556b2f", menta: "#7fd4b8", oliva: "#6b7b38",
    azul: "#2b59c3", marinho: "#16264d", turquesa: "#2aa8b8", celeste: "#74b9ff",
    roxo: "#6c3483", lilas: "#b388eb", violeta: "#7d3c98",
    marrom: "#6e473b", caramelo: "#b0723b", cafe: "#4a2c2a", chocolate: "#5c3317"
  };

  let jaInicializado = false;
  let rafId = null;
  let precisaRedesenhar = true;
  let timerAutosave = null;
  let timerToast = null;
  let sincronizandoContador = false;

  // Estado principal do gráfico
  const estado = {
    nome: "Meu Gráfico",
    largura: 24,
    altura: 24,
    proporcaoCelula: 1, // largura / altura (1 = 1:1)
    celulas: new Uint8Array(24 * 24), // índice na paleta (0 = fundo)
    paleta: [
      { hex: "#f7f3e8", nome: "Fundo (Creme)", simbolo: "", fio_id: null, fio_marca: "", fio_cor_codigo: "" },
      { hex: "#1b2e5a", nome: "Azul Marinho", simbolo: "●", fio_id: null, fio_marca: "", fio_cor_codigo: "" },
      { hex: "#d64550", nome: "Vermelho", simbolo: "▲", fio_id: null, fio_marca: "", fio_cor_codigo: "" },
      { hex: "#2e8b57", nome: "Verde Folha", simbolo: "■", fio_id: null, fio_marca: "", fio_cor_codigo: "" },
      { hex: "#eab308", nome: "Amarelo Ouro", simbolo: "★", fio_id: null, fio_marca: "", fio_cor_codigo: "" },
      { hex: "#222222", nome: "Preto", simbolo: "×", fio_id: null, fio_marca: "", fio_cor_codigo: "" }
    ],
    corAtivaIdx: 1,

    // Modo & Ferramentas
    modo: "edicao", // 'edicao' | 'execucao'
    ferramenta: "pincel", // pincel | borracha | balde | contagotas | linha | retangulo | elipse | selecao | pan
    formaPreenchida: false,
    simetriaH: false,
    simetriaV: false,
    mostrarGrade: true,
    mostrarSimbolos: false,
    divisoriaCada: 5, // 5 | 10 | 0

    // Execução (RF16-RF20)
    tipoTrabalho: "plano", // 'plano' | 'circular'
    perfilMao: "destro", // 'destro' | 'canhoto'
    altoContraste: false,
    syncContador: true,
    carreiraAtual: 1, // RN01: 1..altura (1 = base)
    blocosMarcados: new Set(),

    // Câmera Canvas
    zoom: 1,
    cellBasePx: 22,
    panX: 44,
    panY: 28,

    // Seleção & Clipboard (RF03)
    selecao: null, // { x1, y1, x2, y2 }
    clipboard: null, // { w, h, dados: Uint8Array }
    arrastandoSelecao: false,
    selDragOrigem: null,
    selBufferMovido: null,
    selFundoSemBloco: null,

    // Histórico Undo/Redo (RF04)
    undoStack: [],
    redoStack: []
  };

  // Interação de ponteiro e gestos multi-touch no Canvas
  let ponteiroAtivo = false;
  let botaoMeioOuEspaco = false;
  let espacoPressionado = false;
  let panInicio = { x: 0, y: 0, panX: 0, panY: 0 };
  let celulaInicio = null;
  let celulaAnterior = null;
  let celulaHover = null;
  let previaForma = []; // [{x, y}]
  let fiosInventarioCache = [];

  // Estado multi-touch (Pinch-to-Zoom, Pan 2 dedos, Undo 2 dedos, Redo 3 dedos, Long-Press Conta-gotas)
  const ponteirosToque = new Map(); // pointerId -> { x, y, startX, startY, ts }
  let gestoMultiAtivo = false;
  let gestoMultiMaxDedos = 0;
  let gestoMultiInicioMs = 0;
  let gestoMultiMoveu = false;
  let pinchRef = null; // { dist, midX, midY, zoom, panX, panY }
  let tracoRecenteUndo = null; // { ts, cel, undoLenAntes }
  let timerLongPress = null;
  let longPressDisparado = false;
  let execDragPendente = null; // { x, y, panX, panY, arrastou, cel }
  let ultimoToqueExecMs = 0;

  // Estado do Importador de Imagens (RF06-RF11, RN02)
  const impEstado = {
    imagem: null,
    modo: "quadriculada", // 'quadriculada' | 'foto'
    visao: "calibrar", // 'calibrar' | 'resultado'
    cropL: 0, cropR: 0, cropT: 0, cropB: 0,
    cols: 32, rows: 32,
    offX: 0, offY: 0,
    escX: 100, escY: 100,
    maxCores: 8,
    tolerancia: 24,
    celulasExtraidas: null,
    paletaExtraida: [],
    mergesManuais: new Map() // hexOrig -> hexAlvo
  };

  // ==========================================================================
  // UTILITÁRIOS DE COR, COORDENADAS (RN01) E RLE COMPACTO
  // ==========================================================================

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function escapeHtml(txt) {
    return typeof BancoDadosPT !== "undefined"
      ? BancoDadosPT.escapeHtml(txt)
      : String(txt ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function mostrarToast(msg) {
    const el = document.getElementById("toast-graficos");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("visivel");
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("visivel"), 2600);
  }

  function carreiraParaY(carreira) {
    return clamp(estado.altura - carreira, 0, estado.altura - 1);
  }

  function yParaCarreira(y) {
    return clamp(estado.altura - y, 1, estado.altura);
  }

  function hexParaRgb(hex) {
    const clean = String(hex || "#ffffff").replace("#", "").trim();
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return [255, 255, 255];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function rgbParaHex(r, g, b) {
    const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function corContrasteTexto(hex) {
    const [r, g, b] = hexParaRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.56 ? "#0e172a" : "#ffffff";
  }

  function distanciaPerceptualRgb(rgbA, rgbB) {
    const dr = rgbA[0] - rgbB[0];
    const dg = rgbA[1] - rgbB[1];
    const db = rgbA[2] - rgbB[2];
    const rMean = (rgbA[0] + rgbB[0]) / 2;
    return Math.sqrt((((512 + rMean) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rMean) * db * db) >> 8));
  }

  function inferirHexFio(fio) {
    if (!fio) return null;
    const cod = String(fio.cor_codigo || "").trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(cod)) return cod.startsWith("#") ? cod.toLowerCase() : `#${cod.toLowerCase()}`;
    if (/^#?[0-9a-fA-F]{3}$/.test(cod)) {
      const c = cod.replace("#", "");
      return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase();
    }
    const nomeCor = `${fio.cor_nome || ""} ${fio.nome || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const [palavra, hex] of Object.entries(CORES_TEXTO_MAPA)) {
      if (nomeCor.includes(palavra)) return hex;
    }
    return null;
  }

  function sugerirFioMaisProximo(hexAlvo) {
    if (!fiosInventarioCache.length) return null;
    const rgbAlvo = hexParaRgb(hexAlvo);
    let melhor = null;
    let menorDist = Infinity;
    for (const fio of fiosInventarioCache) {
      const hexFio = inferirHexFio(fio);
      if (!hexFio) continue;
      const d = distanciaPerceptualRgb(rgbAlvo, hexParaRgb(hexFio));
      if (d < menorDist) {
        menorDist = d;
        melhor = { fio, hexFio, distancia: d };
      }
    }
    return melhor && melhor.distancia < 160 ? melhor : null;
  }

  // Codificação RLE compacta para persistência (suporta 200x200 em poucos KB)
  function codificarCelulasRle(arr) {
    if (!arr || arr.length === 0) return "";
    const partes = [];
    let atual = arr[0];
    let cont = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === atual) {
        cont++;
      } else {
        partes.push(cont > 1 ? `${atual}x${cont}` : `${atual}`);
        atual = arr[i];
        cont = 1;
      }
    }
    partes.push(cont > 1 ? `${atual}x${cont}` : `${atual}`);
    return partes.join(",");
  }

  function decodificarCelulasRle(str, totalEsperado) {
    const out = new Uint8Array(totalEsperado);
    if (!str || typeof str !== "string") return out;
    const tokens = str.split(",");
    let idx = 0;
    for (const tok of tokens) {
      if (idx >= totalEsperado) break;
      const p = tok.split("x");
      const val = parseInt(p[0], 10) || 0;
      const rep = p.length > 1 ? Math.max(1, parseInt(p[1], 10) || 1) : 1;
      const fim = Math.min(totalEsperado, idx + rep);
      out.fill(val, idx, fim);
      idx = fim;
    }
    return out;
  }

  function obterSentidoCarreira(carreiraNum) {
    // RF17: Plano (Ida e Volta) alterna D->E (ímpar) e E->D (par) para Destro; Canhoto inverte
    // Circular mantém sempre a mesma direção (D->E para Destro, E->D para Canhoto)
    const impar = carreiraNum % 2 === 1;
    let dirDE;
    if (estado.tipoTrabalho === "circular") {
      dirDE = estado.perfilMao !== "canhoto";
    } else {
      dirDE = estado.perfilMao === "canhoto" ? !impar : impar;
    }
    return dirDE
      ? { codigo: "DE", seta: "←", texto: "D → E", descricao: "Direita → Esquerda (D → E)" }
      : { codigo: "ED", seta: "→", texto: "E → D", descricao: "Esquerda → Direita (E → D)" };
  }

  function gerarBlocosCarreira(carreiraNum) {
    const y = carreiraParaY(carreiraNum);
    const sentido = obterSentidoCarreira(carreiraNum);
    const blocos = [];
    const passo = sentido.codigo === "DE" ? -1 : 1;
    const inicio = sentido.codigo === "DE" ? estado.largura - 1 : 0;
    const fim = sentido.codigo === "DE" ? -1 : estado.largura;

    let corAtual = -1;
    let cont = 0;
    for (let x = inicio; x !== fim; x += passo) {
      const idxCor = estado.celulas[y * estado.largura + x] || 0;
      if (idxCor === corAtual) {
        cont++;
      } else {
        if (cont > 0) blocos.push({ corIdx: corAtual, qtd: cont });
        corAtual = idxCor;
        cont = 1;
      }
    }
    if (cont > 0) blocos.push({ corIdx: corAtual, qtd: cont });
    return { sentido, blocos };
  }

  // ==========================================================================
  // HISTÓRICO UNDO / REDO (RF04) E REDIMENSIONAMENTO NÃO-DESTRUTIVO
  // ==========================================================================

  function empilharHistorico() {
    estado.undoStack.push({
      largura: estado.largura,
      altura: estado.altura,
      celulas: new Uint8Array(estado.celulas),
      paleta: estado.paleta.map((p) => ({ ...p }))
    });
    if (estado.undoStack.length > MAX_HISTORICO) estado.undoStack.shift();
    estado.redoStack = [];
    atualizarBotoesHistorico();
  }

  function desfazer() {
    if (!estado.undoStack.length) return;
    estado.redoStack.push({
      largura: estado.largura,
      altura: estado.altura,
      celulas: new Uint8Array(estado.celulas),
      paleta: estado.paleta.map((p) => ({ ...p }))
    });
    const snap = estado.undoStack.pop();
    estado.largura = snap.largura;
    estado.altura = snap.altura;
    estado.celulas = snap.celulas;
    estado.paleta = snap.paleta;
    estado.corAtivaIdx = clamp(estado.corAtivaIdx, 0, estado.paleta.length - 1);
    estado.carreiraAtual = clamp(estado.carreiraAtual, 1, estado.altura);
    estado.selecao = null;
    atualizarTudoAposEdicao();
  }

  function refazer() {
    if (!estado.redoStack.length) return;
    estado.undoStack.push({
      largura: estado.largura,
      altura: estado.altura,
      celulas: new Uint8Array(estado.celulas),
      paleta: estado.paleta.map((p) => ({ ...p }))
    });
    const snap = estado.redoStack.pop();
    estado.largura = snap.largura;
    estado.altura = snap.altura;
    estado.celulas = snap.celulas;
    estado.paleta = snap.paleta;
    estado.corAtivaIdx = clamp(estado.corAtivaIdx, 0, estado.paleta.length - 1);
    estado.carreiraAtual = clamp(estado.carreiraAtual, 1, estado.altura);
    estado.selecao = null;
    atualizarTudoAposEdicao();
  }

  function atualizarBotoesHistorico() {
    const u = document.getElementById("btn-graf-undo");
    const r = document.getElementById("btn-graf-redo");
    if (u) u.disabled = estado.undoStack.length === 0;
    if (r) r.disabled = estado.redoStack.length === 0;
  }

  function criarNovaGrade(novaLarg, novaAlt, novaProp = null, manterDesenho = false) {
    const w = clamp(parseInt(novaLarg, 10) || 24, MIN_DIM, MAX_DIM);
    const h = clamp(parseInt(novaAlt, 10) || 24, MIN_DIM, MAX_DIM);
    empilharHistorico();

    const novasCel = new Uint8Array(w * h);
    if (manterDesenho) {
      // Preserva a partir da base (Carreira 1 = fundo) e esquerda!
      const minW = Math.min(estado.largura, w);
      const minH = Math.min(estado.altura, h);
      for (let c = 1; c <= minH; c++) {
        const yAnt = estado.altura - c;
        const yNov = h - c;
        for (let x = 0; x < minW; x++) {
          novasCel[yNov * w + x] = estado.celulas[yAnt * estado.largura + x];
        }
      }
    }

    estado.largura = w;
    estado.altura = h;
    estado.celulas = novasCel;
    if (novaProp !== null && novaProp > 0.25 && novaProp < 4) {
      estado.proporcaoCelula = novaProp;
    }
    estado.carreiraAtual = clamp(estado.carreiraAtual, 1, h);
    estado.selecao = null;
    ajustarZoomNaTela();
    atualizarTudoAposEdicao();
  }

  // ==========================================================================
  // OPERAÇÕES DE DESENHO & GEOMETRIA EM GRADE (RF02, RF03)
  // ==========================================================================

  function pintarCelulaComSimetria(x, y, corIdx) {
    if (x < 0 || y < 0 || x >= estado.largura || y >= estado.altura) return;
    const pontos = [[x, y]];
    if (estado.simetriaH) pontos.push([estado.largura - 1 - x, y]);
    if (estado.simetriaV) pontos.push([x, estado.altura - 1 - y]);
    if (estado.simetriaH && estado.simetriaV) pontos.push([estado.largura - 1 - x, estado.altura - 1 - y]);

    for (const [px, py] of pontos) {
      estado.celulas[py * estado.largura + px] = corIdx;
    }
  }

  function pontosLinhaBresenham(x0, y0, x1, y1) {
    const pts = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;
    while (true) {
      pts.push({ x: cx, y: cy });
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
    return pts;
  }

  function pontosRetangulo(x0, y0, x1, y1, cheio) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const pts = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (cheio || x === minX || x === maxX || y === minY || y === maxY) {
          pts.push({ x, y });
        }
      }
    }
    return pts;
  }

  function pontosElipse(x0, y0, x1, y1, cheio) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = Math.max(0.5, (maxX - minX) / 2);
    const ry = Math.max(0.5, (maxY - minY) / 2);
    const pts = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const nx = (x - cx) / (rx + 0.35);
        const ny = (y - cy) / (ry + 0.35);
        const d = nx * nx + ny * ny;
        if (cheio) {
          if (d <= 1.0) pts.push({ x, y });
        } else {
          const inX = rx > 1 ? (x - cx) / Math.max(0.1, rx - 0.65) : 99;
          const inY = ry > 1 ? (y - cy) / Math.max(0.1, ry - 0.65) : 99;
          if (d <= 1.0 && inX * inX + inY * inY >= 0.88) pts.push({ x, y });
        }
      }
    }
    return pts;
  }

  function floodFill(startX, startY, novaCor) {
    const w = estado.largura;
    const h = estado.altura;
    if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;
    const alvo = estado.celulas[startY * w + startX];
    if (alvo === novaCor) return;

    const fila = [startY * w + startX];
    const visitado = new Uint8Array(w * h);
    visitado[fila[0]] = 1;

    while (fila.length > 0) {
      const idx = fila.pop();
      const x = idx % w;
      const y = (idx - x) / w;
      estado.celulas[idx] = novaCor;

      const vizinhos = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
      ];
      for (const [vx, vy] of vizinhos) {
        if (vx >= 0 && vy >= 0 && vx < w && vy < h) {
          const nIdx = vy * w + vx;
          if (!visitado[nIdx] && estado.celulas[nIdx] === alvo) {
            visitado[nIdx] = 1;
            fila.push(nIdx);
          }
        }
      }
    }
  }

  function normalizarSelecao(sel) {
    if (!sel) return null;
    return {
      x1: clamp(Math.min(sel.x1, sel.x2), 0, estado.largura - 1),
      y1: clamp(Math.min(sel.y1, sel.y2), 0, estado.altura - 1),
      x2: clamp(Math.max(sel.x1, sel.x2), 0, estado.largura - 1),
      y2: clamp(Math.max(sel.y1, sel.y2), 0, estado.altura - 1)
    };
  }

  function copiarSelecao() {
    const s = normalizarSelecao(estado.selecao);
    if (!s) {
      mostrarToast("Selecione uma região com a ferramenta ⬚ Seleção primeiro.");
      return;
    }
    const w = s.x2 - s.x1 + 1;
    const h = s.y2 - s.y1 + 1;
    const dados = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        dados[y * w + x] = estado.celulas[(s.y1 + y) * estado.largura + (s.x1 + x)];
      }
    }
    estado.clipboard = { w, h, dados };
    mostrarToast(`📋 Região ${w}×${h} copiada!`);
  }

  function colarSelecao() {
    if (!estado.clipboard) {
      mostrarToast("Nada copiado ainda.");
      return;
    }
    empilharHistorico();
    const s = normalizarSelecao(estado.selecao);
    const destX = s ? s.x1 : Math.max(0, Math.floor((estado.largura - estado.clipboard.w) / 2));
    const destY = s ? s.y1 : Math.max(0, Math.floor((estado.altura - estado.clipboard.h) / 2));
    const { w, h, dados } = estado.clipboard;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tx = destX + x;
        const ty = destY + y;
        if (tx >= 0 && ty >= 0 && tx < estado.largura && ty < estado.altura) {
          estado.celulas[ty * estado.largura + tx] = dados[y * w + x];
        }
      }
    }
    estado.selecao = {
      x1: destX,
      y1: destY,
      x2: Math.min(estado.largura - 1, destX + w - 1),
      y2: Math.min(estado.altura - 1, destY + h - 1)
    };
    atualizarTudoAposEdicao();
    mostrarToast("📌 Região colada! Arraste a seleção para reposicionar.");
  }

  function espelharRegiao(eixo) {
    empilharHistorico();
    const s = normalizarSelecao(estado.selecao) || { x1: 0, y1: 0, x2: estado.largura - 1, y2: estado.altura - 1 };
    const w = s.x2 - s.x1 + 1;
    const h = s.y2 - s.y1 + 1;
    const copia = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        copia[y * w + x] = estado.celulas[(s.y1 + y) * estado.largura + (s.x1 + x)];
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = eixo === "h" ? w - 1 - x : x;
        const sy = eixo === "v" ? h - 1 - y : y;
        estado.celulas[(s.y1 + y) * estado.largura + (s.x1 + x)] = copia[sy * w + sx];
      }
    }
    atualizarTudoAposEdicao();
    mostrarToast(eixo === "h" ? "↔ Espelhado horizontalmente!" : "↕ Espelhado verticalmente!");
  }

  // ==========================================================================
  // RENDERIZAÇÃO HTML5 CANVAS 60FPS (RNF01, RF05, RF18, RNF03)
  // ==========================================================================

  function obterMetricasCelula() {
    const cw = estado.cellBasePx * estado.zoom * estado.proporcaoCelula;
    const ch = estado.cellBasePx * estado.zoom;
    return { cw, ch };
  }

  function ajustarZoomNaTela() {
    const wrap = document.getElementById("graf-palco-wrap");
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dispW = Math.max(220, rect.width - 76);
    const dispH = Math.max(200, rect.height - 64);
    const zW = dispW / (estado.largura * estado.cellBasePx * estado.proporcaoCelula);
    const zH = dispH / (estado.altura * estado.cellBasePx);
    estado.zoom = clamp(Math.min(zW, zH, 2.2), 0.18, 4.0);

    const { cw, ch } = obterMetricasCelula();
    const gridW = estado.largura * cw;
    const gridH = estado.altura * ch;
    estado.panX = Math.max(38, Math.round((rect.width - gridW) / 2));
    estado.panY = Math.max(26, Math.round((rect.height - gridH) / 2));

    atualizarIndicadorZoom();
    solicitarRedesenho();
  }

  function atualizarIndicadorZoom() {
    const el = document.getElementById("graf-zoom-pct");
    if (el) el.textContent = `${Math.round(estado.zoom * 100)}%`;
  }

  function solicitarRedesenho() {
    precisaRedesenhar = true;
    if (rafId === null && typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (precisaRedesenhar) {
          precisaRedesenhar = false;
          renderizarCanvas();
        }
      });
    }
  }

  function renderizarCanvas() {
    const canvas = document.getElementById("canvas-editor-graficos");
    const wrap = document.getElementById("graf-palco-wrap");
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(rect.width * dpr);
    const targetH = Math.floor(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const { cw, ch } = obterMetricasCelula();
    const ox = estado.panX;
    const oy = estado.panY;
    const gridW = estado.largura * cw;
    const gridH = estado.altura * ch;

    // Culling de células visíveis (mantém 60fps mesmo em 200x200!)
    const startX = clamp(Math.floor(-ox / cw), 0, estado.largura - 1);
    const endX = clamp(Math.ceil((rect.width - ox) / cw), 0, estado.largura - 1);
    const startY = clamp(Math.floor(-oy / ch), 0, estado.altura - 1);
    const endY = clamp(Math.ceil((rect.height - oy) / ch), 0, estado.altura - 1);

    // 1. Pinta células visíveis
    for (let y = startY; y <= endY; y++) {
      const py = oy + y * ch;
      const baseRow = y * estado.largura;
      for (let x = startX; x <= endX; x++) {
        const corIdx = estado.celulas[baseRow + x] || 0;
        const itemPal = estado.paleta[corIdx] || estado.paleta[0];
        ctx.fillStyle = itemPal.hex;
        ctx.fillRect(ox + x * cw, py, cw + 0.4, ch + 0.4);
      }
    }

    // 2. Prévia ao vivo de forma (linha / retângulo / elipse)
    if (previaForma.length > 0 && estado.modo === "edicao") {
      const corPrev = estado.paleta[estado.corAtivaIdx]?.hex || "#1b2e5a";
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = corPrev;
      for (const p of previaForma) {
        const pts = [[p.x, p.y]];
        if (estado.simetriaH) pts.push([estado.largura - 1 - p.x, p.y]);
        if (estado.simetriaV) pts.push([p.x, estado.altura - 1 - p.y]);
        if (estado.simetriaH && estado.simetriaV) pts.push([estado.largura - 1 - p.x, estado.altura - 1 - p.y]);
        for (const [px, py] of pts) {
          if (px >= 0 && py >= 0 && px < estado.largura && py < estado.altura) {
            ctx.fillRect(ox + px * cw, oy + py * ch, cw, ch);
          }
        }
      }
      ctx.restore();
    }

    // 3. Símbolos de acessibilidade dentro das células (RF15 + RNF03)
    if (estado.mostrarSimbolos && cw >= 10 && ch >= 10) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = clamp(Math.floor(Math.min(cw, ch) * 0.56), 8, 22);
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      for (let y = startY; y <= endY; y++) {
        const py = oy + y * ch + ch / 2;
        const baseRow = y * estado.largura;
        for (let x = startX; x <= endX; x++) {
          const corIdx = estado.celulas[baseRow + x] || 0;
          const itemPal = estado.paleta[corIdx];
          if (!itemPal || !itemPal.simbolo) continue;
          ctx.fillStyle = corContrasteTexto(itemPal.hex);
          ctx.fillText(itemPal.simbolo, ox + x * cw + cw / 2, py + 0.5);
        }
      }
      ctx.restore();
    }

    // 4. Linhas da grade & divisórias a cada 5 ou 10 pontos (RF05)
    if (estado.mostrarGrade && cw >= 4 && ch >= 4) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(15, 25, 55, 0.24)";
      ctx.lineWidth = 1;
      for (let x = startX; x <= endX + 1; x++) {
        const px = Math.round(ox + x * cw) + 0.5;
        ctx.moveTo(px, oy + startY * ch);
        ctx.lineTo(px, oy + (endY + 1) * ch);
      }
      for (let y = startY; y <= endY + 1; y++) {
        const py = Math.round(oy + y * ch) + 0.5;
        ctx.moveTo(ox + startX * cw, py);
        ctx.lineTo(ox + (endX + 1) * cw, py);
      }
      ctx.stroke();

      if (estado.divisoriaCada > 0) {
        const passo = estado.divisoriaCada;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(15, 25, 55, 0.68)";
        ctx.lineWidth = 1.7;
        for (let x = 0; x <= estado.largura; x += passo) {
          if (x < startX || x > endX + 1) continue;
          const px = Math.round(ox + x * cw) + 0.5;
          ctx.moveTo(px, oy);
          ctx.lineTo(px, oy + gridH);
        }
        // Divisórias horizontais contadas a partir da base (Carreira 1 embaixo - RN01)
        for (let c = 0; c <= estado.altura; c += passo) {
          const y = estado.altura - c;
          if (y < startY || y > endY + 1) continue;
          const py = Math.round(oy + y * ch) + 0.5;
          ctx.moveTo(ox, py);
          ctx.lineTo(ox + gridW, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Eixos de simetria em tempo real (RF03)
    if (estado.modo === "edicao" && (estado.simetriaH || estado.simetriaV)) {
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      if (estado.simetriaH) {
        const mx = ox + gridW / 2;
        ctx.beginPath();
        ctx.moveTo(mx, oy - 6);
        ctx.lineTo(mx, oy + gridH + 6);
        ctx.stroke();
      }
      if (estado.simetriaV) {
        const my = oy + gridH / 2;
        ctx.beginPath();
        ctx.moveTo(ox - 6, my);
        ctx.lineTo(ox + gridW + 6, my);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Modo Execução: destaque de carreira ativa, esmaecimento e seta de direção (RF18 + RNF03)
    if (estado.modo === "execucao") {
      const activeY = carreiraParaY(estado.carreiraAtual);
      const activeTop = oy + activeY * ch;
      const activeBottom = activeTop + ch;

      ctx.save();
      // Carreiras futuras (acima da ativa)
      if (activeY > 0) {
        ctx.fillStyle = estado.altoContraste ? "rgba(0, 0, 0, 0.72)" : "rgba(6, 13, 38, 0.52)";
        ctx.fillRect(ox, oy, gridW, activeTop - oy);
      }
      // Carreiras concluídas (abaixo da ativa)
      if (activeY < estado.altura - 1) {
        ctx.fillStyle = estado.altoContraste ? "rgba(0, 0, 0, 0.55)" : "rgba(6, 13, 38, 0.34)";
        ctx.fillRect(ox, activeBottom, gridW, oy + gridH - activeBottom);
      }

      // Moldura brilhante na carreira ativa
      ctx.strokeStyle = estado.altoContraste ? "#ffff00" : "#5b87e8";
      ctx.lineWidth = estado.altoContraste ? 3.5 : 2.6;
      ctx.strokeRect(ox - 1, activeTop, gridW + 2, ch);

      // Seta de direção na lateral de início da carreira
      const sentido = obterSentidoCarreira(estado.carreiraAtual);
      const badgeW = 28;
      const badgeH = Math.max(20, Math.min(28, ch));
      const bx = sentido.codigo === "DE" ? ox + gridW + 8 : ox - badgeW - 8;
      const by = activeTop + (ch - badgeH) / 2;
      ctx.fillStyle = estado.altoContraste ? "#ffff00" : "#2c4a91";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, badgeW, badgeH, 6) : ctx.rect(bx, by, badgeW, badgeH);
      ctx.fill();
      ctx.fillStyle = estado.altoContraste ? "#000000" : "#ffffff";
      ctx.font = "900 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sentido.seta, bx + badgeW / 2, by + badgeH / 2 + 0.5);
      ctx.restore();
    }

    // 6. Retângulo de seleção ativa (RF03)
    const sel = normalizarSelecao(estado.selecao);
    if (sel && estado.modo === "edicao") {
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        ox + sel.x1 * cw,
        oy + sel.y1 * ch,
        (sel.x2 - sel.x1 + 1) * cw,
        (sel.y2 - sel.y1 + 1) * ch
      );
      ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
      ctx.fillRect(
        ox + sel.x1 * cw,
        oy + sel.y1 * ch,
        (sel.x2 - sel.x1 + 1) * cw,
        (sel.y2 - sel.y1 + 1) * ch
      );
      ctx.restore();
    }

    // 7. Moldura externa + Numeração de Carreiras (1 embaixo -> cima, RN01) e Colunas (RF05)
    ctx.save();
    ctx.strokeStyle = "rgba(252, 241, 208, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, gridW, gridH);

    const temaClaro = document.documentElement.getAttribute("data-tema") === "claro";
    ctx.fillStyle = temaClaro ? "#16264d" : "rgba(252, 241, 208, 0.85)";
    const passoNumY = ch < 12 ? 5 : ch < 18 ? 2 : 1;
    const passoNumX = cw < 14 ? 5 : cw < 20 ? 2 : 1;
    ctx.font = "700 10.5px system-ui, sans-serif";
    ctx.textBaseline = "middle";

    // Numeração de carreiras (esquerda) — Carreira 1 na base!
    ctx.textAlign = "right";
    for (let y = startY; y <= endY; y++) {
      const carr = yParaCarreira(y);
      if (carr === 1 || carr === estado.altura || carr % passoNumY === 0 || (estado.modo === "execucao" && carr === estado.carreiraAtual)) {
        const isAtiva = estado.modo === "execucao" && carr === estado.carreiraAtual;
        ctx.fillStyle = isAtiva ? (estado.altoContraste ? "#ffff00" : "#7aa2f7") : temaClaro ? "#16264d" : "rgba(252, 241, 208, 0.8)";
        ctx.fillText(String(carr), ox - 6, oy + y * ch + ch / 2);
      }
    }

    // Numeração de colunas (embaixo)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = temaClaro ? "#16264d" : "rgba(252, 241, 208, 0.8)";
    for (let x = startX; x <= endX; x++) {
      const col = x + 1;
      if (col === 1 || col === estado.largura || col % passoNumX === 0) {
        ctx.fillText(String(col), ox + x * cw + cw / 2, oy + gridH + 5);
      }
    }
    ctx.restore();
  }

  function clientParaCelula(clientX, clientY) {
    const canvas = document.getElementById("canvas-editor-graficos");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { cw, ch } = obterMetricasCelula();
    const x = Math.floor((clientX - rect.left - estado.panX) / cw);
    const y = Math.floor((clientY - rect.top - estado.panY) / ch);
    if (x < 0 || y < 0 || x >= estado.largura || y >= estado.altura) return null;
    return { x, y };
  }

  // ==========================================================================
  // PALETA DE CORES, CONTAGEM DE PONTOS & INTEGRAÇÃO COM FIOS (RF12-RF15, RN03)
  // ==========================================================================

  async function carregarFiosInventario() {
    if (typeof BancoDadosPT === "undefined") return;
    try {
      fiosInventarioCache = (await BancoDadosPT.obterTodos("fios")) || [];
    } catch {
      fiosInventarioCache = [];
    }
  }

  function contarPontosPorCor() {
    const cont = new Int32Array(estado.paleta.length);
    for (let i = 0; i < estado.celulas.length; i++) {
      const idx = estado.celulas[i];
      if (idx < cont.length) cont[idx]++;
    }
    return cont;
  }

  function renderizarPaletaUI() {
    const lista = document.getElementById("graf-lista-paleta");
    const resumo = document.getElementById("graf-total-pontos-resumo");
    const dimBadge = document.getElementById("graf-dim-badge");
    if (dimBadge) dimBadge.textContent = `${estado.largura} × ${estado.altura}`;
    if (resumo) resumo.textContent = `${(estado.largura * estado.altura).toLocaleString("pt-BR")} pts`;
    if (!lista) return;

    const contagens = contarPontosPorCor();
    lista.innerHTML = "";
    const frag = document.createDocumentFragment();

    estado.paleta.forEach((cor, idx) => {
      const item = document.createElement("div");
      item.className = `graf-item-paleta${idx === estado.corAtivaIdx ? " ativa" : ""}`;
      const qtd = contagens[idx] || 0;

      // RN03: verifica se fio vinculado ainda existe; se foi removido, preserva nome/hex em cache
      const fioExiste = cor.fio_id ? fiosInventarioCache.some((f) => Number(f.id) === Number(cor.fio_id)) : false;
      let subLinha = idx === 0 ? "Cor de fundo" : cor.hex.toUpperCase();
      if (cor.fio_id) {
        const infoFio = [cor.fio_marca, cor.fio_cor_codigo ? `Cód. ${cor.fio_cor_codigo}` : ""].filter(Boolean).join(" · ");
        subLinha = fioExiste
          ? `🧶 ${infoFio || "Fio do estoque"}`
          : `🧶 ${infoFio || "Fio"} (em cache)`;
      }

      item.innerHTML = `
        <button type="button" class="graf-swatch-btn" style="background:${escapeHtml(cor.hex)};color:${corContrasteTexto(cor.hex)}" title="Selecionar cor ${escapeHtml(cor.nome)}">
          ${escapeHtml(cor.simbolo || "")}
        </button>
        <div class="graf-paleta-info">
          <strong>${escapeHtml(cor.nome)}</strong>
          <span>${escapeHtml(subLinha)}</span>
        </div>
        <span class="graf-paleta-qtd" title="Total de pontos desta cor">${qtd}</span>
        <button type="button" class="btn-graf-edit-cor" title="Editar cor, símbolo ou vincular fio">✎</button>
      `;

      item.addEventListener("click", (e) => {
        if (e.target.closest(".btn-graf-edit-cor")) return;
        estado.corAtivaIdx = idx;
        if (estado.ferramenta === "borracha" || estado.ferramenta === "pan" || estado.ferramenta === "contagotas") {
          selecionarFerramenta("pincel");
        }
        renderizarPaletaUI();
      });

      item.querySelector(".btn-graf-edit-cor")?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirModalEditarCor(idx);
      });

      frag.appendChild(item);
    });

    lista.appendChild(frag);
  }

  async function abrirModalEditarCor(idx = -1, focarFio = false) {
    await carregarFiosInventario();
    const modal = document.getElementById("modal-graf-editar-cor");
    const selFio = document.getElementById("select-graf-fio-inv");
    const inpIdx = document.getElementById("graf-cor-edit-idx");
    const inpPicker = document.getElementById("input-graf-cor-picker");
    const inpHex = document.getElementById("input-graf-cor-hex");
    const inpSim = document.getElementById("input-graf-cor-simbolo");
    const inpNome = document.getElementById("input-graf-cor-nome");
    const btnRem = document.getElementById("btn-graf-remover-cor");
    if (!modal || !selFio) return;

    selFio.innerHTML = `<option value="">Cor manual (sem vínculo de estoque)</option>`;
    fiosInventarioCache.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = String(f.id);
      opt.textContent = `${f.nome} — ${f.cor_nome || "Sem cor"} (${f.marca || "Sem marca"})${f.cor_codigo ? ` [${f.cor_codigo}]` : ""}`;
      selFio.appendChild(opt);
    });

    const editando = idx >= 0 && idx < estado.paleta.length;
    inpIdx.value = editando ? String(idx) : "-1";
    const cor = editando
      ? estado.paleta[idx]
      : {
          hex: "#3b82f6",
          nome: `Cor ${estado.paleta.length}`,
          simbolo: SIMBOLOS_PADRAO[estado.paleta.length % SIMBOLOS_PADRAO.length] || "•",
          fio_id: null
        };

    inpPicker.value = cor.hex;
    inpHex.value = cor.hex;
    inpSim.value = cor.simbolo || "";
    inpNome.value = cor.nome || "";
    selFio.value = cor.fio_id ? String(cor.fio_id) : "";
    if (btnRem) btnRem.style.display = editando && idx > 0 ? "inline-flex" : "none";

    modal.style.display = "flex";
    if (focarFio) selFio.focus();
  }

  function salvarEdicaoCorModal() {
    const idx = parseInt(document.getElementById("graf-cor-edit-idx")?.value, 10);
    const hexRaw = (document.getElementById("input-graf-cor-hex")?.value || "#1b2e5a").trim();
    const hex = /^#[0-9a-fA-F]{6}$/.test(hexRaw) ? hexRaw.toLowerCase() : (document.getElementById("input-graf-cor-picker")?.value || "#1b2e5a");
    const nome = (document.getElementById("input-graf-cor-nome")?.value || "").trim() || hex.toUpperCase();
    const simbolo = (document.getElementById("input-graf-cor-simbolo")?.value || "").trim().slice(0, 2);
    const fioIdStr = document.getElementById("select-graf-fio-inv")?.value || "";
    const fio = fioIdStr ? fiosInventarioCache.find((f) => String(f.id) === fioIdStr) : null;

    empilharHistorico();
    const novoObj = {
      hex,
      nome,
      simbolo,
      fio_id: fio ? fio.id : null,
      fio_marca: fio ? fio.marca || "" : "",
      fio_cor_codigo: fio ? fio.cor_codigo || "" : ""
    };

    if (idx >= 0 && idx < estado.paleta.length) {
      estado.paleta[idx] = novoObj; // RF14: substituição global instantânea!
      estado.corAtivaIdx = idx;
      mostrarToast(`🎨 Cor "${nome}" atualizada em toda a grade!`);
    } else {
      if (estado.paleta.length >= 64) {
        mostrarToast("Limite de 64 cores atingido.");
        return;
      }
      estado.paleta.push(novoObj);
      estado.corAtivaIdx = estado.paleta.length - 1;
      mostrarToast(`✓ Cor "${nome}" adicionada à paleta!`);
    }

    document.getElementById("modal-graf-editar-cor").style.display = "none";
    atualizarTudoAposEdicao();
  }

  function removerCorAtualModal() {
    const idx = parseInt(document.getElementById("graf-cor-edit-idx")?.value, 10);
    if (!(idx > 0 && idx < estado.paleta.length)) return;
    empilharHistorico();
    for (let i = 0; i < estado.celulas.length; i++) {
      if (estado.celulas[i] === idx) estado.celulas[i] = 0;
      else if (estado.celulas[i] > idx) estado.celulas[i]--;
    }
    estado.paleta.splice(idx, 1);
    estado.corAtivaIdx = clamp(estado.corAtivaIdx, 0, estado.paleta.length - 1);
    document.getElementById("modal-graf-editar-cor").style.display = "none";
    atualizarTudoAposEdicao();
    mostrarToast("Cor removida da paleta (células retornaram ao fundo).");
  }

  // ==========================================================================
  // MODO EXECUÇÃO & SINCRONIZAÇÃO BIDIRECIONAL COM CONTADOR (RF16-RF20)
  // ==========================================================================

  function definirModo(novoModo) {
    estado.modo = novoModo === "execucao" ? "execucao" : "edicao";
    const emExec = estado.modo === "execucao";

    document.getElementById("btn-graf-modo-edicao")?.classList.toggle("ativo", !emExec);
    document.getElementById("btn-graf-modo-execucao")?.classList.toggle("ativo", emExec);
    document.getElementById("btn-graf-modo-edicao")?.setAttribute("aria-selected", !emExec ? "true" : "false");
    document.getElementById("btn-graf-modo-execucao")?.setAttribute("aria-selected", emExec ? "true" : "false");

    const barraFerr = document.getElementById("graf-barra-ferramentas");
    const resizeMini = document.getElementById("graf-resize-mini");
    const barraCfgExec = document.getElementById("graf-barra-config-exec");
    const barraExec = document.getElementById("graf-barra-execucao");
    const layout = document.getElementById("layout-editor-graficos");

    if (barraFerr) barraFerr.style.display = emExec ? "none" : "flex";
    if (resizeMini) resizeMini.style.display = emExec ? "none" : "inline-flex";
    if (barraCfgExec) barraCfgExec.style.display = emExec ? "flex" : "none";
    if (barraExec) barraExec.style.display = emExec ? "flex" : "none";
    if (layout) layout.classList.toggle("modo-execucao-ativo", emExec);

    if (emExec) {
      estado.selecao = null;
      atualizarBarraExecucao();
    }
    setTimeout(ajustarZoomNaTela, 30);
    agendarAutosave();
  }

  function definirCarreiraAtual(novaCarreira, { sincronizarComContador = true, limparBlocos = true } = {}) {
    const alvo = clamp(parseInt(novaCarreira, 10) || 1, 1, estado.altura);
    if (alvo !== estado.carreiraAtual && limparBlocos) {
      estado.blocosMarcados.clear();
    }
    estado.carreiraAtual = alvo;
    atualizarBarraExecucao();
    solicitarRedesenho();

    if (sincronizarComContador && estado.syncContador && !sincronizandoContador) {
      sincronizandoContador = true;
      try {
        if (typeof ContadorCarreiras !== "undefined" && typeof ContadorCarreiras.definirCarreiraPrincipal === "function") {
          ContadorCarreiras.definirCarreiraPrincipal(alvo, "editor-graficos");
        }
      } finally {
        sincronizandoContador = false;
      }
    }
    agendarAutosave();
  }

  function atualizarBarraExecucao() {
    const tit = document.getElementById("graf-exec-titulo");
    const dirEl = document.getElementById("graf-exec-direcao");
    const blocosEl = document.getElementById("graf-exec-blocos");
    const btnAnt = document.getElementById("btn-graf-exec-ant");
    const btnProx = document.getElementById("btn-graf-exec-prox");
    if (!tit || !blocosEl) return;

    const { sentido, blocos } = gerarBlocosCarreira(estado.carreiraAtual);
    tit.textContent = `Carreira ${estado.carreiraAtual} / ${estado.altura}`;
    if (dirEl) dirEl.textContent = `${sentido.seta} ${sentido.descricao}`;
    if (btnAnt) btnAnt.disabled = estado.carreiraAtual <= 1;
    if (btnProx) btnProx.disabled = estado.carreiraAtual >= estado.altura;

    blocosEl.innerHTML = "";
    blocos.forEach((b, idx) => {
      const cor = estado.paleta[b.corIdx] || estado.paleta[0];
      const feito = estado.blocosMarcados.has(idx);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `graf-bloco-chip${feito ? " feito" : ""}`;
      chip.innerHTML = `
        <span class="graf-bloco-dot" style="background:${escapeHtml(cor.hex)};color:${corContrasteTexto(cor.hex)}">${escapeHtml(cor.simbolo || "")}</span>
        <strong>${b.qtd}</strong>
        <span>${escapeHtml(cor.nome)}</span>
        ${feito ? '<span class="graf-bloco-check">✓</span>' : ""}
      `;
      chip.addEventListener("click", () => {
        if (estado.blocosMarcados.has(idx)) estado.blocosMarcados.delete(idx);
        else estado.blocosMarcados.add(idx);
        if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(10);
        atualizarBarraExecucao();
      });
      blocosEl.appendChild(chip);
    });
  }

  // ==========================================================================
  // IMPORTADOR DE IMAGENS (PIXEL ART QUADRICULADA + FOTO) (RF06-RF11, RN02)
  // ==========================================================================

  function detectarGradeAutomatica(img, cropL, cropR, cropT, cropB) {
    const tmp = document.createElement("canvas");
    const maxSide = 600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    tmp.width = Math.max(20, Math.round(img.width * scale));
    tmp.height = Math.max(20, Math.round(img.height * scale));
    const ctx = tmp.getContext("2d");
    ctx.drawImage(img, 0, 0, tmp.width, tmp.height);

    const x0 = Math.floor((cropL / 100) * tmp.width);
    const x1 = Math.ceil((1 - cropR / 100) * tmp.width);
    const y0 = Math.floor((cropT / 100) * tmp.height);
    const y1 = Math.ceil((1 - cropB / 100) * tmp.height);
    const cw = Math.max(10, x1 - x0);
    const ch = Math.max(10, y1 - y0);

    const data = ctx.getImageData(x0, y0, cw, ch).data;
    const lum = (x, y) => {
      const i = (y * cw + x) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    // Perfil de energia de bordas verticais (para colunas) e horizontais (para linhas)
    const projX = new Float32Array(cw);
    const projY = new Float32Array(ch);
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        projX[x] += Math.abs(lum(x + 1, y) - lum(x - 1, y));
        projY[y] += Math.abs(lum(x, y + 1) - lum(x, y - 1));
      }
    }

    const estimarContagem = (perfil, len) => {
      let melhorPeriodo = 0;
      let melhorScore = -1;
      const minP = Math.max(3, Math.floor(len / 120));
      const maxP = Math.min(Math.floor(len / 5), 60);
      for (let p = minP; p <= maxP; p++) {
        let corr = 0;
        let n = 0;
        for (let i = 0; i < len - p; i++) {
          corr += perfil[i] * perfil[i + p];
          n++;
        }
        const score = n > 0 ? corr / n : 0;
        if (score > melhorScore) {
          melhorScore = score;
          melhorPeriodo = p;
        }
      }
      if (melhorPeriodo <= 0) return 32;
      return clamp(Math.round(len / melhorPeriodo), MIN_DIM, MAX_DIM);
    };

    return {
      cols: estimarContagem(projX, cw),
      rows: estimarContagem(projY, ch)
    };
  }

  function extrairGradeDaImagem() {
    if (!impEstado.imagem) return;
    const img = impEstado.imagem;
    const cols = clamp(parseInt(impEstado.cols, 10) || 32, MIN_DIM, MAX_DIM);
    const rows = clamp(parseInt(impEstado.rows, 10) || 32, MIN_DIM, MAX_DIM);

    // Canvas fonte em resolução controlada
    const srcCanvas = document.createElement("canvas");
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const sw = Math.max(20, Math.round(img.width * scale));
    const sh = Math.max(20, Math.round(img.height * scale));
    srcCanvas.width = sw;
    srcCanvas.height = sh;
    const sctx = srcCanvas.getContext("2d");
    sctx.drawImage(img, 0, 0, sw, sh);
    const imgData = sctx.getImageData(0, 0, sw, sh).data;

    // Retângulo útil após Crop + Offset + Escala (RF07, RF08)
    const cropX = (impEstado.cropL / 100) * sw;
    const cropY = (impEstado.cropT / 100) * sh;
    const cropW = Math.max(10, sw * (1 - (impEstado.cropL + impEstado.cropR) / 100));
    const cropH = Math.max(10, sh * (1 - (impEstado.cropT + impEstado.cropB) / 100));

    const gridW = cropW * (impEstado.escX / 100);
    const gridH = cropH * (impEstado.escY / 100);
    const startX = cropX + impEstado.offX;
    const startY = cropY + impEstado.offY;
    const cellW = gridW / cols;
    const cellH = gridH / rows;

    // RN02: No modo Pixel Art Quadriculada, amostrar APENAS os 45% centrais de cada célula!
    // (margem 27.5% de cada lado -> intervalo [27.5% .. 72.5%] = 45% central)
    const margem = impEstado.modo === "quadriculada" ? 0.275 : 0.1;
    const amostrasRgb = new Array(cols * rows);

    for (let r = 0; r < rows; r++) {
      const cy0 = startY + (r + margem) * cellH;
      const cy1 = startY + (r + 1 - margem) * cellH;
      const py0 = clamp(Math.floor(cy0), 0, sh - 1);
      const py1 = clamp(Math.max(py0 + 1, Math.ceil(cy1)), 1, sh);

      for (let c = 0; c < cols; c++) {
        const cx0 = startX + (c + margem) * cellW;
        const cx1 = startX + (c + 1 - margem) * cellW;
        const px0 = clamp(Math.floor(cx0), 0, sw - 1);
        const px1 = clamp(Math.max(px0 + 1, Math.ceil(cx1)), 1, sw);

        let sr = 0, sg = 0, sb = 0, cnt = 0;
        const stepX = Math.max(1, Math.floor((px1 - px0) / 8));
        const stepY = Math.max(1, Math.floor((py1 - py0) / 8));
        for (let py = py0; py < py1; py += stepY) {
          const rowOff = py * sw * 4;
          for (let px = px0; px < px1; px += stepX) {
            const p = rowOff + px * 4;
            sr += imgData[p];
            sg += imgData[p + 1];
            sb += imgData[p + 2];
            cnt++;
          }
        }
        amostrasRgb[r * cols + c] = cnt > 0 ? [Math.round(sr / cnt), Math.round(sg / cnt), Math.round(sb / cnt)] : [255, 255, 255];
      }
    }

    // RF10: Agrupamento / Limpeza de cores parecidas + Limite máximo de cores
    const tol = Number(impEstado.tolerancia) || 0;
    const maxCores = clamp(parseInt(impEstado.maxCores, 10) || 8, 2, 24);
    const grupos = []; // { rSum, gSum, bSum, count, rgb }

    for (let i = 0; i < amostrasRgb.length; i++) {
      const rgb = amostrasRgb[i];
      let melhorIdx = -1;
      let menorDist = Infinity;
      for (let g = 0; g < grupos.length; g++) {
        const d = distanciaPerceptualRgb(rgb, grupos[g].rgb);
        if (d < menorDist) {
          menorDist = d;
          melhorIdx = g;
        }
      }
      if (melhorIdx !== -1 && menorDist <= tol * 2.2) {
        const gr = grupos[melhorIdx];
        gr.rSum += rgb[0];
        gr.gSum += rgb[1];
        gr.bSum += rgb[2];
        gr.count++;
        gr.rgb = [gr.rSum / gr.count, gr.gSum / gr.count, gr.bSum / gr.count];
      } else {
        grupos.push({ rSum: rgb[0], gSum: rgb[1], bSum: rgb[2], count: 1, rgb: [...rgb] });
      }
    }

    // Reduz até maxCores mesclando o par mais próximo (ponderado pela frequência)
    while (grupos.length > maxCores) {
      let bestA = 0, bestB = 1, bestScore = Infinity;
      for (let a = 0; a < grupos.length; a++) {
        for (let b = a + 1; b < grupos.length; b++) {
          const dist = distanciaPerceptualRgb(grupos[a].rgb, grupos[b].rgb);
          const peso = Math.min(grupos[a].count, grupos[b].count);
          const score = dist * (1 + Math.log1p(peso) * 0.15);
          if (score < bestScore) {
            bestScore = score;
            bestA = a;
            bestB = b;
          }
        }
      }
      const ga = grupos[bestA];
      const gb = grupos[bestB];
      ga.rSum += gb.rSum;
      ga.gSum += gb.gSum;
      ga.bSum += gb.bSum;
      ga.count += gb.count;
      ga.rgb = [ga.rSum / ga.count, ga.gSum / ga.count, ga.bSum / ga.count];
      grupos.splice(bestB, 1);
    }

    // Ordena por maior frequência (índice 0 = cor predominante de fundo)
    grupos.sort((a, b) => b.count - a.count);

    // Aplica merges manuais feitos pelo usuário na lista de cores (RF10)
    const paletaBase = grupos.map((g, i) => {
      const hex = rgbParaHex(g.rgb[0], g.rgb[1], g.rgb[2]);
      const sug = sugerirFioMaisProximo(hex);
      return {
        hex,
        rgb: g.rgb,
        nome: sug ? `${sug.fio.nome} (${sug.fio.cor_nome || ""})` : i === 0 ? "Fundo" : `Cor ${i}`,
        simbolo: SIMBOLOS_PADRAO[i % SIMBOLOS_PADRAO.length] || "",
        fio_id: sug ? sug.fio.id : null,
        fio_marca: sug ? sug.fio.marca || "" : "",
        fio_cor_codigo: sug ? sug.fio.cor_codigo || "" : "",
        sugestaoFio: sug ? sug.fio : null
      };
    });

    // Filtra cores que o usuário mesclou manualmente
    const paletaAtiva = paletaBase.filter((c) => !impEstado.mergesManuais.has(c.hex));
    const paletaFinal = paletaAtiva.length > 0 ? paletaAtiva : paletaBase.slice(0, 1);

    const celulasOut = new Uint8Array(cols * rows);
    for (let i = 0; i < amostrasRgb.length; i++) {
      const rgb = amostrasRgb[i];
      let best = 0;
      let bestD = Infinity;
      for (let p = 0; p < paletaFinal.length; p++) {
        const d = distanciaPerceptualRgb(rgb, paletaFinal[p].rgb);
        if (d < bestD) { bestD = d; best = p; }
      }
      celulasOut[i] = best;
    }

    impEstado.celulasExtraidas = celulasOut;
    impEstado.paletaExtraida = paletaFinal;

    desenharPreviasImportador(srcCanvas, cropX, cropY, cropW, cropH, startX, startY, gridW, gridH, cols, rows);
    renderizarListaCoresImportador(celulasOut, paletaFinal);
  }

  function desenharPreviasImportador(srcCanvas, cropX, cropY, cropW, cropH, startX, startY, gridW, gridH, cols, rows) {
    // 1. Canvas de Calibração (Imagem original + máscara de Crop + Grid Overlay)
    const cCal = document.getElementById("canvas-graf-imp-calibrar");
    if (cCal) {
      const maxW = 460;
      const maxH = 340;
      const ratio = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height, 1);
      const dw = Math.round(srcCanvas.width * ratio);
      const dh = Math.round(srcCanvas.height * ratio);
      cCal.width = dw;
      cCal.height = dh;
      const ctx = cCal.getContext("2d");
      ctx.drawImage(srcCanvas, 0, 0, dw, dh);

      // Escurece área fora do recorte (Crop RF07)
      ctx.fillStyle = "rgba(1, 7, 54, 0.58)";
      const rx = cropX * ratio, ry = cropY * ratio, rw = cropW * ratio, rh = cropH * ratio;
      ctx.fillRect(0, 0, dw, ry);
      ctx.fillRect(0, ry + rh, dw, dh - (ry + rh));
      ctx.fillRect(0, ry, rx, rh);
      ctx.fillRect(rx + rw, ry, dw - (rx + rw), rh);

      // Malha virtual sobreposta (Grid Overlay RF08)
      const gx = startX * ratio, gy = startY * ratio, gw = gridW * ratio, gh = gridH * ratio;
      const cw = gw / cols, ch = gh / rows;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const px = gx + c * cw;
        ctx.moveTo(px, gy);
        ctx.lineTo(px, gy + gh);
      }
      for (let r = 0; r <= rows; r++) {
        const py = gy + r * ch;
        ctx.moveTo(gx, py);
        ctx.lineTo(gx + gw, py);
      }
      ctx.stroke();

      // Borda da área útil
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
    }

    // 2. Canvas da Grade Extraída (Prévia em tempo real RF10)
    const cRes = document.getElementById("canvas-graf-imp-resultado");
    if (cRes && impEstado.celulasExtraidas) {
      const maxW = 460;
      const maxH = 340;
      const cellPx = Math.max(2, Math.floor(Math.min(maxW / cols, maxH / rows)));
      cRes.width = cols * cellPx;
      cRes.height = rows * cellPx;
      const ctx = cRes.getContext("2d");
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pIdx = impEstado.celulasExtraidas[r * cols + c] || 0;
          ctx.fillStyle = impEstado.paletaExtraida[pIdx]?.hex || "#ffffff";
          ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
        }
      }
      if (cellPx >= 5) {
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) { ctx.moveTo(c * cellPx, 0); ctx.lineTo(c * cellPx, rows * cellPx); }
        for (let r = 0; r <= rows; r++) { ctx.moveTo(0, r * cellPx); ctx.lineTo(cols * cellPx, r * cellPx); }
        ctx.stroke();
      }
    }
  }

  function renderizarListaCoresImportador(celulas, paleta) {
    const lista = document.getElementById("graf-imp-cores-lista");
    if (!lista) return;
    const cont = new Int32Array(paleta.length);
    for (let i = 0; i < celulas.length; i++) cont[celulas[i]]++;

    lista.innerHTML = "";
    paleta.forEach((cor, idx) => {
      const row = document.createElement("div");
      row.className = "graf-imp-cor-row";
      const sugTxt = cor.sugestaoFio ? `🧶 Sugestão: ${cor.sugestaoFio.nome}` : cor.hex.toUpperCase();
      row.innerHTML = `
        <span class="graf-imp-swatch" style="background:${escapeHtml(cor.hex)}"></span>
        <div class="graf-imp-cor-txt">
          <strong>${escapeHtml(cor.nome)} (${cont[idx]} pts)</strong>
          <small>${escapeHtml(sugTxt)}</small>
        </div>
        ${paleta.length > 2 ? '<button type="button" class="btn-graf-mini btn-imp-mesclar-cor" title="Mesclar esta cor com a tonalidade mais próxima">Mesclar</button>' : ""}
      `;
      row.querySelector(".btn-imp-mesclar-cor")?.addEventListener("click", () => {
        impEstado.mergesManuais.set(cor.hex, true);
        extrairGradeDaImagem();
      });
      lista.appendChild(row);
    });
  }

  function confirmarImportacaoParaEditor() {
    if (!impEstado.celulasExtraidas || !impEstado.paletaExtraida.length) return;
    empilharHistorico();
    estado.largura = clamp(parseInt(impEstado.cols, 10) || 32, MIN_DIM, MAX_DIM);
    estado.altura = clamp(parseInt(impEstado.rows, 10) || 32, MIN_DIM, MAX_DIM);
    estado.celulas = new Uint8Array(impEstado.celulasExtraidas);
    estado.paleta = impEstado.paletaExtraida.map((c, i) => ({
      hex: c.hex,
      nome: c.nome,
      simbolo: c.simbolo || SIMBOLOS_PADRAO[i % SIMBOLOS_PADRAO.length] || "",
      fio_id: c.fio_id || null,
      fio_marca: c.fio_marca || "",
      fio_cor_codigo: c.fio_cor_codigo || ""
    }));
    estado.corAtivaIdx = Math.min(1, estado.paleta.length - 1);
    estado.carreiraAtual = 1;
    estado.selecao = null;

    document.getElementById("modal-graf-importar-img").style.display = "none";
    definirModo("edicao");
    ajustarZoomNaTela();
    atualizarTudoAposEdicao();
    mostrarToast(`✓ Imagem convertida (${estado.largura}×${estado.altura}, ${estado.paleta.length} cores) e pronta para editar!`);
  }

  // ==========================================================================
  // PERSISTÊNCIA, AUTOSAVE (RNF04) E SALVAMENTO EM PROJETO (RF21)
  // ==========================================================================

  function serializarEstadoGrafico() {
    return {
      versao: 1,
      nome: estado.nome,
      largura: estado.largura,
      altura: estado.altura,
      proporcaoCelula: estado.proporcaoCelula,
      celulasRle: codificarCelulasRle(estado.celulas),
      paleta: estado.paleta.map((c) => ({ ...c })),
      tipoTrabalho: estado.tipoTrabalho,
      perfilMao: estado.perfilMao,
      divisoriaCada: estado.divisoriaCada,
      mostrarSimbolos: estado.mostrarSimbolos,
      carreiraAtual: estado.carreiraAtual,
      atualizado_em: new Date().toISOString()
    };
  }

  function restaurarEstadoGrafico(obj) {
    if (!obj || typeof obj !== "object" || !obj.largura || !obj.altura) return false;
    const w = clamp(parseInt(obj.largura, 10) || 24, MIN_DIM, MAX_DIM);
    const h = clamp(parseInt(obj.altura, 10) || 24, MIN_DIM, MAX_DIM);
    estado.nome = String(obj.nome || "Meu Gráfico");
    estado.largura = w;
    estado.altura = h;
    estado.proporcaoCelula = Number(obj.proporcaoCelula) > 0.25 ? Number(obj.proporcaoCelula) : 1;
    estado.celulas = decodificarCelulasRle(obj.celulasRle || "", w * h);
    if (Array.isArray(obj.paleta) && obj.paleta.length > 0) {
      estado.paleta = obj.paleta.map((c, i) => ({
        hex: c.hex || "#ffffff",
        nome: c.nome || `Cor ${i}`,
        simbolo: c.simbolo || "",
        fio_id: c.fio_id ?? null,
        fio_marca: c.fio_marca || "",
        fio_cor_codigo: c.fio_cor_codigo || ""
      }));
    }
    estado.corAtivaIdx = clamp(estado.corAtivaIdx, 0, estado.paleta.length - 1);
    estado.tipoTrabalho = obj.tipoTrabalho === "circular" ? "circular" : "plano";
    estado.perfilMao = obj.perfilMao === "canhoto" ? "canhoto" : "destro";
    estado.divisoriaCada = [0, 5, 10].includes(Number(obj.divisoriaCada)) ? Number(obj.divisoriaCada) : 5;
    estado.mostrarSimbolos = Boolean(obj.mostrarSimbolos);
    estado.carreiraAtual = clamp(parseInt(obj.carreiraAtual, 10) || 1, 1, h);

    const selTrab = document.getElementById("select-graf-tipo-trab");
    const selMao = document.getElementById("select-graf-mao");
    const selDiv = document.getElementById("select-graf-divisoria");
    const btnSim = document.getElementById("btn-graf-toggle-simbolos");
    if (selTrab) selTrab.value = estado.tipoTrabalho;
    if (selMao) selMao.value = estado.perfilMao;
    if (selDiv) selDiv.value = String(estado.divisoriaCada);
    if (btnSim) {
      btnSim.classList.toggle("ativo", estado.mostrarSimbolos);
      btnSim.setAttribute("aria-pressed", estado.mostrarSimbolos ? "true" : "false");
    }

    renderizarPaletaUI();
    atualizarBarraExecucao();
    ajustarZoomNaTela();
    return true;
  }

  function agendarAutosave() {
    const statusEl = document.getElementById("graf-autosave-status");
    if (statusEl) statusEl.textContent = "Salvando...";
    if (timerAutosave) clearTimeout(timerAutosave);
    timerAutosave = setTimeout(() => {
      const snap = serializarEstadoGrafico();
      try {
        localStorage.setItem(STORAGE_AUTOSAVE, JSON.stringify(snap));
      } catch {
        // ignora quota
      }
      if (
        typeof ProjetoContexto !== "undefined" &&
        !ProjetoContexto.estaHidratando() &&
        ProjetoContexto.obterProjetoAtivo()
      ) {
        ProjetoContexto.atualizarSecaoAtiva("grafico", snap, { origem: "editor-graficos" });
      }
      if (statusEl) statusEl.textContent = "✓ Salvo";
    }, 320);
  }

  function carregarDoProjeto(projeto) {
    if (!projeto) return;
    if (projeto.grafico && projeto.grafico.largura && projeto.grafico.altura) {
      restaurarEstadoGrafico(projeto.grafico);
    }
    if (Array.isArray(projeto.contadores) && projeto.contadores.length > 0 && estado.syncContador) {
      const c = parseInt(projeto.contadores[0].carreiras, 10) || 1;
      if (c >= 1 && c <= estado.altura) {
        estado.carreiraAtual = c;
        atualizarBarraExecucao();
        solicitarRedesenho();
      }
    }
  }

  async function abrirModalSalvarProjeto() {
    const modal = document.getElementById("modal-graf-salvar-proj");
    const sel = document.getElementById("select-graf-projeto-alvo");
    if (!modal || !sel) return;

    sel.innerHTML = "";
    let lista = [];
    if (typeof BancoDadosPT !== "undefined") {
      try {
        lista = (await BancoDadosPT.obterTodos("projetos")) || [];
      } catch {
        lista = [];
      }
    }
    if (!lista.length) {
      sel.innerHTML = `<option value="">Nenhum projeto cadastrado ainda (crie no Gerenciador de Projetos)</option>`;
    } else {
      const ativoId = typeof ProjetoContexto !== "undefined" ? ProjetoContexto.obterProjetoAtivoId() : null;
      lista.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = String(p.id);
        const temGraf = p.grafico && p.grafico.largura ? " [possui gráfico]" : "";
        opt.textContent = `${p.nome}${temGraf}`;
        if (ativoId && Number(p.id) === Number(ativoId)) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    modal.style.display = "flex";
  }

  async function salvarGraficoNoProjetoSelecionado() {
    const idStr = document.getElementById("select-graf-projeto-alvo")?.value;
    if (!idStr || typeof BancoDadosPT === "undefined") {
      mostrarToast("Selecione um projeto válido.");
      return;
    }
    const lista = await BancoDadosPT.obterTodos("projetos");
    const proj = (lista || []).find((p) => String(p.id) === idStr);
    if (!proj) return;
    proj.grafico = serializarEstadoGrafico();

    // Opcional: sincroniza fios vinculados na paleta do gráfico para a Ficha Técnica do projeto
    const syncFios = document.getElementById("chk-graf-sync-fios-proj")?.checked !== false;
    let fiosAdicionados = 0;
    if (syncFios) {
      await carregarFiosInventario();
      proj.materiais = proj.materiais || { fios: [], agulha_id: null, agulha_mm: "", agulha_nome: "" };
      proj.materiais.fios = Array.isArray(proj.materiais.fios) ? proj.materiais.fios : [];
      const contagens = contarPontosPorCor();
      estado.paleta.forEach((cor, idx) => {
        if (!cor.fio_id || !(contagens[idx] > 0)) return;
        const jaTem = proj.materiais.fios.some((f) => Number(f.fio_id) === Number(cor.fio_id));
        if (jaTem) return;
        const fEst = fiosInventarioCache.find((f) => Number(f.id) === Number(cor.fio_id));
        proj.materiais.fios.push({
          id: `fio-${Date.now()}-${idx}`,
          fio_id: cor.fio_id,
          nome: fEst?.nome || cor.nome,
          marca: fEst?.marca || cor.fio_marca || "",
          cor: fEst?.cor_nome || cor.nome,
          lote: fEst?.lote || "",
          quantidade: 1,
          preco_pago: Number(fEst?.preco_pago) || 0,
          peso_novelo_g: Number(fEst?.peso_novelo_g) || 0
        });
        fiosAdicionados++;
      });
    }

    proj.atualizado_em = new Date().toISOString();
    const salvo = await BancoDadosPT.salvar("projetos", proj);
    if (typeof ProjetoContexto !== "undefined" && Number(ProjetoContexto.obterProjetoAtivoId()) === Number(proj.id)) {
      await ProjetoContexto.retirarProjeto(salvo || proj, { origem: "editor-graficos-salvar" });
    }
    if (typeof GerenciadorProjetos !== "undefined" && typeof GerenciadorProjetos.recarregar === "function") {
      await GerenciadorProjetos.recarregar();
    }
    document.getElementById("modal-graf-salvar-proj").style.display = "none";
    const extraTxt = fiosAdicionados > 0 ? ` (+${fiosAdicionados} fio(s) na ficha técnica)` : "";
    mostrarToast(`💾 Gráfico salvo em "${proj.nome}"${extraTxt}!`);
  }

  async function carregarGraficoDoProjetoSelecionado() {
    const idStr = document.getElementById("select-graf-projeto-alvo")?.value;
    if (!idStr || typeof BancoDadosPT === "undefined") return;
    const lista = await BancoDadosPT.obterTodos("projetos");
    const proj = (lista || []).find((p) => String(p.id) === idStr);
    if (!proj || !proj.grafico || !proj.grafico.largura) {
      mostrarToast("Este projeto ainda não possui gráfico salvo.");
      return;
    }
    empilharHistorico();
    restaurarEstadoGrafico(proj.grafico);
    document.getElementById("modal-graf-salvar-proj").style.display = "none";
    mostrarToast(`📂 Gráfico carregado de "${proj.nome}"!`);
  }

  // ==========================================================================
  // EXPORTAÇÃO PNG E PDF (RF22)
  // ==========================================================================

  function puxarProporcaoDaAmostra() {
    let pts = 0;
    let carr = 0;
    if (typeof CalculadoraAmostra !== "undefined" && typeof CalculadoraAmostra.obterDadosAmostraAtual === "function") {
      const am = CalculadoraAmostra.obterDadosAmostraAtual();
      if (am && am.pontos > 0 && am.carreiras > 0) {
        pts = am.pontos;
        carr = am.carreiras;
      }
    }
    if (!(pts > 0 && carr > 0) && typeof ProjetoContexto !== "undefined") {
      const p = ProjetoContexto.obterProjetoAtivo();
      if (p?.amostra?.pontos > 0 && p?.amostra?.carreiras > 0) {
        pts = Number(p.amostra.pontos);
        carr = Number(p.amostra.carreiras);
      }
    }
    if (!(pts > 0 && carr > 0)) {
      mostrarToast("Preencha pontos e carreiras na Calculadora de Amostra primeiro.");
      return;
    }
    const sel = document.getElementById("select-graf-proporcao");
    const box = document.getElementById("graf-box-prop-custom");
    const inpW = document.getElementById("input-graf-prop-w");
    const inpH = document.getElementById("input-graf-prop-h");
    if (sel) sel.value = "custom";
    if (box) box.style.display = "grid";
    if (inpW) inpW.value = pts;
    if (inpH) inpH.value = carr;
    mostrarToast(`📐 Proporção puxada da amostra (${pts} pts × ${carr} carr)!`);
  }

  function enviarReceitaParaAnotacoes() {
    const cabecalho = `=== ${estado.nome} (${estado.largura} pts × ${estado.altura} carr — ${estado.tipoTrabalho === "circular" ? "Circular" : "Plano"} · ${estado.perfilMao === "canhoto" ? "Canhoto" : "Destro"}) ===`;
    const linhas = [cabecalho];
    for (let c = 1; c <= estado.altura; c++) {
      const { sentido, blocos } = gerarBlocosCarreira(c);
      const seq = blocos.map((b) => `${b.qtd} ${(estado.paleta[b.corIdx] || estado.paleta[0]).nome}`).join(", ");
      linhas.push(`Carr ${c} (${sentido.texto}): ${seq}`);
    }
    const textoCompleto = linhas.join("\n");
    document.getElementById("modal-graf-exportar").style.display = "none";

    const btnRec = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta="receitas"]');
    if (btnRec) btnRec.click();
    setTimeout(() => {
      if (typeof LeitorReceitas !== "undefined" && typeof LeitorReceitas.definirTexto === "function") {
        const atual = (document.getElementById("input-receita-texto-global")?.value || "").trim();
        LeitorReceitas.definirTexto(atual ? `${atual}\n\n${textoCompleto}` : textoCompleto);
      }
      mostrarToast("📝 Receita carreira por carreira enviada para Receitas e Anotações!");
    }, 80);
  }

  function gerarCanvasExportacao({ incluirGrade, incluirNumeros, incluirSimbolos, incluirLegenda }) {
    const cellBase = estado.largura > 100 || estado.altura > 100 ? 14 : 24;
    const cw = Math.round(cellBase * estado.proporcaoCelula);
    const ch = cellBase;
    const padL = incluirNumeros ? 44 : 16;
    const padR = 20;
    const padT = 24;
    const padB = incluirNumeros ? 38 : 18;
    const gridW = estado.largura * cw;
    const gridH = estado.altura * ch;

    const contagens = contarPontosPorCor();
    const coresUsadas = estado.paleta.map((c, i) => ({ ...c, idx: i, qtd: contagens[i] })).filter((c) => c.qtd > 0);
    const alturaLegenda = incluirLegenda ? 44 + Math.ceil(coresUsadas.length / 2) * 28 : 0;

    const canvas = document.createElement("canvas");
    canvas.width = padL + gridW + padR;
    canvas.height = padT + gridH + padB + alturaLegenda;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Células
    for (let y = 0; y < estado.altura; y++) {
      for (let x = 0; x < estado.largura; x++) {
        const idx = estado.celulas[y * estado.largura + x] || 0;
        const pal = estado.paleta[idx] || estado.paleta[0];
        ctx.fillStyle = pal.hex;
        ctx.fillRect(padL + x * cw, padT + y * ch, cw, ch);

        if (incluirSimbolos && pal.simbolo) {
          ctx.fillStyle = corContrasteTexto(pal.hex);
          ctx.font = `700 ${Math.max(8, Math.floor(Math.min(cw, ch) * 0.55))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(pal.simbolo, padL + x * cw + cw / 2, padT + y * ch + ch / 2 + 0.5);
        }
      }
    }

    if (incluirGrade) {
      ctx.strokeStyle = "rgba(22, 38, 77, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= estado.largura; x++) {
        ctx.moveTo(padL + x * cw + 0.5, padT);
        ctx.lineTo(padL + x * cw + 0.5, padT + gridH);
      }
      for (let y = 0; y <= estado.altura; y++) {
        ctx.moveTo(padL, padT + y * ch + 0.5);
        ctx.lineTo(padL + gridW, padT + y * ch + 0.5);
      }
      ctx.stroke();

      if (estado.divisoriaCada > 0) {
        const p = estado.divisoriaCada;
        ctx.strokeStyle = "#16264d";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let x = 0; x <= estado.largura; x += p) {
          ctx.moveTo(padL + x * cw + 0.5, padT);
          ctx.lineTo(padL + x * cw + 0.5, padT + gridH);
        }
        for (let c = 0; c <= estado.altura; c += p) {
          const y = estado.altura - c;
          ctx.moveTo(padL, padT + y * ch + 0.5);
          ctx.lineTo(padL + gridW, padT + y * ch + 0.5);
        }
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "#16264d";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(padL, padT, gridW, gridH);

    if (incluirNumeros) {
      ctx.fillStyle = "#16264d";
      ctx.font = "700 10px sans-serif";
      const passoY = ch < 16 ? 5 : 1;
      const passoX = cw < 16 ? 5 : 1;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let y = 0; y < estado.altura; y++) {
        const carr = yParaCarreira(y);
        if (carr === 1 || carr === estado.altura || carr % passoY === 0) {
          ctx.fillText(String(carr), padL - 6, padT + y * ch + ch / 2);
        }
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let x = 0; x < estado.largura; x++) {
        const col = x + 1;
        if (col === 1 || col === estado.largura || col % passoX === 0) {
          ctx.fillText(String(col), padL + x * cw + cw / 2, padT + gridH + 6);
        }
      }
    }

    if (incluirLegenda && coresUsadas.length > 0) {
      const yBase = padT + gridH + padB + 8;
      ctx.fillStyle = "#16264d";
      ctx.font = "800 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Legenda — ${estado.nome} (${estado.largura} × ${estado.altura})`, padL, yBase);
      const colW = Math.max(180, (canvas.width - padL - padR) / 2);
      coresUsadas.forEach((c, i) => {
        const lx = padL + (i % 2) * colW;
        const ly = yBase + 24 + Math.floor(i / 2) * 26;
        ctx.fillStyle = c.hex;
        ctx.fillRect(lx, ly, 16, 16);
        ctx.strokeStyle = "#16264d";
        ctx.lineWidth = 1;
        ctx.strokeRect(lx, ly, 16, 16);
        if (incluirSimbolos && c.simbolo) {
          ctx.fillStyle = corContrasteTexto(c.hex);
          ctx.font = "700 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(c.simbolo, lx + 8, ly + 8);
        }
        ctx.fillStyle = "#16264d";
        ctx.font = "600 11px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const extra = c.fio_marca ? ` (${c.fio_marca})` : "";
        ctx.fillText(`${c.nome}${extra} — ${c.qtd} pts`, lx + 22, ly + 8);
      });
    }

    return canvas;
  }

  function exportarPng() {
    const opts = {
      incluirGrade: Boolean(document.getElementById("chk-exp-grade")?.checked),
      incluirNumeros: Boolean(document.getElementById("chk-exp-numeros")?.checked),
      incluirSimbolos: Boolean(document.getElementById("chk-exp-simbolos")?.checked),
      incluirLegenda: Boolean(document.getElementById("chk-exp-legenda")?.checked)
    };
    const canvas = gerarCanvasExportacao(opts);
    const dataUrl = canvas.toDataURL("image/png");
    const slug = (estado.nome || "grafico").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "grafico";
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `ponto-e-trama-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    mostrarToast("🖼️ Gráfico PNG exportado!");
  }

  function exportarPdf() {
    const opts = {
      incluirGrade: Boolean(document.getElementById("chk-exp-grade")?.checked),
      incluirNumeros: Boolean(document.getElementById("chk-exp-numeros")?.checked),
      incluirSimbolos: Boolean(document.getElementById("chk-exp-simbolos")?.checked),
      incluirLegenda: Boolean(document.getElementById("chk-exp-legenda")?.checked),
      incluirReceita: Boolean(document.getElementById("chk-exp-receita")?.checked)
    };

    const imgDataUrl = gerarCanvasExportacao({ ...opts, incluirLegenda: false }).toDataURL("image/png");
    const contagens = contarPontosPorCor();
    const legendaHtml = opts.incluirLegenda
      ? `<h2>Legenda de Fios &amp; Cores</h2>
         <table><thead><tr><th>Cor</th><th>Símbolo</th><th>Fio / Nome</th><th>Detalhes</th><th>Pontos</th></tr></thead><tbody>
         ${estado.paleta
           .map((c, i) => ({ ...c, qtd: contagens[i] }))
           .filter((c) => c.qtd > 0)
           .map(
             (c) => `<tr>
               <td><span class="sw" style="background:${escapeHtml(c.hex)}"></span> ${escapeHtml(c.hex.toUpperCase())}</td>
               <td style="text-align:center;font-weight:700">${escapeHtml(c.simbolo || "—")}</td>
               <td><strong>${escapeHtml(c.nome)}</strong></td>
               <td>${escapeHtml([c.fio_marca, c.fio_cor_codigo].filter(Boolean).join(" · ") || "Cor manual")}</td>
               <td style="text-align:right;font-weight:700">${c.qtd} pts</td>
             </tr>`
           )
           .join("")}
         </tbody></table>`
      : "";

    let receitaHtml = "";
    if (opts.incluirReceita) {
      const linhas = [];
      for (let carr = 1; carr <= estado.altura; carr++) {
        const { sentido, blocos } = gerarBlocosCarreira(carr);
        const seq = blocos.map((b) => `${b.qtd} ${escapeHtml((estado.paleta[b.corIdx] || estado.paleta[0]).nome)}`).join(", ");
        linhas.push(`<li><strong>Carreira ${carr} (${sentido.texto}):</strong> ${seq}</li>`);
      }
      receitaHtml = `<h2>Receita Escrita Carreira por Carreira (${estado.tipoTrabalho === "circular" ? "Circular" : "Plano Ida e Volta"} · ${estado.perfilMao === "canhoto" ? "Canhoto" : "Destro"})</h2>
        <ol class="rec">${linhas.join("")}</ol>`;
    }

    const docHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>${escapeHtml(estado.nome)} — Ponto &amp; Trama</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #16264d; padding: 24px; max-width: 820px; margin: 0 auto; }
        h1 { font-size: 20px; margin: 0 0 4px 0; border-bottom: 2px solid #233b72; padding-bottom: 6px; }
        h2 { font-size: 15px; margin: 20px 0 8px 0; color: #233b72; }
        .meta { font-size: 12px; color: #4c5d82; margin-bottom: 14px; }
        .grafico-img { max-width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; display: block; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d5dbe7; padding: 6px 8px; }
        th { background: #f2ebdc; text-align: left; }
        .sw { display: inline-block; width: 14px; height: 14px; border: 1px solid #333; vertical-align: middle; margin-right: 4px; }
        .rec { font-size: 12px; line-height: 1.65; columns: 2; column-gap: 24px; padding-left: 20px; }
        @media print { body { padding: 0; } .rec { columns: 2; } }
      </style></head><body>
      <h1>${escapeHtml(estado.nome)}</h1>
      <div class="meta">${estado.largura} pontos × ${estado.altura} carreiras · Gerado offline pelo Ponto &amp; Trama</div>
      <img class="grafico-img" src="${imgDataUrl}" alt="Gráfico" />
      ${legendaHtml}
      ${receitaHtml}
      </body></html>`;

    if (typeof window.PontoETramaAndroid !== "undefined") {
      // No Android offline, copia a receita escrita completa ou baixa PNG
      const linhasTxt = [];
      for (let c = 1; c <= estado.altura; c++) {
        const { sentido, blocos } = gerarBlocosCarreira(c);
        linhasTxt.push(`Carreira ${c} (${sentido.texto}): ${blocos.map((b) => `${b.qtd} ${(estado.paleta[b.corIdx] || estado.paleta[0]).nome}`).join(", ")}`);
      }
      navigator.clipboard?.writeText(`${estado.nome} (${estado.largura}x${estado.altura})\n` + linhasTxt.join("\n")).catch(() => {});
      mostrarToast("📋 Receita carreira por carreira copiada (e use Baixar PNG para a imagem)!");
      return;
    }

    const emDesktop = Boolean(window.__PONTO_TRAMA_DESKTOP__);
    if (!emDesktop) {
      const win = window.open("", "_blank", "width=840,height=920");
      if (win) {
        win.document.write(docHtml + `<script>window.onload=function(){window.print();};<\/script>`);
        win.document.close();
        return;
      }
    }

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(docHtml);
    iframe.contentDocument.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => iframe.remove(), 1800);
      }
    }, 150);
  }

  // ==========================================================================
  // EVENTOS DO CANVAS E DA INTERFACE
  // ==========================================================================

  function selecionarFerramenta(tool) {
    estado.ferramenta = tool;
    document.querySelectorAll(".btn-graf-tool").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.grafTool === tool);
    });
    const canvas = document.getElementById("canvas-editor-graficos");
    if (canvas) {
      canvas.style.cursor = tool === "pan" ? "grab" : tool === "contagotas" ? "crosshair" : "crosshair";
    }
  }

  function atualizarTudoAposEdicao() {
    renderizarPaletaUI();
    atualizarBotoesHistorico();
    if (estado.modo === "execucao") atualizarBarraExecucao();
    solicitarRedesenho();
    agendarAutosave();
  }

  function cancelarLongPressCanvas() {
    if (timerLongPress) {
      clearTimeout(timerLongPress);
      timerLongPress = null;
    }
  }

  function reverterTracoAcidentalSeRecente() {
    if (!tracoRecenteUndo) return;
    const snap = tracoRecenteUndo;
    tracoRecenteUndo = null;
    if (Date.now() - snap.ts <= 520 && estado.undoStack.length > snap.undoLenAntes) {
      const anterior = estado.undoStack.pop();
      if (anterior) {
        estado.largura = anterior.largura;
        estado.altura = anterior.altura;
        estado.celulas = new Uint8Array(anterior.celulas);
        estado.paleta = anterior.paleta.map((c) => ({ ...c }));
        atualizarBotoesHistorico();
        renderizarPaletaUI();
        solicitarRedesenho();
      }
    }
  }

  function iniciarInteracaoCanvas(clientX, clientY, button = 0, pointerType = "mouse") {
    const cel = clientParaCelula(clientX, clientY);
    ponteiroAtivo = true;
    longPressDisparado = false;
    execDragPendente = null;
    tracoRecenteUndo = null;
    cancelarLongPressCanvas();

    // Pan com ferramenta Mão, botão do meio ou Espaço
    if (estado.ferramenta === "pan" || button === 1 || espacoPressionado) {
      botaoMeioOuEspaco = true;
      panInicio = { x: clientX, y: clientY, panX: estado.panX, panY: estado.panY };
      return;
    }

    // Modo Execução: arrastar faz pan suave em qualquer lugar; toque rápido seleciona a carreira; toque duplo enquadra
    if (estado.modo === "execucao") {
      execDragPendente = {
        x: clientX,
        y: clientY,
        panX: estado.panX,
        panY: estado.panY,
        arrastou: false,
        cel
      };
      return;
    }

    if (!cel) {
      botaoMeioOuEspaco = true;
      panInicio = { x: clientX, y: clientY, panX: estado.panX, panY: estado.panY };
      return;
    }

    celulaInicio = cel;
    celulaAnterior = cel;

    // Pressionar e segurar (460ms) no toque -> Conta-gotas instantâneo sem trocar de ferramenta
    if (pointerType === "touch" && estado.ferramenta !== "contagotas" && estado.ferramenta !== "selecao") {
      const corOriginalCel = estado.celulas[cel.y * estado.largura + cel.x] || 0;
      const sx = clientX;
      const sy = clientY;
      timerLongPress = setTimeout(() => {
        timerLongPress = null;
        if (!ponteiroAtivo || gestoMultiAtivo) return;
        const pAtual = Array.from(ponteirosToque.values())[0];
        if (pAtual && Math.hypot(pAtual.x - sx, pAtual.y - sy) > 10) return;

        longPressDisparado = true;
        reverterTracoAcidentalSeRecente();
        estado.corAtivaIdx = corOriginalCel;
        renderizarPaletaUI();
        if (estado.ferramenta === "borracha") selecionarFerramenta("pincel");
        if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(22);
        mostrarToast(`💧 Cor capturada: ${estado.paleta[estado.corAtivaIdx]?.nome || ""}`);
        ponteiroAtivo = false;
        previaForma = [];
        celulaInicio = null;
        celulaAnterior = null;
      }, 460);
    }

    if (estado.ferramenta === "contagotas") {
      estado.corAtivaIdx = estado.celulas[cel.y * estado.largura + cel.x] || 0;
      renderizarPaletaUI();
      selecionarFerramenta("pincel");
      mostrarToast(`💧 Cor capturada: ${estado.paleta[estado.corAtivaIdx]?.nome || ""}`);
      ponteiroAtivo = false;
      return;
    }

    if (estado.ferramenta === "balde") {
      const undoAntes = estado.undoStack.length;
      empilharHistorico();
      tracoRecenteUndo = { ts: Date.now(), cel, undoLenAntes: undoAntes };
      floodFill(cel.x, cel.y, estado.corAtivaIdx);
      if (estado.simetriaH) floodFill(estado.largura - 1 - cel.x, cel.y, estado.corAtivaIdx);
      if (estado.simetriaV) floodFill(cel.x, estado.altura - 1 - cel.y, estado.corAtivaIdx);
      if (estado.simetriaH && estado.simetriaV) floodFill(estado.largura - 1 - cel.x, estado.altura - 1 - cel.y, estado.corAtivaIdx);
      atualizarTudoAposEdicao();
      ponteiroAtivo = false;
      return;
    }

    if (estado.ferramenta === "pincel" || estado.ferramenta === "borracha") {
      const undoAntes = estado.undoStack.length;
      empilharHistorico();
      tracoRecenteUndo = { ts: Date.now(), cel, undoLenAntes: undoAntes };
      const cor = estado.ferramenta === "borracha" ? 0 : estado.corAtivaIdx;
      pintarCelulaComSimetria(cel.x, cel.y, cor);
      solicitarRedesenho();
      return;
    }

    if (estado.ferramenta === "selecao") {
      const s = normalizarSelecao(estado.selecao);
      // Se clicou DENTRO da seleção atual, inicia MOVER (RF03)
      if (s && cel.x >= s.x1 && cel.x <= s.x2 && cel.y >= s.y1 && cel.y <= s.y2) {
        empilharHistorico();
        estado.arrastandoSelecao = true;
        estado.selDragOrigem = { x: cel.x, y: cel.y, s };
        const w = s.x2 - s.x1 + 1;
        const h = s.y2 - s.y1 + 1;
        const bloco = new Uint8Array(w * h);
        const fundo = new Uint8Array(estado.celulas);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            bloco[y * w + x] = estado.celulas[(s.y1 + y) * estado.largura + (s.x1 + x)];
            fundo[(s.y1 + y) * estado.largura + (s.x1 + x)] = 0;
          }
        }
        estado.selBufferMovido = { w, h, bloco };
        estado.selFundoSemBloco = fundo;
      } else {
        estado.arrastandoSelecao = false;
        estado.selecao = { x1: cel.x, y1: cel.y, x2: cel.x, y2: cel.y };
        solicitarRedesenho();
      }
      return;
    }

    // Formas (linha, retângulo, elipse)
    previaForma = [{ x: cel.x, y: cel.y }];
    solicitarRedesenho();
  }

  function moverInteracaoCanvas(clientX, clientY) {
    const cel = clientParaCelula(clientX, clientY);
    if (cel && (!celulaHover || cel.x !== celulaHover.x || cel.y !== celulaHover.y)) {
      celulaHover = cel;
      const hud = document.getElementById("graf-coord-hud");
      if (hud) {
        const cor = estado.paleta[estado.celulas[cel.y * estado.largura + cel.x] || 0];
        hud.textContent = `Carr ${yParaCarreira(cel.y)} · Pt ${cel.x + 1}${cor ? ` · ${cor.nome}` : ""}`;
      }
    }

    if (!ponteiroAtivo) return;

    if (execDragPendente) {
      const dx = clientX - execDragPendente.x;
      const dy = clientY - execDragPendente.y;
      if (!execDragPendente.arrastou && Math.hypot(dx, dy) > 8) {
        execDragPendente.arrastou = true;
      }
      if (execDragPendente.arrastou) {
        estado.panX = execDragPendente.panX + dx;
        estado.panY = execDragPendente.panY + dy;
        solicitarRedesenho();
      }
      return;
    }

    if (botaoMeioOuEspaco) {
      estado.panX = panInicio.panX + (clientX - panInicio.x);
      estado.panY = panInicio.panY + (clientY - panInicio.y);
      solicitarRedesenho();
      return;
    }

    if (estado.modo !== "edicao" || !cel) return;

    if (celulaInicio && (cel.x !== celulaInicio.x || cel.y !== celulaInicio.y)) {
      cancelarLongPressCanvas();
    }

    if (estado.ferramenta === "pincel" || estado.ferramenta === "borracha") {
      const cor = estado.ferramenta === "borracha" ? 0 : estado.corAtivaIdx;
      const prev = celulaAnterior || cel;
      const linha = pontosLinhaBresenham(prev.x, prev.y, cel.x, cel.y);
      for (const p of linha) pintarCelulaComSimetria(p.x, p.y, cor);
      celulaAnterior = cel;
      solicitarRedesenho();
      return;
    }

    if (estado.ferramenta === "selecao") {
      if (estado.arrastandoSelecao && estado.selDragOrigem && estado.selBufferMovido) {
        const dx = cel.x - estado.selDragOrigem.x;
        const dy = cel.y - estado.selDragOrigem.y;
        const s0 = estado.selDragOrigem.s;
        estado.celulas.set(estado.selFundoSemBloco);
        const { w, h, bloco } = estado.selBufferMovido;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const tx = s0.x1 + dx + x;
            const ty = s0.y1 + dy + y;
            if (tx >= 0 && ty >= 0 && tx < estado.largura && ty < estado.altura) {
              estado.celulas[ty * estado.largura + tx] = bloco[y * w + x];
            }
          }
        }
        estado.selecao = { x1: s0.x1 + dx, y1: s0.y1 + dy, x2: s0.x2 + dx, y2: s0.y2 + dy };
        solicitarRedesenho();
      } else if (celulaInicio) {
        estado.selecao = { x1: celulaInicio.x, y1: celulaInicio.y, x2: cel.x, y2: cel.y };
        solicitarRedesenho();
      }
      return;
    }

    if (celulaInicio) {
      if (estado.ferramenta === "linha") {
        previaForma = pontosLinhaBresenham(celulaInicio.x, celulaInicio.y, cel.x, cel.y);
      } else if (estado.ferramenta === "retangulo") {
        previaForma = pontosRetangulo(celulaInicio.x, celulaInicio.y, cel.x, cel.y, estado.formaPreenchida);
      } else if (estado.ferramenta === "elipse") {
        previaForma = pontosElipse(celulaInicio.x, celulaInicio.y, cel.x, cel.y, estado.formaPreenchida);
      }
      solicitarRedesenho();
    }
  }

  function finalizarInteracaoCanvas() {
    cancelarLongPressCanvas();
    if (!ponteiroAtivo) {
      execDragPendente = null;
      return;
    }
    ponteiroAtivo = false;

    if (execDragPendente) {
      const infoExec = execDragPendente;
      execDragPendente = null;
      if (!infoExec.arrastou) {
        const agora = Date.now();
        if (agora - ultimoToqueExecMs < 320) {
          ultimoToqueExecMs = 0;
          ajustarZoomNaTela();
          if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(12);
          return;
        }
        ultimoToqueExecMs = agora;
        if (infoExec.cel) {
          definirCarreiraAtual(yParaCarreira(infoExec.cel.y), { sincronizarComContador: true });
          if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(14);
        }
      }
      return;
    }

    if (botaoMeioOuEspaco) {
      botaoMeioOuEspaco = false;
      return;
    }

    if (longPressDisparado) {
      longPressDisparado = false;
      return;
    }

    if (estado.modo === "edicao") {
      if (previaForma.length > 0 && (estado.ferramenta === "linha" || estado.ferramenta === "retangulo" || estado.ferramenta === "elipse")) {
        empilharHistorico();
        for (const p of previaForma) pintarCelulaComSimetria(p.x, p.y, estado.corAtivaIdx);
        previaForma = [];
        atualizarTudoAposEdicao();
      } else if (estado.ferramenta === "pincel" || estado.ferramenta === "borracha" || estado.arrastandoSelecao) {
        estado.arrastandoSelecao = false;
        estado.selBufferMovido = null;
        estado.selFundoSemBloco = null;
        atualizarTudoAposEdicao();
      }
    }

    celulaInicio = null;
    celulaAnterior = null;
  }

  function calcularMetricasPinch(wrap) {
    const pts = Array.from(ponteirosToque.values());
    if (pts.length < 2 || !wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const p1 = pts[0];
    const p2 = pts[1];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const midX = (p1.x + p2.x) / 2 - rect.left;
    const midY = (p1.y + p2.y) / 2 - rect.top;
    return { dist: Math.max(12, dist), midX, midY };
  }

  function vincularEventos() {
    const canvas = document.getElementById("canvas-editor-graficos");
    const wrap = document.getElementById("graf-palco-wrap");

    // Pointer Events unificados (mouse + caneta + multi-touch no celular)
    // Suporta: Pinça para Zoom + Pan com 2 dedos, Toque 2 dedos = Desfazer,
    // Toque 3 dedos = Refazer, Long-Press = Conta-gotas e Toque Duplo na Execução = Enquadrar.
    canvas?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);

      if (e.pointerType === "touch") {
        ponteirosToque.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          ts: Date.now()
        });

        if (ponteirosToque.size >= 2) {
          cancelarLongPressCanvas();
          // Reverte ponto acidental pintado pelo 1º dedo logo antes do 2º dedo encostar
          if (!gestoMultiAtivo) {
            reverterTracoAcidentalSeRecente();
            ponteiroAtivo = false;
            botaoMeioOuEspaco = false;
            execDragPendente = null;
            previaForma = [];
            celulaInicio = null;
            celulaAnterior = null;
            gestoMultiAtivo = true;
            gestoMultiInicioMs = Date.now();
            gestoMultiMoveu = false;
          }
          gestoMultiMaxDedos = Math.max(gestoMultiMaxDedos, ponteirosToque.size);
          const m = calcularMetricasPinch(wrap);
          if (m) {
            pinchRef = {
              dist: m.dist,
              midX: m.midX,
              midY: m.midY,
              zoom: estado.zoom,
              panX: estado.panX,
              panY: estado.panY
            };
          }
          return;
        }
      }

      if (!gestoMultiAtivo) {
        iniciarInteracaoCanvas(e.clientX, e.clientY, e.button, e.pointerType);
      }
    });

    canvas?.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" && ponteirosToque.has(e.pointerId)) {
        const reg = ponteirosToque.get(e.pointerId);
        reg.x = e.clientX;
        reg.y = e.clientY;
        if (Math.hypot(reg.x - reg.startX, reg.y - reg.startY) > 10) {
          cancelarLongPressCanvas();
        }
      }

      if (gestoMultiAtivo) {
        if (ponteirosToque.size >= 2 && pinchRef) {
          const m = calcularMetricasPinch(wrap);
          if (!m) return;
          const distDelta = Math.abs(m.dist - pinchRef.dist);
          const panDelta = Math.hypot(m.midX - pinchRef.midX, m.midY - pinchRef.midY);
          if (distDelta > 8 || panDelta > 10) {
            gestoMultiMoveu = true;
          }
          const fator = m.dist / pinchRef.dist;
          const novoZoom = clamp(pinchRef.zoom * fator, 0.18, 4.5);
          const razao = novoZoom / pinchRef.zoom;
          estado.zoom = novoZoom;
          estado.panX = m.midX - (pinchRef.midX - pinchRef.panX) * razao;
          estado.panY = m.midY - (pinchRef.midY - pinchRef.panY) * razao;
          atualizarIndicadorZoom();
          solicitarRedesenho();
        }
        return;
      }

      moverInteracaoCanvas(e.clientX, e.clientY);
    });

    const aoSoltarPonteiro = (e) => {
      if (e.pointerType === "touch") {
        ponteirosToque.delete(e.pointerId);
        if (gestoMultiAtivo) {
          if (ponteirosToque.size >= 2) {
            const m = calcularMetricasPinch(wrap);
            if (m) {
              pinchRef = {
                dist: m.dist,
                midX: m.midX,
                midY: m.midY,
                zoom: estado.zoom,
                panX: estado.panX,
                panY: estado.panY
              };
            }
          } else if (ponteirosToque.size === 0) {
            const duracao = Date.now() - gestoMultiInicioMs;
            const foiTapRapido = !gestoMultiMoveu && duracao < 280;
            const dedos = gestoMultiMaxDedos;
            gestoMultiAtivo = false;
            gestoMultiMaxDedos = 0;
            pinchRef = null;

            if (foiTapRapido && estado.modo === "edicao") {
              if (dedos === 2 && estado.undoStack.length > 0) {
                desfazer();
                if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(14);
                mostrarToast("↩ Desfeito (toque com 2 dedos)");
              } else if (dedos >= 3 && estado.redoStack.length > 0) {
                refazer();
                if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(14);
                mostrarToast("↪ Refeito (toque com 3 dedos)");
              }
            }
          }
          return;
        }
      }
      finalizarInteracaoCanvas();
    };

    canvas?.addEventListener("pointerup", aoSoltarPonteiro);
    canvas?.addEventListener("pointercancel", aoSoltarPonteiro);

    // Swipe horizontal na barra de execução para avançar / voltar carreira no toque
    const barraExec = document.getElementById("graf-barra-execucao");
    let swipeExec = null;
    barraExec?.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        swipeExec = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      },
      { passive: true }
    );
    barraExec?.addEventListener(
      "touchend",
      (e) => {
        if (!swipeExec || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - swipeExec.x;
        const dy = e.changedTouches[0].clientY - swipeExec.y;
        swipeExec = null;
        if (Math.abs(dx) >= 60 && Math.abs(dy) < 42) {
          if (dx < 0 && estado.carreiraAtual < estado.altura) {
            definirCarreiraAtual(estado.carreiraAtual + 1, { sincronizarComContador: true });
            if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(16);
          } else if (dx > 0 && estado.carreiraAtual > 1) {
            definirCarreiraAtual(estado.carreiraAtual - 1, { sincronizarComContador: true });
            if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(16);
          }
        }
      },
      { passive: true }
    );

    // Zoom com roda do mouse centrado no cursor (RF04)
    wrap?.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const fator = e.deltaY < 0 ? 1.12 : 0.89;
        const rect = wrap.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const prevZ = estado.zoom;
        estado.zoom = clamp(estado.zoom * fator, 0.18, 4.5);
        const razao = estado.zoom / prevZ;
        estado.panX = mx - (mx - estado.panX) * razao;
        estado.panY = my - (my - estado.panY) * razao;
        atualizarIndicadorZoom();
        solicitarRedesenho();
      },
      { passive: false }
    );

    // Switch Edição / Execução (RF16)
    document.getElementById("btn-graf-modo-edicao")?.addEventListener("click", () => definirModo("edicao"));
    document.getElementById("btn-graf-modo-execucao")?.addEventListener("click", () => definirModo("execucao"));

    // Ferramentas de desenho (RF02)
    document.querySelectorAll(".btn-graf-tool").forEach((b) => {
      b.addEventListener("click", () => selecionarFerramenta(b.dataset.grafTool || "pincel"));
    });
    document.getElementById("chk-graf-forma-cheia")?.addEventListener("change", (e) => {
      estado.formaPreenchida = Boolean(e.target.checked);
    });

    // Simetria & Manipulação (RF03)
    document.getElementById("btn-graf-sim-h")?.addEventListener("click", (e) => {
      estado.simetriaH = !estado.simetriaH;
      e.currentTarget.classList.toggle("ativo", estado.simetriaH);
      e.currentTarget.setAttribute("aria-pressed", estado.simetriaH ? "true" : "false");
      solicitarRedesenho();
    });
    document.getElementById("btn-graf-sim-v")?.addEventListener("click", (e) => {
      estado.simetriaV = !estado.simetriaV;
      e.currentTarget.classList.toggle("ativo", estado.simetriaV);
      e.currentTarget.setAttribute("aria-pressed", estado.simetriaV ? "true" : "false");
      solicitarRedesenho();
    });
    document.getElementById("btn-graf-espelhar-h")?.addEventListener("click", () => espelharRegiao("h"));
    document.getElementById("btn-graf-espelhar-v")?.addEventListener("click", () => espelharRegiao("v"));
    document.getElementById("btn-graf-copiar-sel")?.addEventListener("click", copiarSelecao);
    document.getElementById("btn-graf-colar-sel")?.addEventListener("click", colarSelecao);
    document.getElementById("btn-graf-undo")?.addEventListener("click", desfazer);
    document.getElementById("btn-graf-redo")?.addEventListener("click", refazer);

    // Redimensionamento rápido (RF04 + RN04)
    document.getElementById("btn-graf-add-col")?.addEventListener("click", () => {
      if (estado.largura >= MAX_DIM) return mostrarToast(`Limite máximo de ${MAX_DIM} colunas atingido.`);
      criarNovaGrade(estado.largura + 1, estado.altura, null, true);
    });
    document.getElementById("btn-graf-rem-col")?.addEventListener("click", () => {
      if (estado.largura <= MIN_DIM) return mostrarToast(`Mínimo de ${MIN_DIM} colunas.`);
      criarNovaGrade(estado.largura - 1, estado.altura, null, true);
    });
    document.getElementById("btn-graf-add-row")?.addEventListener("click", () => {
      if (estado.altura >= MAX_DIM) return mostrarToast(`Limite máximo de ${MAX_DIM} carreiras atingido.`);
      criarNovaGrade(estado.largura, estado.altura + 1, null, true);
    });
    document.getElementById("btn-graf-rem-row")?.addEventListener("click", () => {
      if (estado.altura <= MIN_DIM) return mostrarToast(`Mínimo de ${MIN_DIM} carreiras.`);
      criarNovaGrade(estado.largura, estado.altura - 1, null, true);
    });

    // Zoom & Guias (RF04, RF05, RNF03)
    document.getElementById("btn-graf-zoom-in")?.addEventListener("click", () => {
      estado.zoom = clamp(estado.zoom * 1.2, 0.18, 4.5);
      atualizarIndicadorZoom();
      solicitarRedesenho();
    });
    document.getElementById("btn-graf-zoom-out")?.addEventListener("click", () => {
      estado.zoom = clamp(estado.zoom * 0.82, 0.18, 4.5);
      atualizarIndicadorZoom();
      solicitarRedesenho();
    });
    document.getElementById("btn-graf-zoom-fit")?.addEventListener("click", ajustarZoomNaTela);

    document.getElementById("select-graf-divisoria")?.addEventListener("change", (e) => {
      estado.divisoriaCada = parseInt(e.target.value, 10) || 0;
      solicitarRedesenho();
      agendarAutosave();
    });
    document.getElementById("btn-graf-toggle-simbolos")?.addEventListener("click", (e) => {
      estado.mostrarSimbolos = !estado.mostrarSimbolos;
      e.currentTarget.classList.toggle("ativo", estado.mostrarSimbolos);
      e.currentTarget.setAttribute("aria-pressed", estado.mostrarSimbolos ? "true" : "false");
      solicitarRedesenho();
      agendarAutosave();
    });
    document.getElementById("btn-graf-toggle-grade")?.addEventListener("click", (e) => {
      estado.mostrarGrade = !estado.mostrarGrade;
      e.currentTarget.classList.toggle("ativo", estado.mostrarGrade);
      e.currentTarget.setAttribute("aria-pressed", estado.mostrarGrade ? "true" : "false");
      solicitarRedesenho();
    });

    // Controles do Modo Execução (RF17-RF20)
    document.getElementById("select-graf-tipo-trab")?.addEventListener("change", (e) => {
      estado.tipoTrabalho = e.target.value === "circular" ? "circular" : "plano";
      atualizarBarraExecucao();
      solicitarRedesenho();
      agendarAutosave();
    });
    document.getElementById("select-graf-mao")?.addEventListener("change", (e) => {
      estado.perfilMao = e.target.value === "canhoto" ? "canhoto" : "destro";
      atualizarBarraExecucao();
      solicitarRedesenho();
      agendarAutosave();
    });
    document.getElementById("btn-graf-alto-contraste")?.addEventListener("click", (e) => {
      estado.altoContraste = !estado.altoContraste;
      e.currentTarget.classList.toggle("ativo", estado.altoContraste);
      e.currentTarget.setAttribute("aria-pressed", estado.altoContraste ? "true" : "false");
      solicitarRedesenho();
    });
    document.getElementById("btn-graf-sync-contador")?.addEventListener("click", (e) => {
      estado.syncContador = !estado.syncContador;
      e.currentTarget.classList.toggle("ativo", estado.syncContador);
      e.currentTarget.setAttribute("aria-pressed", estado.syncContador ? "true" : "false");
    });
    document.getElementById("btn-graf-exec-ant")?.addEventListener("click", () => {
      if (estado.carreiraAtual > 1) {
        if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(14);
        definirCarreiraAtual(estado.carreiraAtual - 1, { sincronizarComContador: true });
      }
    });
    document.getElementById("btn-graf-exec-prox")?.addEventListener("click", () => {
      if (estado.carreiraAtual < estado.altura) {
        if (typeof Configuracoes !== "undefined") Configuracoes.vibrar(20);
        definirCarreiraAtual(estado.carreiraAtual + 1, { sincronizarComContador: true });
      }
    });

    // Paleta & Fios
    document.getElementById("btn-graf-add-cor")?.addEventListener("click", () => abrirModalEditarCor(-1, false));
    document.getElementById("btn-graf-add-fio")?.addEventListener("click", () => abrirModalEditarCor(-1, true));
    document.getElementById("btn-fechar-modal-cor")?.addEventListener("click", () => { document.getElementById("modal-graf-editar-cor").style.display = "none"; });
    document.getElementById("btn-graf-cancelar-cor")?.addEventListener("click", () => { document.getElementById("modal-graf-editar-cor").style.display = "none"; });
    document.getElementById("btn-graf-salvar-cor")?.addEventListener("click", salvarEdicaoCorModal);
    document.getElementById("btn-graf-remover-cor")?.addEventListener("click", removerCorAtualModal);

    document.getElementById("input-graf-cor-picker")?.addEventListener("input", (e) => {
      const h = document.getElementById("input-graf-cor-hex");
      if (h) h.value = e.target.value;
    });
    document.getElementById("input-graf-cor-hex")?.addEventListener("input", (e) => {
      const v = e.target.value.trim();
      const p = document.getElementById("input-graf-cor-picker");
      if (p && /^#[0-9a-fA-F]{6}$/.test(v)) p.value = v;
    });
    document.getElementById("select-graf-fio-inv")?.addEventListener("change", (e) => {
      const fio = fiosInventarioCache.find((f) => String(f.id) === e.target.value);
      if (!fio) return;
      const hex = inferirHexFio(fio);
      const inpP = document.getElementById("input-graf-cor-picker");
      const inpH = document.getElementById("input-graf-cor-hex");
      const inpN = document.getElementById("input-graf-cor-nome");
      if (hex && inpP && inpH) { inpP.value = hex; inpH.value = hex; }
      if (inpN) inpN.value = fio.cor_nome ? `${fio.nome} — ${fio.cor_nome}` : fio.nome;
    });

    // Modal Nova Grade / Redimensionar (RF01)
    document.getElementById("btn-graf-nova-grade")?.addEventListener("click", () => {
      document.getElementById("input-graf-largura").value = estado.largura;
      document.getElementById("input-graf-altura").value = estado.altura;
      document.getElementById("input-graf-nome-padrao").value = estado.nome;
      document.getElementById("modal-graf-nova-grade").style.display = "flex";
    });
    document.getElementById("select-graf-proporcao")?.addEventListener("change", (e) => {
      const box = document.getElementById("graf-box-prop-custom");
      if (box) box.style.display = e.target.value === "custom" ? "grid" : "none";
    });
    document.getElementById("btn-graf-puxar-amostra")?.addEventListener("click", puxarProporcaoDaAmostra);
    const lerProporcaoModal = () => {
      const val = document.getElementById("select-graf-proporcao")?.value || "1";
      if (val === "custom") {
        const pts = parseFloat(document.getElementById("input-graf-prop-w")?.value) || 18;
        const carr = parseFloat(document.getElementById("input-graf-prop-h")?.value) || 22;
        return clamp(carr / pts, 0.4, 2.5);
      }
      return parseFloat(val) || 1;
    };
    document.getElementById("btn-graf-aplicar-resize")?.addEventListener("click", () => {
      estado.nome = (document.getElementById("input-graf-nome-padrao")?.value || "").trim() || estado.nome;
      criarNovaGrade(
        document.getElementById("input-graf-largura").value,
        document.getElementById("input-graf-altura").value,
        lerProporcaoModal(),
        true
      );
      document.getElementById("modal-graf-nova-grade").style.display = "none";
      mostrarToast(`⊞ Grade redimensionada para ${estado.largura}×${estado.altura}!`);
    });
    document.getElementById("btn-graf-criar-limpa")?.addEventListener("click", () => {
      estado.nome = (document.getElementById("input-graf-nome-padrao")?.value || "").trim() || "Novo Gráfico";
      criarNovaGrade(
        document.getElementById("input-graf-largura").value,
        document.getElementById("input-graf-altura").value,
        lerProporcaoModal(),
        false
      );
      document.getElementById("modal-graf-nova-grade").style.display = "none";
      mostrarToast(`✨ Nova grade limpa ${estado.largura}×${estado.altura} criada!`);
    });
    document.getElementById("btn-fechar-modal-grade")?.addEventListener("click", () => { document.getElementById("modal-graf-nova-grade").style.display = "none"; });
    document.getElementById("btn-graf-cancelar-grade")?.addEventListener("click", () => { document.getElementById("modal-graf-nova-grade").style.display = "none"; });

    // Modal Importar Imagem (RF06-RF11)
    document.getElementById("btn-graf-importar-img")?.addEventListener("click", async () => {
      await carregarFiosInventario();
      document.getElementById("modal-graf-importar-img").style.display = "flex";
    });
    document.getElementById("btn-fechar-modal-imp")?.addEventListener("click", () => { document.getElementById("modal-graf-importar-img").style.display = "none"; });
    document.getElementById("btn-graf-cancelar-imp")?.addEventListener("click", () => { document.getElementById("modal-graf-importar-img").style.display = "none"; });

    document.querySelectorAll(".btn-imp-modo").forEach((btn) => {
      btn.addEventListener("click", () => {
        impEstado.modo = btn.dataset.impModo === "foto" ? "foto" : "quadriculada";
        document.querySelectorAll(".btn-imp-modo").forEach((b) => b.classList.toggle("ativo", b === btn));
        const boxCal = document.getElementById("graf-imp-box-calibracao");
        const nota = document.getElementById("graf-imp-nota-rn02");
        if (boxCal) boxCal.style.display = impEstado.modo === "quadriculada" ? "grid" : "none";
        if (nota) {
          nota.textContent =
            impEstado.modo === "quadriculada"
              ? "✓ Amostragem Central (RN02): lê apenas os 45% centrais de cada célula, ignorando linhas da grade original."
              : "📷 Modo Foto/Ilustração: pixeliza a área recortada reduzindo para a paleta de cores selecionada.";
        }
        if (impEstado.imagem) extrairGradeDaImagem();
      });
    });

    document.querySelectorAll(".btn-imp-prev").forEach((btn) => {
      btn.addEventListener("click", () => {
        impEstado.visao = btn.dataset.impVisao === "resultado" ? "resultado" : "calibrar";
        document.querySelectorAll(".btn-imp-prev").forEach((b) => b.classList.toggle("ativo", b === btn));
        const c1 = document.getElementById("canvas-graf-imp-calibrar");
        const c2 = document.getElementById("canvas-graf-imp-resultado");
        if (c1) c1.style.display = impEstado.visao === "calibrar" ? "block" : "none";
        if (c2) c2.style.display = impEstado.visao === "resultado" ? "block" : "none";
      });
    });

    document.getElementById("input-graf-img-file")?.addEventListener("change", (e) => {
      const arq = e.target.files?.[0];
      if (!arq) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          impEstado.imagem = img;
          impEstado.mergesManuais.clear();
          document.getElementById("graf-imp-vazio").style.display = "none";
          document.getElementById("graf-imp-conteudo").style.display = "grid";
          document.getElementById("btn-graf-confirmar-imp").disabled = false;
          if (impEstado.modo === "quadriculada") {
            const det = detectarGradeAutomatica(img, impEstado.cropL, impEstado.cropR, impEstado.cropT, impEstado.cropB);
            impEstado.cols = det.cols;
            impEstado.rows = det.rows;
            document.getElementById("imp-cols").value = det.cols;
            document.getElementById("imp-rows").value = det.rows;
          }
          extrairGradeDaImagem();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(arq);
      e.target.value = "";
    });

    const ligarRangeImp = (id, chave, lblId, sufixo = "") => {
      document.getElementById(id)?.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value) || 0;
        impEstado[chave] = v;
        if (chave === "maxCores" || chave === "tolerancia") impEstado.mergesManuais.clear();
        const l = document.getElementById(lblId);
        if (l) l.textContent = `${v}${sufixo}`;
        if (impEstado.imagem) extrairGradeDaImagem();
      });
    };
    ligarRangeImp("imp-crop-l", "cropL", "lbl-crop-l", "%");
    ligarRangeImp("imp-crop-r", "cropR", "lbl-crop-r", "%");
    ligarRangeImp("imp-crop-t", "cropT", "lbl-crop-t", "%");
    ligarRangeImp("imp-crop-b", "cropB", "lbl-crop-b", "%");
    ligarRangeImp("imp-off-x", "offX", "lbl-off-x", " px");
    ligarRangeImp("imp-off-y", "offY", "lbl-off-y", " px");
    ligarRangeImp("imp-esc-x", "escX", "lbl-esc-x", "%");
    ligarRangeImp("imp-esc-y", "escY", "lbl-esc-y", "%");
    ligarRangeImp("imp-max-cores", "maxCores", "lbl-max-cores", "");
    ligarRangeImp("imp-tol-cor", "tolerancia", "lbl-tol-cor", "");

    document.getElementById("imp-cols")?.addEventListener("input", (e) => {
      impEstado.cols = clamp(parseInt(e.target.value, 10) || 32, MIN_DIM, MAX_DIM);
      if (impEstado.imagem) extrairGradeDaImagem();
    });
    document.getElementById("imp-rows")?.addEventListener("input", (e) => {
      impEstado.rows = clamp(parseInt(e.target.value, 10) || 32, MIN_DIM, MAX_DIM);
      if (impEstado.imagem) extrairGradeDaImagem();
    });
    document.getElementById("btn-imp-auto-grade")?.addEventListener("click", () => {
      if (!impEstado.imagem) return;
      const det = detectarGradeAutomatica(impEstado.imagem, impEstado.cropL, impEstado.cropR, impEstado.cropT, impEstado.cropB);
      impEstado.cols = det.cols;
      impEstado.rows = det.rows;
      document.getElementById("imp-cols").value = det.cols;
      document.getElementById("imp-rows").value = det.rows;
      extrairGradeDaImagem();
      mostrarToast(`✨ Grade detectada: ${det.cols} × ${det.rows} células`);
    });
    document.getElementById("btn-graf-confirmar-imp")?.addEventListener("click", confirmarImportacaoParaEditor);

    // Modal Exportar (RF22)
    document.getElementById("btn-graf-exportar")?.addEventListener("click", () => {
      document.getElementById("modal-graf-exportar").style.display = "flex";
    });
    document.getElementById("btn-fechar-modal-exp")?.addEventListener("click", () => { document.getElementById("modal-graf-exportar").style.display = "none"; });
    document.getElementById("btn-graf-cancelar-exp")?.addEventListener("click", () => { document.getElementById("modal-graf-exportar").style.display = "none"; });
    document.getElementById("btn-graf-enviar-receitas")?.addEventListener("click", enviarReceitaParaAnotacoes);
    document.getElementById("btn-graf-baixar-png")?.addEventListener("click", exportarPng);
    document.getElementById("btn-graf-gerar-pdf")?.addEventListener("click", exportarPdf);

    // Modal Projeto (RF21)
    document.getElementById("btn-graf-salvar-proj")?.addEventListener("click", abrirModalSalvarProjeto);
    document.getElementById("btn-fechar-modal-proj")?.addEventListener("click", () => { document.getElementById("modal-graf-salvar-proj").style.display = "none"; });
    document.getElementById("btn-graf-cancelar-proj")?.addEventListener("click", () => { document.getElementById("modal-graf-salvar-proj").style.display = "none"; });
    document.getElementById("btn-graf-confirmar-salvar-proj")?.addEventListener("click", salvarGraficoNoProjetoSelecionado);
    document.getElementById("btn-graf-carregar-de-proj")?.addEventListener("click", carregarGraficoDoProjetoSelecionado);

    // Fechar modais ao clicar fora
    ["modal-graf-nova-grade", "modal-graf-importar-img", "modal-graf-editar-cor", "modal-graf-exportar", "modal-graf-salvar-proj"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", (e) => {
        if (e.target.id === id) e.target.style.display = "none";
      });
    });

    // Atalhos de teclado (Ctrl+Z, Ctrl+Y, Espaço para pan, Esc fecha modais)
    document.addEventListener("keydown", (e) => {
      const sec = document.getElementById("secao-editor-graficos");
      if (!sec || sec.style.display === "none") return;
      if (e.key === "Escape") {
        ["modal-graf-nova-grade", "modal-graf-importar-img", "modal-graf-editar-cor", "modal-graf-exportar", "modal-graf-salvar-proj"].forEach((id) => {
          const m = document.getElementById(id);
          if (m) m.style.display = "none";
        });
        estado.selecao = null;
        solicitarRedesenho();
        return;
      }
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.code === "Space") { espacoPressionado = true; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) refazer(); else desfazer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        refazer();
      }
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") espacoPressionado = false;
    });

    // Sincronização bidirecional vinda do Contador de Carreiras (RF19)
    window.addEventListener("ponto-trama:contador-alterado", (e) => {
      if (!estado.syncContador || sincronizandoContador) return;
      const c = parseInt(e.detail?.carreiras, 10);
      if (!Number.isNaN(c) && c >= 1 && c <= estado.altura && c !== estado.carreiraAtual) {
        definirCarreiraAtual(c, { sincronizarComContador: false });
      }
    });

    window.addEventListener("ponto-trama:fios-atualizados", async () => {
      await carregarFiosInventario();
      renderizarPaletaUI();
    });

    window.addEventListener("ponto-trama:ferramenta-alterada", (e) => {
      if (e.detail?.ferramenta === "editor-graficos") {
        setTimeout(ajustarZoomNaTela, 40);
      }
    });

    window.addEventListener("resize", () => {
      const sec = document.getElementById("secao-editor-graficos");
      if (sec && sec.style.display !== "none") solicitarRedesenho();
    });
  }

  async function init() {
    if (jaInicializado) {
      setTimeout(ajustarZoomNaTela, 40);
      return;
    }
    jaInicializado = true;
    await carregarFiosInventario();
    vincularEventos();

    // Tenta restaurar do projeto ativo ou do autosave local (RNF04)
    const projAtivo = typeof ProjetoContexto !== "undefined" ? ProjetoContexto.obterProjetoAtivo() : null;
    let restaurou = false;
    if (projAtivo && projAtivo.grafico && projAtivo.grafico.largura) {
      restaurou = restaurarEstadoGrafico(projAtivo.grafico);
    }
    if (!restaurou) {
      try {
        const raw = localStorage.getItem(STORAGE_AUTOSAVE);
        if (raw) restaurou = restaurarEstadoGrafico(JSON.parse(raw));
      } catch {
        restaurou = false;
      }
    }
    if (!restaurou) {
      renderizarPaletaUI();
      atualizarBotoesHistorico();
    }
    setTimeout(ajustarZoomNaTela, 50);
  }

  return {
    init,
    carregarDoProjeto,
    criarNovaGrade,
    definirModo,
    definirCarreiraAtual,
    gerarBlocosCarreira,
    obterSentidoCarreira,
    codificarCelulasRle,
    decodificarCelulasRle,
    serializarEstadoGrafico,
    restaurarEstadoGrafico,
    obterEstado: () => estado
  };
})();
