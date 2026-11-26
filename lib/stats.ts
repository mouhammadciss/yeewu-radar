import { db, type Brand, type Client } from "./db.ts";

export async function clientByToken(token: string): Promise<Client | null> {
  const rows = await db()<Client[]>`select * from clients where token = ${token}`;
  return rows[0] ?? null;
}

export async function brandsOf(clientId: number): Promise<Brand[]> {
  return db()<Brand[]>`select * from brands where client_id = ${clientId} order by is_own desc, id`;
}

export type BrandStat = Brand & { total: number; pos: number; neu: number; neg: number; share: number };
export type DayPoint = { day: string; brand_id: number; n: number };
export type SourceStat = { source: string; n: number };
export type Mention = {
  id: number; brand_id: number; url: string; title: string; snippet: string; source: string;
  published_at: Date; sentiment: number; sentiment_method: string;
};
export type Alert = { brand: Brand; neg24: number; avgNeg: number };

export async function periodStats(clientId: number, from: Date, to: Date) {
  const sql = db();
  const brands = await brandsOf(clientId);

  const counts = await sql<{ brand_id: number; total: number; pos: number; neu: number; neg: number }[]>`
    select brand_id, count(*)::int total,
      count(*) filter (where sentiment = 1)::int pos,
      count(*) filter (where sentiment = 0)::int neu,
      count(*) filter (where sentiment = -1)::int neg
    from mentions where client_id = ${clientId} and published_at >= ${from} and published_at < ${to}
    group by brand_id`;
  const all = counts.reduce((s, c) => s + c.total, 0);
  const byBrand: BrandStat[] = brands.map((b) => {
    const c = counts.find((x) => x.brand_id === b.id) ?? { total: 0, pos: 0, neu: 0, neg: 0 };
    return { ...b, total: c.total, pos: c.pos, neu: c.neu, neg: c.neg, share: all ? c.total / all : 0 };
  });

  const daily = await sql<DayPoint[]>`
    select to_char(date_trunc('day', published_at at time zone 'UTC'), 'YYYY-MM-DD') as day, brand_id, count(*)::int n
    from mentions where client_id = ${clientId} and published_at >= ${from} and published_at < ${to}
    group by 1, 2 order by 1`;

  const sources = await sql<SourceStat[]>`
    select source, count(*)::int n from mentions
    where client_id = ${clientId} and published_at >= ${from} and published_at < ${to}
    group by source order by n desc limit 10`;

  return { brands, byBrand, total: all, daily, sources };
}

export async function latestMentions(
  clientId: number, from: Date, to: Date,
  opts: { brandId?: number; sentiment?: number; limit?: number } = {},
): Promise<Mention[]> {
  const sql = db();
  return sql<Mention[]>`
    select id, brand_id, url, title, snippet, source, published_at, sentiment, sentiment_method
    from mentions
    where client_id = ${clientId} and published_at >= ${from} and published_at < ${to}
      ${opts.brandId ? sql`and brand_id = ${opts.brandId}` : sql``}
      ${opts.sentiment !== undefined ? sql`and sentiment = ${opts.sentiment}` : sql``}
    order by published_at desc limit ${opts.limit ?? 60}`;
}

/** Alerte quand une marque cumule sur 24 h au moins 3 articles négatifs et plus du double de sa moyenne des 7 jours précédents. */
export async function alerts(clientId: number): Promise<Alert[]> {
  const sql = db();
  const brands = await brandsOf(clientId);
  const rows = await sql<{ brand_id: number; neg24: number; neg7: number }[]>`
    select brand_id,
      count(*) filter (where published_at >= now() - interval '24 hours')::int neg24,
      count(*) filter (where published_at < now() - interval '24 hours')::int neg7
    from mentions
    where client_id = ${clientId} and sentiment = -1 and published_at >= now() - interval '8 days'
    group by brand_id`;
  const out: Alert[] = [];
  for (const r of rows) {
    const avg = r.neg7 / 7;
    const b = brands.find((x) => x.id === r.brand_id);
    if (b && r.neg24 >= 3 && r.neg24 > 2 * avg) out.push({ brand: b, neg24: r.neg24, avgNeg: avg });
  }
  return out;
}

export async function lastRun() {
  const rows = await db()<{ finished_at: Date | null; mentions_added: number }[]>`
    select finished_at, mentions_added from collect_runs where finished_at is not null order by id desc limit 1`;
  return rows[0] ?? null;
}

export function periodFromDays(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  return { from, to };
}

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

export const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
