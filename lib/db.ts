import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function make() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  const local = url.includes("localhost") || url.includes("127.0.0.1");
  return postgres(url, { ssl: local ? false : "require", max: 5, idle_timeout: 20, prepare: false });
}

export function db() {
  if (!globalThis.__sql) globalThis.__sql = make();
  return globalThis.__sql;
}

export type Brand = {
  id: number;
  client_id: number;
  name: string;
  is_own: boolean;
  color: string;
  keywords: string[];
  excludes: string[];
};

export type Client = { id: number; name: string; token: string; created_at: Date };
