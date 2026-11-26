// Au démarrage du serveur : crée les tables et l'espace démo s'ils n'existent pas (idempotent).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  try {
    const { db } = await import("./lib/db.ts");
    const { SCHEMA_SQL, SEED_SQL } = await import("./lib/schema.ts");
    const sql = db();
    await sql.unsafe(SCHEMA_SQL);
    await sql.unsafe(SEED_SQL);
  } catch (e) {
    console.error("[yeewu-radar] initialisation de la base échouée :", e);
  }
}
