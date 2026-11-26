import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db, type Brand } from "@/lib/db.ts";
import { isAdmin, login, logout } from "@/lib/auth.ts";
import { collect } from "@/lib/collect.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" });
const lines = (s: FormDataEntryValue | null) => String(s ?? "").split(/[\n,;]/).map((x) => x.trim()).filter(Boolean);

async function guard() {
  if (!(await isAdmin())) redirect("/admin");
}

async function doLogin(fd: FormData) {
  "use server";
  const ok = await login(String(fd.get("password") ?? ""));
  redirect(ok ? "/admin" : "/admin?e=1");
}
async function doLogout() {
  "use server";
  await logout();
  redirect("/admin");
}
async function runCollect() {
  "use server";
  await guard();
  const r = await collect();
  redirect(`/admin?collecte=${r.mentionsAdded}-${r.errors.length}`);
}
async function createClient(fd: FormData) {
  "use server";
  await guard();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const token = `${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)}-${randomBytes(5).toString("hex")}`;
  const [c] = await db()`insert into clients (name, token) values (${name}, ${token}) returning id`;
  redirect(`/admin?client=${c.id}`);
}
async function saveBrand(fd: FormData) {
  "use server";
  await guard();
  const id = Number(fd.get("id") || 0);
  const clientId = Number(fd.get("client_id"));
  const name = String(fd.get("name") ?? "").trim();
  const color = String(fd.get("color") ?? "#1f6feb");
  const isOwn = fd.get("is_own") === "on";
  const kw = lines(fd.get("keywords"));
  const ex = lines(fd.get("excludes"));
  if (!name || kw.length === 0) redirect(`/admin?client=${clientId}&e=2`);
  if (id) {
    await db()`update brands set name=${name}, color=${color}, is_own=${isOwn}, keywords=${kw}, excludes=${ex} where id=${id}`;
  } else {
    await db()`insert into brands (client_id, name, color, is_own, keywords, excludes) values (${clientId}, ${name}, ${color}, ${isOwn}, ${kw}, ${ex})`;
  }
  revalidatePath("/admin");
  redirect(`/admin?client=${clientId}`);
}
async function deleteBrand(fd: FormData) {
  "use server";
  await guard();
  await db()`delete from brands where id = ${Number(fd.get("id"))}`;
  redirect(`/admin?client=${Number(fd.get("client_id"))}`);
}
async function rotateToken(fd: FormData) {
  "use server";
  await guard();
  const id = Number(fd.get("client_id"));
  const [c] = await db()<{ token: string }[]>`select token from clients where id=${id}`;
  const base = c.token.replace(/-[0-9a-f]{10}$/, "");
  await db()`update clients set token = ${`${base}-${randomBytes(5).toString("hex")}`} where id = ${id}`;
  redirect(`/admin?client=${id}`);
}

