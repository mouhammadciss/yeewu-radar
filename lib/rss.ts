import { XMLParser } from "fast-xml-parser";
import { stripHtml } from "./text.ts";

export type FeedItem = {
  url: string;
  title: string;
  snippet: string;
  source: string;
  publishedAt: Date;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Analyse un flux RSS 2.0 ou Atom. `fallbackSource` sert quand l'article ne nomme pas sa source. */
export function parseFeed(xml: string, fallbackSource = ""): FeedItem[] {
  const doc = parser.parse(xml);
  const items: unknown[] = [];
  const rssItems = doc?.rss?.channel?.item;
  const atomEntries = doc?.feed?.entry;
  if (rssItems) items.push(...(Array.isArray(rssItems) ? rssItems : [rssItems]));
  if (atomEntries) items.push(...(Array.isArray(atomEntries) ? atomEntries : [atomEntries]));

  const out: FeedItem[] = [];
  for (const raw of items) {
    const it = raw as Record<string, unknown>;
    let url = text(it.link);
    if (!url && it.link && typeof it.link === "object") {
      const l = Array.isArray(it.link) ? it.link[0] : it.link;
      url = String((l as Record<string, unknown>)["@_href"] ?? "");
    }
    let title = stripHtml(text(it.title));
    if (!url || !title) continue;

    // Google News : <source url="...">Nom</source> et titre « Titre - Source »
    let source = "";
    const src = it.source as Record<string, unknown> | string | undefined;
    if (src) source = typeof src === "string" ? src : text(src);
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    if (!source) source = fallbackSource || hostOf(url);

    const snippetRaw = text(it.description) || text(it.summary) || text(it.content);
    let snippet = stripHtml(snippetRaw);
    if (snippet.startsWith(title)) snippet = snippet.slice(title.length).trim();
    if (snippet === source) snippet = "";

    const dateStr = text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"]);
    const d = dateStr ? new Date(dateStr) : new Date();
    out.push({
      url,
      title,
      snippet: snippet.slice(0, 500),
      source,
      publishedAt: isNaN(d.getTime()) ? new Date() : d,
    });
  }
  return out;
}

/** URL de recherche Google News (Sénégal, français) pour une expression exacte, limitée à N jours. */
export function googleNewsUrl(keyword: string, days = 7): string {
  const q = encodeURIComponent(`"${keyword}" when:${days}d`);
  return `https://news.google.com/rss/search?q=${q}&hl=fr&gl=SN&ceid=SN:fr`;
}
