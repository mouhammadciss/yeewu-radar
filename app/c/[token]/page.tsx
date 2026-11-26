import { notFound } from "next/navigation";
import { alerts, clientByToken, lastRun, latestMentions, periodFromDays, periodStats } from "@/lib/stats.ts";
import { DailyLines, SentBadge, SentimentRows, ShareOfVoice } from "@/components/charts.tsx";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" });

export default async function Dashboard({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ j?: string; marque?: string; ton?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const client = await clientByToken(token);
  if (!client) notFound();

  const days = [7, 30, 90].includes(Number(sp.j)) ? Number(sp.j) : 30;
  const { from, to } = periodFromDays(days);
  const brandId = sp.marque ? Number(sp.marque) : undefined;
  const ton = sp.ton === "neg" ? -1 : sp.ton === "pos" ? 1 : undefined;

  const [stats, list, al, run] = await Promise.all([
    periodStats(client.id, from, to),
    latestMentions(client.id, from, to, { brandId, sentiment: ton }),
    alerts(client.id),
    lastRun(),
  ]);
  const own = stats.byBrand.find((b) => b.is_own);
  const negShare = own && own.total ? Math.round((own.neg / own.total) * 100) : 0;
  const brandOf = (id: number) => stats.brands.find((b) => b.id === id);

  const q = (o: Record<string, string | number | undefined>) => {
    const merged = { j: days, marque: sp.marque, ton: sp.ton, ...o };
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") s.set(k, String(v));
    return `?${s.toString()}`;
  };
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <span className="logo">Yeewu<span>Radar</span></span>
          <nav>
            <a className="on" href={`/c/${token}`}>Tableau de bord</a>
            <a href={`/c/${token}/rapport?mois=${ym}`}>Rapport mensuel</a>
          </nav>
        </div>
      </header>
      <main className="wrap">
        <div className="page-head">
          <div>
            <h1>{client.name}</h1>
            <div className="muted">
              {run?.finished_at ? `Dernière collecte : ${fmt.format(run.finished_at)}` : "Première collecte en attente"}
            </div>
          </div>
          <div className="pills">
            {[7, 30, 90].map((d) => <a key={d} className={`pill ${d === days ? "on" : ""}`} href={q({ j: d })}>{d} jours</a>)}
          </div>
        </div>

        {al.map((a) => (
          <div key={a.brand.id} className="alert">
            <strong>Alerte {a.brand.name}</strong> : {a.neg24} articles négatifs ces dernières 24 h
            (moyenne habituelle : {a.avgNeg.toFixed(1)} par jour).{" "}
            <a href={q({ marque: a.brand.id, ton: "neg", j: 7 })}>Voir les articles</a>
          </div>
        ))}

        <div className="grid4 section">
          <div className="card kpi"><div className="v">{stats.total}</div><div className="l">mentions, toutes marques</div></div>
          <div className="card kpi"><div className="v">{own ? own.total : "—"}</div><div className="l">mentions de {own?.name ?? "votre marque"}</div></div>
          <div className="card kpi"><div className="v">{own ? `${Math.round(own.share * 100)} %` : "—"}</div><div className="l">part de voix</div></div>
          <div className="card kpi"><div className="v" style={{ color: negShare > 25 ? "var(--neg)" : undefined }}>{own ? `${negShare} %` : "—"}</div><div className="l">d&apos;articles négatifs</div></div>
        </div>

        <div className="grid2 section">
          <div className="card"><h2>Part de voix</h2><ShareOfVoice stats={stats.byBrand} /></div>
          <div className="card"><h2>Tonalité par marque</h2><SentimentRows stats={stats.byBrand} /></div>
        </div>

        <div className="card section">
          <h2>Mentions par jour</h2>
          <DailyLines stats={stats.byBrand} daily={stats.daily} from={from} to={to} />
        </div>

        <div className="grid2 section" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Derniers articles</h2>
              <div className="pills">
                <a className={`pill ${!sp.marque ? "on" : ""}`} href={q({ marque: "" })}>Toutes</a>
                {stats.brands.map((b) => (
                  <a key={b.id} className={`pill ${brandId === b.id ? "on" : ""}`} href={q({ marque: b.id })}>{b.name}</a>
                ))}
                <a className={`pill ${sp.ton === "neg" ? "on" : ""}`} href={q({ ton: sp.ton === "neg" ? "" : "neg" })}>Négatifs</a>
              </div>
            </div>
            {list.length === 0 ? <p className="muted">Aucun article pour ces filtres.</p> : (
              <ul className="mentions">
                {list.map((m) => {
                  const b = brandOf(m.brand_id);
                  return (
                    <li key={m.id}>
                      <div className="bar" style={{ background: b?.color }} />
                      <div>
                        <a className="t" href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a>
                        <div className="meta">
                          <span>{m.source}</span>·<span>{fmt.format(m.published_at)}</span>·<span>{b?.name}</span>
                          <SentBadge s={m.sentiment} />
                        </div>
                        {m.snippet && <div className="snip">{m.snippet.slice(0, 220)}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="card">
            <h2>Principales sources</h2>
            {stats.sources.length === 0 ? <p className="muted">—</p> : (
              <ul className="sources">
                {stats.sources.map((s) => <li key={s.source}><span>{s.source}</span><strong>{s.n}</strong></li>)}
              </ul>
            )}
          </div>
        </div>
        <p className="muted" style={{ fontSize: ".85rem", margin: "24px 0 40px" }}>
          Lien privé : ne le partagez qu&apos;au sein de votre équipe.
        </p>
      </main>
    </>
  );
}
