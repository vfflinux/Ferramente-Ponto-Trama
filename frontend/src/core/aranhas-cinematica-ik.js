// ==========================================================================
// PONTO & TRAMA (ÑANDUOBYETÉ) — ENGINE VETORIAL 2D, CINEMÁTICA INVERSA (IK)
// & BIOMECÂNICA POR ESPÉCIE (Baseada no modelo Vec2 + SpiderLeg + Steering)
// ==========================================================================
// 1. Vec2: Biblioteca matemática vetorial 2D pura (add, sub, mult, div, mag,
//    normalize, setMag, limit, rotate, angle, dist, dot, lerp, perp).
// 2. SPECIES_CONFIG: Dicionário anatômico e biomecânico por espécie:
//    - Tarântula Golias (Theraphosa blondi)
//    - Papa-moscas (Salticidae)
//    - Aranha Tecelã (Araneidae / Nephila — tecela_canto & nandu)
//    - Tecelã-de-renda (Amaurobiidae — tecela_renda)
//    - Aranha-caranguejo (Thomisidae — caranguejo)
//    - Filhote Tecelão (filhote)
// 3. SpiderLeg: Instância independente para cada uma das 8 patas com âncora
//    no cefalotórax, alvo ideal no solo, estado de passo parabólico
//    (isStepping, stepProgress, liftHeight = 4*t*(1-t)) e Cinemática Inversa
//    Analítica (Lei dos Cossenos + projeção perpendicular do joelho/patela e
//    articulação secundária tíbia-metatarso), garantindo que NENHUMA pata
//    jamais fique como uma linha reta única.
// 4. Renderização Híbrida HiDPI:
//    - Atualiza os vértices reais (Coxa -> Joelho/Patela -> Tíbia/Metatarso -> Tarso)
//      dos elementos vetoriais de cada aranha a 60 FPS.
//    - Projeta sombras 3D segmentadas por pata que se deslocam conforme liftHeight.
//    - Modo Debug Vetorial & IK em tempo real (Velocidade, Steering, Wander,
//      Raios de Passo, Triângulo IK e Articulações dos Joelhos).
// ==========================================================================

