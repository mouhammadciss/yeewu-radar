import { collect } from "@/lib/collect.ts";
import { cronAuthorized } from "@/lib/auth.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Appelé chaque matin par le cron Vercel (voir vercel.json), ou par un service externe
// avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Non autorisé", { status: 401 });
  const r = await collect();
  return Response.json(r);
}
