import { db, type Brand } from "./db.ts";
import { googleNewsUrl, parseFeed, type FeedItem } from "./rss.ts";
import { matchBrands } from "./text.ts";
import { aiSentiment, lexiconSentiment } from "./sentiment.ts";
import { LOCAL_FEEDS } from "./feeds.ts";

const UA = "Mozilla/5.0 (compatible; YeewuRadar/0.1; +https://yeewu.sn)";

async function fetchFeed(url: string, source: string, timeoutMs = 12000): Promise<FeedItem[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text(), source);
  } finally {
    clearTimeout(t);
  }
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

type Candidate = { brand: Brand; item: FeedItem; matched: string };

/** Collecte pour tous les clients (ou un seul). Renvoie un résumé. */
export async function collect(opts: { clientId?: number; days?: number } = {}) {
  const sql = db();
  const days = opts.days ?? 7;
  const [run] = await sql`insert into collect_runs default values returning id`;
  const errors: string[] = [];

  const brands = opts.clientId
    ? await sql<Brand[]>`select * from brands where client_id = ${opts.clientId}`
    : await sql<Brand[]>`select * from brands`;

  // 1. Requêtes Google News : une par mot-clé distinct
  const kwToBrands = new Map<string, Brand[]>();
  for (const b of brands) for (const kw of b.keywords) {
    const k = kw.trim();
    if (!k) continue;
    kwToBrands.set(k, [...(kwToBrands.get(k) ?? []), b]);
  }
  const jobs: { url: string; source: string }[] = [...kwToBrands.keys()].map((k) => ({ url: googleNewsUrl(k, days), source: "" }));
  // 2. Flux de la presse locale
  for (const f of LOCAL_FEEDS) jobs.push({ url: f.url, source: f.name });

  const results = await pool(jobs, 6, async (j) => {
    try {
      return await fetchFeed(j.url, j.source);
    } catch (e) {
      errors.push(`${j.source || "Google News"} ${j.url.slice(0, 90)} : ${(e as Error).message}`);
      return [] as FeedItem[];
    }
  });

  // 3. Rapprochement article ↔ marques (le mot-clé doit apparaître dans le titre ou l'extrait)
  const since = Date.now() - days * 86400_000;
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  let itemsSeen = 0;
  for (const items of results) for (const item of items) {
    itemsSeen++;
    if (item.publishedAt.getTime() < since) continue;
    for (const { brand, matched } of matchBrands(`${item.title} ${item.snippet}`, brands)) {
      const key = `${brand.id}|${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ brand, item, matched });
    }
  }

  // 4. Ne garder que les nouveautés
  let fresh = candidates;
  if (candidates.length) {
    const existing = await sql<{ brand_id: number; url: string }[]>`
      select brand_id, url from mentions
      where url in ${sql([...new Set(candidates.map((c) => c.item.url))])}`;
    const ex = new Set(existing.map((e) => `${e.brand_id}|${e.url}`));
    fresh = candidates.filter((c) => !ex.has(`${c.brand.id}|${c.item.url}`));
  }

  // 5. Tonalité : Claude si une clé est configurée, sinon lexique
  const sentiments: (-1 | 0 | 1)[] = fresh.map((c) => lexiconSentiment(c.item.title, c.item.snippet));
  const methods: string[] = fresh.map(() => "lexique");
  for (let i = 0; i < fresh.length; i += 25) {
    const batch = fresh.slice(i, i + 25);
    const ai = await aiSentiment(batch.map((c) => ({ brand: c.brand.name, title: c.item.title, snippet: c.item.snippet })));
    if (ai) ai.forEach((v, k) => { sentiments[i + k] = v; methods[i + k] = "ia"; });
  }

  // 6. Enregistrement
  let added = 0;
  for (let i = 0; i < fresh.length; i++) {
    const c = fresh[i];
    const r = await sql`
      insert into mentions (client_id, brand_id, url, title, snippet, source, published_at, sentiment, sentiment_method, matched)
      values (${c.brand.client_id}, ${c.brand.id}, ${c.item.url}, ${c.item.title}, ${c.item.snippet}, ${c.item.source},
              ${c.item.publishedAt}, ${sentiments[i]}, ${methods[i]}, ${c.matched})
      on conflict (brand_id, url) do nothing`;
    added += r.count;
  }

  await sql`update collect_runs set finished_at = now(), items_seen = ${itemsSeen}, mentions_added = ${added},
            errors = ${errors.join("\n").slice(0, 8000)} where id = ${run.id}`;
  return { runId: run.id as number, feeds: jobs.length, itemsSeen, mentionsAdded: added, errors };
}
