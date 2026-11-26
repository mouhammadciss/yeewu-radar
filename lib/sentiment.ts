import { normalize } from "./text.ts";

// Lexique de départ (français + quelques termes wolof courants). À enrichir avec les vrais cas clients.
const NEG = [
  "panne", "pannes", "perturbation", "perturbations", "coupure", "coupures", "plainte", "plaintes",
  "arnaque", "arnaques", "escroquerie", "fraude", "amende", "sanction", "sanctionne", "sanctionnee",
  "greve", "licenciement", "licenciements", "scandale", "polemique", "mecontentement", "colere",
  "reclamation", "reclamations", "boycott", "dysfonctionnement", "piratage", "fuite de donnees",
  "hausse des tarifs", "hausse des prix", "trop cher", "condamne", "condamnee", "proces", "litige",
  "denonce", "denoncent", "accuse", "accusent", "indignation", "inacceptable", "crise", "chute",
  "baisse du chiffre", "perte", "pertes", "suspendu", "suspension", "interdit", "retrait de licence",
  "reseau defaillant", "pas de reseau", "lenteur", "bug",
  // wolof
  "dafa metti", "dafa seer", "dafa bon", "nax", "naxe",
];
const POS = [
  "lancement", "lance", "lancent", "succes", "record", "croissance", "hausse du chiffre", "benefice",
  "partenariat", "partenaire", "innovation", "innovant", "gratuit", "gratuite", "offre speciale",
  "amelioration", "ameliore", "renforce", "investissement", "investit", "inaugure", "inauguration",
  "recompense", "prix du meilleur", "distingue", "felicite", "salue", "leader", "premier operateur",
  "couverture 5g", "5g", "fibre", "solidarite", "soutien", "don", "bourse", "emplois",
  // wolof
  "baax na", "dafa baax", "dafa neex", "jerejef", "jarama",
];

const negN = NEG.map(normalize);
const posN = POS.map(normalize);

function count(hay: string, terms: string[]): number {
  let n = 0;
  for (const t of terms) if (hay.includes(` ${t} `)) n++;
  return n;
}

/** -1, 0 ou 1, à partir du titre (pondéré x2) et de l'extrait. */
export function lexiconSentiment(title: string, snippet = ""): -1 | 0 | 1 {
  const t = ` ${normalize(title)} `;
  const s = ` ${normalize(snippet)} `;
  const score = 2 * (count(t, posN) - count(t, negN)) + (count(s, posN) - count(s, negN));
  if (score >= 2) return 1;
  if (score <= -1) return -1; // on signale vite le négatif : c'est ce qu'un client veut voir
  return 0;
}

/**
 * Si ANTHROPIC_API_KEY est défini, classe un lot de titres avec Claude (plus fiable, gère le wolof).
 * Renvoie null en cas d'échec : l'appelant garde alors le lexique.
 */
export async function aiSentiment(
  items: { brand: string; title: string; snippet: string }[],
): Promise<(-1 | 0 | 1)[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || items.length === 0) return null;
  const list = items
    .map((it, i) => `${i + 1}. [${it.brand}] ${it.title}${it.snippet ? ` — ${it.snippet.slice(0, 200)}` : ""}`)
    .join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content:
              "Pour chaque article ci-dessous, indique la tonalité envers la marque entre crochets, du point de vue de son image : " +
              "1 (positive), 0 (neutre/factuelle), -1 (négative). Réponds uniquement par un tableau JSON d'entiers, dans l'ordre.\n\n" +
              list,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { text?: string }[] };
    const txt = data.content?.[0]?.text ?? "";
    const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1)) as number[];
    if (!Array.isArray(arr) || arr.length !== items.length) return null;
    return arr.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  } catch {
    return null;
  }
}
