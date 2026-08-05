# Déploiement NUANCE — guide complet, de A à Z

Coût : 0 €. Durée estimée : 45-60 minutes la première fois.

## Avant de commencer — comptes nécessaires

- [ ] GitHub (tu l'as déjà, utilisé pour KeyGery)
- [ ] Vercel (tu l'as déjà, lié à GitHub)
- [ ] Stripe (à créer, ou 2e compte séparé de KeyGery — voir notre discussion sur les activités mixtes)
- [ ] Accès à nuanceprosupport@gmail.com

---

## Étape 1 — Organiser les fichiers

Télécharge tous les fichiers de la conversation et range-les **exactement** comme ceci dans un dossier sur ton ordinateur :

```
nuance-site/
├── index.html                 ⚠️ renommé depuis nuance-boutique.html — voir note ci-dessous
├── admin.html
├── mentions-legales.html
├── cgv.html
├── confidentialite.html
├── package.json
└── api/
    ├── create-checkout-session.js
    ├── active-promos.js
    ├── request-login.js
    ├── verify-login.js
    └── admin/
        ├── orders.js
        ├── promos.js
        └── tracking.js
```

**⚠️ Point qui casse tout si tu l'oublies** : le fichier principal doit s'appeler `index.html`, sinon Vercel affichera ton site à `tonsite.vercel.app/nuance-boutique.html` au lieu de `tonsite.vercel.app` tout court. Je t'ai déjà préparé cette copie renommée — prends `index.html` directement.

## Étape 2 — Créer le dépôt GitHub

1. github.com → New repository
2. Nomme-le (ex. `nuance-boutique`), Private si tu préfères (aucun secret n'est dans le code de toute façon, donc pas d'impact sécurité, juste une question de discrétion)
3. Upload tous les fichiers en respectant la structure ci-dessus (glisser-déposer sur l'interface web GitHub, ou `git add . && git commit && git push` si tu es à l'aise)

## Étape 3 — Déployer sur Vercel

1. vercel.com → Add New → Project
2. Sélectionne ton repo `nuance-boutique`
3. Clique Deploy, aucune configuration particulière nécessaire
4. Le site se déploie mais **ne fonctionne pas encore complètement** (paiement, email) — c'est normal, on configure ça maintenant

## Étape 4 — Récupérer la clé Stripe

1. dashboard.stripe.com → crée un compte si besoin
2. Reste en mode **Test** pour l'instant (bouton en haut à droite)
3. Developers → API keys → copie la clé **secrète** (`sk_test_...`)
4. Garde cet onglet ouvert

## Étape 5 — Mot de passe d'application Gmail

1. Connecte-toi sur nuanceprosupport@gmail.com
2. Active la validation en 2 étapes si ce n'est pas fait (Compte Google → Sécurité)
3. Compte Google → Sécurité → "Mots de passe des applications" → crée-en un → copie le code à 16 caractères

## Étape 6 — Variables d'environnement sur Vercel

Projet Vercel → Settings → Environment Variables, ajoute chacune :

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | clé de l'étape 4 |
| `SITE_URL` | ton URL Vercel (visible en haut du dashboard projet, ex. `https://nuance-boutique.vercel.app`) |
| `GMAIL_USER` | `nuanceprosupport@gmail.com` |
| `GMAIL_APP_PASSWORD` | code de l'étape 5 |
| `ADMIN_PASSWORD` | mot de passe long, choisi par toi (accès à `/admin.html`) |
| `MAGIC_LINK_SECRET` | chaîne aléatoire longue, inventée par toi (40+ caractères, n'importe quoi) |

## Étape 7 — Redéployer

Vercel → onglet Deployments → sur le dernier déploiement → menu "..." → **Redeploy**.
(Les variables d'environnement ne s'appliquent qu'après un redéploiement — à refaire à chaque fois que tu en changes une.)

## Étape 8 — Premier test complet (argent fictif, aucun risque)

1. Va sur ton site déployé, ajoute un produit, "Passer commande"
2. Tu dois atterrir sur une vraie page de paiement Stripe
3. Carte de test : `4242 4242 4242 4242`, date future au hasard, CVC au hasard
4. Vérifie : la commande apparaît dans `/admin.html` (onglet Commandes) avec ton mot de passe admin
5. Teste "Mon compte" avec l'email utilisé au paiement → lien reçu par email → clic → commande visible

## Étape 9 — Créer tes vrais codes promo

Une fois déployé, le site utilise les vrais codes Stripe (plus la version de démonstration en JS) :
- Directement depuis l'onglet **Codes promo** de `/admin.html`, le plus simple
- Ou manuellement : Stripe Dashboard → Product catalog → Coupons, puis Promotion codes

## Étape 10 — Passer en argent réel

Seulement une fois que tout est testé et validé :
1. Stripe Dashboard → bascule Test → **Live** (en haut à droite)
2. Copie la clé secrète **live** (`sk_live_...`)
3. Remplace `STRIPE_SECRET_KEY` sur Vercel par cette clé → redéploie (étape 7)

**Rappel** : sans notification automatique, tu dois checker l'onglet Commandes de `/admin.html` régulièrement pour ne pas louper une vente.

---

## Avant d'annoncer publiquement le site

Ces points restent en dehors du déploiement technique, mais bloquent une vraie mise en ligne commerciale :

- [ ] Ton SIRET une fois reçu → à intégrer dans mentions-legales.html / cgv.html / confidentialite.html (dis-le-moi, je le fais en 2 minutes)
- [ ] Vraies listes d'ingrédients des 10 produits (obligation légale, pas approximatif)
- [ ] Adhésion à un médiateur de la consommation (obligatoire pour vendre en ligne)
- [ ] Confirmation de tes vrais prix d'achat Qogita (tes marges actuelles sont basées sur des prix de vente marché, pas tes coûts réels)
