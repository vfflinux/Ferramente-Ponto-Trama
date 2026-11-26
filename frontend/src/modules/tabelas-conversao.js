// ==========================================================================
// PONTO & TRAMA — TABELAS DE CONVERSÃO E MEDIDAS (RF01–RF08, RNF01–RNF04)
// Módulo offline-first de referências: Agulhas, Espessura de Fios e Medidas
// Padrão com conversor rápido, alternância cm/pol, busca instantânea,
// destaque de linha (modo leitura), cópia formatada e acessibilidade WCAG AA.
// ==========================================================================

const TabelasConversao = (() => {
  const STORAGE_UNIDADE_KEY = "ponto_trama_unidade_medida_v1";
  const CACHE_DADOS_KEY = "ponto_trama_tabelas_conversao_v1";
  const DATA_URL = "data/tabelas-conversao.json";
  const FATOR_POLEGADA = 2.54;

  // Base embutida em memória para resposta imediata (< 5ms) e garantia 100% offline
  const DADOS_EMBUTIDOS = {
    agulhas_croche: [
      { mm: 2.0, us: "—", uk: "14", letra: "—", uso_comum: "Rendas, barrados, fios super finos" },
      { mm: 2.25, us: "B-1", uk: "13", letra: "B", uso_comum: "Amigurumis pequenos, fios finos" },
      { mm: 2.5, us: "—", uk: "12", letra: "—", uso_comum: "Amigurumis padrão, barrados" },
      { mm: 2.75, us: "C-2", uk: "12", letra: "C", uso_comum: "Amigurumis, vestuário leve" },
      { mm: 3.0, us: "—", uk: "11", letra: "—", uso_comum: "Vestuário de verão, amigurumis" },
      { mm: 3.25, us: "D-3", uk: "10", letra: "D", uso_comum: "Peças leves de algodão" },
      { mm: 3.5, us: "E-4", uk: "9", letra: "E", uso_comum: "Blusas, sousplats finos, barbante nº 4" },
      { mm: 3.75, us: "F-5", uk: "9", letra: "F", uso_comum: "Acessórios, mantas leves" },
      { mm: 4.0, us: "G-6", uk: "8", letra: "G", uso_comum: "Barbante nº 6, lãs médias, bolsas" },
      { mm: 4.5, us: "7", uk: "7", letra: "—", uso_comum: "Lãs acrílicas (ex: Mollet), suéteres" },
      { mm: 5.0, us: "H-8", uk: "6", letra: "H", uso_comum: "Cachecóis, toucas, tapetes" },
      { mm: 5.5, us: "I-9", uk: "5", letra: "I", uso_comum: "Mantas, suéteres quentes" },
      { mm: 6.0, us: "J-10", uk: "4", letra: "J", uso_comum: "Fios grossos, barbante nº 8" },
      { mm: 6.5, us: "K-10.5", uk: "3", letra: "K", uso_comum: "Golas volumosas, tapetes pesados" },
      { mm: 7.0, us: "—", uk: "2", letra: "—", uso_comum: "Fio de malha fino, cestos" },
      { mm: 8.0, us: "L-11", uk: "0", letra: "L", uso_comum: "Fio de malha médio, mantas chunky" },
      { mm: 9.0, us: "M/N-13", uk: "00", letra: "M/N", uso_comum: "Cestos estruturados, bolsas de malha" },
      { mm: 10.0, us: "N/P-15", uk: "000", letra: "N/P", uso_comum: "Fio de malha grosso, tapetes maxi" },
      { mm: 12.0, us: "P-16", uk: "—", letra: "P", uso_comum: "Maxi crochê, fios jumbo" },
      { mm: 15.0, us: "Q", uk: "—", letra: "Q", uso_comum: "Mantas gigantes, puffes" }
    ],
    espessura_fios: [
      { cyc: 0, nome_internacional: "Lace", nome_pt: "Renda / Super Fino", tex_min: 0, tex_max: 150, agulha_sugerida_mm: "1.25 – 2.25", exemplos_br: ["Cléa 1000 (151)", "Cléa 5 (196 - transição)", "Anne dupla não se aplica"] },
      { cyc: 1, nome_internacional: "Super Fine (Fingering / Sock)", nome_pt: "Fino / Bebê", tex_min: 151, tex_max: 250, agulha_sugerida_mm: "2.25 – 3.5", exemplos_br: ["Mais Bebê (200)", "Fio Brisa (200)", "Cléa 5 (196)"] },
      { cyc: 2, nome_internacional: "Fine (Sport / Baby)", nome_pt: "Leve / Sport", tex_min: 251, tex_max: 380, agulha_sugerida_mm: "3.5 – 4.5", exemplos_br: ["Anne (295)", "Charme (378)", "Bela (370)"] },
      { cyc: 3, nome_internacional: "Light (DK / Light Worsted)", nome_pt: "Médio Leve (DK)", tex_min: 381, tex_max: 500, agulha_sugerida_mm: "4.5 – 5.5", exemplos_br: ["Amigurumi (492)", "Mollet (500)", "Cisne TodoDia (400)"] },
      { cyc: 4, nome_internacional: "Medium (Worsted / Aran)", nome_pt: "Médio", tex_min: 501, tex_max: 750, agulha_sugerida_mm: "5.5 – 6.5", exemplos_br: ["Barroco Maxcolor nº 4 (590)", "Lã Família (375 a 500)", "Flash (500)"] },
      { cyc: 5, nome_internacional: "Bulky (Chunky)", nome_pt: "Grosso", tex_min: 751, tex_max: 1100, agulha_sugerida_mm: "6.5 – 9.0", exemplos_br: ["Barroco Maxcolor nº 6 (885)", "Urbano (909)", "Barbante nº 6"] },
      { cyc: 6, nome_internacional: "Super Bulky", nome_pt: "Super Grosso", tex_min: 1101, tex_max: 1800, agulha_sugerida_mm: "9.0 – 15.0", exemplos_br: ["Barroco nº 8 (1180)", "Fio Náutico 5mm", "Fio de Malha Extra Leve"] },
      { cyc: 7, nome_internacional: "Jumbo", nome_pt: "Jumbo / Maxi", tex_min: 1801, tex_max: 9999, agulha_sugerida_mm: "15.0+", exemplos_br: ["Fio de Malha Tradicional", "Lã Maxi / Braço"] }
    ],
    medidas_padrao: {
      toucas: {
        dica: "Subtraia de 2 a 4 cm da circunferência real da cabeça para garantir que a touca não fique larga após o uso.",
        itens: [
          { tamanho: "Prematuro", circunferencia_cm: [30, 33], diametro_coroa_cm: [9.5, 10.5], altura_cm: [11, 12] },
          { tamanho: "Recém-nascido (0–3m)", circunferencia_cm: [33, 36], diametro_coroa_cm: [10.5, 11.5], altura_cm: [13, 14] },
          { tamanho: "Bebê (3–6m)", circunferencia_cm: [36, 41], diametro_coroa_cm: [11.5, 13.0], altura_cm: [14, 15] },
          { tamanho: "Bebê (6–12m)", circunferencia_cm: [41, 46], diametro_coroa_cm: [13.0, 14.5], altura_cm: [15, 16.5] },
          { tamanho: "Infantil (1–3 anos)", circunferencia_cm: [46, 49], diametro_coroa_cm: [14.5, 15.5], altura_cm: [17, 18] },
          { tamanho: "Criança (4–10 anos)", circunferencia_cm: [49, 52], diametro_coroa_cm: [15.5, 16.5], altura_cm: [18, 19.5] },
          { tamanho: "Adolescente / Adulto P", circunferencia_cm: [53, 55], diametro_coroa_cm: [16.5, 17.5], altura_cm: [20, 21] },
          { tamanho: "Adulto M", circunferencia_cm: [56, 58], diametro_coroa_cm: [17.5, 18.5], altura_cm: [21, 22] },
          { tamanho: "Adulto G", circunferencia_cm: [59, 61], diametro_coroa_cm: [18.5, 19.5], altura_cm: [22, 23.5] }
        ]
      },
      meias: {
        dica: "Para um caimento anatômico, faça a meia cerca de 10% menor que o comprimento e a circunferência real do pé (folga negativa).",
        itens: [
          { numeracao_br: "16–18 (Bebê)", comprimento_pe_cm: [10.0, 11.5], circunferencia_pe_cm: [11, 12] },
          { numeracao_br: "19–22 (Infantil)", comprimento_pe_cm: [12.0, 14.5], circunferencia_pe_cm: [13, 15] },
          { numeracao_br: "23–26 (Infantil)", comprimento_pe_cm: [15.0, 17.0], circunferencia_pe_cm: [15, 17] },
          { numeracao_br: "27–30 (Infantil)", comprimento_pe_cm: [17.5, 19.5], circunferencia_pe_cm: [17, 19] },
          { numeracao_br: "31–33 (Juvenil)", comprimento_pe_cm: [20.0, 21.5], circunferencia_pe_cm: [19, 20.5] },
          { numeracao_br: "34–36 (Adulto P)", comprimento_pe_cm: [22.0, 23.5], circunferencia_pe_cm: [20.5, 22] },
          { numeracao_br: "37–39 (Adulto M)", comprimento_pe_cm: [24.0, 25.5], circunferencia_pe_cm: [22, 24] },
          { numeracao_br: "40–42 (Adulto G)", comprimento_pe_cm: [26.0, 27.5], circunferencia_pe_cm: [24, 25.5] },
          { numeracao_br: "43–45 (Adulto GG)", comprimento_pe_cm: [28.0, 29.5], circunferencia_pe_cm: [25.5, 27] }
        ]
      },
      blusas_camisas: {
        dica: "Medidas referentes ao corpo. Para peças soltinhas (oversized), adicione de 8 a 15 cm na circunferência do busto/tórax.",
        itens: [
          { tamanho: "PP (34–36)", busto_torax_cm: [80, 84], cintura_cm: [62, 66], largura_ombro_cm: 38, comprimento_cm: 56, manga_longa_cm: 58 },
          { tamanho: "P (38)", busto_torax_cm: [85, 89], cintura_cm: [67, 71], largura_ombro_cm: 40, comprimento_cm: 58, manga_longa_cm: 59 },
          { tamanho: "M (40–42)", busto_torax_cm: [90, 96], cintura_cm: [72, 78], largura_ombro_cm: 42, comprimento_cm: 60, manga_longa_cm: 60 },
          { tamanho: "G (44)", busto_torax_cm: [97, 104], cintura_cm: [79, 86], largura_ombro_cm: 44, comprimento_cm: 63, manga_longa_cm: 62 },
          { tamanho: "GG (46–48)", busto_torax_cm: [105, 114], cintura_cm: [87, 96], largura_ombro_cm: 46, comprimento_cm: 66, manga_longa_cm: 63 },
          { tamanho: "XGG (50–52)", busto_torax_cm: [115, 124], cintura_cm: [97, 106], largura_ombro_cm: 48, comprimento_cm: 68, manga_longa_cm: 64 }
        ]
      },
      calcas: {
        dica: "O crochê tende a ceder no comprimento pelo peso do fio. Faça o teste de caimento antes de finalizar a barra.",
        itens: [
          { tamanho: "PP (36)", cintura_cm: [62, 66], quadril_cm: [88, 92], altura_gancho_cm: 25, comprimento_total_cm: 100 },
          { tamanho: "P (38)", cintura_cm: [67, 71], quadril_cm: [93, 97], altura_gancho_cm: 26, comprimento_total_cm: 102 },
          { tamanho: "M (40–42)", cintura_cm: [72, 78], quadril_cm: [98, 104], altura_gancho_cm: 27, comprimento_total_cm: 104 },
          { tamanho: "G (44)", cintura_cm: [79, 86], quadril_cm: [105, 112], altura_gancho_cm: 29, comprimento_total_cm: 106 },
          { tamanho: "GG (46–48)", cintura_cm: [87, 96], quadril_cm: [113, 122], altura_gancho_cm: 31, comprimento_total_cm: 108 }
        ]
      },
      vestidos: {
        dica: "Meça o comprimento a partir do ponto mais alto do ombro. Em pontos muito abertos, considere usar forro ou reduzir o comprimento final em 3 a 5 cm por conta do peso.",
        itens: [
          { tamanho: "PP", busto_cm: [80, 84], cintura_cm: [62, 66], quadril_cm: [88, 92], comp_curto_cm: 85, comp_midi_cm: 110, comp_longo_cm: 142 },
          { tamanho: "P", busto_cm: [85, 89], cintura_cm: [67, 71], quadril_cm: [93, 97], comp_curto_cm: 87, comp_midi_cm: 112, comp_longo_cm: 144 },
          { tamanho: "M", busto_cm: [90, 96], cintura_cm: [72, 78], quadril_cm: [98, 104], comp_curto_cm: 90, comp_midi_cm: 115, comp_longo_cm: 146 },
          { tamanho: "G", busto_cm: [97, 104], cintura_cm: [79, 86], quadril_cm: [105, 112], comp_curto_cm: 93, comp_midi_cm: 118, comp_longo_cm: 148 },
          { tamanho: "GG", busto_cm: [105, 114], cintura_cm: [87, 96], quadril_cm: [113, 122], comp_curto_cm: 96, comp_midi_cm: 120, comp_longo_cm: 150 }
        ]
      },
      cachecois: {
        dica: "Regra prática: o comprimento ideal de um cachecol adulto costuma ser igual à altura da pessoa que vai usá-lo.",
        itens: [
          { modelo: "Infantil (2–6 anos)", largura_cm: [12, 15], comprimento_cm: [100, 120] },
          { modelo: "Juvenil (7–12 anos)", largura_cm: [15, 18], comprimento_cm: [125, 145] },
          { modelo: "Adulto Padrão", largura_cm: [18, 22], comprimento_cm: [150, 175] },
          { modelo: "Adulto Longo / Inverno", largura_cm: [22, 28], comprimento_cm: [180, 210] },
          { modelo: "Gola Fechada (1 volta)", largura_cm: [20, 25], comprimento_cm: [60, 70] },
          { modelo: "Gola Infinita (2 voltas)", largura_cm: [20, 28], comprimento_cm: [130, 150] }
        ]
      },
      mantas: {
        dica: "Para camas, as medidas já incluem caimento lateral padrão. Para peseiras decorativas, use a largura da cama com 50 a 70 cm de profundidade.",
        itens: [
          { modelo: "Bebê / Carrinho", largura_cm: 70, comprimento_cm: 90 },
          { modelo: "Berço Padrão", largura_cm: 90, comprimento_cm: 120 },
          { modelo: "Manta de Sofá / Colo", largura_cm: 120, comprimento_cm: 150 },
          { modelo: "Cama Solteiro", largura_cm: 150, comprimento_cm: 220 },
          { modelo: "Cama Casal", largura_cm: 200, comprimento_cm: 230 },
          { modelo: "Cama Queen", largura_cm: 230, comprimento_cm: 250 },
          { modelo: "Cama King", largura_cm: 260, comprimento_cm: 260 }
        ]
      },
      bolsas: {
        dica: "Alças de crochê cedem com o peso. Faça a alça cerca de 10% a 15% menor que o tamanho final desejado ou utilize pontos mais fechados (como ponto baixo centrado ou tunisiano).",
        itens: [
          { modelo: "Clutch / Carteira de Mão", largura_cm: [22, 26], altura_cm: [12, 16], profundidade_cm: [3, 5], alca_cm: "0 (ou punho 18)" },
          { modelo: "Tiracolo Pequena (Crossbody)", largura_cm: [18, 22], altura_cm: [14, 18], profundidade_cm: [5, 7], alca_cm: "105 – 120" },
          { modelo: "Bolsa Média (Dia a Dia)", largura_cm: [28, 34], altura_cm: [24, 28], profundidade_cm: [8, 12], alca_cm: "55 – 65 (ombro)" },
          { modelo: "Tote / Ecobag", largura_cm: [35, 40], altura_cm: [38, 42], profundidade_cm: [8, 12], alca_cm: "60 – 70" },
          { modelo: "Bolsa de Praia / Maxi", largura_cm: [42, 48], altura_cm: [35, 40], profundidade_cm: [14, 18], alca_cm: "60 – 75" }
        ]
      }
    }
  };

  // Metadados das 8 subcategorias de Medidas Padrão (RF04)
  const META_SUBCATEGORIAS = {
    toucas: {
      rotulo: "Toucas / Gorros",
      curto: "Toucas",
      prefixoCopia: "Touca",
      palavras: ["touca", "toucas", "gorro", "gorros", "cabeca", "coroa", "bebe"],
      colunas: [
        { key: "tamanho", label: "Tamanho / Faixa Etária", tipo: "texto" },
        { key: "circunferencia_cm", label: "Circunferência", copia: "Circ.", tipo: "medida" },
        { key: "diametro_coroa_cm", label: "Diâmetro Coroa", copia: "Coroa", tipo: "medida" },
        { key: "altura_cm", label: "Altura", copia: "Alt.", tipo: "medida" }
      ]
    },
    meias: {
      rotulo: "Meias",
      curto: "Meias",
      prefixoCopia: "Meia",
      palavras: ["meia", "meias", "pe", "calcado", "numeracao", "bebe"],
      colunas: [
        { key: "numeracao_br", label: "Numeração BR", tipo: "texto" },
        { key: "comprimento_pe_cm", label: "Comprimento do Pé", copia: "Comp. Pé", tipo: "medida" },
        { key: "circunferencia_pe_cm", label: "Circunferência do Pé", copia: "Circ. Pé", tipo: "medida" }
      ]
    },
    blusas_camisas: {
      rotulo: "Blusas / Camisas",
      curto: "Blusas",
      prefixoCopia: "Blusa",
      palavras: ["blusa", "blusas", "camisa", "camisas", "sueter", "vestuario", "busto", "torax", "manga"],
      colunas: [
        { key: "tamanho", label: "Tamanho", tipo: "texto" },
        { key: "busto_torax_cm", label: "Busto / Tórax", copia: "Busto", tipo: "medida" },
        { key: "cintura_cm", label: "Cintura", copia: "Cintura", tipo: "medida" },
        { key: "largura_ombro_cm", label: "Ombro", copia: "Ombro", tipo: "medida" },
        { key: "comprimento_cm", label: "Comprimento", copia: "Comp.", tipo: "medida" },
        { key: "manga_longa_cm", label: "Manga Longa", copia: "Manga", tipo: "medida" }
      ]
    },
    calcas: {
      rotulo: "Calças",
      curto: "Calças",
      prefixoCopia: "Calça",
      palavras: ["calca", "calcas", "quadril", "gancho", "cintura"],
      colunas: [
        { key: "tamanho", label: "Tamanho", tipo: "texto" },
        { key: "cintura_cm", label: "Cintura", copia: "Cintura", tipo: "medida" },
        { key: "quadril_cm", label: "Quadril", copia: "Quadril", tipo: "medida" },
        { key: "altura_gancho_cm", label: "Altura Gancho", copia: "Gancho", tipo: "medida" },
        { key: "comprimento_total_cm", label: "Comp. Total", copia: "Comp.", tipo: "medida" }
      ]
    },
    vestidos: {
      rotulo: "Vestidos",
      curto: "Vestidos",
      prefixoCopia: "Vestido",
      palavras: ["vestido", "vestidos", "curto", "midi", "longo", "busto", "quadril"],
      colunas: [
        { key: "tamanho", label: "Tamanho", tipo: "texto" },
        { key: "busto_cm", label: "Busto", copia: "Busto", tipo: "medida" },
        { key: "cintura_cm", label: "Cintura", copia: "Cintura", tipo: "medida" },
        { key: "quadril_cm", label: "Quadril", copia: "Quadril", tipo: "medida" },
        { key: "comp_curto_cm", label: "Curto", copia: "Curto", tipo: "medida" },
        { key: "comp_midi_cm", label: "Midi", copia: "Midi", tipo: "medida" },
        { key: "comp_longo_cm", label: "Longo", copia: "Longo", tipo: "medida" }
      ]
    },
    cachecois: {
      rotulo: "Cachecóis",
      curto: "Cachecóis",
      prefixoCopia: "Cachecol",
      palavras: ["cachecol", "cachecois", "gola", "inverno", "infinita"],
      colunas: [
        { key: "modelo", label: "Modelo / Faixa Etária", tipo: "texto" },
        { key: "largura_cm", label: "Largura", copia: "Larg.", tipo: "medida" },
        { key: "comprimento_cm", label: "Comprimento", copia: "Comp.", tipo: "medida" }
      ]
    },
    mantas: {
      rotulo: "Mantas",
      curto: "Mantas",
      prefixoCopia: "Manta",
      palavras: ["manta", "mantas", "cobertor", "berco", "cama", "solteiro", "casal", "queen", "king", "sofa"],
      colunas: [
        { key: "modelo", label: "Modelo / Uso", tipo: "texto" },
        { key: "largura_cm", label: "Largura", copia: "Larg.", tipo: "medida" },
        { key: "comprimento_cm", label: "Comprimento", copia: "Comp.", tipo: "medida" }
      ]
    },
    bolsas: {
      rotulo: "Bolsas",
      curto: "Bolsas",
      prefixoCopia: "Bolsa",
      palavras: ["bolsa", "bolsas", "clutch", "ecobag", "tote", "praia", "alca", "tiracolo"],
      colunas: [
        { key: "modelo", label: "Modelo", tipo: "texto" },
        { key: "largura_cm", label: "Largura", copia: "Larg.", tipo: "medida" },
        { key: "altura_cm", label: "Altura", copia: "Alt.", tipo: "medida" },
        { key: "profundidade_cm", label: "Profundidade", copia: "Prof.", tipo: "medida" },
        { key: "alca_cm", label: "Alça", copia: "Alça", tipo: "medida_texto" }
      ]
    }
  };

  const ORDEM_SUBCATEGORIAS = [
    "toucas",
    "meias",
    "blusas_camisas",
    "calcas",
    "vestidos",
    "cachecois",
    "mantas",
    "bolsas"
  ];

  const SISTEMAS_AGULHA = [
    { valor: "mm", rotulo: "Milímetros (mm)", placeholder: "Ex.: 4.0", exemplo: "4.0" },
    { valor: "us", rotulo: "Padrão US", placeholder: "Ex.: G-6 ou H-8", exemplo: "G-6" },
    { valor: "uk", rotulo: "Padrão UK", placeholder: "Ex.: 8 ou 6", exemplo: "8" },
    { valor: "letra", rotulo: "Letra", placeholder: "Ex.: G ou H", exemplo: "G" }
  ];

  const SISTEMAS_FIO = [
    { valor: "tex", rotulo: "TEX (g/1000m)", placeholder: "Ex.: 500 ou 295", exemplo: "500" },
    { valor: "cyc", rotulo: "CYC (0 a 7)", placeholder: "Ex.: 3 ou 4", exemplo: "3" },
    { valor: "nome", rotulo: "Nome / Fio", placeholder: "Ex.: Worsted, DK, Anne", exemplo: "DK" }
  ];

  let dados = DADOS_EMBUTIDOS;
  let abaAtiva = "agulhas"; // 'agulhas' | 'fios' | 'medidas'
  let subcategoriaAtiva = "toucas";
  let unidadeAtiva = "cm"; // 'cm' | 'pol'
  let termoBusca = "";
  let sistemaAgulha = "mm";
  let valorConvAgulha = "4.0";
  let sistemaFio = "tex";
  let valorConvFio = "500";
  let linhasDestacadas = new Set();
  let inventarioCache = { agulhas: [], fios: [] };
  let jaInicializado = false;
  let timerToast = null;

  // Referências DOM
  const el = {};

  const ICONE_COPIAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const ICONE_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  // ==========================================================================
  // UTILITÁRIOS DE FORMATAÇÃO, CONVERSÃO E NORMALIZAÇÃO
  // ==========================================================================

  function escapeHtml(txt) {
    return String(txt == null ? "" : txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizar(str) {
    return String(str == null ? "" : str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function lerUnidadeSalva() {
    try {
      const salva = localStorage.getItem(STORAGE_UNIDADE_KEY);
      return salva === "pol" ? "pol" : "cm";
    } catch (_) {
      return "cm";
    }
  }

  function salvarUnidade(un) {
    try {
      localStorage.setItem(STORAGE_UNIDADE_KEY, un);
    } catch (_) {}
  }

  function formatarNumeroPT(num, decimais) {
    const n = Number(num);
    if (!Number.isFinite(n)) return String(num);
    if (decimais === 0 || (decimais == null && Math.abs(n - Math.round(n)) < 0.001)) {
      return String(Math.round(n));
    }
    const casas = decimais != null ? decimais : 1;
    return n.toFixed(casas).replace(".", ",").replace(/,0$/, "");
  }

  function converterCmParaUnidade(valorCm, unidade) {
    const n = Number(valorCm);
    if (!Number.isFinite(n)) return null;
    if (unidade === "pol") {
      return Math.round((n / FATOR_POLEGADA) * 10) / 10;
    }
    return n;
  }

  function formatarMedida(valor, unidade, tipo) {
    const suf = unidade === "pol" ? "pol" : "cm";

    if (tipo === "medida_texto" || typeof valor === "string") {
      const texto = String(valor || "—");
      if (unidade === "cm") {
        // Acrescenta "cm" quando é uma faixa pura como "105 – 120"
        return /\b(cm|pol|in)\b/i.test(texto) ? texto : `${texto} cm`;
      }
      // Converte cada número presente no texto de cm para polegadas (ex.: "105 – 120" -> "41,3 – 47,2 pol")
      const convertido = texto.replace(/\d+(?:[.,]\d+)?/g, (m) => {
        const num = parseFloat(m.replace(",", "."));
        if (!Number.isFinite(num) || num === 0) return m;
        return formatarNumeroPT(num / FATOR_POLEGADA, 1);
      });
      return `${convertido} ${suf}`;
    }

    if (Array.isArray(valor) && valor.length === 2) {
      const a = converterCmParaUnidade(valor[0], unidade);
      const b = converterCmParaUnidade(valor[1], unidade);
      const dec = unidade === "pol" ? 1 : null;
      return `${formatarNumeroPT(a, dec)} – ${formatarNumeroPT(b, dec)} ${suf}`;
    }

    if (typeof valor === "number") {
      const v = converterCmParaUnidade(valor, unidade);
      const dec = unidade === "pol" ? 1 : null;
      return `${formatarNumeroPT(v, dec)} ${suf}`;
    }

    return escapeHtml(valor);
  }

  function formatarMm(mm) {
    const n = Number(mm);
    if (!Number.isFinite(n)) return String(mm);
    if (Math.abs(n * 100 - Math.round(n * 100)) < 0.01 && Math.round(n * 100) % 10 !== 0) {
      return n.toFixed(2).replace(".", ",") + " mm";
    }
    return n.toFixed(1).replace(".", ",") + " mm";
  }

  function formatarDicaContextual(dica) {
    if (!dica) return "";
    if (unidadeAtiva === "cm") return dica;
    // Converte menções "X a Y cm" ou "X cm" na dica para exibir também em polegadas
    return dica.replace(/(\d+(?:[.,]\d+)?)\s*(?:a|–|-)\s*(\d+(?:[.,]\d+)?)\s*cm/gi, (_, a, b) => {
      const pa = formatarNumeroPT(parseFloat(a.replace(",", ".")) / FATOR_POLEGADA, 1);
      const pb = formatarNumeroPT(parseFloat(b.replace(",", ".")) / FATOR_POLEGADA, 1);
      return `${pa} a ${pb} pol (${a}–${b} cm)`;
    });
  }

  // ==========================================================================
  // CARREGAMENTO OFFLINE-FIRST DO JSON (RNF02) + INVENTÁRIO INTEGRADO
  // ==========================================================================

  function carregarDadosJson() {
    // 1. Tenta cache em localStorage (instantâneo)
    try {
      const salvo = localStorage.getItem(CACHE_DADOS_KEY);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (parsed && Array.isArray(parsed.agulhas_croche) && Array.isArray(parsed.espessura_fios) && parsed.medidas_padrao) {
          dados = parsed;
        }
      }
    } catch (_) {}

    // 2. Atualiza em background a partir do JSON estático local
    if (typeof fetch === "function") {
      fetch(DATA_URL)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json && Array.isArray(json.agulhas_croche) && Array.isArray(json.espessura_fios) && json.medidas_padrao) {
            dados = json;
            try {
              localStorage.setItem(CACHE_DADOS_KEY, JSON.stringify(json));
            } catch (_) {}
            renderizarTudo(false);
          }
        })
        .catch(() => {});
    }
  }

  function atualizarCacheInventario() {
    if (typeof BancoDadosPT === "undefined" || typeof BancoDadosPT.listar !== "function") return;
    Promise.all([
      BancoDadosPT.listar("itens_biblioteca").catch(() => []),
      BancoDadosPT.listar("fios").catch(() => [])
    ]).then(([itens, fios]) => {
      inventarioCache.agulhas = Array.isArray(itens)
        ? itens.filter((it) => it && (it.categoria === "agulha" || it.espessuraMm != null))
        : [];
      inventarioCache.fios = Array.isArray(fios) ? fios : [];
      if (abaAtiva === "agulhas" || abaAtiva === "fios") {
        renderizarResultadoConversor();
      }
    });
  }

  function contarAgulhasNoInventario(mm) {
    const alvo = Number(mm);
    if (!Number.isFinite(alvo) || !inventarioCache.agulhas.length) return 0;
    return inventarioCache.agulhas.filter((a) => {
      const m = parseFloat(String(a.espessuraMm || a.tamanho || "").replace(",", "."));
      return Number.isFinite(m) && Math.abs(m - alvo) < 0.06;
    }).length;
  }

  function contarFiosNoInventario(texMin, texMax) {
    if (!inventarioCache.fios.length) return 0;
    return inventarioCache.fios.filter((f) => {
      const t = parseFloat(String(f.tex || "").replace(",", "."));
      return Number.isFinite(t) && t >= texMin && t <= texMax;
    }).length;
  }

  // ==========================================================================
  // LÓGICA DO CONVERSOR RÁPIDO (RF02)
  // ==========================================================================

  function buscarConversaoAgulha(sistema, entradaBruta) {
    const lista = dados.agulhas_croche || [];
    const txt = String(entradaBruta || "").trim();
    if (!txt) return { item: null, exato: false, vazio: true };

    const norm = normalizar(txt);

    if (sistema === "mm") {
      const num = parseFloat(txt.replace(",", ".").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(num)) return { item: null, exato: false };
      const exato = lista.find((a) => Math.abs(a.mm - num) < 0.001);
      if (exato) return { item: exato, exato: true };
      // Mais próximo
      let melhor = lista[0];
      let menorDist = Infinity;
      for (const a of lista) {
        const d = Math.abs(a.mm - num);
        if (d < menorDist) {
          menorDist = d;
          melhor = a;
        }
      }
      return { item: melhor, exato: false, distancia: menorDist };
    }

    if (sistema === "us") {
      const limpo = norm.replace(/\s+/g, "");
      let match = lista.find((a) => normalizar(a.us).replace(/\s+/g, "") === limpo);
      if (!match) {
        match = lista.find((a) => a.us !== "—" && normalizar(a.us).includes(limpo));
      }
      return { item: match || null, exato: Boolean(match) };
    }

    if (sistema === "uk") {
      const limpo = norm.replace(/\s+/g, "");
      const match = lista.find((a) => a.uk !== "—" && normalizar(a.uk) === limpo);
      return { item: match || null, exato: Boolean(match) };
    }

    if (sistema === "letra") {
      const limpo = norm.replace(/\s+/g, "");
      let match = lista.find((a) => a.letra !== "—" && normalizar(a.letra) === limpo);
      if (!match) {
        match = lista.find((a) => a.letra !== "—" && normalizar(a.letra).split("/").includes(limpo));
      }
      return { item: match || null, exato: Boolean(match) };
    }

    return { item: null, exato: false };
  }

  function buscarConversaoFio(sistema, entradaBruta) {
    const lista = dados.espessura_fios || [];
    const txt = String(entradaBruta || "").trim();
    if (!txt) return { item: null, exato: false, vazio: true };

    const norm = normalizar(txt);

    if (sistema === "tex") {
      const num = parseFloat(txt.replace(",", ".").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(num) || num < 0) return { item: null, exato: false };
      const exato = lista.find((f) => num >= f.tex_min && num <= f.tex_max);
      if (exato) return { item: exato, exato: true, texInformado: num };
      if (num > 1800) return { item: lista[lista.length - 1], exato: true, texInformado: num };
      return { item: lista[0], exato: false, texInformado: num };
    }

    if (sistema === "cyc") {
      const num = parseInt(txt.replace(/[^\d]/g, ""), 10);
      if (!Number.isFinite(num)) return { item: null, exato: false };
      const exato = lista.find((f) => f.cyc === num);
      return { item: exato || null, exato: Boolean(exato) };
    }

    if (sistema === "nome") {
      const match = lista.find((f) => {
        const bloco = normalizar(
          `${f.nome_internacional} ${f.nome_pt} ${(f.exemplos_br || []).join(" ")} cyc ${f.cyc}`
        );
        return bloco.includes(norm);
      });
      return { item: match || null, exato: Boolean(match) };
    }

    return { item: null, exato: false };
  }

  // ==========================================================================
  // FILTRAGEM / BUSCA INSTANTÂNEA (RF05)
  // ==========================================================================

  function filtrarAgulhas(q) {
    const lista = dados.agulhas_croche || [];
    if (!q) return lista;
    const normQ = normalizar(q).replace(/mm$/i, "").trim();
    const numQ = parseFloat(normQ.replace(",", "."));
    return lista.filter((a) => {
      const texto = normalizar(
        `${a.mm} ${String(a.mm).replace(".", ",")} ${a.mm}mm ${a.us} ${a.uk} ${a.letra} ${a.uso_comum}`
      );
      if (texto.includes(normalizar(q)) || texto.includes(normQ)) return true;
      if (Number.isFinite(numQ) && Math.abs(a.mm - numQ) < 0.001) return true;
      return false;
    });
  }

  function filtrarFios(q) {
    const lista = dados.espessura_fios || [];
    if (!q) return lista;
    const normQ = normalizar(q);
    // Suporta busca por "TEX 500" ou número puro dentro da faixa TEX
    const texMatch = normQ.match(/^(?:tex\s*)?(\d{2,4})$/);
    const texNum = texMatch ? parseInt(texMatch[1], 10) : null;

    return lista.filter((f) => {
      if (texNum != null && texNum >= f.tex_min && texNum <= f.tex_max) return true;
      const texto = normalizar(
        `cyc ${f.cyc} ${f.nome_internacional} ${f.nome_pt} tex ${f.tex_min} ${f.tex_max} ${f.agulha_sugerida_mm} ${(f.exemplos_br || []).join(" ")}`
      );
      const tokens = normQ.split(/\s+/).filter(Boolean);
      return tokens.every((tk) => texto.includes(tk));
    });
  }

  function filtrarMedidasSubcategoria(subKey, q) {
    const grupo = (dados.medidas_padrao || {})[subKey];
    const meta = META_SUBCATEGORIAS[subKey];
    if (!grupo || !meta) return [];
    const itens = grupo.itens || [];
    if (!q) return itens.map((item, idx) => ({ subKey, meta, item, idx }));

    const normQ = normalizar(q);
    const tokens = normQ.split(/\s+/).filter(Boolean);
    const palavrasSub = normalizar(`${meta.rotulo} ${meta.curto} ${meta.palavras.join(" ")}`);

    return itens
      .map((item, idx) => ({ subKey, meta, item, idx }))
      .filter(({ item }) => {
        const valores = meta.colunas
          .map((c) => {
            const raw = item[c.key];
            const fmtCm = c.tipo === "texto" ? String(raw || "") : formatarMedida(raw, "cm", c.tipo);
            const fmtPol = c.tipo === "texto" ? "" : formatarMedida(raw, "pol", c.tipo);
            return `${fmtCm} ${fmtPol}`;
          })
          .join(" ");
        const textoCompleto = normalizar(`${palavrasSub} ${valores}`);
        return tokens.every((tk) => textoCompleto.includes(tk));
      });
  }

  function filtrarMedidasInteligente(q) {
    if (!q) {
      return {
        modoGlobal: false,
        linhas: filtrarMedidasSubcategoria(subcategoriaAtiva, "")
      };
    }

    // Verifica se a busca menciona explicitamente outra subcategoria (ex.: "Touca bebê" estando em Meias)
    const normQ = normalizar(q);
    const naAtiva = filtrarMedidasSubcategoria(subcategoriaAtiva, q);

    // Se a busca contém palavra-chave de outra categoria ou não encontrou na ativa, busca em todas as 8
    const outraCatExplicita = ORDEM_SUBCATEGORIAS.find(
      (k) => k !== subcategoriaAtiva && META_SUBCATEGORIAS[k].palavras.some((p) => normQ.includes(p))
    );

    if (naAtiva.length > 0 && !outraCatExplicita) {
      return { modoGlobal: false, linhas: naAtiva };
    }

    // Se encontrou categoria explícita com matches, foca nela (e mantém resultados globais se houver mais)
    const todas = [];
    for (const k of ORDEM_SUBCATEGORIAS) {
      const encontrados = filtrarMedidasSubcategoria(k, q);
      for (const r of encontrados) todas.push(r);
    }
    return { modoGlobal: true, linhas: todas };
  }

  function contarResultadosOutrasAbas(q) {
    if (!q) return [];
    const sugestoes = [];
    if (abaAtiva !== "agulhas") {
      const n = filtrarAgulhas(q).length;
      if (n > 0) sugestoes.push({ aba: "agulhas", rotulo: "Agulhas", qtd: n });
    }
    if (abaAtiva !== "fios") {
      const n = filtrarFios(q).length;
      if (n > 0) sugestoes.push({ aba: "fios", rotulo: "Espessura de Fios", qtd: n });
    }
    if (abaAtiva !== "medidas") {
      let total = 0;
      let primeiraSub = null;
      for (const k of ORDEM_SUBCATEGORIAS) {
        const res = filtrarMedidasSubcategoria(k, q);
        if (res.length > 0 && !primeiraSub) primeiraSub = k;
        total += res.length;
      }
      if (total > 0) {
        sugestoes.push({ aba: "medidas", sub: primeiraSub, rotulo: "Medidas Padrão", qtd: total });
      }
    }
    return sugestoes;
  }

  // ==========================================================================
  // FORMATAÇÃO DE TEXTO PARA CÓPIA RÁPIDA (RF06)
  // ==========================================================================

  function textoCopiaAgulha(a) {
    return `Agulha ${formatarMm(a.mm)} | US: ${a.us} | UK: ${a.uk} | Letra: ${a.letra} — ${a.uso_comum}`;
  }

  function textoCopiaFio(f) {
    const texFaixa = f.tex_max >= 9999 ? `${f.tex_min}+` : `${f.tex_min}–${f.tex_max}`;
    const ex = (f.exemplos_br || []).slice(0, 2).join(", ");
    return `Fio CYC ${f.cyc} (${f.nome_internacional} / ${f.nome_pt}) | TEX: ${texFaixa} | Agulha: ${f.agulha_sugerida_mm} mm${ex ? ` | Ex.: ${ex}` : ""}`;
  }

  function textoCopiaMedida(subKey, item) {
    const meta = META_SUBCATEGORIAS[subKey];
    if (!meta) return "";
    const primeiraCol = meta.colunas[0];
    const titulo = `${meta.prefixoCopia} ${item[primeiraCol.key]}`;
    const partes = meta.colunas.slice(1).map((c) => {
      const fmt = formatarMedida(item[c.key], unidadeAtiva, c.tipo);
      return `${c.copia || c.label}: ${fmt}`;
    });
    return `${titulo}: ${partes.join(" | ")}`;
  }

  function copiarTexto(texto, botaoEl, mensagemToast) {
    const sucesso = () => {
      if (botaoEl) {
        botaoEl.classList.add("copiado");
        const iconeWrap = botaoEl.querySelector(".icone-btn-copiar");
        if (iconeWrap) iconeWrap.innerHTML = ICONE_CHECK;
        const lbl = botaoEl.querySelector(".texto-btn-copiar");
        if (lbl) lbl.textContent = "Copiado";
        clearTimeout(botaoEl._timerCopia);
        botaoEl._timerCopia = setTimeout(() => {
          botaoEl.classList.remove("copiado");
          if (iconeWrap) iconeWrap.innerHTML = ICONE_COPIAR;
          if (lbl) lbl.textContent = "Copiar";
        }, 1500);
      }
      mostrarToast(mensagemToast || "Medida copiada!");
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(texto).then(sucesso).catch(() => copiarFallback(texto, sucesso));
    } else {
      copiarFallback(texto, sucesso);
    }
  }

  function copiarFallback(texto, onSuccess) {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      if (typeof onSuccess === "function") onSuccess();
    } catch (_) {
      mostrarToast("Não foi possível copiar automaticamente.");
    }
  }

  function mostrarToast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.add("visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => {
      el.toast.classList.remove("visivel");
    }, 2200);
  }

  // ==========================================================================
  // RENDERIZAÇÃO DA INTERFACE E ANIMAÇÕES
  // ==========================================================================

  function atualizarIndicadorAbas() {
    if (!el.tabsWrap || !el.tabsIndicador) return;
    const ativa = el.tabsWrap.querySelector(`.conv-tab[data-aba="${abaAtiva}"]`);
    if (!ativa) return;
    const left = ativa.offsetLeft;
    const width = ativa.offsetWidth;
    el.tabsIndicador.style.width = `${width}px`;
    el.tabsIndicador.style.transform = `translateX(${left}px)`;
  }

  function atualizarToggleUnidade(pulsarValores) {
    if (el.btnUnidadeCm && el.btnUnidadePol) {
      const isCm = unidadeAtiva === "cm";
      el.btnUnidadeCm.classList.toggle("ativo", isCm);
      el.btnUnidadeCm.setAttribute("aria-pressed", String(isCm));
      el.btnUnidadePol.classList.toggle("ativo", !isCm);
      el.btnUnidadePol.setAttribute("aria-pressed", String(!isCm));
    }
    if (el.wrapToggleUnidade) {
      el.wrapToggleUnidade.classList.toggle("em-pol", unidadeAtiva === "pol");
    }

    if (pulsarValores && abaAtiva === "medidas" && el.tabelaArea) {
      el.tabelaArea.querySelectorAll(".valor-medida-conv").forEach((span) => {
        span.classList.remove("valor-pulso-unidade");
        void span.offsetWidth;
        span.classList.add("valor-pulso-unidade");
      });
    }
  }

  function animarEntradaConteudo() {
    if (!el.areaDinamica) return;
    el.areaDinamica.classList.remove("conv-animar-entrada");
    void el.areaDinamica.offsetWidth;
    el.areaDinamica.classList.add("conv-animar-entrada");
  }

  function renderizarConversorRapido() {
    if (!el.cardConversor) return;
    const mostrar = abaAtiva === "agulhas" || abaAtiva === "fios";
    el.cardConversor.style.display = mostrar ? "flex" : "none";
    if (!mostrar) return;

    const sistemas = abaAtiva === "agulhas" ? SISTEMAS_AGULHA : SISTEMAS_FIO;
    const sistemaAtual = abaAtiva === "agulhas" ? sistemaAgulha : sistemaFio;
    const valorAtual = abaAtiva === "agulhas" ? valorConvAgulha : valorConvFio;
    const cfgSistema = sistemas.find((s) => s.valor === sistemaAtual) || sistemas[0];

    if (el.tituloConversor) {
      el.tituloConversor.textContent =
        abaAtiva === "agulhas"
          ? "Conversor Rápido de Agulhas"
          : "Conversor Rápido de Espessura de Fios";
    }

    if (el.selectSistema) {
      el.selectSistema.innerHTML = sistemas
        .map(
          (s) =>
            `<option value="${s.valor}" ${s.valor === sistemaAtual ? "selected" : ""}>${escapeHtml(s.rotulo)}</option>`
        )
        .join("");
    }

    if (el.inputConversor) {
      el.inputConversor.value = valorAtual;
      el.inputConversor.placeholder = cfgSistema.placeholder;
    }

    // Popula datalist com opções rápidas do sistema selecionado
    if (el.datalistConversor) {
      let opcoes = [];
      if (abaAtiva === "agulhas") {
        const lista = dados.agulhas_croche || [];
        if (sistemaAtual === "mm") opcoes = lista.map((a) => String(a.mm));
        else if (sistemaAtual === "us") opcoes = lista.filter((a) => a.us !== "—").map((a) => a.us);
        else if (sistemaAtual === "uk") opcoes = lista.filter((a) => a.uk !== "—").map((a) => a.uk);
        else if (sistemaAtual === "letra") opcoes = lista.filter((a) => a.letra !== "—").map((a) => a.letra);
      } else {
        const lista = dados.espessura_fios || [];
        if (sistemaAtual === "tex") opcoes = ["150", "200", "295", "378", "492", "500", "590", "885", "1180", "2000"];
        else if (sistemaAtual === "cyc") opcoes = lista.map((f) => String(f.cyc));
        else opcoes = lista.map((f) => f.nome_internacional);
      }
      el.datalistConversor.innerHTML = [...new Set(opcoes)]
        .map((v) => `<option value="${escapeHtml(v)}"></option>`)
        .join("");
    }

    renderizarResultadoConversor();
  }

  function renderizarResultadoConversor() {
    if (!el.resultadoConversor) return;

    if (abaAtiva === "agulhas") {
      const res = buscarConversaoAgulha(sistemaAgulha, valorConvAgulha);
      if (res.vazio) {
        el.resultadoConversor.innerHTML = `<div class="conv-res-vazio">Digite ou selecione uma medida (ex.: <strong>4.0</strong>, <strong>G-6</strong>, <strong>8</strong>) para ver todas as equivalências.</div>`;
        return;
      }
      if (!res.item) {
        el.resultadoConversor.innerHTML = `<div class="conv-res-vazio">Nenhuma agulha equivalente encontrada para "<strong>${escapeHtml(valorConvAgulha)}</strong>" no padrão selecionado.</div>`;
        return;
      }
      const a = res.item;
      const qtdEstoque = contarAgulhasNoInventario(a.mm);
      const badgeAprox = !res.exato
        ? `<span class="conv-badge-aprox">Mais próximo</span>`
        : "";
      const badgeEst =
        qtdEstoque > 0
          ? `<span class="conv-badge-estoque">✓ ${qtdEstoque} no seu inventário</span>`
          : "";

      el.resultadoConversor.innerHTML = `
        <div class="conv-res-grid">
          <div class="conv-res-celula ${sistemaAgulha === "mm" ? "origem" : ""}">
            <span class="conv-res-rotulo">Milímetros</span>
            <strong class="conv-res-valor">${escapeHtml(formatarMm(a.mm))}</strong>
          </div>
          <div class="conv-res-celula ${sistemaAgulha === "us" ? "origem" : ""}">
            <span class="conv-res-rotulo">Padrão US</span>
            <strong class="conv-res-valor">${escapeHtml(a.us)}</strong>
          </div>
          <div class="conv-res-celula ${sistemaAgulha === "uk" ? "origem" : ""}">
            <span class="conv-res-rotulo">Padrão UK</span>
            <strong class="conv-res-valor">${escapeHtml(a.uk)}</strong>
          </div>
          <div class="conv-res-celula ${sistemaAgulha === "letra" ? "origem" : ""}">
            <span class="conv-res-rotulo">Letra</span>
            <strong class="conv-res-valor">${escapeHtml(a.letra)}</strong>
          </div>
        </div>
        <div class="conv-res-rodape">
          <div class="conv-res-detalhe">
            ${badgeAprox}${badgeEst}
            <span><strong>Uso comum:</strong> ${escapeHtml(a.uso_comum)}</span>
          </div>
          <button type="button" class="btn-conv-copiar" id="btn-conv-copiar-card" data-copiar="${escapeHtml(textoCopiaAgulha(a))}">
            <span class="icone-btn-copiar">${ICONE_COPIAR}</span>
            <span class="texto-btn-copiar">Copiar</span>
          </button>
        </div>
      `;
      return;
    }

    if (abaAtiva === "fios") {
      const res = buscarConversaoFio(sistemaFio, valorConvFio);
      if (res.vazio) {
        el.resultadoConversor.innerHTML = `<div class="conv-res-vazio">Informe um valor de <strong>TEX</strong> (ex.: 500), categoria <strong>CYC</strong> (0–7) ou nome (ex.: Worsted, DK).</div>`;
        return;
      }
      if (!res.item) {
        el.resultadoConversor.innerHTML = `<div class="conv-res-vazio">Nenhuma classificação de fio encontrada para "<strong>${escapeHtml(valorConvFio)}</strong>".</div>`;
        return;
      }
      const f = res.item;
      const faixaTex = f.tex_max >= 9999 ? `${f.tex_min}+` : `${f.tex_min} – ${f.tex_max}`;
      const qtdFios = contarFiosNoInventario(f.tex_min, f.tex_max);
      const badgeEst =
        qtdFios > 0
          ? `<span class="conv-badge-estoque">✓ ${qtdFios} fio(s) dessa faixa no estoque</span>`
          : "";

      el.resultadoConversor.innerHTML = `
        <div class="conv-res-grid">
          <div class="conv-res-celula ${sistemaFio === "cyc" ? "origem" : ""}">
            <span class="conv-res-rotulo">Padrão CYC</span>
            <strong class="conv-res-valor">CYC ${f.cyc}</strong>
          </div>
          <div class="conv-res-celula ${sistemaFio === "nome" ? "origem" : ""}">
            <span class="conv-res-rotulo">Internacional / PT</span>
            <strong class="conv-res-valor compacto">${escapeHtml(f.nome_internacional)}</strong>
            <small class="conv-res-sub">${escapeHtml(f.nome_pt)}</small>
          </div>
          <div class="conv-res-celula ${sistemaFio === "tex" ? "origem" : ""}">
            <span class="conv-res-rotulo">Faixa TEX</span>
            <strong class="conv-res-valor">${escapeHtml(faixaTex)}</strong>
          </div>
          <div class="conv-res-celula">
            <span class="conv-res-rotulo">Agulha Sugerida</span>
            <strong class="conv-res-valor">${escapeHtml(f.agulha_sugerida_mm)} mm</strong>
          </div>
        </div>
        <div class="conv-res-rodape">
          <div class="conv-res-detalhe">
            ${badgeEst}
            <span><strong>Exemplos BR:</strong> ${escapeHtml((f.exemplos_br || []).join(" • "))}</span>
          </div>
          <button type="button" class="btn-conv-copiar" id="btn-conv-copiar-card" data-copiar="${escapeHtml(textoCopiaFio(f))}">
            <span class="icone-btn-copiar">${ICONE_COPIAR}</span>
            <span class="texto-btn-copiar">Copiar</span>
          </button>
        </div>
      `;
    }
  }

  function renderizarBlocoMedidasTopo() {
    if (!el.blocoMedidasTopo) return;
    const isMedidas = abaAtiva === "medidas";
    el.blocoMedidasTopo.style.display = isMedidas ? "flex" : "none";
    if (!isMedidas) return;

    if (el.chipsSubcategorias) {
      el.chipsSubcategorias.innerHTML = ORDEM_SUBCATEGORIAS.map((key) => {
        const meta = META_SUBCATEGORIAS[key];
        const ativo = key === subcategoriaAtiva;
        return `
          <button
            type="button"
            class="conv-chip-sub ${ativo ? "ativo" : ""}"
            data-sub="${key}"
            aria-pressed="${ativo}"
          >${escapeHtml(meta.rotulo)}</button>
        `;
      }).join("");
    }

    if (el.dicaContextual) {
      const grupo = (dados.medidas_padrao || {})[subcategoriaAtiva];
      const meta = META_SUBCATEGORIAS[subcategoriaAtiva];
      const dica = grupo ? formatarDicaContextual(grupo.dica) : "";
      el.dicaContextual.innerHTML = `
        <span class="conv-dica-icone" aria-hidden="true">💡</span>
        <div class="conv-dica-texto">
          <strong>Dica prática (${escapeHtml(meta ? meta.rotulo : "")}):</strong>
          <span>${escapeHtml(dica)}</span>
        </div>
      `;
    }
  }

  function renderizarTabela() {
    if (!el.tabelaArea) return;
    const q = termoBusca.trim();

    if (abaAtiva === "agulhas") {
      const linhas = filtrarAgulhas(q);
      atualizarStatusContagem(linhas.length, (dados.agulhas_croche || []).length, "agulha(s)");

      if (linhas.length === 0) {
        renderizarEstadoVazio(q);
        return;
      }

      el.tabelaArea.innerHTML = `
        <table class="conv-tabela" aria-label="Tabela de conversão de agulhas de crochê">
          <thead>
            <tr>
              <th scope="col">Milímetros (mm)</th>
              <th scope="col">Padrão US</th>
              <th scope="col">Padrão UK</th>
              <th scope="col">Letra</th>
              <th scope="col">Uso Comum</th>
              <th scope="col" class="col-acao">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${linhas
              .map((a) => {
                const rowId = `agulha:${a.mm}`;
                const dest = linhasDestacadas.has(rowId);
                const copia = textoCopiaAgulha(a);
                return `
                  <tr class="${dest ? "linha-destacada" : ""}" data-row-id="${escapeHtml(rowId)}" tabindex="0" aria-selected="${dest}">
                    <td data-label="Milímetros (mm)"><strong>${escapeHtml(formatarMm(a.mm))}</strong></td>
                    <td data-label="Padrão US">${escapeHtml(a.us)}</td>
                    <td data-label="Padrão UK">${escapeHtml(a.uk)}</td>
                    <td data-label="Letra">${escapeHtml(a.letra)}</td>
                    <td data-label="Uso Comum" class="col-descricao">${escapeHtml(a.uso_comum)}</td>
                    <td data-label="Ação" class="col-acao">
                      <button type="button" class="btn-conv-copiar" data-copiar="${escapeHtml(copia)}" title="Copiar referência da agulha">
                        <span class="icone-btn-copiar">${ICONE_COPIAR}</span>
                        <span class="texto-btn-copiar">Copiar</span>
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
      return;
    }

    if (abaAtiva === "fios") {
      const linhas = filtrarFios(q);
      atualizarStatusContagem(linhas.length, (dados.espessura_fios || []).length, "espessura(s)");

      if (linhas.length === 0) {
        renderizarEstadoVazio(q);
        return;
      }

      el.tabelaArea.innerHTML = `
        <table class="conv-tabela" aria-label="Tabela de espessura de fios CYC e TEX">
          <thead>
            <tr>
              <th scope="col">CYC</th>
              <th scope="col">Nome Internacional</th>
              <th scope="col">Categoria (PT-BR)</th>
              <th scope="col">Faixa TEX</th>
              <th scope="col">Agulha (mm)</th>
              <th scope="col">Exemplos no Brasil</th>
              <th scope="col" class="col-acao">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${linhas
              .map((f) => {
                const rowId = `fio:${f.cyc}`;
                const dest = linhasDestacadas.has(rowId);
                const texFaixa = f.tex_max >= 9999 ? `${f.tex_min}+` : `${f.tex_min} – ${f.tex_max}`;
                const copia = textoCopiaFio(f);
                return `
                  <tr class="${dest ? "linha-destacada" : ""}" data-row-id="${escapeHtml(rowId)}" tabindex="0" aria-selected="${dest}">
                    <td data-label="CYC"><span class="conv-pill-cyc">${f.cyc}</span></td>
                    <td data-label="Nome Internacional"><strong>${escapeHtml(f.nome_internacional)}</strong></td>
                    <td data-label="Categoria (PT-BR)">${escapeHtml(f.nome_pt)}</td>
                    <td data-label="Faixa TEX" class="col-mono">${escapeHtml(texFaixa)}</td>
                    <td data-label="Agulha (mm)" class="col-mono">${escapeHtml(f.agulha_sugerida_mm)} mm</td>
                    <td data-label="Exemplos no Brasil" class="col-descricao">${escapeHtml((f.exemplos_br || []).join(" • "))}</td>
                    <td data-label="Ação" class="col-acao">
                      <button type="button" class="btn-conv-copiar" data-copiar="${escapeHtml(copia)}" title="Copiar referência do fio">
                        <span class="icone-btn-copiar">${ICONE_COPIAR}</span>
                        <span class="texto-btn-copiar">Copiar</span>
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
      return;
    }

    // Aba: Medidas Padrão (RF03, RF04, RF08)
    const { modoGlobal, linhas } = filtrarMedidasInteligente(q);

    if (linhas.length === 0) {
      atualizarStatusContagem(0, ((dados.medidas_padrao || {})[subcategoriaAtiva]?.itens || []).length, "medida(s)");
      renderizarEstadoVazio(q);
      return;
    }

    if (!modoGlobal) {
      const meta = META_SUBCATEGORIAS[subcategoriaAtiva];
      const totalSub = ((dados.medidas_padrao || {})[subcategoriaAtiva]?.itens || []).length;
      atualizarStatusContagem(linhas.length, totalSub, `medida(s) em ${meta.rotulo}`);

      el.tabelaArea.innerHTML = `
        <table class="conv-tabela" aria-label="Tabela de medidas padrão de ${escapeHtml(meta.rotulo)}">
          <thead>
            <tr>
              ${meta.colunas.map((c) => `<th scope="col">${escapeHtml(c.label)}</th>`).join("")}
              <th scope="col" class="col-acao">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${linhas
              .map(({ item, idx }) => {
                const rowId = `med:${subcategoriaAtiva}:${idx}`;
                const dest = linhasDestacadas.has(rowId);
                const copia = textoCopiaMedida(subcategoriaAtiva, item);
                return `
                  <tr class="${dest ? "linha-destacada" : ""}" data-row-id="${escapeHtml(rowId)}" tabindex="0" aria-selected="${dest}">
                    ${meta.colunas
                      .map((c, ci) => {
                        const raw = item[c.key];
                        if (c.tipo === "texto") {
                          return `<td data-label="${escapeHtml(c.label)}"><strong>${escapeHtml(raw)}</strong></td>`;
                        }
                        const fmt = formatarMedida(raw, unidadeAtiva, c.tipo);
                        return `<td data-label="${escapeHtml(c.label)}"><span class="valor-medida-conv">${escapeHtml(fmt)}</span></td>`;
                      })
                      .join("")}
                    <td data-label="Ação" class="col-acao">
                      <button type="button" class="btn-conv-copiar" data-copiar="${escapeHtml(copia)}" title="Copiar medidas desta linha">
                        <span class="icone-btn-copiar">${ICONE_COPIAR}</span>
                        <span class="texto-btn-copiar">Copiar</span>
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      // Busca transversal nas 8 subcategorias (ex.: "Touca bebê" estando em outra subcategoria)
      atualizarStatusContagem(linhas.length, linhas.length, "medida(s) encontradas em todas as peças");

      el.tabelaArea.innerHTML = `
        <table class="conv-tabela" aria-label="Resultados de busca em Medidas Padrão">
          <thead>
            <tr>
              <th scope="col">Peça</th>
              <th scope="col">Tamanho / Modelo</th>
              <th scope="col">Medidas (${unidadeAtiva === "pol" ? "pol" : "cm"})</th>
              <th scope="col" class="col-acao">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${linhas
              .map(({ subKey, meta, item, idx }) => {
                const rowId = `med:${subKey}:${idx}`;
                const dest = linhasDestacadas.has(rowId);
                const primeiraCol = meta.colunas[0];
                const resumoMedidas = meta.colunas
                  .slice(1)
                  .map(
                    (c) =>
                      `<span class="conv-med-chip-resumo"><em>${escapeHtml(c.copia || c.label)}:</em> <span class="valor-medida-conv">${escapeHtml(formatarMedida(item[c.key], unidadeAtiva, c.tipo))}</span></span>`
                  )
                  .join("");
                const copia = textoCopiaMedida(subKey, item);
                return `
                  <tr class="${dest ? "linha-destacada" : ""}" data-row-id="${escapeHtml(rowId)}" tabindex="0" aria-selected="${dest}">
                    <td data-label="Peça">
                      <button type="button" class="conv-link-sub" data-ir-sub="${subKey}">${escapeHtml(meta.curto)}</button>
                    </td>
                    <td data-label="Tamanho / Modelo"><strong>${escapeHtml(item[primeiraCol.key])}</strong></td>
                    <td data-label="Medidas" class="col-resumo-medidas">${resumoMedidas}</td>
                    <td data-label="Ação" class="col-acao">
                      <button type="button" class="btn-conv-copiar" data-copiar="${escapeHtml(copia)}" title="Copiar medidas desta linha">
                        <span class="icone-btn-copiar">${ICONE_COPIAR}</span>
                        <span class="texto-btn-copiar">Copiar</span>
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
    }
  }

  function atualizarStatusContagem(exibidos, total, unidadeTexto) {
    if (!el.statusBusca) return;
    if (termoBusca.trim()) {
      el.statusBusca.textContent = `${exibidos} resultado(s) para "${termoBusca.trim()}" (${unidadeTexto}) • Clique em uma linha para destacar no modo leitura`;
    } else {
      el.statusBusca.textContent = `Exibindo ${exibidos} ${unidadeTexto} • Clique em qualquer linha para destacar durante o trabalho`;
    }
  }

  function renderizarEstadoVazio(q) {
    const sugestoes = contarResultadosOutrasAbas(q);
    const botoesSug = sugestoes.length
      ? `
        <div class="conv-sugestoes-abas">
          <span>Encontrado em outra aba:</span>
          ${sugestoes
            .map(
              (s) =>
                `<button type="button" class="btn-conv-sug-aba" data-ir-aba="${s.aba}" ${s.sub ? `data-ir-sub="${s.sub}"` : ""}>${escapeHtml(s.rotulo)} (${s.qtd}) →</button>`
            )
            .join("")}
        </div>
      `
      : "";

    el.tabelaArea.innerHTML = `
      <div class="conv-estado-vazio">
        <p>Nenhuma referência encontrada para <strong>"${escapeHtml(q)}"</strong> nesta aba.</p>
        ${botoesSug}
        <button type="button" class="btn-conv-limpar-vazio" id="btn-conv-limpar-vazio">Limpar busca</button>
      </div>
    `;
  }

  function renderizarTudo(animar) {
    // Atualiza aria-selected nas abas
    if (el.tabsWrap) {
      el.tabsWrap.querySelectorAll(".conv-tab").forEach((btn) => {
        const ativa = btn.dataset.aba === abaAtiva;
        btn.classList.toggle("ativo", ativa);
        btn.setAttribute("aria-selected", String(ativa));
        btn.setAttribute("tabindex", ativa ? "0" : "-1");
      });
    }

    renderizarConversorRapido();
    renderizarBlocoMedidasTopo();
    renderizarTabela();
    atualizarToggleUnidade(false);
    requestAnimationFrame(atualizarIndicadorAbas);

    if (animar) animarEntradaConteudo();
  }

  // ==========================================================================
  // AÇÕES E EVENTOS
  // ==========================================================================

  function trocarAba(novaAba, manterBusca) {
    if (!novaAba || !["agulhas", "fios", "medidas"].includes(novaAba)) return;
    if (abaAtiva === novaAba && !manterBusca) return;
    abaAtiva = novaAba;

    // Limpa busca ao trocar de aba manualmente (conforme spec: limpa filtros específicos da aba anterior)
    if (!manterBusca && termoBusca) {
      termoBusca = "";
      if (el.inputBusca) el.inputBusca.value = "";
      if (el.btnLimparBusca) el.btnLimparBusca.hidden = true;
    }

    renderizarTudo(true);
  }

  function alternarUnidade(novaUnidade) {
    if (novaUnidade !== "cm" && novaUnidade !== "pol") return;
    if (unidadeAtiva === novaUnidade) return;
    unidadeAtiva = novaUnidade;
    salvarUnidade(unidadeAtiva);

    if (abaAtiva === "medidas") {
      renderizarBlocoMedidasTopo();
      renderizarTabela();
    }
    atualizarToggleUnidade(true);
    mostrarToast(unidadeAtiva === "pol" ? "Medidas convertidas para polegadas (pol)" : "Medidas exibidas em centímetros (cm)");
  }

  function alternarOrigemConversor() {
    if (abaAtiva === "agulhas") {
      const idx = SISTEMAS_AGULHA.findIndex((s) => s.valor === sistemaAgulha);
      const prox = SISTEMAS_AGULHA[(idx + 1) % SISTEMAS_AGULHA.length];
      // Se houver um item atualmente convertido, já preenche o valor equivalente na nova origem!
      const atual = buscarConversaoAgulha(sistemaAgulha, valorConvAgulha).item;
      sistemaAgulha = prox.valor;
      if (atual && atual[prox.valor] && atual[prox.valor] !== "—") {
        valorConvAgulha = String(atual[prox.valor]);
      } else {
        valorConvAgulha = prox.exemplo;
      }
      renderizarConversorRapido();
    } else if (abaAtiva === "fios") {
      const idx = SISTEMAS_FIO.findIndex((s) => s.valor === sistemaFio);
      const prox = SISTEMAS_FIO[(idx + 1) % SISTEMAS_FIO.length];
      const atual = buscarConversaoFio(sistemaFio, valorConvFio).item;
      sistemaFio = prox.valor;
      if (atual) {
        if (prox.valor === "tex") valorConvFio = String(atual.tex_max >= 9999 ? atual.tex_min : atual.tex_max);
        else if (prox.valor === "cyc") valorConvFio = String(atual.cyc);
        else valorConvFio = atual.nome_internacional.split(" ")[0];
      } else {
        valorConvFio = prox.exemplo;
      }
      renderizarConversorRapido();
    }
  }

  function vincularEventos() {
    // 1. Toggle cm | pol (RF03 / RNF04)
    if (el.btnUnidadeCm) {
      el.btnUnidadeCm.addEventListener("click", () => alternarUnidade("cm"));
    }
    if (el.btnUnidadePol) {
      el.btnUnidadePol.addEventListener("click", () => alternarUnidade("pol"));
    }

    // 2. Busca instantânea + Botão Limpar (X) (RF05)
    if (el.inputBusca) {
      el.inputBusca.addEventListener("input", () => {
        termoBusca = el.inputBusca.value;
        if (el.btnLimparBusca) el.btnLimparBusca.hidden = termoBusca.length === 0;
        renderizarTabela();
      });
    }
    if (el.btnLimparBusca) {
      el.btnLimparBusca.addEventListener("click", () => {
        termoBusca = "";
        if (el.inputBusca) {
          el.inputBusca.value = "";
          el.inputBusca.focus();
        }
        el.btnLimparBusca.hidden = true;
        renderizarTabela();
      });
    }

    // 3. Abas principais + Navegação por teclado (RF01 / RNF03)
    if (el.tabsWrap) {
      el.tabsWrap.addEventListener("click", (e) => {
        const btn = e.target.closest(".conv-tab[data-aba]");
        if (btn) trocarAba(btn.dataset.aba, false);
      });

      el.tabsWrap.addEventListener("keydown", (e) => {
        const tabs = Array.from(el.tabsWrap.querySelectorAll(".conv-tab[data-aba]"));
        const atualIdx = tabs.indexOf(document.activeElement);
        if (atualIdx === -1) return;

        let novoIdx = null;
        if (e.key === "ArrowRight") novoIdx = (atualIdx + 1) % tabs.length;
        else if (e.key === "ArrowLeft") novoIdx = (atualIdx - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") novoIdx = 0;
        else if (e.key === "End") novoIdx = tabs.length - 1;

        if (novoIdx != null) {
          e.preventDefault();
          tabs[novoIdx].focus();
          trocarAba(tabs[novoIdx].dataset.aba, false);
        }
      });
    }

    // 4. Conversor Rápido (RF02)
    if (el.selectSistema) {
      el.selectSistema.addEventListener("change", () => {
        const novoSis = el.selectSistema.value;
        if (abaAtiva === "agulhas") {
          const atual = buscarConversaoAgulha(sistemaAgulha, valorConvAgulha).item;
          sistemaAgulha = novoSis;
          const cfg = SISTEMAS_AGULHA.find((s) => s.valor === novoSis);
          valorConvAgulha =
            atual && atual[novoSis] && atual[novoSis] !== "—"
              ? String(atual[novoSis])
              : cfg
                ? cfg.exemplo
                : "";
        } else {
          const atual = buscarConversaoFio(sistemaFio, valorConvFio).item;
          sistemaFio = novoSis;
          const cfg = SISTEMAS_FIO.find((s) => s.valor === novoSis);
          if (atual && novoSis === "cyc") valorConvFio = String(atual.cyc);
          else if (atual && novoSis === "tex") valorConvFio = String(atual.tex_max >= 9999 ? atual.tex_min : atual.tex_max);
          else if (atual && novoSis === "nome") valorConvFio = atual.nome_internacional.split(" ")[0];
          else valorConvFio = cfg ? cfg.exemplo : "";
        }
        renderizarConversorRapido();
      });
    }

    if (el.inputConversor) {
      el.inputConversor.addEventListener("input", () => {
        if (abaAtiva === "agulhas") valorConvAgulha = el.inputConversor.value;
        else if (abaAtiva === "fios") valorConvFio = el.inputConversor.value;
        renderizarResultadoConversor();
      });
    }

    if (el.btnInverterOrigem) {
      el.btnInverterOrigem.addEventListener("click", alternarOrigemConversor);
    }

    if (el.resultadoConversor) {
      el.resultadoConversor.addEventListener("click", (e) => {
        const btnCop = e.target.closest(".btn-conv-copiar[data-copiar]");
        if (btnCop) {
          copiarTexto(btnCop.dataset.copiar, btnCop, "Equivalência copiada!");
        }
      });
    }

    // 5. Chips de Subcategoria (RF04 + teclado)
    if (el.chipsSubcategorias) {
      el.chipsSubcategorias.addEventListener("click", (e) => {
        const chip = e.target.closest(".conv-chip-sub[data-sub]");
        if (!chip) return;
        subcategoriaAtiva = chip.dataset.sub;
        renderizarBlocoMedidasTopo();
        renderizarTabela();
        animarEntradaConteudo();
      });

      el.chipsSubcategorias.addEventListener("keydown", (e) => {
        const chips = Array.from(el.chipsSubcategorias.querySelectorAll(".conv-chip-sub[data-sub]"));
        const idx = chips.indexOf(document.activeElement);
        if (idx === -1) return;
        let prox = null;
        if (e.key === "ArrowRight") prox = (idx + 1) % chips.length;
        else if (e.key === "ArrowLeft") prox = (idx - 1 + chips.length) % chips.length;
        if (prox != null) {
          e.preventDefault();
          chips[prox].focus();
          subcategoriaAtiva = chips[prox].dataset.sub;
          renderizarBlocoMedidasTopo();
          renderizarTabela();
          animarEntradaConteudo();
        }
      });
    }

    // 6. Delegação de eventos na Tabela: Copiar (RF06), Destacar Linha (RF07), Sugestões de busca
    if (el.tabelaArea) {
      el.tabelaArea.addEventListener("click", (e) => {
        const btnCop = e.target.closest(".btn-conv-copiar[data-copiar]");
        if (btnCop) {
          e.stopPropagation();
          copiarTexto(btnCop.dataset.copiar, btnCop, "Medida copiada!");
          return;
        }

        const btnIrSub = e.target.closest("[data-ir-sub]:not([data-ir-aba])");
        if (btnIrSub) {
          e.stopPropagation();
          subcategoriaAtiva = btnIrSub.dataset.irSub;
          termoBusca = "";
          if (el.inputBusca) el.inputBusca.value = "";
          if (el.btnLimparBusca) el.btnLimparBusca.hidden = true;
          renderizarBlocoMedidasTopo();
          renderizarTabela();
          animarEntradaConteudo();
          return;
        }

        const btnSugAba = e.target.closest(".btn-conv-sug-aba[data-ir-aba]");
        if (btnSugAba) {
          const destino = btnSugAba.dataset.irAba;
          if (btnSugAba.dataset.irSub) subcategoriaAtiva = btnSugAba.dataset.irSub;
          trocarAba(destino, true);
          return;
        }

        if (e.target.closest("#btn-conv-limpar-vazio")) {
          termoBusca = "";
          if (el.inputBusca) {
            el.inputBusca.value = "";
            el.inputBusca.focus();
          }
          if (el.btnLimparBusca) el.btnLimparBusca.hidden = true;
          renderizarTabela();
          return;
        }

        // RF07: Destacar / fixar linha no modo leitura
        const tr = e.target.closest("tr[data-row-id]");
        if (tr) {
          alternarDestaqueLinha(tr);
        }
      });

      el.tabelaArea.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const tr = e.target.closest("tr[data-row-id]");
        if (!tr || e.target.closest("button")) return;
        e.preventDefault();
        alternarDestaqueLinha(tr);
      });
    }

    // 7. Recalcula posição do indicador deslizante ao redimensionar ou abrir a ferramenta
    window.addEventListener("resize", () => {
      if (document.getElementById("secao-tabelas-conversao")?.style.display !== "none") {
        atualizarIndicadorAbas();
      }
    });

    window.addEventListener("ponto-trama:ferramenta-alterada", (e) => {
      if (e.detail && e.detail.ferramenta === "tabelas-conversao") {
        atualizarCacheInventario();
        requestAnimationFrame(atualizarIndicadorAbas);
      }
    });
  }

  function alternarDestaqueLinha(tr) {
    const id = tr.dataset.rowId;
    if (!id) return;
    if (linhasDestacadas.has(id)) {
      linhasDestacadas.delete(id);
      tr.classList.remove("linha-destacada");
      tr.setAttribute("aria-selected", "false");
    } else {
      linhasDestacadas.add(id);
      tr.classList.add("linha-destacada");
      tr.setAttribute("aria-selected", "true");
    }
  }

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================

  function init() {
    if (jaInicializado) {
      requestAnimationFrame(atualizarIndicadorAbas);
      return;
    }

    el.secao = document.getElementById("secao-tabelas-conversao");
    if (!el.secao) return;

    el.wrapToggleUnidade = document.getElementById("conv-toggle-unidade");
    el.btnUnidadeCm = document.getElementById("btn-conv-unidade-cm");
    el.btnUnidadePol = document.getElementById("btn-conv-unidade-pol");
    el.inputBusca = document.getElementById("input-busca-conversao");
    el.btnLimparBusca = document.getElementById("btn-limpar-busca-conversao");
    el.tabsWrap = document.getElementById("conv-tabs-lista");
    el.tabsIndicador = document.getElementById("conv-tabs-indicador");
    el.areaDinamica = document.getElementById("conv-area-dinamica");
    el.cardConversor = document.getElementById("conv-card-rapido");
    el.tituloConversor = document.getElementById("conv-titulo-rapido");
    el.selectSistema = document.getElementById("conv-select-sistema");
    el.inputConversor = document.getElementById("conv-input-valor");
    el.datalistConversor = document.getElementById("conv-datalist-valores");
    el.btnInverterOrigem = document.getElementById("btn-conv-inverter-origem");
    el.resultadoConversor = document.getElementById("conv-resultado-rapido");
    el.blocoMedidasTopo = document.getElementById("conv-bloco-medidas-topo");
    el.chipsSubcategorias = document.getElementById("conv-chips-subcategorias");
    el.dicaContextual = document.getElementById("conv-dica-contextual");
    el.statusBusca = document.getElementById("conv-status-busca");
    el.tabelaArea = document.getElementById("conv-tabela-wrapper");
    el.toast = document.getElementById("toast-conversao");

    unidadeAtiva = lerUnidadeSalva();
    carregarDadosJson();
    vincularEventos();
    renderizarTudo(false);
    atualizarCacheInventario();

    jaInicializado = true;
  }

  return { init, trocarAba };
})();
