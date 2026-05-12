-- ============================================================
-- LOFT DELICIAE — Schéma base de données Supabase
-- À coller dans Supabase > SQL Editor > New Query > Run
-- ============================================================

-- Tarifs
CREATE TABLE IF NOT EXISTS tarifs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) UNIQUE NOT NULL,
  prix INTEGER NOT NULL,
  label VARCHAR(50) NOT NULL,
  nuits INTEGER NOT NULL
);

-- Extras / Options
CREATE TABLE IF NOT EXISTS extras (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  prix INTEGER NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT true
);

-- Réservations
CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(20),
  date_arrivee DATE NOT NULL,
  date_depart DATE NOT NULL,
  duree_type VARCHAR(20) NOT NULL,
  extras JSONB DEFAULT '[]',
  montant_base INTEGER NOT NULL,
  montant_extras INTEGER DEFAULT 0,
  montant_total INTEGER NOT NULL,
  occasion VARCHAR(50),
  message TEXT,
  statut VARCHAR(20) DEFAULT 'pending',
  stripe_session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dates bloquées manuellement par l'admin
CREATE TABLE IF NOT EXISTS blocked_dates (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  raison VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos galerie
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  alt VARCHAR(255),
  categorie VARCHAR(50) DEFAULT 'galerie',
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paramètres admin
CREATE TABLE IF NOT EXISTS settings (
  cle VARCHAR(100) PRIMARY KEY,
  valeur TEXT NOT NULL
);

-- Codes promo & cartes cadeaux
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) DEFAULT 'promo',
  discount_type VARCHAR(20) DEFAULT 'percent',
  discount_value NUMERIC NOT NULL,
  expires_at TIMESTAMPTZ,
  used BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Données initiales ──────────────────────────────────────

INSERT INTO tarifs (type, prix, label, nuits) VALUES
  ('nuit',    180,  'Nuitée',   1),
  ('weekend', 320,  'Week-end', 2),
  ('long',    450,  '3 nuits',  3),
  ('semaine', 980,  'Semaine',  7)
ON CONFLICT (type) DO NOTHING;

INSERT INTO extras (key, nom, prix, description) VALUES
  ('petales',   'Pétales de roses',                    25, 'Un lit parsemé de pétales de roses fraîches'),
  ('champagne', 'Champagne millésimé & coupe cristal', 55, 'Bouteille de champagne millésimée'),
  ('petitdej',  'Plateau petit-déjeuner pour 2',       35, 'Viennoiseries fraîches, fruits de saison'),
  ('bougies',   'Sélection de bougies parfumées',      20, 'Bougies de luxe disposées dans l''espace'),
  ('jacuzzi',   'Jacuzzi préparé à l''arrivée',        30, 'Bain bouillonnant préparé à température'),
  ('deco',      'Décoration romantique thématique',    45, 'Mise en scène romantique personnalisée'),
  ('surprise',  'Pack surprise complet',               80, 'Pétales + champagne + bougies + déco')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (cle, valeur) VALUES
  ('admin_password', 'LoftAdmin2024!'),
  ('email_contact',  'contact@loftdeliciae.fr'),
  ('nom_site',       'Loft Deliciae')
ON CONFLICT (cle) DO NOTHING;

-- ── Sécurité RLS ──────────────────────────────────────────

ALTER TABLE tarifs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes   ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour tarifs, extras, photos, blocked_dates
CREATE POLICY "public_read_tarifs"        ON tarifs        FOR SELECT USING (true);
CREATE POLICY "public_read_extras"        ON extras        FOR SELECT USING (true);
CREATE POLICY "public_read_photos"        ON photos        FOR SELECT USING (actif = true);
CREATE POLICY "public_read_blocked_dates" ON blocked_dates FOR SELECT USING (true);

-- Insertion publique pour réservations
CREATE POLICY "public_insert_reservations" ON reservations FOR INSERT WITH CHECK (true);

-- Tout le reste via service_role uniquement (API server-side)
