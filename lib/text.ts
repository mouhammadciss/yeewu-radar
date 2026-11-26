// Normalisation et détection de mots-clés, insensibles aux accents et aux majuscules.

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Renvoie la première expression trouvée en mot entier, ou null. */
export function findKeyword(text: string, keywords: string[]): string | null {
  const hay = ` ${normalize(text)} `;
  for (const kw of keywords) {
    const n = normalize(kw);
    if (n && hay.includes(` ${n} `)) return kw;
  }
  return null;
}

export type MatchableBrand = { id: number; keywords: string[]; excludes: string[] };

/** Marques mentionnées dans un texte (mot-clé présent et aucune exclusion). */
export function matchBrands<B extends MatchableBrand>(text: string, brands: B[]): { brand: B; matched: string }[] {
  const out: { brand: B; matched: string }[] = [];
  for (const b of brands) {
    const m = findKeyword(text, b.keywords);
    if (!m) continue;
    if (b.excludes.length && findKeyword(text, b.excludes)) continue;
    out.push({ brand: b, matched: m });
  }
  return out;
}
