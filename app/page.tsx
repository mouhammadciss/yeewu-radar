import { db } from "@/lib/db.ts";

async function requestDemo(formData: FormData) {
  "use server";
  const { redirect } = await import("next/navigation");
  const get = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 1000);
  const name = get("name"), email = get("email");
  if (get("website")) redirect("/?demande=ok"); // pot de miel anti-robots
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/?demande=erreur#demo");
  await db()`insert into leads (name, email, phone, company, message)
             values (${name}, ${email}, ${get("phone")}, ${get("company")}, ${get("message")})`;
  redirect("/?demande=ok#demo");
}

export default async function Home({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const { demande } = await searchParams;
  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="logo" href="/">Yeewu<span>Radar</span></a>
          <nav><a href="#offres">Offres</a><a href="#demo">Demander une démo</a></nav>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>Sachez chaque matin ce que la presse sénégalaise dit de <em>votre marque</em> et de vos concurrents.</h1>
          <p>Yeewu Radar suit les sites d&apos;information du Sénégal et de la sous-région, détecte vos mentions et celles de vos concurrents, mesure la tonalité et vous alerte quand ça s&apos;emballe.</p>
          <div className="cta">
            <a className="btn" href="#demo">Demander une démo</a>
            <a className="btn ghost" href="#offres">Voir les offres</a>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Ce que vous recevez</h2>
          <div className="feat">
            <div className="card"><h3>Votre part de voix</h3><p>Qui occupe l&apos;espace médiatique, vous ou vos concurrents, jour après jour.</p></div>
            <div className="card"><h3>La tonalité, article par article</h3><p>Positif, neutre ou négatif, avec un modèle pensé pour le contexte local, wolof compris.</p></div>
            <div className="card"><h3>Des alertes avant la crise</h3><p>Un pic d&apos;articles négatifs ? Vous le voyez dans les 24 heures, pas à la réunion du mois suivant.</p></div>
            <div className="card"><h3>La presse locale, vraiment</h3><p>APS, Senego, Dakaractu, PressAfrik, SeneNews, Leral… et tout ce que Google Actualités indexe au Sénégal.</p></div>
            <div className="card"><h3>Un tableau de bord privé</h3><p>Un lien personnel, sans compte à créer, consultable sur téléphone comme sur ordinateur.</p></div>
            <div className="card"><h3>Un rapport mensuel prêt à présenter</h3><p>En PDF, à transmettre tel quel à votre direction générale.</p></div>
          </div>
        </div>
      </section>

      <section className="band price" id="offres" style={{ background: "#fff", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <h2>Offres</h2>
          <div className="feat">
            <div className="card">
              <h3>Essentiel</h3>
              <div className="amount">150 000 <small>FCFA / mois HT</small></div>
              <ul><li>Votre marque + 2 concurrents</li><li>Tableau de bord en continu</li><li>Rapport mensuel PDF</li></ul>
            </div>
            <div className="card featured">
              <h3>Pro</h3>
              <div className="amount">300 000 <small>FCFA / mois HT</small></div>
              <ul><li>Votre marque + 5 concurrents</li><li>Tonalité analysée par IA</li><li>Alertes de crise</li><li>Rapport commenté + point mensuel de 30 min</li></ul>
            </div>
            <div className="card">
              <h3>Agences</h3>
              <div className="amount">Sur devis</div>
              <ul><li>Plusieurs marques clientes</li><li>Rapports à votre nom</li><li>Accompagnement dédié</li></ul>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>Sans engagement. Premier mois offert pour les 5 premières marques.</p>
        </div>
      </section>

      <section className="band" id="demo">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <h2>Demander une démo</h2>
          <p className="muted">On vous montre le tableau de bord sur votre propre marque. Réponse sous 24 h.</p>
          {demande === "ok" && <p className="ok">Merci, votre demande est bien reçue. Nous revenons vers vous très vite.</p>}
          {demande === "erreur" && <p className="err">Merci d&apos;indiquer votre nom et une adresse e-mail valide.</p>}
          <form action={requestDemo} className="stack">
            <label>Nom complet<input name="name" required /></label>
            <label>E-mail professionnel<input name="email" type="email" required /></label>
            <label>Téléphone / WhatsApp<input name="phone" /></label>
            <label>Entreprise ou marque<input name="company" /></label>
            <label>Concurrents à suivre<textarea name="message" placeholder="Ex. : nos 2 ou 3 principaux concurrents" /></label>
            <input name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
            <button className="btn" type="submit">Envoyer</button>
          </form>
        </div>
      </section>

      <footer className="foot"><div className="wrap">Yeewu Radar · un service Yeewu Advisory · Dakar</div></footer>
    </>
  );
}
