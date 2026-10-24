/**
 * Avisa o Bing (e os outros buscadores do IndexNow) de todas as URLs do sitemap.
 *
 * O Google tem o Search Console; o Bing — que também alimenta o ChatGPT com
 * busca e o Copilot — aceita o protocolo IndexNow: um POST com a lista de URLs
 * e uma chave que o próprio site publica em `/<chave>.txt` (ver `public/`).
 *
 * Uso, depois de um deploy que mudou páginas públicas:
 *   npx tsx scripts/indexnow.ts                      # produção
 *   npx tsx scripts/indexnow.ts https://outro.dominio
 */
const CHAVE = "a74287edcb6775cfbfdf01846f276e6d";

async function main() {
  const base = (process.argv[2] ?? "https://www.atenza.online").replace(/\/$/, "");
  const host = new URL(base).host;

  const publicada = await fetch(`${base}/${CHAVE}.txt`).then((r) => (r.ok ? r.text() : ""));
  if (publicada.trim() !== CHAVE) {
    throw new Error(`${base}/${CHAVE}.txt não publica a chave — faça o deploy antes de avisar`);
  }

  const xml = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1]!.trim())
    .filter((u) => new URL(u).host === host);
  if (urls.length === 0) throw new Error("sitemap sem URLs deste host");

  const resposta = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: CHAVE, keyLocation: `${base}/${CHAVE}.txt`, urlList: urls }),
  });
  // 200 = aceito; 202 = aceito, chave ainda em verificação. Os dois são sucesso.
  console.log(`IndexNow: ${urls.length} URLs → HTTP ${resposta.status}`);
  if (resposta.status !== 200 && resposta.status !== 202) {
    throw new Error(await resposta.text());
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
