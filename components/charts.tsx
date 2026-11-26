import type { BrandStat, DayPoint } from "@/lib/stats.ts";

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function ShareOfVoice({ stats }: { stats: BrandStat[] }) {
  const total = stats.reduce((s, b) => s + b.total, 0);
  return (
    <div>
      <div className="sov-bar" role="img" aria-label="Part de voix">
        {total === 0 ? (
          <div className="sov-empty">Aucune mention sur la période</div>
        ) : (
          stats.filter((b) => b.total > 0).map((b) => (
            <div key={b.id} style={{ width: `${b.share * 100}%`, background: b.color }} title={`${b.name} : ${b.total}`} />
          ))
        )}
      </div>
      <ul className="legend">
        {stats.map((b) => (
          <li key={b.id}>
            <span className="dot" style={{ background: b.color }} />
            <strong>{b.name}</strong> {pct(b.share)} <span className="muted">· {b.total} mentions</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SentimentRows({ stats }: { stats: BrandStat[] }) {
  return (
    <div className="sent-rows">
      {stats.map((b) => {
        const t = b.total || 1;
        return (
          <div key={b.id} className="sent-row">
            <div className="sent-name">{b.name}</div>
            <div className="sent-bar" role="img" aria-label={`${b.name} : ${b.pos} positives, ${b.neu} neutres, ${b.neg} négatives`}>
              {b.total === 0 ? <div className="sent-zero" /> : (
                <>
                  <div className="s-pos" style={{ width: `${(b.pos / t) * 100}%` }} />
                  <div className="s-neu" style={{ width: `${(b.neu / t) * 100}%` }} />
                  <div className="s-neg" style={{ width: `${(b.neg / t) * 100}%` }} />
                </>
              )}
            </div>
            <div className="sent-nums">
              <span className="c-pos">{b.pos}</span> / <span className="muted">{b.neu}</span> / <span className="c-neg">{b.neg}</span>
            </div>
          </div>
        );
      })}
      <div className="sent-key muted"><span className="c-pos">■</span> positif <span>■</span> neutre <span className="c-neg">■</span> négatif</div>
    </div>
  );
}

export function DailyLines({ stats, daily, from, to }: { stats: BrandStat[]; daily: DayPoint[]; from: Date; to: Date }) {
  const days: string[] = [];
  for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d < to; d = new Date(d.getTime() + 86400_000)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const W = 720, H = 220, P = { l: 34, r: 10, t: 10, b: 26 };
  const max = Math.max(1, ...daily.map((p) => p.n));
  const x = (i: number) => P.l + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (W - P.l - P.r));
  const y = (n: number) => H - P.b - (n / max) * (H - P.t - P.b);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const step = Math.max(1, Math.ceil(days.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lines" role="img" aria-label="Mentions par jour">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {days.map((d, i) => i % step === 0 ? (
        <text key={d} x={x(i)} y={H - 6} textAnchor="middle" className="axis">{d.slice(8, 10)}/{d.slice(5, 7)}</text>
      ) : null)}
      {stats.map((b) => {
        const pts = days.map((d, i) => `${x(i)},${y(daily.find((p) => p.day === d && p.brand_id === b.id)?.n ?? 0)}`);
        return <polyline key={b.id} points={pts.join(" ")} fill="none" stroke={b.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function SentBadge({ s }: { s: number }) {
  if (s > 0) return <span className="badge b-pos">positif</span>;
  if (s < 0) return <span className="badge b-neg">négatif</span>;
  return <span className="badge b-neu">neutre</span>;
}
