-- Registrazione agenzie funebri (Cloudflare D1)
CREATE TABLE IF NOT EXISTS agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT NOT NULL,
  website TEXT,
  necrologi_url TEXT NOT NULL,
  anniversari_url TEXT,
  authorization_accepted_at TEXT NOT NULL,
  authorization_text_version TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configurazione di acquisizione (selettori) impostata dall'amministratore dopo aver verificato la pagina
ALTER TABLE agencies ADD COLUMN scraper_config TEXT;
ALTER TABLE agencies ADD COLUMN active INTEGER NOT NULL DEFAULT 0;

-- Prova del consenso: data della presa visione privacy e hash del testo accettato
ALTER TABLE agencies ADD COLUMN privacy_accepted_at TEXT;
ALTER TABLE agencies ADD COLUMN auth_text_sha256 TEXT;
-- Testo dell'autorizzazione per versione (archivio)
CREATE TABLE IF NOT EXISTS consent_texts (version TEXT PRIMARY KEY, text TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