function BrandForm({ clientId, b }: { clientId: number; b?: Brand }) {
  return (
    <form action={saveBrand} className="stack card" style={{ marginBottom: 12 }}>
      <input type="hidden" name="client_id" value={clientId} />
      {b && <input type="hidden" name="id" value={b.id} />}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, alignItems: "end" }}>
        <label>Marque<input name="name" defaultValue={b?.name} required /></label>
        <label>Couleur<input name="color" type="color" defaultValue={b?.color ?? "#1f6feb"} style={{ height: 44, padding: 4 }} /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="is_own" defaultChecked={b?.is_own} /> Marque du client</label>
      </div>
      <label>Mots-clés (un par ligne)<textarea name="keywords" defaultValue={b?.keywords.join("\n")} required /></label>
      <label>Exclusions (un par ligne, optionnel)<textarea name="excludes" defaultValue={b?.excludes.join("\n")} style={{ minHeight: 50 }} /></label>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn sm">{b ? "Enregistrer" : "Ajouter la marque"}</button>
      </div>
    </form>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ e?: string; client?: string; collecte?: string }> }) {
  const sp = await searchParams;
  if (!(await isAdmin())) {
    return (
      <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
        <h1>Administration</h1>
        {!process.env.ADMIN_PASSWORD && <p className="err">Définissez la variable ADMIN_PASSWORD pour activer cet espace.</p>}
        {sp.e && <p className="err">Mot de passe incorrect.</p>}
        <form action={doLogin} className="stack">
          <label>Mot de passe<input type="password" name="password" required autoFocus /></label>
          <button className="btn">Entrer</button>
        </form>
      </main>
    );
  }

  const sql = db();
  const clients = await sql<{ id: number; name: string; token: string; brands: number; m30: number }[]>`
    select c.id, c.name, c.token,
      (select count(*) from brands b where b.client_id = c.id)::int brands,
      (select count(*) from mentions m where m.client_id = c.id and m.published_at > now() - interval '30 days')::int m30
    from clients c order by c.id`;
  const leads = await sql`select * from leads order by id desc limit 50`;
  const runs = await sql`select * from collect_runs order by id desc limit 5`;
  const selected = sp.client ? clients.find((c) => c.id === Number(sp.client)) : undefined;
  const brands = selected ? await sql<Brand[]>`select * from brands where client_id = ${selected.id} order by is_own desc, id` : [];
  const [added, errs] = (sp.collecte ?? "").split("-");

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="logo" href="/admin">Yeewu<span>Radar</span> · admin</a>
          <nav><a href="/">Site</a><form action={doLogout}><button className="btn ghost sm" style={{ color: "#fff" }}>Déconnexion</button></form></nav>
        </div>
      </header>
      <main className="wrap" style={{ paddingBottom: 60 }}>
        {sp.collecte && <p className="ok" style={{ marginTop: 20 }}>Collecte terminée : {added} nouvelles mentions{Number(errs) ? `, ${errs} sources en erreur (voir le journal)` : ""}.</p>}
        {sp.e === "2" && <p className="err" style={{ marginTop: 20 }}>Une marque doit avoir un nom et au moins un mot-clé.</p>}

        <div className="page-head">
          <h1>Clients</h1>
          <form action={runCollect}><button className="btn">Lancer une collecte maintenant</button></form>
        </div>
        <div className="card">
          <table className="t">
            <thead><tr><th>Client</th><th>Marques</th><th>Mentions 30 j</th><th>Lien client</th><th /></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td><td>{c.brands}</td><td>{c.m30}</td>
                  <td><a href={`/c/${c.token}`} target="_blank">/c/{c.token}</a></td>
                  <td><a href={`/admin?client=${c.id}`}>Configurer</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={createClient} style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <input name="name" placeholder="Nom du nouveau client" required style={{ flex: 1 }} />
            <button className="btn">Créer</button>
          </form>
        </div>

        {selected && (
          <section className="section">
            <div className="page-head">
              <h1>{selected.name}</h1>
              <form action={rotateToken}><input type="hidden" name="client_id" value={selected.id} /><button className="btn ghost sm">Changer le lien privé</button></form>
            </div>
            {brands.map((b) => (
              <div key={b.id}>
                <BrandForm clientId={selected.id} b={b} />
                <form action={deleteBrand} style={{ marginTop: -6, marginBottom: 18 }}>
                  <input type="hidden" name="id" value={b.id} /><input type="hidden" name="client_id" value={selected.id} />
                  <button className="btn ghost sm">Supprimer {b.name} et ses mentions</button>
                </form>
              </div>
            ))}
            <h2 style={{ marginTop: 20 }}>Ajouter une marque</h2>
            <BrandForm clientId={selected.id} />
          </section>
        )}

        <div className="grid2 section">
          <div className="card">
            <h2>Demandes de démo</h2>
            {leads.length === 0 ? <p className="muted">Aucune pour l&apos;instant.</p> : (
              <table className="t"><tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.name}</strong> · {l.company}<br /><a href={`mailto:${l.email}`}>{l.email}</a> {l.phone}<br /><span className="muted">{l.message}</span></td>
                    <td className="muted">{fmt.format(l.created_at)}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
          <div className="card">
            <h2>Journal de collecte</h2>
            <table className="t"><tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{fmt.format(r.started_at)}</td>
                  <td>{r.finished_at ? `${r.mentions_added} ajoutées / ${r.items_seen} lues` : "en cours ou interrompue"}
                    {r.errors && <details><summary className="muted">{r.errors.split("\n").length} erreurs</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: ".75rem" }}>{r.errors}</pre></details>}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </main>
    </>
  );
}
