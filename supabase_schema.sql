-- ============================================================
-- MYR PHARMA — Schéma de base de données
-- À exécuter dans : Supabase → SQL Editor → New query
-- ============================================================

-- ── 1. CONFIGURATION DU DISTRICT ──────────────────────────
CREATE TABLE IF NOT EXISTS configuration (
  id            SERIAL PRIMARY KEY,
  region        TEXT,
  aire_sante    TEXT,
  district      TEXT,
  nom_structure TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. CATÉGORIES D'INTRANTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS categories_intrants (
  id    SERIAL PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,
  nom   TEXT NOT NULL
);

INSERT INTO categories_intrants (code, nom) VALUES
  ('ARV_A',  'ARV Adultes'),
  ('ARV_P',  'ARV Pédiatriques'),
  ('TEST',   'Tests & Réactifs'),
  ('MIO',    'M. Infections Opportunistes')
ON CONFLICT (code) DO NOTHING;

-- ── 3. INTRANTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intrants (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_intrant         TEXT UNIQUE NOT NULL,
  sigle                TEXT NOT NULL,
  nom_dci              TEXT NOT NULL,
  id_categorie         INTEGER REFERENCES categories_intrants(id),
  conditionnement      TEXT,
  forme_galenique      TEXT,
  stock_dispo          INTEGER DEFAULT 0,
  seuil_reappro        INTEGER DEFAULT 0,
  file_active          INTEGER DEFAULT 0,
  cmm                  NUMERIC(10,2) DEFAULT 0,
  actif                BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. LOTS D'INTRANTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS lots (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_intrant  UUID REFERENCES intrants(id) ON DELETE CASCADE,
  num_lot     TEXT NOT NULL,
  date_fab    DATE,
  date_perexp DATE NOT NULL,
  qte_lot     INTEGER NOT NULL DEFAULT 0,
  qte_dispo   INTEGER NOT NULL DEFAULT 0,
  date_recep  DATE,
  observ_lot  TEXT,
  etat_lot    TEXT DEFAULT 'en_cours' CHECK (etat_lot IN ('en_cours','fini','perime')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. CENTRES DE SANTÉ ────────────────────────────────────
CREATE TABLE IF NOT EXISTS centres_sante (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_cs      TEXT UNIQUE NOT NULL,
  nom          TEXT NOT NULL,
  contact      TEXT,
  localisation TEXT,
  type_centre  TEXT DEFAULT 'dispensaire' CHECK (type_centre IN ('dispensaire','ccs','hopital')),
  actif        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. FOURNISSEURS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fournisseurs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_four   TEXT UNIQUE NOT NULL,
  nom         TEXT NOT NULL,
  nom_pf      TEXT,
  contact_pf  TEXT,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. SESSIONS (périodes de 4 mois) ──────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         TEXT NOT NULL,
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  statut      TEXT DEFAULT 'active' CHECK (statut IN ('active','cloturee')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. INVENTAIRES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventaires (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  date_inventaire DATE NOT NULL,
  id_session      UUID REFERENCES sessions(id),
  statut          TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon','valide')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  validated_at    TIMESTAMPTZ
);

-- ── 9. LIGNES D'INVENTAIRE (par lot) ──────────────────────
CREATE TABLE IF NOT EXISTS inventaire_lignes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_inventaire  UUID REFERENCES inventaires(id) ON DELETE CASCADE,
  id_intrant     UUID REFERENCES intrants(id),
  id_lot         UUID REFERENCES lots(id),
  num_lot        TEXT,
  date_perexp    DATE,
  qs             INTEGER DEFAULT 0,
  sdu            INTEGER DEFAULT 0,
  ecart          INTEGER GENERATED ALWAYS AS (qs - sdu) STORED,
  observation    TEXT
);

-- ── 10. BONS DE COMMANDE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bons_commande (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_bc       TEXT UNIQUE NOT NULL,
  type_bc         TEXT NOT NULL CHECK (type_bc IN ('cs_district','district_fournisseur')),
  id_cs           UUID REFERENCES centres_sante(id),
  id_fournisseur  UUID REFERENCES fournisseurs(id),
  id_session      UUID REFERENCES sessions(id),
  date_commande   DATE NOT NULL,
  periode_debut   DATE,
  periode_fin     DATE,
  nb_patients     INTEGER DEFAULT 0,
  statut          TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','livree','partielle','annulee')),
  date_livraison  DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. LIGNES DES BONS DE COMMANDE ───────────────────────
CREATE TABLE IF NOT EXISTS bons_commande_lignes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_bon_commande     UUID REFERENCES bons_commande(id) ON DELETE CASCADE,
  id_intrant          UUID REFERENCES intrants(id),
  file_active         INTEGER DEFAULT 0,
  sdu                 INTEGER DEFAULT 0,
  cmm_bm              NUMERIC(10,2) DEFAULT 0,
  qac                 INTEGER DEFAULT 0,
  quantite_commandee  INTEGER DEFAULT 0,
  quantite_livree     INTEGER DEFAULT 0,
  observation         TEXT
);

-- ── 12. MOUVEMENTS DE STOCK ────────────────────────────────
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type_mvt        TEXT NOT NULL CHECK (type_mvt IN ('entree','sortie')),
  motif           TEXT NOT NULL,
  id_intrant      UUID REFERENCES intrants(id),
  id_lot          UUID REFERENCES lots(id),
  quantite        INTEGER NOT NULL,
  date_mouvement  DATE NOT NULL DEFAULT CURRENT_DATE,
  source          TEXT CHECK (source IN ('fournisseur','livraison_cs','perte','don','retour_cs','peremption','autre')),
  id_cs           UUID REFERENCES centres_sante(id),
  id_fournisseur  UUID REFERENCES fournisseurs(id),
  id_bon_commande UUID REFERENCES bons_commande(id),
  observation     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGER : mise à jour automatique de stock_dispo et etat_lot
-- ============================================================

-- Recalcule stock_dispo de l'intrant après chaque changement de lot
CREATE OR REPLACE FUNCTION update_stock_dispo()
RETURNS TRIGGER AS $$
BEGIN
  -- Marquer lot comme fini si qte_dispo = 0
  IF NEW.qte_dispo = 0 THEN
    NEW.etat_lot := 'fini';
  END IF;
  -- Marquer lot comme périmé si date dépassée
  IF NEW.date_perexp < CURRENT_DATE THEN
    NEW.etat_lot := 'perime';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_lot_etat
  BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_stock_dispo();

-- Recalcule stock_dispo de l'intrant
CREATE OR REPLACE FUNCTION recalc_intrant_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE intrants SET
    stock_dispo = (
      SELECT COALESCE(SUM(qte_dispo), 0)
      FROM lots
      WHERE id_intrant = COALESCE(NEW.id_intrant, OLD.id_intrant)
        AND etat_lot = 'en_cours'
        AND date_perexp >= CURRENT_DATE
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.id_intrant, OLD.id_intrant);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recalc_stock
  AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW EXECUTE FUNCTION recalc_intrant_stock();

-- ============================================================
-- ROW LEVEL SECURITY (authentification requise)
-- ============================================================

ALTER TABLE configuration       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_intrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE intrants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE centres_sante        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaires          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire_lignes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_commande        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_commande_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock     ENABLE ROW LEVEL SECURITY;

-- Toutes les tables : accès uniquement aux utilisateurs connectés
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'configuration','categories_intrants','intrants','lots',
    'centres_sante','fournisseurs','sessions','inventaires',
    'inventaire_lignes','bons_commande','bons_commande_lignes','mouvements_stock'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth_only_%s" ON %I;', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "auth_only_%s" ON %I
       FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
