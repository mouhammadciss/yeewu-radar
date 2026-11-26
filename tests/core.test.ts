import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, findKeyword, matchBrands } from "../lib/text.ts";
import { parseFeed, googleNewsUrl } from "../lib/rss.ts";
import { lexiconSentiment } from "../lib/sentiment.ts";

const brands = [
  { id: 1, name: "Orange Sénégal", keywords: ["Orange Sénégal", "Sonatel", "Orange Money"], excludes: ["Orange Côte d'Ivoire"] },
  { id: 2, name: "Yas", keywords: ["Yas Sénégal", "Mixx by Yas"], excludes: [] },
  { id: 3, name: "Expresso", keywords: ["Expresso Sénégal"], excludes: ["café expresso"] },
];

test("normalize retire accents et ponctuation", () => {
  assert.equal(normalize("  L’opérateur ORANGE-Sénégal !"), "l'operateur orange senegal");
});

test("findKeyword : mot entier, insensible aux accents", () => {
  assert.equal(findKeyword("La SONATEL publie ses résultats", ["Sonatel"]), "Sonatel");
  assert.equal(findKeyword("Orange senegal lance une offre", ["Orange Sénégal"]), "Orange Sénégal");
  assert.equal(findKeyword("Sonatelecom n'existe pas", ["Sonatel"]), null);
});

test("matchBrands gère plusieurs marques et les exclusions", () => {
  const r = matchBrands("Orange Sénégal et Yas Sénégal se disputent le marché", brands);
  assert.deepEqual(r.map((x) => x.brand.id), [1, 2]);
  assert.equal(matchBrands("Orange Money : Orange Côte d'Ivoire annonce...", brands).length, 0);
  assert.equal(matchBrands("Un café expresso chez Expresso Sénégal", brands).length, 0);
});

const GOOGLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Google News</title>
<item><title>Panne réseau : les abonnés de Yas Sénégal en colère - Seneweb</title>
<link>https://news.google.com/rss/articles/abc</link><pubDate>Wed, 25 Nov 2026 09:12:00 GMT</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/abc"&gt;Panne réseau : les abonnés de Yas Sénégal en colère&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Seneweb&lt;/font&gt;</description>
<source url="https://www.seneweb.com">Seneweb</source></item>
<item><title>Sonatel lance la 5G à Thiès - APS</title><link>https://news.google.com/rss/articles/def</link>
<pubDate>Tue, 24 Nov 2026 15:00:00 GMT</pubDate><source url="https://aps.sn">APS</source></item>
</channel></rss>`;

test("parseFeed lit Google News (titre nettoyé, source, date)", () => {
  const items = parseFeed(GOOGLE);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Panne réseau : les abonnés de Yas Sénégal en colère");
  assert.equal(items[0].source, "Seneweb");
  assert.equal(items[0].snippet, "");
  assert.equal(items[1].publishedAt.toISOString(), "2026-11-24T15:00:00.000Z");
});

const WP = `<?xml version="1.0"?><rss version="2.0"><channel><title>Senego</title>
<item><title>Expresso Sénégal : nouvelle offre internet gratuite pour les étudiants</title>
<link>https://senego.com/expresso-offre</link><pubDate>Thu, 26 Nov 2026 08:00:00 +0000</pubDate>
<description><![CDATA[<p>L'opérateur annonce une offre spéciale…</p>]]></description></item>
</channel></rss>`;

test("parseFeed lit un flux WordPress avec la source de secours", () => {
  const [it] = parseFeed(WP, "Senego");
  assert.equal(it.source, "Senego");
  assert.match(it.snippet, /offre spéciale/);
});

test("parseFeed lit l'Atom", () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Mixx by Yas recrute</title>
  <link href="https://ex.sn/a"/><updated>2026-11-20T10:00:00Z</updated><summary>Des emplois</summary></entry></feed>`;
  const [it] = parseFeed(atom);
  assert.equal(it.url, "https://ex.sn/a");
  assert.equal(it.source, "ex.sn");
});

test("lexiconSentiment", () => {
  assert.equal(lexiconSentiment("Panne réseau : les abonnés de Yas Sénégal en colère"), -1);
  assert.equal(lexiconSentiment("Sonatel lance la 5G à Thiès"), 1);
  assert.equal(lexiconSentiment("Expresso Sénégal publie son rapport annuel"), 0);
  assert.equal(lexiconSentiment("Orange Money : dafa metti", ""), -1);
});

test("googleNewsUrl cible le Sénégal en français", () => {
  const u = googleNewsUrl("Orange Sénégal", 7);
  assert.match(u, /gl=SN/);
  assert.match(decodeURIComponent(u), /"Orange Sénégal" when:7d/);
});
