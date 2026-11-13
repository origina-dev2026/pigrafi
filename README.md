# Pigrafi

App per consultare le pigrafi delle agenzie funebri, per città, con filtro per cognome.

- **Dati**: un file JSON (`docs/data/pigrafi.json`) + immagini locali, nel repository. È il "database" ed è gratuito.
- **Aggiornamento**: GitHub Actions ogni notte a mezzanotte (ora italiana) esegue lo scraper e fa commit dei dati.
- **Web / Android**: sito statico su GitHub Pages, installabile da Chrome su Android ("Aggiungi a schermata Home").
- **App Store (iOS)**: stesso sito incapsulato con Capacitor (vedi sotto).

## Struttura

```
sources.json          agenzie e selettori CSS (da configurare)
scraper/scrape.mjs    scansiona le pagine e scarica le immagini
docs/                 app web (index.html, app.js, ...) + dati
.github/workflows/    cron giornaliero
```

## Configurare le agenzie

Per ogni pagina "pigrafi" di un'agenzia, in `sources.json` indica:

| campo     | cosa è |
|-----------|--------|
| `city`    | città (il menu in app mostra queste città) |
| `name`    | nome agenzia |
| `url`     | URL della pagina con le pigrafi |
| `item`    | selettore CSS di ogni scheda/pigrafe |
| `image`   | selettore dell'immagine dentro la scheda |
| `surname` | selettore del cognome (se assente usa il testo `alt` dell'immagine) |

La data viene cercata nel testo della scheda (formati `12/11/2026` o `12 novembre 2026`). È la data del funerale: quando è passata la pigrafe diventa grigia.

Per trovare i selettori: apri la pagina, tasto destro su una pigrafe → *Ispeziona*, e annota la classe della scheda.

## Provare in locale

```bash
npm install
npm test
npm run scrape
npx serve docs      # oppure: python3 -m http.server -d docs 8080
```

## Pubblicare (gratis)

1. Crea un repository GitHub e carica il progetto.
2. *Settings → Pages*: sorgente "Deploy from a branch", branch `main`, cartella `/docs`.
3. *Settings → Actions → General → Workflow permissions*: scegli "Read and write".
4. Esegui una volta il workflow "Aggiornamento pigrafi" (tab *Actions*, *Run workflow*).

Il sito sarà su `https://<utente>.github.io/<repo>/`.

## Android

Apri il sito in Chrome → menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.

## App Store (iOS)

Serve un account Apple Developer (99 USD/anno) e un Mac con Xcode:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Pigrafi it.tuonome.pigrafi --web-dir docs
npx cap add ios
npx cap open ios     # in Xcode: firma, icona, invio su App Store Connect
```

Con `--web-dir docs` l'app iOS mostra la stessa versione web; per aggiornare i dati non serve ripubblicare l'app.

## Note legali

Le pigrafi sono annunci pubblici, ma le immagini appartengono alle agenzie. Lo scraper le copia nel repository: prima di pubblicare, chiedi il permesso alle agenzie o usa solo i loro dati testuali con link alla pagina originale. Verifica anche i termini d'uso dei siti e i dati personali (il nome del defunto è già pubblico nelle pigrafi; non aggiungere altri dati).
