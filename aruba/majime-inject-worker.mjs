// Cloudflare Worker su majime.it (route "majime.it/*"): aggiunge lo snippet AdSense
// nella <head> di tutte le pagine HTML, senza toccare i file del sito.
// Reversibile: basta disattivare/eliminare la route.
const SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2414957329781059" crossorigin="anonymous"></script>';

export default {
  async fetch(request) {
    const res = await fetch(request);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return res;
    return new HTMLRewriter()
      .on('head', { element(el) { el.append(SNIPPET, { html: true }); } })
      .transform(res);
  },
};
