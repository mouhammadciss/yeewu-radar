// Test d'intégration : DATABASE_URL vers une base de test, réseau simulé.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { collect } from "../lib/collect.ts";
import { db } from "../lib/db.ts";

const now = new Date().toUTCString();
const feed = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
const item = (t: string, link: string, src: string) =>
  `<item><title>${t} - ${src}</title><link>${link}</link><pubDate>${now}</pubDate><source url="https://${src}.sn">${src}</source></item>`;

globalThis.fetch = (async (url: string) => {
  const u = decodeURIComponent(String(url));
  let body = feed("");
  if (u.includes('"Sonatel"')) body = feed(item("Sonatel lance la 5G à Thiès", "https://g/1", "APS") + item("Panne géante chez Sonatel : les abonnés en colère", "https://g/2", "Seneweb"));
  if (u.includes('"Yas Sénégal"')) body = feed(item("Yas Sénégal et Sonatel : la bataille des forfaits", "https://g/3", "Dakaractu"));
  if (u.includes("senego.com")) body = feed(item("Expresso Sénégal : un café expresso offert", "https://s/4", "Senego"));
  if (u.includes("aps.sn")) return new Response("down", { status: 503 });
  return new Response(body, { status: 200 });
}) as typeof fetch;

after(async () => { await db().end(); });

test("collecte : rapprochement, exclusions, dédoublonnage, erreurs tolérées", async () => {
  const sql = db();
  await sql`delete from mentions`;
  const r1 = await collect();
  const rows = await sql<{ name: string; title: string; sentiment: number }[]>`
    select b.name, m.title, m.sentiment from mentions m join brands b on b.id = m.brand_id order by m.url, b.name`;
  // g/1 → Orange ; g/2 → Orange ; g/3 → Orange + Yas ; s/4 exclu (café expresso)
  assert.equal(r1.mentionsAdded, 4, JSON.stringify(rows));
  assert.ok(rows.some((x) => x.title.startsWith("Panne") && x.sentiment === -1));
  assert.ok(rows.some((x) => x.title.startsWith("Sonatel lance") && x.sentiment === 1));
  assert.ok(r1.errors.some((e) => e.includes("APS")));
  const r2 = await collect();
  assert.equal(r2.mentionsAdded, 0);
});
