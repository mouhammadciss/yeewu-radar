// Crée les tables et l'espace de démo. Usage : DATABASE_URL=... npm run db:setup
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
const sql = postgres(url, { ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require" });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await sql.unsafe(readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8"));
const clients = await sql`select name, token from clients order by id`;
console.log("Base prête. Espaces clients :");
for (const c of clients) console.log(`  - ${c.name} → /c/${c.token}`);
await sql.end();
