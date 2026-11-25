-- ============================================================================
-- PONTO & TRAMA - ESQUEMA DO BANCO DE DADOS RELACIONAL (SQLite / SQL)
-- Arquivo: backend/database/schema.sql
-- Banco físico gerado em: backend/database/ponto_e_trama.db
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ----------------------------------------------------------------------------
-- 1. INVENTÁRIO DE FIOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fios (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nome              TEXT    NOT NULL,
    marca             TEXT    NOT NULL DEFAULT '',
    cor_nome          TEXT    NOT NULL DEFAULT '',
    cor_codigo        TEXT    DEFAULT '',
    lote              TEXT    DEFAULT '',
    imagem_url        TEXT    DEFAULT '',
    tex               REAL,
    composicao        TEXT    DEFAULT '',
    peso_novelo_g     REAL,
    metragem_novelo_m REAL,
    agulha            TEXT    DEFAULT '',
    quantidade        REAL    NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    peso_restante_g   REAL,
    preco_pago        REAL,
    localizacao       TEXT    DEFAULT '',
    observacoes       TEXT    DEFAULT '',
    criado_em         TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fios_nome  ON fios (nome);
CREATE INDEX IF NOT EXISTS idx_fios_marca ON fios (marca);
CREATE INDEX IF NOT EXISTS idx_fios_cor   ON fios (cor_nome);

-- ----------------------------------------------------------------------------
-- 2. AGULHAS, FERRAMENTAS E AVIAMENTOS (itens_biblioteca)
--    Campos comuns + JSON flexível `atributos_json` para atributos por tipo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itens_biblioteca (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    categoria      TEXT    NOT NULL CHECK (categoria IN ('agulha', 'ferramenta', 'aviamento')),
    foto_url       TEXT    DEFAULT '',
    observacoes    TEXT    DEFAULT '',
    atributos_json TEXT    NOT NULL DEFAULT '{}',
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_categoria ON itens_biblioteca (categoria);
CREATE INDEX IF NOT EXISTS idx_biblioteca_nome      ON itens_biblioteca (nome);

-- ----------------------------------------------------------------------------
-- 3. BANCO DE AMOSTRAS (MODELOS DE PONTOS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banco_amostras (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL,
    tecnica         TEXT    NOT NULL DEFAULT 'croche' CHECK (tecnica IN ('croche', 'trico')),
    categoria       TEXT    NOT NULL DEFAULT 'basico',
    tensao          TEXT    NOT NULL DEFAULT 'medio' CHECK (tensao IN ('apertado', 'medio', 'solto')),
    fio             TEXT    NOT NULL DEFAULT '',
    agulha_mm       REAL    NOT NULL DEFAULT 4.0,
    largura_cm      REAL    NOT NULL DEFAULT 10.0 CHECK (largura_cm > 0),
    altura_cm       REAL    NOT NULL DEFAULT 10.0 CHECK (altura_cm > 0),
    pontos          INTEGER NOT NULL CHECK (pontos > 0),
    carreiras       INTEGER NOT NULL CHECK (carreiras > 0),
    peso_g          REAL,
    metros          REAL,
    foto_url        TEXT    DEFAULT '',
    link_referencia TEXT    DEFAULT '',
    anotacoes       TEXT    DEFAULT '',
    favorito        INTEGER NOT NULL DEFAULT 0 CHECK (favorito IN (0, 1)),
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_amostras_categoria ON banco_amostras (categoria);
CREATE INDEX IF NOT EXISTS idx_amostras_favorito  ON banco_amostras (favorito);
CREATE INDEX IF NOT EXISTS idx_amostras_nome      ON banco_amostras (nome);

-- ----------------------------------------------------------------------------
-- 4. PROJETOS (Gerenciador de Projetos integrado às ferramentas)
--    Campos estruturados + JSON `dados_json` para etapas, materiais,
--    contadores, receita, galeria, amostra e precificação do projeto.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projetos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nome             TEXT    NOT NULL,
    categoria        TEXT    NOT NULL DEFAULT 'amigurumi',
    cliente          TEXT    DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'na_fila',
    foto_capa        TEXT    DEFAULT '',
    data_inicio      TEXT    DEFAULT '',
    prazo_estimado   TEXT    DEFAULT '',
    data_entrega     TEXT    DEFAULT '',
    progresso_modo   TEXT    NOT NULL DEFAULT 'auto',
    progresso_manual INTEGER NOT NULL DEFAULT 0,
    tempo_gasto_seg  INTEGER NOT NULL DEFAULT 0,
    arquivado        INTEGER NOT NULL DEFAULT 0 CHECK (arquivado IN (0, 1)),
    agulha_id        INTEGER REFERENCES itens_biblioteca(id) ON DELETE SET NULL,
    amostra_id       INTEGER REFERENCES banco_amostras(id)   ON DELETE SET NULL,
    observacoes      TEXT    DEFAULT '',
    dados_json       TEXT    NOT NULL DEFAULT '{}',
    criado_em        TEXT    NOT NULL DEFAULT (datetime('now')),
    atualizado_em    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projetos_status    ON projetos (status);
CREATE INDEX IF NOT EXISTS idx_projetos_categoria ON projetos (categoria);
CREATE INDEX IF NOT EXISTS idx_projetos_nome      ON projetos (nome);
