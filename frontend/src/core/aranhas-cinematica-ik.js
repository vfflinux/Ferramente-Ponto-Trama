// ==========================================================================
// PONTO & TRAMA (ÑANDUOBYETÉ) — MOTOR BIOMECÂNICO CANVAS 2D & CINEMÁTICA INVERSA (IK)
// - Camada única <canvas> HiDPI (devicePixelRatio) com 0 mutações de DOM por frame
// - Cinemática Inversa (IK) de 2 Juntas (Fêmur + Tíbia/Tarso) com Foot-Planting real:
//   cada pata apoia no pixel exato da tela e avança em marcha tetrapodal alternada
// - Sombra de Contato Física 3D (elipse projetada que desloca, encolhe e suaviza com a altura Z)
// - Micro-Física de Inércia (Follow-Through elástico do abdômen em curvas/arrancadas)
// - Head-Tracking Saccádico de Salticidae (Papa-Moscas mira presa/cursor em micro-trancos)
// - Oclusão e Interação com Bordas de Cards (efeito de emergir de frestas da bancada)
// ==========================================================================

const AranhasCinematicaIK = (() => {
  let canvasEl = null;
  let ctx = null;
  let dpr = 1;
  let larg = 1200;
  let alt = 800;

  // Cache leve de retângulos dos cards visíveis (atualizado no máximo a cada 1.6s)
  let cardsCache = [];
  let ultimoCacheCardsTs = 0;

  // Ângulos anatômicos base (em radianos, no referencial local da aranha onde -PI/2 é frente)
  const ANGULOS_BASE_PAR = [-1.02, -0.38, 0.36, 0.98];
  const ALCANCE_PAR = [0.54, 0.48, 0.46, 0.54];
  const COXA_OFFSET_PAR = [0.16, 0.14, 0.14, 0.16];

  function garantirCanvas(camadaEl) {
    if (!camadaEl) return null;
    if (!canvasEl || !camadaEl.contains(canvasEl)) {
      canvasEl = document.createElement("canvas");
      canvasEl.className = "canvas-ik-aranhas";
      canvasEl.setAttribute("aria-hidden", "true");
      camadaEl.insertBefore(canvasEl, camadaEl.firstChild);
      ctx = canvasEl.getContext("2d", { alpha: true });
      redimensionar(window.innerWidth || 1200, window.innerHeight || 800);
    }
    return canvasEl;
  }

  function redimensionar(w, h) {
    larg = Math.max(320, w || window.innerWidth || 1200);
    alt = Math.max(320, h || window.innerHeight || 800);
    dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    if (!canvasEl) return;
    canvasEl.width = Math.round(larg * dpr);
    canvasEl.height = Math.round(alt * dpr);
    canvasEl.style.width = `${larg}px`;
    canvasEl.style.height = `${alt}px`;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function diffAnguloGraus(a, b) {
    return ((a - b + 540) % 360) - 180;
  }

  function atualizarCacheCards(ts) {
    if (ts - ultimoCacheCardsTs < 1600) return;
    ultimoCacheCardsTs = ts;
    const seletores = ".home-hero-card, .card-contador, .card-fio, .card-projeto, .bloco-config, .card-amostra";
    const els = document.querySelectorAll(seletores);
    const novos = [];
    for (let i = 0; i < els.length && novos.length < 14; i++) {
      const r = els[i].getBoundingClientRect();
      if (r.width >= 120 && r.height >= 70 && r.bottom > 0 && r.top < alt && r.right > 0 && r.left < larg) {
        novos.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
    }
    cardsCache = novos;
  }

  // Verifica se a aranha está cruzando a borda de um card para criar sombra de fresta/oclusão sutil
  function obterFatorFrestaCard(x, y, raio) {
    for (let i = 0; i < cardsCache.length; i++) {
      const c = cardsCache[i];
      const dentroX = x >= c.left - raio && x <= c.right + raio;
      const dentroY = y >= c.top - raio && y <= c.bottom + raio;
      if (!dentroX || !dentroY) continue;
      const dBorda = Math.min(
        Math.abs(x - c.left),
        Math.abs(x - c.right),
        Math.abs(y - c.top),
        Math.abs(y - c.bottom)
      );
      if (dBorda < 18) {
        return { ativo: true, intensidade: 1 - dBorda / 18, x, y };
      }
    }
    return null;
  }

  // Inicializa os 8 alvos de Foot-Planting em coordenadas de mundo para uma aranha
  function inicializarPatasIK(inst) {
    const st = inst.estado;
    const radCorpo = ((st.angulo - 90) * Math.PI) / 180;
    const cosC = Math.cos(radCorpo);
    const sinC = Math.sin(radCorpo);
    const perpX = -sinC;
    const perpY = cosC;

    inst.ikPatas = [];
    for (let par = 0; par < 4; par++) {
      for (let s = 0; s < 2; s++) {
        const lado = s === 0 ? -1 : 1; // -1 esq, +1 dir
        const alc = inst.tamPx * ALCANCE_PAR[par];
        const angLocal = ANGULOS_BASE_PAR[par];
        const avancoFrente = -Math.sin(angLocal) * alc * 0.72;
        const aberturaLat = Math.cos(angLocal) * alc * lado;
        const px = st.x + cosC * avancoFrente + perpX * aberturaLat;
        const py = st.y + sinC * avancoFrente + perpY * aberturaLat;
        // Grupo tetrapodal alternado (0 ou 1)
        const grupo = (par + (lado === 1 ? 1 : 0)) % 2;
        inst.ikPatas.push({
          par,
          lado,
          grupo,
          x: px,
          y: py,
          z: 0,
          origX: px,
          origY: py,
          alvoX: px,
          alvoY: py,
          passoT: 1,
          deltaAngGraus: 0
        });
      }
    }
    inst._angAntIK = st.angulo;
    inst._xAntIK = st.x;
    inst._yAntIK = st.y;
    inst._inerciaAbd = 0;
    inst._velInerciaAbd = 0;
    inst._headSaccadeAng = 0;
    inst._headSaccadeTimer = 0;
  }

  // Atualiza a física de Foot-Planting, IK de 2 juntas, inércia do abdômen e saccades visuais
  function atualizarBiomecanicaAranha(inst, dt, flags, cursorAtual, presasAtivas) {
    const st = inst.estado;
    if (!inst.ikPatas) inicializarPatasIK(inst);

    const vx = (st.x - (inst._xAntIK ?? st.x)) / Math.max(0.004, dt);
    const vy = (st.y - (inst._yAntIK ?? st.y)) / Math.max(0.004, dt);
    const velEsc = Math.hypot(vx, vy);
    const dAng = diffAnguloGraus(st.angulo, inst._angAntIK ?? st.angulo);
    const velAng = dAng / Math.max(0.004, dt);

    inst._xAntIK = st.x;
    inst._yAntIK = st.y;
    inst._angAntIK = st.angulo;

    // 1. Micro-física de Inércia (Follow-Through elástico do abdômen ao girar/acelerar)
    const alvoInercia = Math.max(-13, Math.min(13, -velAng * 0.065));
    const forcaMola = (alvoInercia - inst._inerciaAbd) * 140 - inst._velInerciaAbd * 16;
    inst._velInerciaAbd += forcaMola * dt;
    inst._inerciaAbd = Math.max(-15, Math.min(15, inst._inerciaAbd + inst._velInerciaAbd * dt));

    // 2. Head-Tracking em Micro-Trancos (Saccades reais de Salticidae / Papa-Moscas)
    if (inst.especie.id === "papa_moscas") {
      inst._headSaccadeTimer -= dt;
      if (inst._headSaccadeTimer <= 0) {
        inst._headSaccadeTimer = 0.16 + Math.random() * 0.18;
        let alvoOlhar = null;
        let menorD = 260;
        for (let i = 0; i < presasAtivas.length; i++) {
          const pr = presasAtivas[i];
          const dp = Math.hypot(pr.x - st.x, pr.y - st.y);
          if (dp < menorD) {
            menorD = dp;
            alvoOlhar = { x: pr.x, y: pr.y };
          }
        }
        if (!alvoOlhar && cursorAtual && cursorAtual.ativo) {
          const dc = Math.hypot(cursorAtual.x - st.x, cursorAtual.y - st.y);
          if (dc >= 70 && dc <= 270) {
            alvoOlhar = { x: cursorAtual.x, y: cursorAtual.y };
          }
        }
        if (alvoOlhar) {
          const angMundo = (Math.atan2(alvoOlhar.y - st.y, alvoOlhar.x - st.x) * 180) / Math.PI + 90;
          const rel = diffAnguloGraus(angMundo, st.angulo);
          // Quantiza em degraus discretos de 4° (saccade biológica real!)
          inst._headSaccadeAng = Math.max(-16, Math.min(16, Math.round((rel * 0.45) / 4) * 4));
        } else {
          inst._headSaccadeAng *= 0.5;
        }
      }
    }

    // 3. Cinemática Inversa (IK) 2 juntas + Foot-Planting no chão
    const radCorpo = ((st.angulo - 90) * Math.PI) / 180;
    const cosC = Math.cos(radCorpo);
    const sinC = Math.sin(radCorpo);
    const perpX = -sinC;
    const perpY = cosC;

    const noArGlobal = Boolean(flags && (flags.noAr || st.tipo === "ballooning" || st.tipo === "rapel_fio"));
    const limiarPasso = Math.max(7, inst.tamPx * 0.21);

    // Conta quantas patas de cada grupo tetrapodal estão atualmente no ar dando passo
    let noArGrupo0 = 0;
    let noArGrupo1 = 0;
    for (let i = 0; i < inst.ikPatas.length; i++) {
      const p = inst.ikPatas[i];
      if (p.passoT < 1) {
        if (p.grupo === 0) noArGrupo0++;
        else noArGrupo1++;
      }
    }

    for (let i = 0; i < inst.ikPatas.length; i++) {
      const p = inst.ikPatas[i];
      const alc = inst.tamPx * ALCANCE_PAR[p.par];
      const angLocal = ANGULOS_BASE_PAR[p.par];
      const avancoFrente = -Math.sin(angLocal) * alc * 0.72;
      const aberturaLat = Math.cos(angLocal) * alc * p.lado;

      // Posição ideal de repouso da ponta do tarso no mundo + leve antecipação da velocidade (lead)
      const leadX = Math.max(-alc * 0.38, Math.min(alc * 0.38, vx * 0.055));
      const leadY = Math.max(-alc * 0.38, Math.min(alc * 0.38, vy * 0.055));
      const idealX = st.x + cosC * avancoFrente + perpX * aberturaLat + leadX;
      const idealY = st.y + sinC * avancoFrente + perpY * aberturaLat + leadY;

      // Posição da coxa (articulação basal no cefalotórax)
      const coxaDist = inst.tamPx * COXA_OFFSET_PAR[p.par];
      const coxaFrente = (1.5 - p.par) * (inst.tamPx * 0.055);
      p.coxaX = st.x + cosC * coxaFrente + perpX * (coxaDist * p.lado);
      p.coxaY = st.y + sinC * coxaFrente + perpY * (coxaDist * p.lado);

      if (noArGlobal) {
        // Durante salto/rapel/ballooning, as patas acompanham o corpo no ar
        p.x = idealX;
        p.y = idealY;
        p.z = (flags && flags.sombraExtra) || 8;
        p.passoT = 1;
      } else {
        const distIdeal = Math.hypot(idealX - p.x, idealY - p.y);
        // Se a aranha teletransportou (ex.: spawn de cena), ressincroniza imediatamente
        if (distIdeal > inst.tamPx * 1.45) {
          p.x = idealX;
          p.y = idealY;
          p.origX = idealX;
          p.origY = idealY;
          p.alvoX = idealX;
          p.alvoY = idealY;
          p.passoT = 1;
          p.z = 0;
        } else if (p.passoT >= 1) {
          // Pata plantada no pixel exato do chão! Verifica se precisa dar um passo tetrapodal
          const outroGrupoOcupado = p.grupo === 0 ? noArGrupo1 >= 2 : noArGrupo0 >= 2;
          if (distIdeal > limiarPasso && (!outroGrupoOcupado || distIdeal > limiarPasso * 1.55)) {
            p.origX = p.x;
            p.origY = p.y;
            p.alvoX = idealX + leadX * 0.45;
            p.alvoY = idealY + leadY * 0.45;
            p.passoT = 0;
            if (p.grupo === 0) noArGrupo0++;
            else noArGrupo1++;
          }
        }

        if (p.passoT < 1) {
          const velPasso = Math.max(7.5, Math.min(18, 7.2 + velEsc * 0.065));
          p.passoT = Math.min(1, p.passoT + dt * velPasso);
          const ease = p.passoT * p.passoT * (3 - 2 * p.passoT);
          p.x = p.origX + (p.alvoX - p.origX) * ease;
          p.y = p.origY + (p.alvoY - p.origY) * ease;
          p.z = Math.sin(p.passoT * Math.PI) * Math.max(3.5, inst.tamPx * 0.11);
        } else {
          p.z = 0;
        }
      }

      // 4. Solver Analítico de IK 2 Segmentos (Fêmur L1 + Tíbia/Tarso L2)
      const dx = p.x - p.coxaX;
      const dy = p.y - p.coxaY;
      const dist2D = Math.max(2, Math.hypot(dx, dy));
      const L1 = alc * 0.56; // Fêmur
      const L2 = alc * 0.62; // Tíbia + Metatarso
      const dClamped = Math.min(L1 + L2 - 0.5, Math.max(Math.abs(L1 - L2) + 0.5, dist2D));
      const cosJoelho = (L1 * L1 + dClamped * dClamped - L2 * L2) / (2 * L1 * dClamped);
      const angInterno = Math.acos(Math.max(-1, Math.min(1, cosJoelho)));

      // Joelho arqueia anatomicamente para cima (eixo Z -> elevação na tela) e para frente/trás conforme o par
      const dirBase = Math.atan2(dy, dx);
      const curvaturaPar = (p.par <= 1 ? -1 : 1) * p.lado * 0.48;
      const angFemur = dirBase + curvaturaPar * angInterno;
      const elevacaoJoelho = Math.sin(angInterno) * L1 * 0.42 + p.z * 0.55;

      p.joelhoX = p.coxaX + Math.cos(angFemur) * L1;
      p.joelhoY = p.coxaY + Math.sin(angFemur) * L1 - elevacaoJoelho;

      // Calcula o desvio angular real da pata plantada em relação ao ângulo ideal para modular a pata SVG
      const idealDx = idealX - p.coxaX;
      const idealDy = idealY - p.coxaY;
      const angAtualMundo = (Math.atan2(dy, dx) * 180) / Math.PI;
      const angIdealMundo = (Math.atan2(idealDy, idealDx) * 180) / Math.PI;
      p.deltaAngGraus = Math.max(-18, Math.min(18, diffAnguloGraus(angAtualMundo, angIdealMundo) * 0.62));
    }
  }

  // Desenha sombra de contato física 3D + articulações tarsais de 2 juntas + sombra de fresta nos cards
  function renderizarFrame(camadaEl, ativas, presasAtivas, ts) {
    if (!ativas.length && !presasAtivas.length) {
      if (ctx && canvasEl) ctx.clearRect(0, 0, larg, alt);
      return;
    }
    garantirCanvas(camadaEl);
    if (!ctx) return;

    atualizarCacheCards(ts || 0);
    ctx.clearRect(0, 0, larg, alt);

    // Cor temática atual para os tarsos articulados e sombras de contato
    const estiloRoot = getComputedStyle(document.documentElement);
    const corTinta = (estiloRoot.getPropertyValue("--aranha-tinta") || "#fcf1d0").trim();
    const temaClaro = document.documentElement.getAttribute("data-tema-base") === "claro";
    const alphaSombraBase = temaClaro ? 0.16 : 0.34;

    // 1. Sombras de contato 3D das presas (encolhem e deslocam durante o voo!)
    for (let i = 0; i < presasAtivas.length; i++) {
      const pr = presasAtivas[i];
      if (!isFinite(pr.x) || !isFinite(pr.y)) continue;
      const alturaVoo = Math.max(0, ((pr.escalaExtraX || 1) - 1) * 65);
      const sx = pr.x + alturaVoo * 0.85;
      const sy = pr.y + 3 + alturaVoo * 1.15;
      const rx = Math.max(5, pr.tamPx * 0.28 * Math.max(0.55, 1 - alturaVoo * 0.015));
      const ry = rx * 0.62;
      const alpha = alphaSombraBase * Math.max(0.28, 1 - alturaVoo * 0.022);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(((pr.angulo || 0) * Math.PI) / 180);
      const grad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
      grad.addColorStop(0, `rgba(1, 5, 22, ${alpha.toFixed(3)})`);
      grad.addColorStop(1, "rgba(1, 5, 22, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Sombras de contato 3D + Patas IK de 2 juntas (Fêmur -> Joelho -> Tarso plantado) das aranhas
    for (let i = 0; i < ativas.length; i++) {
      const inst = ativas[i];
      const st = inst.estado;
      if (!st || !isFinite(st.x) || !isFinite(st.y)) continue;

      const alturaAranha = inst._elevadaAtiva ? 11 : st.tipo === "ballooning" ? 16 : st.tipo === "rapel_fio" ? 7 : 0;
      const sx = st.x + alturaAranha * 0.95;
      const sy = st.y + 4 + alturaAranha * 1.25;
      const rx = Math.max(10, inst.tamPx * 0.36 * Math.max(0.58, 1 - alturaAranha * 0.02));
      const ry = rx * 0.74;
      const alpha = alphaSombraBase * (inst.especie.id === "tarantula_golias" ? 1.25 : 1) * Math.max(0.32, 1 - alturaAranha * 0.025);

      // 2.1 Sombra elíptica projetada no chão sob o corpo
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(((st.angulo || 0) * Math.PI) / 180);
      const grad = ctx.createRadialGradient(0, 0, rx * 0.12, 0, 0, rx);
      grad.addColorStop(0, `rgba(1, 5, 22, ${Math.min(0.52, alpha).toFixed(3)})`);
      grad.addColorStop(1, "rgba(1, 5, 22, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2.2 Oclusão sutil ao cruzar a fresta/borda de um card da bancada
      const fresta = obterFrestaCardSeAtivo(inst, st);
      if (fresta) {
        ctx.save();
        const rF = inst.tamPx * 0.38;
        const gF = ctx.createRadialGradient(st.x, st.y, 2, st.x, st.y, rF);
        gF.addColorStop(0, `rgba(1, 6, 28, ${(0.28 * fresta.intensidade).toFixed(3)})`);
        gF.addColorStop(1, "rgba(1, 6, 28, 0)");
        ctx.fillStyle = gF;
        ctx.beginPath();
        ctx.arc(st.x, st.y, rF, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2.3 Micro-sombras de apoio plantar + Tarsos articulados (2ª junta IK plantada no chão!)
      if (inst.ikPatas) {
        ctx.save();
        ctx.strokeStyle = corTinta;
        ctx.fillStyle = corTinta;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const espTarso = inst.especie.id === "tarantula_golias" ? 2.1 : inst.especie.id === "filhote" ? 0.95 : 1.3;

        for (let k = 0; k < inst.ikPatas.length; k++) {
          const p = inst.ikPatas[k];
          if (!isFinite(p.joelhoX) || !isFinite(p.x)) continue;

          // Sombra pontual da garra tarsal quando plantada no chão (z < 1.5)
          if (p.z < 1.5 && alturaAranha < 4) {
            ctx.globalAlpha = temaClaro ? 0.16 : 0.28;
            ctx.beginPath();
            ctx.arc(p.x + 1, p.y + 1.5, espTarso * 1.45, 0, Math.PI * 2);
            ctx.fill();
          }

          // Segmento distal articulado (Joelho -> Tarso plantado) + junta do joelho
          ctx.globalAlpha = inst.especie.id === "filhote" ? 0.34 : 0.44;
          ctx.lineWidth = espTarso;
          ctx.beginPath();
          ctx.moveTo(p.joelhoX, p.joelhoY);
          ctx.lineTo(p.x, p.y - p.z);
          ctx.stroke();

          // Micro-garra tarsal no ponto exato de apoio
          ctx.globalAlpha = 0.52;
          ctx.beginPath();
          ctx.arc(p.x, p.y - p.z, espTarso * 0.72, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  function obterFrestaCardSeAtivo(inst, st) {
    if (alturaMaiorQueZero(inst)) return null;
    return obterFatorFrestaCard(st.x, st.y, inst.tamPx * 0.4);
  }

  function alturaMaiorQueZero(inst) {
    return Boolean(inst._elevadaAtiva || inst.estado.tipo === "ballooning");
  }

  return {
    garantirCanvas,
    redimensionar,
    atualizarBiomecanicaAranha,
    renderizarFrame
  };
})();

if (typeof window !== "undefined") {
  window.AranhasCinematicaIK = AranhasCinematicaIK;
}
