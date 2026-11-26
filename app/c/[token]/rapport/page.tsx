import { notFound } from "next/navigation";
import { clientByToken, latestMentions, monthRange, MOIS, periodStats, type Mention } from "@/lib/stats.ts";
import { DailyLines, SentBadge, SentimentRows, ShareOfVoice } from "@/components/charts.tsx";
import { PrintButton } from "@/components/print-button.tsx";

export const dynamic = "force-dynamic";

const fmtDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Dakar" });

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function evol(cur: number, prev: number) {
  if (!prev) return cur ? "nouveau" : "stable";
  const p = Math.round(((cur - prev) / prev) * 100);
  return p === 0 ? "stable" : `${p > 0 ? "+" : ""}${p} % vs mois précédent`;
}

export default async function Report({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ mois?: string }> }) {
  const { token } = await params;
  const { mois } = await searchParams;
  const client = await clientByToken(token);
  if (!client) notFound();

  const now = new Date();
  const ym = /^\d{4}-\d{2}$/.test(mois ?? "") ? mois! : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const { from, to } = monthRange(ym);
  const prev = monthRange(prevMonth(ym));
  const [cur, before] = await Promise.all([periodStats(client.id, from, to), periodStats(client.id, prev.from, prev.to)]);
  const label = `${MOIS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;

  const own = cur.byBrand.find((b) => b.is_own);
  const ownPrev = before.byBrand.find((b) => b.is_own);
  const leader = [...cur.byBrand].sort((a, b) => b.total - a.total)[0];

  // Articles marquants : pour chaque marque, d'abord les négatifs puis les positifs
  const highlights: { brandId: number; items: Mention[] }[] = [];
  for (const b of cur.brands) {
    const [neg, pos] = await Promise.all([
      latestMentions(client.id, from, to, { brandId: b.id, sentiment: -1, limit: b.is_own ? 5 : 3 }),
      latestMentions(client.id, from, to, { brandId: b.id, sentiment: 1, limit: b.is_own ? 5 : 3 }),
    ]);
    highlights.push({ brandId: b.id, items: [...neg, ...pos] });
  }

  const summary: string[] = [];
  summary.push(`${cur.total} articles mentionnant au moins une des marques suivies ont été relevés en ${label} (${evol(cur.total, before.total)}).`);
  if (own) {
    summary.push(`${own.name} totalise ${own.total} mentions, soit ${Math.round(own.share * 100)} % de la part de voix (${evol(own.total, ownPrev?.total ?? 0)}).`);
    if (own.total) summary.push(`Tonalité : ${own.pos} articles positifs, ${own.neu} neutres et ${own.neg} négatifs (${Math.round((own.neg / own.total) * 100)} %).`);
  }
  if (leader && own && leader.id !== own.id && leader.total > 0) summary.push(`${leader.name} occupe davantage l'espace médiatique ce mois-ci avec ${leader.total} mentions.`);

  return (
    <div className="report">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <a href={`/c/${token}`}>← Tableau de bord</a>
        <form style={{ display: "flex", gap: 8 }}>
          <input type="month" name="mois" defaultValue={ym} />
          <button className="btn ghost sm">Afficher</button>
          <PrintButton />
        </form>
      </div>

      <div className="cover">
        <div>
          <div className="muted">Rapport de veille médias</div>
          <h1>{client.name}</h1>
          <div style={{ fontSize: "1.2rem", textTransform: "capitalize" }}>{label}</div>
        </div>
        <div className="logo" style={{ color: "var(--ink)" }}>Yeewu<span>Radar</span></div>
      </div>

      <h2>Synthèse</h2>
      {summary.map((s, i) => <p key={i}>{s}</p>)}
      <div className="muted" style={{ fontSize: ".85rem" }}>Commentaire de l&apos;analyste (cliquez pour écrire avant d&apos;imprimer) :</div>
      <div contentEditable suppressContentEditableWarning style={{ minHeight: 60, border: "1px dashed var(--line)", borderRadius: 8, padding: 10, marginTop: 4 }} />

      <h2>Part de voix</h2>
      <ShareOfVoice stats={cur.byBrand} />

      <h2>Tonalité</h2>
      <SentimentRows stats={cur.byBrand} />

      <h2>Évolution quotidienne</h2>
      <DailyLines stats={cur.byBrand} daily={cur.daily} from={from} to={to > now ? now : to} />

      <h2>Principales sources</h2>
      <table className="t">
        <thead><tr><th>Source</th><th>Articles</th></tr></thead>
        <tbody>{cur.sources.map((s) => <tr key={s.source}><td>{s.source}</td><td>{s.n}</td></tr>)}</tbody>
      </table>

      <h2>Articles marquants</h2>
      {highlights.map(({ brandId, items }) => {
        const b = cur.brands.find((x) => x.id === brandId)!;
        return (
          <div key={brandId} style={{ marginTop: 14 }}>
            <h3 style={{ fontSize: "1rem" }}><span className="dot" style={{ background: b.color }} />{b.name}</h3>
            {items.length === 0 ? <p className="muted">Aucun article positif ou négatif ce mois-ci.</p> : (
              <ul className="mentions">
                {items.map((m) => (
                  <li key={m.id}>
                    <div className="bar" style={{ background: b.color }} />
                    <div>
                      <a className="t" href={m.url}>{m.title}</a>
                      <div className="meta"><span>{m.source}</span>·<span>{fmtDay.format(m.published_at)}</span><SentBadge s={m.sentiment} /></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <p className="muted" style={{ fontSize: ".8rem", marginTop: 30 }}>
        Méthode : collecte automatique de la presse en ligne (Google Actualités Sénégal et flux de sites d&apos;information locaux),
        détection par mots-clés, tonalité {process.env.ANTHROPIC_API_KEY ? "évaluée par IA" : "évaluée par lexique"}. Yeewu Radar · Yeewu Advisory.
      </p>
    </div>
  );
}
