// Flux de la presse locale, lus à chaque collecte en plus de Google News.
// Un flux en panne est simplement ignoré (et noté dans le journal de collecte).
// À vérifier/compléter : certains sites changent l'adresse de leur flux.
export const LOCAL_FEEDS: { name: string; url: string }[] = [
  { name: "APS", url: "https://aps.sn/feed/" },
  { name: "Senego", url: "https://senego.com/feed" },
  { name: "SeneNews", url: "https://www.senenews.com/feed" },
  { name: "Dakaractu", url: "https://www.dakaractu.com/xml/syndication.rss" },
  { name: "PressAfrik", url: "https://www.pressafrik.com/xml/syndication.rss" },
  { name: "Leral", url: "https://www.leral.net/xml/syndication.rss" },
  { name: "Le Quotidien", url: "https://lequotidien.sn/feed/" },
  { name: "Sud Quotidien", url: "https://www.sudquotidien.sn/feed/" },
  { name: "Wiwsport", url: "https://wiwsport.com/feed/" },
  { name: "Senexalaat", url: "https://www.senexalaat.com/feed/" },
];