const AranhasCinematicaIK = (() => {
  /**
   * =====================================================================
   * 1. CLASSE VEC2 — BIBLIOTECA COMPLETA DE VETORES 2D
   * =====================================================================
   */
  class Vec2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    copy() {
      return new Vec2(this.x, this.y);
    }

    set(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }

    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }

    sub(v) {
      this.x -= v.x;
      this.y -= v.y;
      return this;
    }

    mult(s) {
      this.x *= s;
      this.y *= s;
      return this;
    }

    div(s) {
      if (s !== 0) {
        this.x /= s;
        this.y /= s;
      }
      return this;
    }

    mag() {
      return Math.hypot(this.x, this.y);
    }

    magSq() {
      return this.x * this.x + this.y * this.y;
    }

    normalize() {
      const m = this.mag();
      if (Number.isFinite(m) && m > 1e-8) {
        this.div(m);
      } else {
        this.set(0, 0);
      }
      return this;
    }

    setMag(len) {
      return this.normalize().mult(len);
    }

    limit(max) {
      const mSq = this.magSq();
      if (!Number.isFinite(mSq)) {
        this.set(0, 0);
      } else if (mSq > max * max) {
        this.div(Math.sqrt(mSq)).mult(max);
      }
      return this;
    }

    rotate(rad) {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const nx = this.x * cos - this.y * sin;
      const ny = this.x * sin + this.y * cos;
      this.x = nx;
      this.y = ny;
      return this;
    }

    angle() {
      return Math.atan2(this.y, this.x);
    }

    dist(v) {
      return Math.hypot(this.x - v.x, this.y - v.y);
    }

    dot(v) {
      return this.x * v.x + this.y * v.y;
    }

    lerp(v, t) {
      this.x += (v.x - this.x) * t;
      this.y += (v.y - this.y) * t;
      return this;
    }

    perp() {
      return new Vec2(-this.y, this.x);
    }

    static add(a, b) {
      return new Vec2(a.x + b.x, a.y + b.y);
    }

    static sub(a, b) {
      return new Vec2(a.x - b.x, a.y - b.y);
    }

    static mult(v, s) {
      return new Vec2(v.x * s, v.y * s);
    }

    static dist(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    static dot(a, b) {
      return a.x * b.x + a.y * b.y;
    }

    static lerp(a, b, t) {
      return new Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }

    static fromAngle(rad, mag = 1) {
      return new Vec2(Math.cos(rad) * mag, Math.sin(rad) * mag);
    }
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function lerpAngle(current, target, t) {
    const diff = wrapAngle(target - current);
    return current + diff * t;
  }

  function smoothstep(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  }

  /**
   * =====================================================================
   * 2. SPECIES_CONFIG — PARÂMETROS ANATÔMICOS E BIOMECÂNICOS POR ESPÉCIE
   * =====================================================================
   * Coordenadas definidas no sistema local do viewBox SVG de cada espécie:
   * - Centro do viewBox: (60, 60) para viewBox 120x120; (90, 90) para 180x180 (Golias)
   * - Frente da aranha no SVG: -Y (topo do SVG, ângulo 0° da instância)
   * - Lado: side = -1 (esquerda, -X) | side = +1 (direita, +X)
   * - IMPORTANTE: Para todas as patas, (femurLen + tibiaLen) é 1.35x a 1.48x maior
   *   que a distância em repouso entre anchor e ideal. Isso garante pela Lei dos
   *   Cossenos uma altura perpendicular h ampla (16 a 34 unidades), formando
   *   SEMPRE duas partes articuladas em ângulo anatômico real (Fêmur -> Joelho/Patela
   *   -> Tíbia/Metatarso -> Tarso) e NUNCA uma linha reta!
   */
  const SPECIES_CONFIG = {
    // 1. Tarântula Golias (Theraphosa blondi — viewBox 180x180, centro 90,90)
    tarantula_golias: {
      id: "tarantula_golias",
      nome: "Tarântula Golias (Theraphosa blondi)",
      viewBoxSize: 180,
      baseMaxSpeed: 42,
      baseMaxForce: 135,
      turnRateBase: 3.4,
      abdomenFollowRate: 2.8,
      abdomenSwayAmp: 0.032,
      stepThresholdSvg: 18,
      emergencyThresholdSvg: 34,
      stepDurationMin: 0.19,
      stepDurationMax: 0.28,
      leadTimeBase: 0.14,
      liftHeightScale: 0.65,
      kneeLiftSvg: 3.6,
      tibiaCurveSvg: 2.2,
      topDownKneeRatio: 0.14,
      minSepKneeSvg: 25,
      minSepFootSvg: 36,
      maxSimultaneousSteps: 3,
      weightTremorAmp: 1.35,
      gaitStyle: "heavy_cadenced",
      pairs: [
        // Leque radial bem aberto (vista de cima) para que as 4 patas robustas de cada lado NUNCA se encostem!
        // Par 0 (Dianteiras I — 32° frontal): âncora (73/107, 63), pé ideal (24/156, 8)
        { ax: 17, ay: 63, ix: 66, iy: 8, f: 42, t: 48, bendFront: true },
        // Par 1 (Médio-dianteiras II — 68° lateral-frente): âncora (70/110, 72), pé ideal (6/174, 52)
        { ax: 20, ay: 72, ix: 84, iy: 52, f: 41, t: 47, bendFront: true },
        // Par 2 (Médio-traseiras III — 112° lateral-trás): âncora (70/110, 81), pé ideal (7/173, 118)
        { ax: 20, ay: 81, ix: 83, iy: 118, f: 43, t: 49, bendFront: false },
        // Par 3 (Traseiras IV — 148° traseira): âncora (73/107, 89), pé ideal (24/156, 171)
        { ax: 17, ay: 89, ix: 66, iy: 171, f: 50, t: 58, bendFront: false }
      ]
    },

    // 2. Papa-moscas (Salticidae — viewBox 120x120, centro 60,60)
    papa_moscas: {
      id: "papa_moscas",
      nome: "Papa-moscas (Salticidae)",
      viewBoxSize: 120,
      baseMaxSpeed: 118,
      baseMaxForce: 430,
      turnRateBase: 12.0,
      abdomenFollowRate: 7.5,
      abdomenSwayAmp: 0.055,
      stepThresholdSvg: 13,
      emergencyThresholdSvg: 26,
      stepDurationMin: 0.07,
      stepDurationMax: 0.125,
      leadTimeBase: 0.095,
      liftHeightScale: 1.18,
      kneeLiftSvg: 3.2,
      tibiaCurveSvg: 1.8,
      topDownKneeRatio: 0.15,
      minSepKneeSvg: 15,
      minSepFootSvg: 22,
      maxSimultaneousSteps: 4,
      weightTremorAmp: 0.35,
      gaitStyle: "start_stop_jumper",
      pairs: [
        // Leque radial aberto com corredores angulares exclusivos por par
        { ax: 12, ay: 43, ix: 38, iy: 11, f: 24, t: 27, bendFront: true },
        { ax: 14, ay: 50, ix: 49, iy: 38, f: 22, t: 26, bendFront: true },
        { ax: 14, ay: 58, ix: 48, iy: 77, f: 24, t: 28, bendFront: false },
        { ax: 12, ay: 65, ix: 36, iy: 106, f: 27, t: 32, bendFront: false }
      ]
    },

    // 3A. Aranha Tecelã de Canto (Araneidae / Nephila — viewBox 120x120)
    tecela_canto: {
      id: "tecela_canto",
      nome: "Aranha Tecelã (Araneidae / Nephila)",
      viewBoxSize: 120,
      baseMaxSpeed: 62,
      baseMaxForce: 185,
      turnRateBase: 5.5,
      abdomenFollowRate: 3.6,
      abdomenSwayAmp: 0.068,
      stepThresholdSvg: 17,
      emergencyThresholdSvg: 34,
      stepDurationMin: 0.14,
      stepDurationMax: 0.22,
      leadTimeBase: 0.12,
      liftHeightScale: 1.05,
      kneeLiftSvg: 3.8,
      tibiaCurveSvg: 2.4,
      topDownKneeRatio: 0.15,
      minSepKneeSvg: 17,
      minSepFootSvg: 26,
      maxSimultaneousSteps: 3,
      weightTremorAmp: 0.45,
      gaitStyle: "delicate_pendulum",
      pairs: [
        { ax: 7, ay: 44, ix: 46, iy: 4, f: 31, t: 38, bendFront: true },
        { ax: 9, ay: 49, ix: 56, iy: 32, f: 29, t: 36, bendFront: true },
        { ax: 9, ay: 55, ix: 55, iy: 82, f: 28, t: 34, bendFront: false },
        { ax: 7, ay: 60, ix: 44, iy: 115, f: 32, t: 39, bendFront: false }
      ]
    },

    // 3B. Ñanduobyeté — Tecelã Oficial do Ateliê (Araneidae — viewBox 120x120)
    nandu: {
      id: "nandu",
      nome: "Ñanduobyeté (Aranha Tecelã Oficial)",
      viewBoxSize: 120,
      baseMaxSpeed: 74,
      baseMaxForce: 220,
      turnRateBase: 6.2,
      abdomenFollowRate: 4.2,
      abdomenSwayAmp: 0.058,
      stepThresholdSvg: 16,
      emergencyThresholdSvg: 32,
      stepDurationMin: 0.13,
      stepDurationMax: 0.20,
      leadTimeBase: 0.12,
      liftHeightScale: 1.04,
      kneeLiftSvg: 3.5,
      tibiaCurveSvg: 2.2,
      topDownKneeRatio: 0.15,
      minSepKneeSvg: 16,
      minSepFootSvg: 25,
      maxSimultaneousSteps: 3,
      weightTremorAmp: 0.5,
      gaitStyle: "delicate_pendulum",
      pairs: [
        { ax: 9, ay: 43, ix: 45, iy: 6, f: 29, t: 35, bendFront: true },
        { ax: 10, ay: 49, ix: 55, iy: 34, f: 28, t: 34, bendFront: true },
        { ax: 10, ay: 56, ix: 54, iy: 80, f: 27, t: 33, bendFront: false },
        { ax: 9, ay: 61, ix: 42, iy: 111, f: 30, t: 37, bendFront: false }
      ]
    },

    // 4. Tecelã-de-renda (Amaurobiidae — viewBox 120x120)
    tecela_renda: {
      id: "tecela_renda",
      nome: "Tecelã-de-renda (Amaurobiidae)",
      viewBoxSize: 120,
      baseMaxSpeed: 68,
      baseMaxForce: 265,
      turnRateBase: 7.4,
      abdomenFollowRate: 5.2,
      abdomenSwayAmp: 0.038,
      stepThresholdSvg: 15,
      emergencyThresholdSvg: 30,
      stepDurationMin: 0.10,
      stepDurationMax: 0.16,
      leadTimeBase: 0.10,
      liftHeightScale: 0.78,
      kneeLiftSvg: 3.0,
      tibiaCurveSvg: -2.0,
      topDownKneeRatio: 0.14,
      minSepKneeSvg: 16,
      minSepFootSvg: 25,
      maxSimultaneousSteps: 4,
      weightTremorAmp: 0.35,
      gaitStyle: "cautious_agile",
      pairs: [
        { ax: 6, ay: 44, ix: 46, iy: 6, f: 29, t: 35, bendFront: true },
        { ax: 8, ay: 48, ix: 56, iy: 33, f: 28, t: 33, bendFront: true },
        { ax: 8, ay: 54, ix: 55, iy: 81, f: 28, t: 33, bendFront: false },
        { ax: 6, ay: 58, ix: 44, iy: 113, f: 30, t: 36, bendFront: false }
      ]
    },

    // 5. Aranha-caranguejo (Thomisidae — viewBox 120x120)
    caranguejo: {
      id: "caranguejo",
      nome: "Aranha-caranguejo (Thomisidae)",
      viewBoxSize: 120,
      baseMaxSpeed: 66,
      baseMaxForce: 250,
      turnRateBase: 6.5,
      abdomenFollowRate: 6.0,
      abdomenSwayAmp: 0.03,
      stepThresholdSvg: 14,
      emergencyThresholdSvg: 28,
      stepDurationMin: 0.11,
      stepDurationMax: 0.17,
      leadTimeBase: 0.11,
      liftHeightScale: 0.88,
      kneeLiftSvg: 3.2,
      tibiaCurveSvg: -2.8,
      topDownKneeRatio: 0.16,
      minSepKneeSvg: 15,
      minSepFootSvg: 22,
      maxSimultaneousSteps: 4,
      weightTremorAmp: 0.35,
      gaitStyle: "crab_lateral",
      crabWalk: true,
      pairs: [
        // Pares 0 e 1 (Dianteiras raptoriais) bem separados em arco; pares 2 e 3 curtos e espaçados atrás
        { ax: 12, ay: 46, ix: 46, iy: 10, f: 30, t: 35, bendFront: true },
        { ax: 12, ay: 52, ix: 54, iy: 38, f: 29, t: 34, bendFront: true },
        { ax: 11, ay: 60, ix: 39, iy: 74, f: 19, t: 22, bendFront: false },
        { ax: 9, ay: 65, ix: 30, iy: 98, f: 20, t: 24, bendFront: false }
      ]
    },

    // 6. Filhote Tecelão (Juvenil — viewBox 120x120)
    filhote: {
      id: "filhote",
      nome: "Filhote Tecelão",
      viewBoxSize: 120,
      baseMaxSpeed: 72,
      baseMaxForce: 260,
      turnRateBase: 8.5,
      abdomenFollowRate: 6.0,
      abdomenSwayAmp: 0.05,
      stepThresholdSvg: 13,
      emergencyThresholdSvg: 26,
      stepDurationMin: 0.08,
      stepDurationMax: 0.14,
      leadTimeBase: 0.095,
      liftHeightScale: 1.0,
      kneeLiftSvg: 3.0,
      tibiaCurveSvg: 1.8,
      topDownKneeRatio: 0.14,
      minSepKneeSvg: 13,
      minSepFootSvg: 19,
      maxSimultaneousSteps: 4,
      weightTremorAmp: 0.25,
      gaitStyle: "cautious_agile",
      pairs: [
        { ax: 7, ay: 47, ix: 34, iy: 18, f: 22, t: 26, bendFront: true },
        { ax: 8, ay: 52, ix: 42, iy: 41, f: 21, t: 25, bendFront: true },
        { ax: 8, ay: 57, ix: 40, iy: 73, f: 21, t: 25, bendFront: false },
        { ax: 7, ay: 62, ix: 31, iy: 96, f: 22, t: 26, bendFront: false }
      ]
    }
  };

  function obterConfigEspecie(especieId) {
    return SPECIES_CONFIG[especieId] || SPECIES_CONFIG.nandu;
  }

  /**
   * =====================================================================
   * 3. CONVERSÃO DE ESPAÇO VETORIAL (VIEWBOX SVG <-> MUNDO TELA)
   * =====================================================================
   */
  function svgParaMundo(svgX, svgY, st, tamPx, centroSvg) {
    const rad = ((st.angulo || 0) * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const esc = tamPx / (centroSvg * 2);
    const dx = (svgX - centroSvg) * esc;
    const dy = (svgY - centroSvg) * esc;
    return new Vec2(
      st.x + (dx * cosA - dy * sinA),
      st.y + (dx * sinA + dy * cosA)
    );
  }

  function mundoParaSvg(mundoVec, st, tamPx, centroSvg) {
    const dxM = mundoVec.x - st.x;
    const dyM = mundoVec.y - st.y;
    const rad = (-(st.angulo || 0) * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const escInv = (centroSvg * 2) / Math.max(12, tamPx);
    return new Vec2(
      centroSvg + (dxM * cosA - dyM * sinA) * escInv,
      centroSvg + (dxM * sinA + dyM * cosA) * escInv
    );
  }

  /**
   * =====================================================================
   * 4. CLASSE SPIDERLEG — PATA COM CINEMÁTICA INVERSA E PASSO PARABÓLICO
   * =====================================================================
   */
  class SpiderLeg {
    /**
     * @param {number} index - Índice da pata (0 a 7)
     * @param {number} side - -1 (esquerda) ou +1 (direita)
     * @param {number} pairIndex - 0 (dianteira) até 3 (traseira)
     * @param {Vec2} anchorSvg - Posição local no cefalotórax (unidades do viewBox SVG)
     * @param {Vec2} idealSvg - Posição ideal local de repouso no chão (unidades do viewBox SVG)
     * @param {number} femurLenSvg - Comprimento base do fêmur no viewBox
     * @param {number} tibiaLenSvg - Comprimento base da tíbia+tarso no viewBox
     * @param {number} bendDir - Direção anatômica de dobra do joelho (+1 ou -1)
     * @param {object} speciesCfg - Configuração biomecânica da espécie
     */
    constructor(index, side, pairIndex, anchorSvg, idealSvg, femurLenSvg, tibiaLenSvg, bendDir, speciesCfg) {
      this.index = index;
      this.side = side;
      this.pairIndex = pairIndex;
      this.anchorSvgBase = anchorSvg.copy();
      this.idealSvgBase = idealSvg.copy();
      this.baseFemurLenSvg = femurLenSvg;
      this.baseTibiaLenSvg = tibiaLenSvg;
      this.bendDir = bendDir;
      this.speciesCfg = speciesCfg;

      // Vetores no espaço do mundo (px da tela)
      this.anchorWorld = new Vec2();
      this.idealWorld = new Vec2();
      this.footPos = new Vec2();
      this.kneePos = new Vec2();
      this.anklePos = new Vec2();

      // Vetores resolvidos no espaço local do viewBox SVG (para atualizar os segmentos vetoriais reais)
      this.anchorSvg = anchorSvg.copy();
      this.kneeSvg = new Vec2();
      this.ankleSvg = new Vec2();
      this.footSvg = idealSvg.copy();

      // Estado do passo (Gait)
      this.isStepping = false;
      this.stepProgress = 1;
      this.stepDuration = speciesCfg.stepDurationMin || 0.14;
      this.stepStart = new Vec2();
      this.stepTarget = new Vec2();
      this.liftHeight = 0;
      this.cooldown = 0;

      // Ângulos equivalentes para compatibilidade com posturas especiais
      this.angFemurGraus = 0;
      this.angDistalGraus = 0;
    }

    /**
     * Atualiza âncora e alvo ideal no espaço do mundo usando rotação vetorial
     */
    updateTargets(st, tamPx, centroSvg, reachScale) {
      this.anchorWorld = svgParaMundo(this.anchorSvgBase.x, this.anchorSvgBase.y, st, tamPx, centroSvg);

      // Escala o alcance radial a partir da âncora do cefalotórax
      const relIdeal = Vec2.sub(this.idealSvgBase, this.anchorSvgBase).mult(reachScale);
      const scaledIdealSvg = Vec2.add(this.anchorSvgBase, relIdeal);
      this.idealWorld = svgParaMundo(scaledIdealSvg.x, scaledIdealSvg.y, st, tamPx, centroSvg);
    }

    /**
     * Inicia um passo suave projetando o destino à frente via vetor velocidade
     */
    startStep(bodyVel, speedScale, stepThresholdWorld) {
      this.isStepping = true;
      this.stepProgress = 0;
      this.stepStart = this.footPos.copy();

      const cfg = this.speciesCfg;
      const leadTime = (cfg.leadTimeBase || 0.14) + 0.035 * (1 / Math.max(0.5, speedScale));
      const velocityProjection = Vec2.mult(bodyVel, leadTime).limit(stepThresholdWorld * 0.92);

      // Micro-variação orgânica para evitar rigidez mecânica
      const jitter = Vec2.fromAngle(Math.random() * Math.PI * 2, Math.min(2.2, stepThresholdWorld * 0.08));
      this.stepTarget = Vec2.add(this.idealWorld, velocityProjection).add(jitter);

      const speedMag = bodyVel.mag();
      const dMin = cfg.stepDurationMin || 0.09;
      const dMax = cfg.stepDurationMax || 0.20;
      this.stepDuration = Math.max(dMin, Math.min(dMax, dMax - speedMag * 0.00032));
    }

    /**
     * Avança a animação parabólica do passo e resolve a Cinemática Inversa
     */
    updateStep(dt, st, tamPx, centroSvg, reachScale, overridePoseSvg = null) {
      if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

      if (overridePoseSvg) {
        // Postura especial (ex.: salto no ar, cortejo erguendo 1º par, defesa, esgrima)
        this.isStepping = false;
        this.stepProgress = 1;
        this.liftHeight = overridePoseSvg.lift || 0;
        this.footPos = svgParaMundo(overridePoseSvg.fx, overridePoseSvg.fy, st, tamPx, centroSvg);
      } else if (this.isStepping) {
        this.stepProgress += dt / Math.max(0.06, this.stepDuration);
        if (this.stepProgress >= 1) {
          this.stepProgress = 1;
          this.isStepping = false;
          this.footPos = this.stepTarget.copy();
          this.liftHeight = 0;
          this.cooldown = 0.035;
        } else {
          const eased = smoothstep(this.stepProgress);
          // Acompanha suavemente o idealWorld caso a aranha gire rápido durante o passo
          const liveTarget = Vec2.lerp(this.stepTarget, this.idealWorld, 0.25);
          this.footPos = Vec2.lerp(this.stepStart, liveTarget, eased);
          // Arco parabólico suave: 4 * t * (1 - t) atinge pico 1.0 em t = 0.5
          this.liftHeight = 4 * this.stepProgress * (1 - this.stepProgress) * (this.speciesCfg.liftHeightScale || 1.0);
        }
      } else {
        this.liftHeight = 0;
      }

      this.solveIK(st, tamPx, centroSvg, reachScale);
    }

    /**
     * Cinemática Inversa Analítica de 2/3 Segmentos (Lei dos Cossenos + Vetor Perpendicular)
     * Calcula a posição exata da articulação do joelho (patela) e da tíbia-metatarso
     * tanto no espaço local do viewBox SVG quanto no espaço do mundo (Canvas).
     */
    solveIK(st, tamPx, centroSvg, reachScale) {
      const cfg = this.speciesCfg;
      const scaleL = 0.72 + 0.28 * reachScale;
      const L1 = this.baseFemurLenSvg * scaleL;
      const L2 = this.baseTibiaLenSvg * scaleL;

      this.anchorSvg = this.anchorSvgBase.copy();
      const rawFootSvg = mundoParaSvg(this.footPos, st, tamPx, centroSvg);

      // Vetor da âncora até a ponta da pata no espaço do viewBox SVG
      const toFoot = Vec2.sub(rawFootSvg, this.anchorSvg);
      let dist = toFoot.mag();

      // Clamping para garantir solução real e preservar sempre uma dobra mínima visível no joelho!
      const minDist = Math.abs(L1 - L2) + 2.5;
      const maxDist = (L1 + L2) * 0.965;
      if (dist < minDist) dist = minDist;
      if (dist > maxDist) dist = maxDist;

      const dir = toFoot.copy().normalize();
      if (toFoot.magSq() < 1e-6) {
        dir.set(this.side, 0);
      }

      // Ponta da pata respeitando o alcance físico máximo (impede que a pata estique como linha reta!)
      this.footSvg = Vec2.add(this.anchorSvg, Vec2.mult(dir, dist));

      // Lei dos Cossenos: projeção 'a' ao longo de dir e altura perpendicular 'h' do joelho (patela)
      // Na vista superior (top-down 2D), o joelho da aranha sobe principalmente no eixo Z (vertical),
      // projetando no plano XY uma dobra lateral moderada (~14% a 18% de dist). Isso exibe claramente
      // as 2/3 partes articuladas da pata sem jamais invadir o corredor da pata vizinha!
      const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
      const hRaw = Math.sqrt(Math.max(4.0, L1 * L1 - a * a));
      const maxTopDownH = dist * (cfg.topDownKneeRatio || 0.15);
      const minTopDownH = dist * 0.10;
      const h = Math.max(minTopDownH, Math.min(maxTopDownH, hRaw * 0.42));

      // Vetor perpendicular para dobrar o joelho no sentido anatômico correto
      const perp = dir.perp().mult(this.bendDir);

      // Elevação 2.5D do joelho durante o arco parabólico do passo
      const liftOffsetSvg = perp.copy().mult(this.liftHeight * (cfg.kneeLiftSvg || 3.4));

      // Posição exata do Joelho (Fêmur-Patela) no SVG
      this.kneeSvg = this.anchorSvg
        .copy()
        .add(Vec2.mult(dir, a))
        .add(Vec2.mult(perp, h))
        .add(liftOffsetSvg);

      // Articulação secundária Tíbia-Metatarso (Ankle) entre o Joelho e a Ponta do Tarso
      const toTip = Vec2.sub(this.footSvg, this.kneeSvg);
      const tipPerp = toTip.perp().normalize().mult(this.bendDir * (cfg.tibiaCurveSvg || 2.0));
      this.ankleSvg = Vec2.lerp(this.kneeSvg, this.footSvg, 0.56).add(tipPerp);

      // Sincroniza coordenadas de mundo para as sombras projetadas e o modo Debug
      this.kneePos = svgParaMundo(this.kneeSvg.x, this.kneeSvg.y, st, tamPx, centroSvg);
      this.anklePos = svgParaMundo(this.ankleSvg.x, this.ankleSvg.y, st, tamPx, centroSvg);
      this.footPos = svgParaMundo(this.footSvg.x, this.footSvg.y, st, tamPx, centroSvg);
    }
  }

  /**
   * =====================================================================
   * 5. ESTADO DO MOTOR, CONTROLES EM TEMPO REAL & CACHE DE CARDS
   * =====================================================================
   */
  let canvasEl = null;
  let ctx = null;
  let dpr = 1;
  let larg = 1200;
  let alt = 800;

  let cardsCache = [];
  let ultimoCacheCardsTs = 0;

  // Controles interativos em tempo real (compatíveis com o painel de controle / Configurações)
  const runtimeConfig = {
    mode: "autonomous", // 'autonomous' | 'seek' | 'flee'
    speedScale: 1.0,
    reachScale: 1.0,
    showDebug: false,
    poi: null // { pos: Vec2, life: 0, maxLife: 8.5, arrivedTime: 0 }
  };

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

  /**
   * =====================================================================
   * 6. INICIALIZAÇÃO DAS 8 INSTÂNCIAS SPIDERLEG E STEERING POR ARANHA
   * =====================================================================
   */
  function obterFaseMetacronal(par, lado) {
    const grupo = (par + (lado === 1 ? 1 : 0)) % 2;
    const atrasoPar = (3 - par) * 0.12;
    return (grupo * 0.5 + atrasoPar) % 1.0;
  }

  function inicializarPatasIK(inst) {
    const st = inst.estado;
    const cfg = obterConfigEspecie(inst.especie.id);
    const centroSvg = cfg.viewBoxSize * 0.5;
    inst._centroSvgIK = centroSvg;
    inst._speciesCfg = cfg;

    // Estado vetorial Vec2 para Steering Behaviors e telemetria de Debug
    inst._posVec = new Vec2(st.x, st.y);
    const radMov = (((st.angulo || 0) - 90) * Math.PI) / 180;
    inst._velVec = Vec2.fromAngle(radMov, cfg.baseMaxSpeed * 0.4);
    inst._accVec = new Vec2(0, 0);
    inst._lastSteeringVec = new Vec2(0, 0);
    inst._wanderAngle = (Math.random() - 0.5) * 1.5;
    inst._wanderCircleCenter = new Vec2(st.x, st.y);
    inst._wanderTargetPoint = new Vec2(st.x, st.y);

    // Estado de locomoção start-stop para Salticidae (Papa-moscas) e marcha lateral para Thomisidae (Caranguejo)
    inst._burstTimer = 0.45 + Math.random() * 0.35;
    inst._pauseScanTimer = 0;
    inst._crabSideDir = Math.random() < 0.5 ? 1 : -1;

    const esc = inst.tamPx / cfg.viewBoxSize;
    const stepThresholdWorld = cfg.stepThresholdSvg * esc * runtimeConfig.reachScale;
    const dirFrente = Vec2.fromAngle(radMov, 1);

    inst.ikPatas = inst.patas.map((pataDom, idx) => {
      const side = Number(pataDom.lado) || 1;
      const pairIndex = Number(pataDom.par) || 0;
      const pairCfg = cfg.pairs[pairIndex] || cfg.pairs[0];

      // Constrói âncora e alvo ideal no viewBox SVG a partir de SPECIES_CONFIG
      const anchorSvg = new Vec2(centroSvg + side * pairCfg.ax, pairCfg.ay);
      const idealSvg = new Vec2(centroSvg + side * pairCfg.ix, pairCfg.iy);

      // No sistema de coordenadas da tela (+X direita, +Y baixo, frente da aranha em -Y no SVG):
      // bendFront = true dobra o joelho para frente/fora; bendFront = false dobra para trás/fora
      const bendDir = pairCfg.bendFront ? side : -side;

      const leg = new SpiderLeg(
        idx,
        side,
        pairIndex,
        anchorSvg,
        idealSvg,
        pairCfg.f,
        pairCfg.t,
        bendDir,
        cfg
      );

      // Cacheia referências DOM internas da pata para atualização direta dos vértices SVG
      leg.dom = {
        g: pataDom.el,
        distalG: pataDom.distalEl,
        femurPath: pataDom.el.querySelector(".pata-seg-femur"),
        distalPath: pataDom.el.querySelector(".pata-seg-distal"),
        kneeCircle: pataDom.el.querySelector(".pata-junta-joelho"),
        ankleCircle: pataDom.el.querySelector(".pata-junta-tarso"),
        footCircle: pataDom.el.querySelector(".pata-ponta-tarso"),
        anelFemur: pataDom.el.querySelector(".pata-anel-femur"),
        anelDistal: pataDom.el.querySelector(".pata-anel-distal"),
        // Camadas exclusivas da Tarântula Golias 2.0
        goliasFemurBorda: pataDom.el.querySelector(".golias-femur-borda"),
        goliasFemurMiolo: pataDom.el.querySelector(".golias-femur-miolo"),
        goliasFemurFio: pataDom.el.querySelector(".golias-femur-fio"),
        goliasPatelaAcento: pataDom.el.querySelector(".golias-patela-acento"),
        goliasDistalBorda: pataDom.el.querySelector(".golias-distal-borda"),
        goliasDistalMiolo: pataDom.el.querySelector(".golias-distal-miolo"),
        goliasTarsoBorda: pataDom.el.querySelector(".golias-tarso-borda"),
        goliasTarsoAcento: pataDom.el.querySelector(".golias-tarso-acento"),
        goliasCerdasFemurL: pataDom.el.querySelector(".golias-cerdas-femur-l"),
        goliasCerdasFemurC: pataDom.el.querySelector(".golias-cerdas-femur-c"),
        goliasCerdasDistalL: pataDom.el.querySelector(".golias-cerdas-distal-l"),
        goliasCerdasDistalC: pataDom.el.querySelector(".golias-cerdas-distal-c"),
        goliasGarras: pataDom.el.querySelector(".golias-garras")
      };

      // Remove qualquer rotação rígida antiga dos grupos <g>, pois os próprios vértices (A -> K -> M -> F) são atualizados via IK
      pataDom.el.removeAttribute("transform");
      if (pataDom.distalEl) pataDom.distalEl.removeAttribute("transform");

      leg.updateTargets(st, inst.tamPx, centroSvg, runtimeConfig.reachScale);

      // Defasagem metacronal inicial para que as 8 patas já comecem em marcha alternada tetrapodal
      const faseGait = obterFaseMetacronal(pairIndex, side);
      const offsetIni = (faseGait - 0.45) * stepThresholdWorld * 0.72;
      leg.footPos = Vec2.sub(leg.idealWorld, Vec2.mult(dirFrente, offsetIni));
      leg.stepStart = leg.footPos.copy();
      leg.stepTarget = leg.idealWorld.copy();
      leg.cooldown = (1 - faseGait) * 0.06;
      leg.solveIK(st, inst.tamPx, centroSvg, runtimeConfig.reachScale);

      return leg;
    });

    inst._angAntIK = st.angulo;
    inst._xAntIK = st.x;
    inst._yAntIK = st.y;
    inst._inerciaAbd = 0;
    inst._velInerciaAbd = 0;
    inst._headSaccadeAng = 0;
    inst._headSaccadeTimer = 0;

    aplicarGeometriaVetorialPatasSVG(inst);
  }

  /**
   * Regra biomecânica de estabilidade tetrapodal:
   * Impede que a pata oposta do mesmo par ou a pata adjacente do mesmo lado levantem juntas.
   */
  function canLegStep(legs, leg) {
    for (let i = 0; i < legs.length; i++) {
      const other = legs[i];
      if (other.index === leg.index || !other.isStepping) continue;
      if (other.pairIndex === leg.pairIndex && other.side !== leg.side) {
        return false;
      }
      if (other.side === leg.side && Math.abs(other.pairIndex - leg.pairIndex) === 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * =====================================================================
   * 7. STEERING BEHAVIORS (WANDER, ARRIVE/SEEK, FLEE, WALL AVOIDANCE)
   * =====================================================================
   */
  function computeWander(inst, dt, maxSpeed, maxForce) {
    const circleDist = Math.max(42, inst.tamPx * 0.95);
    const circleRadius = Math.max(24, inst.tamPx * 0.55);
    inst._wanderAngle += (Math.random() - 0.5) * 4.2 * dt;

    const radFrente = (((inst.estado.angulo || 0) - 90) * Math.PI) / 180;
    const forward = inst._velVec.magSq() > 4 ? inst._velVec.copy().normalize() : Vec2.fromAngle(radFrente);

    inst._wanderCircleCenter = Vec2.add(inst._posVec, Vec2.mult(forward, circleDist));
    const displacement = Vec2.fromAngle(radFrente + inst._wanderAngle, circleRadius);
    inst._wanderTargetPoint = Vec2.add(inst._wanderCircleCenter, displacement);

    const desired = Vec2.sub(inst._wanderTargetPoint, inst._posVec).setMag(maxSpeed * 0.82);
    return Vec2.sub(desired, inst._velVec).limit(maxForce * 0.8);
  }

  function computeArrive(pos, vel, target, maxSpeed, maxForce, slowRadius = 105) {
    const desired = Vec2.sub(target, pos);
    const d = desired.mag();
    if (d < 4) {
      return Vec2.mult(vel, -2.5).limit(maxForce);
    }
    let speed = maxSpeed;
    if (d < slowRadius) {
      speed = maxSpeed * (d / slowRadius);
    }
    desired.setMag(speed);
    return Vec2.sub(desired, vel).limit(maxForce);
  }

  function computeFlee(pos, vel, threatPos, maxSpeed, maxForce, panicRadius = 260) {
    const away = Vec2.sub(pos, threatPos);
    const d = away.mag();
    if (d > panicRadius || d < 0.001) {
      return new Vec2(0, 0);
    }
    const urgency = 1 - d / panicRadius;
    const desired = away.setMag(maxSpeed * (0.95 + urgency * 0.6));
    return Vec2.sub(desired, vel).limit(maxForce * (1.25 + urgency * 0.9));
  }

  function computeWallAvoidance(pos, vel, width, height, maxSpeed, maxForce) {
    const margin = Math.max(48, Math.min(115, Math.min(width, height) * 0.16));
    const desired = new Vec2(0, 0);
    let nearWall = false;

    if (pos.x < margin) {
      desired.x = maxSpeed * Math.max(0, 1 - pos.x / margin);
      nearWall = true;
    } else if (pos.x > width - margin) {
      desired.x = -maxSpeed * Math.max(0, 1 - (width - pos.x) / margin);
      nearWall = true;
    }

    if (pos.y < margin) {
      desired.y = maxSpeed * Math.max(0, 1 - pos.y / margin);
      nearWall = true;
    } else if (pos.y > height - margin) {
      desired.y = -maxSpeed * Math.max(0, 1 - (height - pos.y) / margin);
      nearWall = true;
    }

    if (!nearWall || desired.magSq() < 1e-8) return new Vec2(0, 0);
    desired.setMag(maxSpeed);
    return Vec2.sub(desired, vel).limit(maxForce * 1.9);
  }

  /**
   * =====================================================================
   * 8. ATUALIZAÇÃO DE FÍSICA, BIOMECÂNICA E IK A CADA FRAME
   * =====================================================================
   */
  function diffAnguloGraus(a, b) {
    return ((a - b + 540) % 360) - 180;
  }

  // Gera cerdas vetoriais rápidas para os 2 segmentos móveis da Tarântula Golias
  function gerarCerdasSegmentoGolias(x1, y1, x2, y2, comp, passos, seed) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 3) return "";
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    let d = "";
    for (let k = 1; k <= passos; k++) {
      const t = k / (passos + 0.45);
      const bx = x1 + dx * t;
      const by = y1 + dy * t;
      const vari = ((k * 13 + seed * 7) % 10) / 10;
      const c = comp * (0.78 + vari * 0.38);
      for (const s of [-1, 1]) {
        const ex = bx + (nx * s + ux * 0.48) * c;
        const ey = by + (ny * s + uy * 0.48) * c;
        d += `M${bx.toFixed(1)} ${by.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} `;
      }
    }
    return d;
  }

  // Calcula postura especial em coordenadas SVG quando a aranha realiza um comportamento não-locomotor
  function obterPosturaEspecialSvg(inst, leg, flags, t) {
    const centroSvg = inst._centroSvgIK || 60;
    const s = leg.side;
    const p = leg.pairIndex;
    const ideal = leg.idealSvgBase;

    if (flags.camuflagemGalhinho) {
      // Postura Tetragnatha: patas alinhadas junto ao eixo longitudinal do corpo
      const fx = centroSvg + s * (p <= 1 ? 8 + p * 3 : 9 + (3 - p) * 3);
      const fy = p <= 1 ? 6 + p * 8 : 112 - (3 - p) * 8;
      return { fx, fy, lift: 0 };
    }
    if (flags.chuteUrticante && p === 3) {
      // Golias raspando o 4º par traseiro no abdômen
      const osc = Math.sin(t * 44 + (s === 1 ? Math.PI : 0)) * 12;
      return { fx: centroSvg + s * (32 + osc), fy: 146 + Math.abs(osc), lift: 0.5 };
    }
    if (flags.cortejoExibicao && (p === 0 || p === 2)) {
      // Semáforos Maratus/Salticidae com 1º e 3º pares erguidos e vibrantes
      const osc = Math.sin(t * 18 + s) * 8;
      return {
        fx: ideal.x + s * (10 + osc),
        fy: ideal.y - (p === 0 ? 10 : 18) + Math.cos(t * 16) * 5,
        lift: 0.85
      };
    }
    if ((flags.cortejoZigueZague || flags.dancaCortejo) && p === 0) {
      const osc = Math.sin(t * 11) * 6;
      return { fx: ideal.x + s * (12 + osc), fy: ideal.y - 8, lift: 0.75 };
    }
    if (flags.disputaCombate && p <= 1) {
      const golpe = Math.sin(t * 28 + (s === 1 ? 0 : Math.PI) + p) * 11;
      return { fx: ideal.x - s * 8 + golpe, fy: ideal.y - 10 - Math.abs(golpe) * 0.5, lift: 0.7 };
    }
    if (flags.disputaEsgrima && p === 0) {
      const toque = Math.sin(t * 24 + (s === 1 ? 0 : Math.PI * 0.85)) * 12;
      return { fx: ideal.x - s * 10 + s * toque * 0.4, fy: ideal.y - 10 + toque, lift: 0.8 };
    }
    if ((flags.disputaAmeaca || flags.emDefesa || flags.armandoBoteGolias) && p <= 1) {
      const vib = Math.sin(t * 18 + s) * 4;
      return { fx: ideal.x + s * (8 + vib), fy: ideal.y - 10, lift: 0.65 };
    }
    if (flags.arremessandoSeda && p === 3) {
      const osc = Math.sin(t * 24 + (s === 1 ? Math.PI : 0)) * 14;
      return { fx: ideal.x - s * 10 + osc, fy: ideal.y - 8, lift: 0.6 };
    }
    if (flags.agachando || flags.preparandoSalto) {
      // Preparação real de salto (Salticidae / Papa-moscas):
      // - Pares traseiros III e IV (p = 2, 3) recolhem e flexionam profundamente junto ao corpo como molas carregadas!
      // - Par I dianteiro (p = 0) ergue-se e abre levemente mirando o alvo do salto!
      if (p === 0) {
        const mira = Math.sin(t * 28) * 2.2;
        return { fx: ideal.x - s * 4, fy: ideal.y - 7 + mira, lift: 0.72 };
      }
      if (p === 1) {
        return { fx: ideal.x + s * 3, fy: ideal.y + 4, lift: 0.2 };
      }
      if (p === 2) {
        return { fx: ideal.x - s * 7, fy: ideal.y - 9, lift: 0.35 };
      }
      // p === 3 (4º par propulsor principal)
      return { fx: ideal.x - s * 6, fy: ideal.y - 12, lift: 0.4 };
    }
    if (flags.noAr || flags.boteHidraulico) {
      // Durante o salto balístico veloz:
      // - Pares dianteiros I e II estendem-se para frente prontos para agarrar/aterrissar!
      // - Pares traseiros III e IV ficam esticados para trás pelo impulso explosivo da catapulta!
      if (p <= 1) {
        return { fx: ideal.x - s * 6, fy: ideal.y - 11, lift: 0.95 };
      }
      return { fx: ideal.x - s * 5, fy: ideal.y + 10, lift: 0.85 };
    }
    return null;
  }

  /**
   * Garante separação angular e longitudinal estrita entre os 4 pares de patas de cada lado
   * na vista superior (top-down), impedindo 100% que duas patas se encostem ou entrem uma dentro da outra!
   */
  function aplicarSeparacaoRadialPatas(inst, st, centroSvg) {
    if (!inst.ikPatas || inst.ikPatas.length < 8) return;
    const cfg = inst._speciesCfg || obterConfigEspecie(inst.especie.id);
    const minSepKnee = cfg.minSepKneeSvg || 15;
    const minSepFoot = cfg.minSepFootSvg || 22;

    for (const side of [-1, 1]) {
      const legsSide = inst.ikPatas
        .filter((l) => l.side === side)
        .sort((a, b) => a.pairIndex - b.pairIndex);

      // Varredura dupla para manter corredores exclusivos entre Par 0 -> Par 1 -> Par 2 -> Par 3
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < legsSide.length - 1; i++) {
          const front = legsSide[i];
          const back = legsSide[i + 1];

          // 1. Separação mínima entre as pontas dos pés (footSvg.y)
          const dyFoot = back.footSvg.y - front.footSvg.y;
          if (dyFoot < minSepFoot) {
            const push = (minSepFoot - dyFoot) * 0.52;
            front.footSvg.y -= push;
            back.footSvg.y += push;
          }

          // 2. Separação mínima entre os joelhos (kneeSvg.y)
          const dyKnee = back.kneeSvg.y - front.kneeSvg.y;
          if (dyKnee < minSepKnee) {
            const pushK = (minSepKnee - dyKnee) * 0.52;
            front.kneeSvg.y -= pushK;
            back.kneeSvg.y += pushK;
          }
        }
      }

      // Recalcula a articulação intermediária (ankleSvg) e posições de mundo após garantir o corredor livre
      for (let i = 0; i < legsSide.length; i++) {
        const leg = legsSide[i];
        const toTip = Vec2.sub(leg.footSvg, leg.kneeSvg);
        const tipPerp = toTip.perp().normalize().mult(leg.bendDir * (cfg.tibiaCurveSvg || 2.0));
        leg.ankleSvg = Vec2.lerp(leg.kneeSvg, leg.footSvg, 0.56).add(tipPerp);

        leg.kneePos = svgParaMundo(leg.kneeSvg.x, leg.kneeSvg.y, st, inst.tamPx, centroSvg);
        leg.anklePos = svgParaMundo(leg.ankleSvg.x, leg.ankleSvg.y, st, inst.tamPx, centroSvg);
        leg.footPos = svgParaMundo(leg.footSvg.x, leg.footSvg.y, st, inst.tamPx, centroSvg);
      }
    }
  }

  /**
   * Atualiza diretamente os atributos "d", "cx" e "cy" dos segmentos vetoriais SVG de cada pata
   * a partir da solução exata (anchorSvg -> kneeSvg -> ankleSvg -> footSvg) de SpiderLeg.solveIK()!
   */
  function aplicarGeometriaVetorialPatasSVG(inst) {
    if (!inst.ikPatas) return;
    const ehGolias = inst.especie.id === "tarantula_golias";

    for (let i = 0; i < inst.ikPatas.length; i++) {
      const leg = inst.ikPatas[i];
      const dom = leg.dom;
      if (!dom) continue;

      const ax = leg.anchorSvg.x;
      const ay = leg.anchorSvg.y;
      const kx = leg.kneeSvg.x;
      const ky = leg.kneeSvg.y;
      const mx = leg.ankleSvg.x;
      const my = leg.ankleSvg.y;
      const fx = leg.footSvg.x;
      const fy = leg.footSvg.y;

      // Chave de cache para evitar mutação DOM redundante quando a pata está 100% imóvel
      const cacheKey = `${ax.toFixed(1)},${ay.toFixed(1)},${kx.toFixed(1)},${ky.toFixed(1)},${mx.toFixed(1)},${my.toFixed(1)},${fx.toFixed(1)},${fy.toFixed(1)}`;
      if (leg._lastSvgKey === cacheKey) continue;
      leg._lastSvgKey = cacheKey;

      if (ehGolias) {
        // Ponto intermediário do fêmur para leve curvatura orgânica da coxa/trocanter até o joelho
        const fMidX = (ax + kx) * 0.5 + (kx - ax) * 0.04;
        const fMidY = (ay + ky) * 0.5 - (ky - ay) * 0.04;
        const dFemur = `M${ax.toFixed(1)} ${ay.toFixed(1)} L${fMidX.toFixed(1)} ${fMidY.toFixed(1)} L${kx.toFixed(1)} ${ky.toFixed(1)}`;
        const dTibia = `M${kx.toFixed(1)} ${ky.toFixed(1)} L${mx.toFixed(1)} ${my.toFixed(1)}`;
        const dTarso = `M${mx.toFixed(1)} ${my.toFixed(1)} L${fx.toFixed(1)} ${fy.toFixed(1)}`;

        if (dom.goliasFemurBorda) dom.goliasFemurBorda.setAttribute("d", dFemur);
        if (dom.goliasFemurMiolo) dom.goliasFemurMiolo.setAttribute("d", dFemur);
        if (dom.goliasFemurFio) dom.goliasFemurFio.setAttribute("d", `M${ax.toFixed(1)} ${ay.toFixed(1)} L${kx.toFixed(1)} ${ky.toFixed(1)}`);

        // Faixa patelar de destaque exatamente sobre a articulação do joelho (kx, ky)
        if (dom.goliasPatelaAcento) {
          const p1x = ax + (kx - ax) * 0.68;
          const p1y = ay + (ky - ay) * 0.68;
          const p2x = kx + (mx - kx) * 0.32;
          const p2y = ky + (my - ky) * 0.32;
          dom.goliasPatelaAcento.setAttribute("d", `M${p1x.toFixed(1)} ${p1y.toFixed(1)} L${kx.toFixed(1)} ${ky.toFixed(1)} L${p2x.toFixed(1)} ${p2y.toFixed(1)}`);
        }

        if (dom.goliasDistalBorda) dom.goliasDistalBorda.setAttribute("d", dTibia);
        if (dom.goliasDistalMiolo) dom.goliasDistalMiolo.setAttribute("d", dTibia);
        if (dom.goliasTarsoBorda) dom.goliasTarsoBorda.setAttribute("d", dTarso);
        if (dom.goliasTarsoAcento) dom.goliasTarsoAcento.setAttribute("d", dTarso);

        if (dom.kneeCircle) {
          dom.kneeCircle.setAttribute("cx", kx.toFixed(1));
          dom.kneeCircle.setAttribute("cy", ky.toFixed(1));
        }
        if (dom.ankleCircle) {
          dom.ankleCircle.setAttribute("cx", mx.toFixed(1));
          dom.ankleCircle.setAttribute("cy", my.toFixed(1));
        }
        if (dom.footCircle) {
          dom.footCircle.setAttribute("cx", fx.toFixed(1));
          dom.footCircle.setAttribute("cy", fy.toFixed(1));
        }

        // Garras tarsais alinhadas à direção do tarso (mx, my) -> (fx, fy)
        if (dom.goliasGarras) {
          const dtx = fx - mx;
          const dty = fy - my;
          const dlen = Math.max(1, Math.hypot(dtx, dty));
          const ux = dtx / dlen;
          const uy = dty / dlen;
          const nx = -uy;
          const ny = ux;
          const g1x = fx + ux * 2.8 + nx * 1.6;
          const g1y = fy + uy * 2.8 + ny * 1.6;
          const g2x = fx + ux * 2.8 - nx * 1.6;
          const g2y = fy + uy * 2.8 - ny * 1.6;
          dom.goliasGarras.setAttribute("d", `M${fx.toFixed(1)} ${fy.toFixed(1)} L${g1x.toFixed(1)} ${g1y.toFixed(1)} M${fx.toFixed(1)} ${fy.toFixed(1)} L${g2x.toFixed(1)} ${g2y.toFixed(1)}`);
        }

        // Cerdas sensoriais acompanhando o fêmur e a tíbia/tarso
        if (dom.goliasCerdasFemurL) {
          dom.goliasCerdasFemurL.setAttribute("d", gerarCerdasSegmentoGolias(ax, ay, kx, ky, 5.6, 5, leg.pairIndex + 5));
        }
        if (dom.goliasCerdasFemurC) {
          dom.goliasCerdasFemurC.setAttribute("d", gerarCerdasSegmentoGolias(ax, ay, kx, ky, 3.1, 8, leg.pairIndex + 1));
        }
        if (dom.goliasCerdasDistalL) {
          dom.goliasCerdasDistalL.setAttribute("d", gerarCerdasSegmentoGolias(kx, ky, fx, fy, 4.8, 5, leg.pairIndex + 7));
        }
        if (dom.goliasCerdasDistalC) {
          dom.goliasCerdasDistalC.setAttribute("d", gerarCerdasSegmentoGolias(kx, ky, fx, fy, 2.7, 8, leg.pairIndex + 3));
        }
      } else {
        // Demais 6 espécies: 3 segmentos afilados claros (Fêmur: A -> K | Tíbia + Tarso: K -> M -> F) + 2 juntas visíveis (K e M)
        if (dom.femurPath) {
          dom.femurPath.setAttribute("d", `M${ax.toFixed(1)} ${ay.toFixed(1)} L${kx.toFixed(1)} ${ky.toFixed(1)}`);
        }
        if (dom.distalPath) {
          dom.distalPath.setAttribute("d", `M${kx.toFixed(1)} ${ky.toFixed(1)} L${mx.toFixed(1)} ${my.toFixed(1)} L${fx.toFixed(1)} ${fy.toFixed(1)}`);
        }
        if (dom.kneeCircle) {
          dom.kneeCircle.setAttribute("cx", kx.toFixed(1));
          dom.kneeCircle.setAttribute("cy", ky.toFixed(1));
        }
        if (dom.ankleCircle) {
          dom.ankleCircle.setAttribute("cx", mx.toFixed(1));
          dom.ankleCircle.setAttribute("cy", my.toFixed(1));
        }
        if (dom.footCircle) {
          dom.footCircle.setAttribute("cx", fx.toFixed(1));
          dom.footCircle.setAttribute("cy", fy.toFixed(1));
        }
        // Anéis de acento acompanhando o meio do fêmur e o meio da tíbia
        if (dom.anelFemur) {
          const a1x = ax + (kx - ax) * 0.45;
          const a1y = ay + (ky - ay) * 0.45;
          const a2x = ax + (kx - ax) * 0.74;
          const a2y = ay + (ky - ay) * 0.74;
          dom.anelFemur.setAttribute("d", `M${a1x.toFixed(1)} ${a1y.toFixed(1)} L${a2x.toFixed(1)} ${a2y.toFixed(1)}`);
        }
        if (dom.anelDistal) {
          const b1x = kx + (mx - kx) * 0.28;
          const b1y = ky + (my - ky) * 0.28;
          const b2x = kx + (mx - kx) * 0.68;
          const b2y = ky + (my - ky) * 0.68;
          dom.anelDistal.setAttribute("d", `M${b1x.toFixed(1)} ${b1y.toFixed(1)} L${b2x.toFixed(1)} ${b2y.toFixed(1)}`);
        }
      }
    }
  }

  function atualizarBiomecanicaAranha(inst, dt, flags, cursorAtual, presasAtivas) {
    const st = inst.estado;
    if (!inst.ikPatas || inst.ikPatas.length !== inst.patas.length) {
      inicializarPatasIK(inst);
    }
    const cfg = inst._speciesCfg || obterConfigEspecie(inst.especie.id);
    const centroSvg = inst._centroSvgIK || cfg.viewBoxSize * 0.5;
    const reachScale = runtimeConfig.reachScale || 1.0;
    const speedScale = runtimeConfig.speedScale || 1.0;

    // 0. Modo de Steering Interativo (Seek Mouse, Flee Mouse ou Ponto de Interesse POI clicado)
    const livreParaSteering =
      !inst.caca &&
      !inst.acaoEspecial &&
      !inst.interacao &&
      !inst.fugindo &&
      st.tipo !== "repouso_teia_canto" &&
      st.tipo !== "rapel_fio" &&
      st.tipo !== "ballooning";

    if (livreParaSteering && (runtimeConfig.mode === "seek" || runtimeConfig.mode === "flee" || runtimeConfig.poi)) {
      const maxSpeed = cfg.baseMaxSpeed * speedScale;
      const maxForce = cfg.baseMaxForce * speedScale;
      inst._posVec.set(st.x, st.y);
      let steering = new Vec2(0, 0);

      if (runtimeConfig.mode === "seek" && cursorAtual && cursorAtual.ativo) {
        steering.add(computeArrive(inst._posVec, inst._velVec, new Vec2(cursorAtual.x, cursorAtual.y), maxSpeed * 1.15, maxForce * 1.25, 110));
      } else if (runtimeConfig.mode === "flee" && cursorAtual && cursorAtual.ativo) {
        const fleeF = computeFlee(inst._posVec, inst._velVec, new Vec2(cursorAtual.x, cursorAtual.y), maxSpeed * 1.35, maxForce * 1.5, 280);
        if (fleeF.magSq() > 1) steering.add(fleeF);
        else steering.add(computeWander(inst, dt, maxSpeed * 0.7, maxForce));
      } else if (runtimeConfig.poi) {
        runtimeConfig.poi.life += dt;
        const dPoi = Vec2.dist(inst._posVec, runtimeConfig.poi.pos);
        if (dPoi < 36) {
          runtimeConfig.poi.arrivedTime += dt;
          steering.add(computeArrive(inst._posVec, inst._velVec, runtimeConfig.poi.pos, maxSpeed * 0.65, maxForce, 85));
          if (runtimeConfig.poi.arrivedTime > 1.5) runtimeConfig.poi = null;
        } else {
          steering.add(computeArrive(inst._posVec, inst._velVec, runtimeConfig.poi.pos, maxSpeed * 1.1, maxForce * 1.15, 105));
        }
        if (runtimeConfig.poi && runtimeConfig.poi.life > runtimeConfig.poi.maxLife) {
          runtimeConfig.poi = null;
        }
      }

      // Wall Avoidance suave quando guiada por Steering interativo
      steering.add(computeWallAvoidance(inst._posVec, inst._velVec, larg, alt, maxSpeed, maxForce));

      // Locomoção Start-Stop característica de Salticidae (Papa-moscas)
      if (cfg.gaitStyle === "start_stop_jumper" && runtimeConfig.mode !== "flee") {
        if (inst._pauseScanTimer > 0) {
          inst._pauseScanTimer -= dt;
          steering.set(0, 0);
          inst._velVec.mult(Math.pow(0.05, dt));
        } else {
          inst._burstTimer -= dt;
          if (inst._burstTimer <= 0) {
            inst._pauseScanTimer = 0.35 + Math.random() * 0.45;
            inst._burstTimer = 0.42 + Math.random() * 0.45;
          }
        }
      }

      inst._lastSteeringVec = steering.copy();
      inst._velVec.add(Vec2.mult(steering, dt)).limit(maxSpeed * 1.35);
      if (steering.magSq() < 20) inst._velVec.mult(Math.pow(0.25, dt));
      inst._posVec.add(Vec2.mult(inst._velVec, dt));

      st.x = inst._posVec.x;
      st.y = inst._posVec.y;
      st.pausaRestante = 0;

      if (inst._velVec.mag() > 5) {
        let angAlvoRad = inst._velVec.angle() + Math.PI * 0.5;
        // Aranha-caranguejo (Thomisidae) pode se deslocar lateralmente mantendo a frente em guarda!
        if (cfg.crabWalk && runtimeConfig.mode !== "seek") {
          angAlvoRad += inst._crabSideDir * Math.PI * 0.42;
        }
        st.anguloAlvo = (angAlvoRad * 180) / Math.PI;
        flags.andando = true;
      } else {
        flags.andando = false;
      }
    } else {
      // Calcula telemetria vetorial (Vec2) real a partir da coreografia autônoma / caçada / interação
      const vx = (st.x - (inst._xAntIK ?? st.x)) / Math.max(0.004, dt);
      const vy = (st.y - (inst._yAntIK ?? st.y)) / Math.max(0.004, dt);
      const novaVel = new Vec2(vx, vy);
      inst._lastSteeringVec = Vec2.sub(novaVel, inst._velVec).div(Math.max(0.01, dt)).limit(cfg.baseMaxForce * 1.6);
      inst._velVec = novaVel;
      inst._posVec.set(st.x, st.y);
      computeWander(inst, dt, cfg.baseMaxSpeed, cfg.baseMaxForce);
    }

    const velEsc = inst._velVec.mag();
    const dAng = diffAnguloGraus(st.angulo, inst._angAntIK ?? st.angulo);
    const velAng = dAng / Math.max(0.004, dt);

    inst._xAntIK = st.x;
    inst._yAntIK = st.y;
    inst._angAntIK = st.angulo;

    // 1. Balanço elástico do Abdômen articulado no pedicelo (específico por espécie)
    const swayAmpDeg = (cfg.abdomenSwayAmp || 0.045) * (180 / Math.PI) * (velEsc > 6 ? 1.5 : 0.45);
    inst._swayPhase = (inst._swayPhase || 0) + dt * (velEsc > 6 ? 4.2 + velEsc * 0.048 : 1.6);
    const alvoInercia = Math.max(-14, Math.min(14, -velAng * 0.065 + Math.sin(inst._swayPhase) * swayAmpDeg));
    const forcaMola = (alvoInercia - inst._inerciaAbd) * (28 * (cfg.abdomenFollowRate || 4.2)) - inst._velInerciaAbd * 15;
    inst._velInerciaAbd += forcaMola * dt;
    inst._inerciaAbd = Math.max(-16, Math.min(16, inst._inerciaAbd + inst._velInerciaAbd * dt));

    // 2. Escaneamento rápido do cefalotórax (Saccades de Salticidae / Papa-moscas)
    if (inst.especie.id === "papa_moscas") {
      inst._headSaccadeTimer -= dt;
      if (inst._headSaccadeTimer <= 0) {
        inst._headSaccadeTimer = 0.16 + Math.random() * 0.22;
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
          if (dc >= 65 && dc <= 280) {
            alvoOlhar = { x: cursorAtual.x, y: cursorAtual.y };
          }
        }
        if (alvoOlhar) {
          const angMundo = (Math.atan2(alvoOlhar.y - st.y, alvoOlhar.x - st.x) * 180) / Math.PI + 90;
          const rel = diffAnguloGraus(angMundo, st.angulo);
          inst._headSaccadeAng = Math.max(-16, Math.min(16, Math.round((rel * 0.45) / 4) * 4));
        } else if (velEsc < 8) {
          // Nas pausas de observação, gira o cefalotórax para escanear o ambiente
          inst._headSaccadeAng = (Math.random() - 0.5) * 18;
        } else {
          inst._headSaccadeAng *= 0.4;
        }
      }
    }

    // 3. Coordenação de Marcha (Gait) e Cinemática Inversa das 8 Instâncias SpiderLeg
    const esc = inst.tamPx / cfg.viewBoxSize;
    const stepThresholdWorld = cfg.stepThresholdSvg * esc * reachScale;
    const emergencyThresholdWorld = cfg.emergencyThresholdSvg * esc * reachScale;
    const teleportThresholdWorld = inst.tamPx * 1.15;

    // 3.1 Atualiza âncoras e alvos ideais no espaço do mundo
    let activeStepsCount = 0;
    for (let i = 0; i < inst.ikPatas.length; i++) {
      const leg = inst.ikPatas[i];
      leg.updateTargets(st, inst.tamPx, centroSvg, reachScale);
      if (leg.isStepping) activeStepsCount++;

      // Reposicionamento instantâneo caso a aranha tenha acabado de nascer ou teletransportado
      const dErr = Vec2.dist(leg.footPos, leg.idealWorld);
      if (dErr > teleportThresholdWorld) {
        const radF = (((st.angulo || 0) - 90) * Math.PI) / 180;
        const faseGait = obterFaseMetacronal(leg.pairIndex, leg.side);
        const off = (faseGait - 0.45) * stepThresholdWorld * 0.65;
        leg.footPos = Vec2.sub(leg.idealWorld, Vec2.fromAngle(radF, off));
        leg.stepStart = leg.footPos.copy();
        leg.stepTarget = leg.idealWorld.copy();
        leg.isStepping = false;
        leg.stepProgress = 1;
        leg.liftHeight = 0;
      }
    }

    // 3.2 Ordena patas não-ativas pela distância ao alvo ideal (prioriza a pata mais esticada)
    const maxSteps = cfg.maxSimultaneousSteps || 4;
    const candidates = inst.ikPatas
      .filter((l) => !l.isStepping && l.cooldown <= 0)
      .map((l) => ({
        leg: l,
        dist: Vec2.dist(l.footPos, l.idealWorld) + l.pairIndex * 0.45
      }))
      .sort((a, b) => b.dist - a.dist);

    // Vetor velocidade efetivo (combina translação linear + velocidade tangencial de giro no próprio eixo)
    for (let i = 0; i < candidates.length && activeStepsCount < maxSteps; i++) {
      const item = candidates[i];
      const leg = item.leg;
      const distReal = Vec2.dist(leg.footPos, leg.idealWorld);

      // Velocidade tangencial local gerada pela rotação do corpo (para girar no próprio eixo na Dança da Seda / Disputas)
      const relAnchor = Vec2.sub(leg.idealWorld, inst._posVec);
      const tangVel = relAnchor.perp().mult((velAng * Math.PI) / 180);
      const effectiveVel = Vec2.add(inst._velVec, tangVel);

      if (distReal > emergencyThresholdWorld) {
        leg.startStep(effectiveVel, speedScale, stepThresholdWorld);
        activeStepsCount++;
      } else if (distReal > stepThresholdWorld && canLegStep(inst.ikPatas, leg)) {
        leg.startStep(effectiveVel, speedScale, stepThresholdWorld);
        activeStepsCount++;
      }
    }

    // 3.3 Avança interpolação parabólica dos passos e resolve IK de cada pata
    const t = inst.tempoVida || 0;
    for (let i = 0; i < inst.ikPatas.length; i++) {
      const leg = inst.ikPatas[i];
      const overridePose = obterPosturaEspecialSvg(inst, leg, flags || {}, t);
      leg.updateStep(dt, st, inst.tamPx, centroSvg, reachScale, overridePose);
    }

    // 3.4 Garante separação radial estrita na vista superior (nenhuma pata encosta ou entra na outra!)
    aplicarSeparacaoRadialPatas(inst, st, centroSvg);

    // 3.5 Escreve os vértices resolvidos (Coxa -> Joelho/Patela -> Tíbia/Metatarso -> Tarso) diretamente no SVG
    aplicarGeometriaVetorialPatasSVG(inst);
  }

  /**
   * =====================================================================
   * 9. RENDERIZAÇÃO NO CANVAS HIDPI (SOMBRAS SEGMENTADAS 3D + MODO DEBUG IK)
   * =====================================================================
   */
  function desenharSetaDebug(origin, vec, scale, color) {
    if (!ctx) return;
    const end = Vec2.add(origin, Vec2.mult(vec, scale));
    const len = Vec2.dist(origin, end);
    if (len < 3) return;
    const ang = Math.atan2(end.y - origin.y, end.x - origin.x);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const head = 7;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(ang - 0.45), end.y - head * Math.sin(ang - 0.45));
    ctx.lineTo(end.x - head * Math.cos(ang + 0.45), end.y - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  function desenharDebugAranha(inst) {
    if (!ctx || !inst.ikPatas) return;
    const st = inst.estado;
    const cfg = inst._speciesCfg || obterConfigEspecie(inst.especie.id);
    const esc = inst.tamPx / cfg.viewBoxSize;
    const stepThresholdWorld = cfg.stepThresholdSvg * esc * (runtimeConfig.reachScale || 1.0);

    ctx.save();

    // 1. Círculo de Wander projetado à frente
    if (inst._wanderCircleCenter && inst._wanderTargetPoint) {
      const rWander = Math.max(20, inst.tamPx * 0.45);
      ctx.strokeStyle = "rgba(252, 241, 208, 0.25)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(inst._wanderCircleCenter.x, inst._wanderCircleCenter.y, rWander, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(inst._wanderCircleCenter.x, inst._wanderCircleCenter.y);
      ctx.lineTo(inst._wanderTargetPoint.x, inst._wanderTargetPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#FCF1D0";
      ctx.beginPath();
      ctx.arc(inst._wanderTargetPoint.x, inst._wanderTargetPoint.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Raios de gatilho de passo, alvos ideais, linhas de erro e articulações dos joelhos (IK)
    for (let i = 0; i < inst.ikPatas.length; i++) {
      const leg = inst.ikPatas[i];

      // Círculo do limiar de passo ao redor do alvo ideal no solo
      ctx.strokeStyle = leg.isStepping ? "rgba(244, 114, 182, 0.55)" : "rgba(252, 241, 208, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(leg.idealWorld.x, leg.idealWorld.y, stepThresholdWorld, 0, Math.PI * 2);
      ctx.stroke();

      // Ponto alvo ideal
      ctx.fillStyle = "rgba(252, 241, 208, 0.8)";
      ctx.beginPath();
      ctx.arc(leg.idealWorld.x, leg.idealWorld.y, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Linha tracejada de erro (ponta da pata -> alvo ideal)
      ctx.strokeStyle = "rgba(252, 241, 208, 0.4)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(leg.footPos.x, leg.footPos.y);
      ctx.lineTo(leg.idealWorld.x, leg.idealWorld.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Base do triângulo IK (âncora -> ponta da pata)
      ctx.strokeStyle = "rgba(244, 114, 182, 0.38)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leg.anchorWorld.x, leg.anchorWorld.y);
      ctx.lineTo(leg.footPos.x, leg.footPos.y);
      ctx.stroke();

      // Destaque da articulação do Joelho / Patela (IK) em rosa #F472B6
      ctx.fillStyle = "#F472B6";
      ctx.beginPath();
      ctx.arc(leg.kneePos.x, leg.kneePos.y, 3.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Vetor Velocidade (#38BDF8 Azul Celeste) e Vetor Steering (#FB923C Laranja)
    if (inst._velVec) {
      desenharSetaDebug(new Vec2(st.x, st.y), inst._velVec, 0.55, "#38BDF8");
    }
    if (inst._lastSteeringVec) {
      desenharSetaDebug(new Vec2(st.x, st.y), inst._lastSteeringVec, 0.28, "#FB923C");
    }

    ctx.restore();
  }

  function renderizarFrame(camadaEl, ativas, presasAtivas, ts) {
    if (!ativas.length && !presasAtivas.length && !runtimeConfig.poi) {
      if (ctx && canvasEl) ctx.clearRect(0, 0, larg, alt);
      return;
    }
    garantirCanvas(camadaEl);
    if (!ctx) return;

    atualizarCacheCards(ts || 0);
    ctx.clearRect(0, 0, larg, alt);

    const temaClaro = document.documentElement.getAttribute("data-tema-base") === "claro";
    const alphaSombraBase = temaClaro ? 0.16 : 0.34;

    // 0. Ponto de Interesse (POI) se ativo
    if (runtimeConfig.poi) {
      const { pos, life, maxLife } = runtimeConfig.poi;
      const fade = Math.max(0, Math.min(1, (maxLife - life) * 1.5));
      const pulse = ((ts || performance.now()) * 0.002) % 1;
      ctx.save();
      ctx.strokeStyle = `rgba(252, 241, 208, ${((1 - pulse) * 0.45 * fade).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8 + pulse * 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(252, 241, 208, ${(0.85 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 1. Sombras de contato 3D das presas
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

    // 2. Sombras projetadas segmentadas das patas (deslocam conforme liftHeight) + sombra do corpo + Debug Vetorial
    for (let i = 0; i < ativas.length; i++) {
      const inst = ativas[i];
      const st = inst.estado;
      if (!st || !isFinite(st.x) || !isFinite(st.y)) continue;

      const alturaAranha = inst._elevadaAtiva ? 11 : st.tipo === "ballooning" ? 16 : st.tipo === "rapel_fio" ? 7 : 0;

      // 2.1 Sombra projetada de cada uma das 8 patas articuladas (Anchor -> Knee -> Foot)
      if (inst.ikPatas && alturaAranha < 12) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = `rgba(1, 5, 22, ${(alphaSombraBase * 0.72).toFixed(3)})`;
        ctx.lineWidth = inst.especie.id === "tarantula_golias" ? 4.2 : 2.2;

        for (let k = 0; k < inst.ikPatas.length; k++) {
          const leg = inst.ikPatas[k];
          const liftShadow = leg.liftHeight * (inst.especie.id === "tarantula_golias" ? 9 : 6.5) + alturaAranha * 0.6;
          ctx.beginPath();
          ctx.moveTo(leg.anchorWorld.x + 3, leg.anchorWorld.y + 5);
          ctx.lineTo(leg.kneePos.x + 4 + liftShadow * 0.45, leg.kneePos.y + 7 + liftShadow * 0.55);
          ctx.lineTo(leg.footPos.x + 2 + liftShadow * 0.75, leg.footPos.y + 3 + liftShadow);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2.2 Sombra suave do corpo
      const sx = st.x + 3 + alturaAranha * 0.95;
      const sy = st.y + 5 + alturaAranha * 1.25;
      const rx = Math.max(10, inst.tamPx * 0.32 * Math.max(0.58, 1 - alturaAranha * 0.02));
      const ry = rx * 0.74;
      const alpha = alphaSombraBase * (inst.especie.id === "tarantula_golias" ? 1.25 : 1) * Math.max(0.32, 1 - alturaAranha * 0.025);

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

      // 2.3 Oclusão de fresta nas bordas dos cards
      if (!alturaMaiorQueZero(inst)) {
        const fresta = obterFatorFrestaCard(st.x, st.y, inst.tamPx * 0.4);
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
      }

      // 2.4 Sobreposição de Debug Vetorial e IK (se ativada)
      if (runtimeConfig.showDebug) {
        desenharDebugAranha(inst);
      }
    }
  }

  function alturaMaiorQueZero(inst) {
    return Boolean(inst._elevadaAtiva || inst.estado.tipo === "ballooning");
  }

  // API de configuração em tempo real para o painel de controles e laboratório
  function definirModoComportamento(modo) {
    if (["autonomous", "seek", "flee"].includes(modo)) {
      runtimeConfig.mode = modo;
      if (modo !== "autonomous") runtimeConfig.poi = null;
    }
    return runtimeConfig.mode;
  }

  function definirEscalaVelocidade(val) {
    const num = parseFloat(val);
    if (Number.isFinite(num)) {
      runtimeConfig.speedScale = Math.max(0.4, Math.min(2.4, num));
    }
    return runtimeConfig.speedScale;
  }

  function definirEscalaAlcance(val) {
    const num = parseFloat(val);
    if (Number.isFinite(num)) {
      runtimeConfig.reachScale = Math.max(0.75, Math.min(1.45, num));
    }
    return runtimeConfig.reachScale;
  }

  function definirMostrarDebug(ativo) {
    runtimeConfig.showDebug = Boolean(ativo);
    return runtimeConfig.showDebug;
  }

  function definirPontoInteresse(x, y) {
    if (runtimeConfig.mode === "autonomous" && Number.isFinite(x) && Number.isFinite(y)) {
      runtimeConfig.poi = {
        pos: new Vec2(x, y),
        life: 0,
        maxLife: 8.5,
        arrivedTime: 0
      };
    }
  }

  function obterConfiguracaoRuntime() {
    return { ...runtimeConfig };
  }

  return {
    Vec2,
    SpiderLeg,
    SPECIES_CONFIG,
    garantirCanvas,
    redimensionar,
    atualizarBiomecanicaAranha,
    renderizarFrame,
    definirModoComportamento,
    definirEscalaVelocidade,
    definirEscalaAlcance,
    definirMostrarDebug,
    definirPontoInteresse,
    obterConfiguracaoRuntime
  };
})();

if (typeof window !== "undefined") {
  window.AranhasCinematicaIK = AranhasCinematicaIK;
}
