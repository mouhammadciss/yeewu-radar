// Lance une collecte depuis ton ordinateur : DATABASE_URL=... npm run collect
const { collect } = await import("../lib/collect.ts");
const r = await collect();
console.log(`${r.mentionsAdded} nouvelles mentions, ${r.itemsSeen} articles lus, ${r.feeds} flux.`);
if (r.errors.length) console.log("Erreurs :\n" + r.errors.join("\n"));
process.exit(0);
