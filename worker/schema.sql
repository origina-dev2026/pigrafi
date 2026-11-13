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
  authorization_accepted_at TEXT NOT NULL,
  authorization_text_version TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
