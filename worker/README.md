# Registrazione agenzie (Cloudflare Worker + D1, gratuito)

1. `cd worker && npm i -g wrangler` (oppure `npx wrangler`)
2. `npx wrangler login`
3. `npx wrangler d1 create pigrafi` → copia il `database_id` in `wrangler.toml`
4. `npx wrangler d1 execute pigrafi --remote --file=schema.sql`
5. `npx wrangler secret put IP_SALT` (una stringa casuale lunga)
6. `npx wrangler deploy` → annota l'URL (es. `https://pigrafi-registrazione.<account>.workers.dev`)
7. In `docs/agenzie.html` sostituisci `REGISTER_URL` con `<URL>/register`.

Test: `node --test worker/validate.test.mjs`
