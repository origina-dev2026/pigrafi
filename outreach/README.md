# Bozze email alle agenzie (Apple Mail)

1. Completa `agencies.csv`: aggiungi la colonna `email` per ogni agenzia (solo righe con email generano bozze).
2. `node outreach/make-drafts.mjs` → crea `create-drafts.applescript` (nessun invio).
3. `osascript outreach/create-drafts.applescript` → Mail apre le bozze, una per agenzia.
4. Controlla le bozze e inviale tu dal Mac.

Il testo sta in `template.txt`. Il link al modulo è `https://pigrafi.majime.it/agenzie.html` (attivo dopo HTTPS e Worker).
Il mittente è configurato su `segreteria@majime.it`: l'account deve essere presente in Mail.
