# Yeewu Radar

Veille médias pour les marques au Sénégal : part de voix, tonalité, alertes et rapport mensuel PDF.
Next.js 16 + Postgres (Neon), déployable sur Vercel.

## Pages

| Adresse | Pour qui | Contenu |
|---|---|---|
| `/` | prospects | page de vente + formulaire « demander une démo » |
| `/c/<lien-privé>` | client | tableau de bord (7/30/90 jours, filtres, alertes) |
| `/c/<lien-privé>/rapport?mois=2026-11` | client | rapport mensuel, bouton « Imprimer / PDF » |
| `/admin` | toi | clients, marques et mots-clés, demandes de démo, collecte manuelle, journal |
| `/api/collect` | cron | collecte (protégée par `CRON_SECRET`) |

## Mise en ligne (≈ 15 min)

1. **Neon** : crée un projet (région Europe), copie la *connection string* (`...?sslmode=require`).
2. **Base** : rien à faire. Au premier démarrage, l'application crée ses tables et l'espace
   « Démo Télécoms Sénégal » (Orange Sénégal, Yas, Expresso) ; son lien privé apparaît dans `/admin`.
   (Alternative manuelle : `DATABASE_URL="postgres://..." npm run db:setup`.)
3. **Vercel** : *Add New → Project*, importe le dépôt GitHub, puis dans *Environment Variables* :
   - `DATABASE_URL` : la chaîne Neon
   - `ADMIN_PASSWORD` : ton mot de passe admin
   - `CRON_SECRET` : une longue chaîne au hasard
   - `ANTHROPIC_API_KEY` (optionnel) : tonalité par IA au lieu du lexique
4. **Deploy**. Va sur `/admin`, clique « Lancer une collecte maintenant », puis ouvre le lien client.

Le cron (`vercel.json`) collecte chaque jour à 6 h UTC (limite du plan gratuit Vercel : 1 fois par jour).
Pour une collecte toutes les heures, programme sur cron-job.org un appel GET à
`https://<ton-domaine>/api/collect` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

## Fonctionnement

- **Sources** : Google Actualités (Sénégal, français) interrogé pour chaque mot-clé, plus les flux RSS
  de la presse locale listés dans `lib/feeds.ts` (à compléter ; un flux en panne est ignoré et noté au journal).
- **Détection** : un article compte pour une marque si un de ses mots-clés apparaît (mot entier,
  sans tenir compte des accents) et qu'aucune exclusion n'apparaît. Les exclusions évitent les faux positifs
  (« café expresso », « Orange Côte d'Ivoire »…).
- **Tonalité** : lexique français + wolof dans `lib/sentiment.ts`, ou Claude si `ANTHROPIC_API_KEY` est défini.
- **Alertes** : une marque est signalée quand elle cumule au moins 3 articles négatifs en 24 h,
  et plus du double de sa moyenne des 7 jours précédents.

## Développement

```bash
npm run dev                                   # http://localhost:3000
npm test                                      # tests unitaires (sans base)
DATABASE_URL=... npm run test:db              # test d'intégration (base de test uniquement : vide la table mentions)
DATABASE_URL=... npm run collect              # collecte depuis ton ordinateur
```

## Limites connues (v0.1)

- Presse en ligne uniquement : pas encore de réseaux sociaux (Facebook, X, TikTok) ni de radio/TV.
- Les liens Google Actualités passent par une redirection Google avant l'article.
- Le commentaire de l'analyste dans le rapport n'est pas enregistré : écris-le juste avant d'imprimer.
