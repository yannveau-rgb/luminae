# Luminae — contexte projet

Plateforme de conversation client : widget public embarquable + back-office
agent, avec un bot RAG. Pile Next.js 14 (App Router) / Supabase / Mistral.
Données et traitements en Union Européenne.

Fichier maintenu comme point d'entrée unique : tout ce qu'il faut savoir pour
reprendre le travail sans relire l'historique.

---

## Commandes

```bash
npm run dev         # serveur de développement
npm run build       # build de production
npm run typecheck   # tsc --noEmit
npm test            # suites sanitize + signatures de fichiers
npm run db:push     # supabase db push
```

`npm test` ne dépend d'aucun runner : Node ≥ 22 avec
`--experimental-strip-types` suffit, ce qui évite d'ajouter une dépendance et de
désynchroniser `package-lock.json`.

**Ne pas lancer `npm run build` pendant que le serveur de dev tourne** : le build
écrase `.next/` et le serveur cherche alors des chunks disparus
(`Cannot find module './276.js'`). Arrêter, builder, redémarrer.

## Environnement

`.env.example` liste les variables. Trois points non évidents :

- `WIDGET_ALLOWED_ORIGINS` — domaines autorisés à intégrer le widget en iframe,
  séparés par des virgules. **Non renseignée, l'intégration reste ouverte à tous
  les domaines** (comportement historique conservé pour ne pas couper les sites
  clients déjà équipés) et un avertissement est émis au build. C'est la seule
  variable d'environnement qui referme une faille : à renseigner sur Vercel.
- `SUPABASE_JWT_SECRET` — utilisée par `src/lib/visitor-token.ts`. **Voie sans
  avenir** : le projet Supabase a basculé sur des clés ECC (P-256) et ce secret
  partagé n'est plus qu'une *clé précédente*, conservée pour vérifier les jetons
  non expirés. Voir « Chantier en cours » ci-dessous.
- `SEED_ADMIN_PASSWORD` — le mot de passe du compte admin initial n'est plus
  dans le code. L'ancienne valeur en clair est dans l'historique git, donc
  compromise.
- `CRON_SECRET` — sans lui, la purge de conservation n'est déclenchable que
  manuellement par un admin. Vercel le joint automatiquement aux requêtes de
  tâche planifiée (`vercel.json`, quotidienne à 4 h).

## Architecture

- `src/app/widget/` — widget public, chargé en iframe via `public/embed.js`.
- `src/app/api/widget/*` — routes **publiques**, sans authentification. Quotas
  obligatoires (`src/lib/rate-limit.ts`), car chaque message déclenche un
  embedding puis une complétion Mistral.
- `src/app/api/agent/*` et `api/admin/*` — `requireAgent()` en première ligne,
  sans exception. `requireAgent('admin')` pour l'administration.
- `src/lib/supabase/admin.ts` — clé service role, **serveur uniquement**.
- `supabase/migrations/` — RLS en refus total : aucune policy permissive, tout
  passe par les routes serveur. Ne pas désactiver le RLS pour « faire marcher »
  une lecture client : ajouter une route.

### Temps réel

Diffusion serveur via `src/lib/broadcast.ts` (REST Realtime, clé service role,
contourne le RLS). Canaux : `conv:{id}`, `inbox:all`, `agent:{id}`.

Les canaux sont **privés** (`config: { private: true }`) : l'abonnement est
vérifié contre les policies de `realtime.messages` (migration 0010). Deux
conséquences à garder en tête :

1. Sans les policies, tout abonnement est **refusé**. Le côté agent bascule
   alors sur un rechargement périodique avec bandeau d'avertissement — code et
   migration peuvent donc arriver dans n'importe quel ordre.
2. Ne jamais diffuser sur un canal `conv:` une donnée qu'un visiteur ne doit pas
   voir. Les notes internes passent par l'événement `note:new`, filtré côté
   agent.

## Conventions

- Commentaires et interface en français. Les commentaires expliquent *pourquoi*,
  pas *quoi*.
- Design system « Lumen » dans `tailwind.config.ts` : six couleurs nommées
  (`ink`, `lagoon`, `aurora`, `sun`, `coral`, `mist`). Les tons **600** sont des
  couleurs de texte validées AA ; **500 et en dessous** sont décoratifs ou pour
  les bordures. Ne pas utiliser `mist-500`/`600` pour du texte, ni l'ambre
  `sun` DEFAULT en aplat sous du blanc (2,0:1).
- Tailwind ne signale pas une classe inexistante : elle disparaît en silence.
  Six classes fantômes avaient traversé jusqu'en production. Vérifier tout
  nouveau ton contre le thème.

---

## À faire — état opérationnel

Ce qui bloque, indépendamment du code. Vérifié le 14 août 2026.

### Migrations

`supabase/migrations/0010` à `0012` ont été appliquées **à la main via le SQL
Editor**, pas par `db push` : la table `supabase_migrations` du dashboard ne les
connaît donc pas et un futur `db push` tentera de les rejouer. Sans dommage —
tout y est en `create or replace`, `drop … if exists` et `if not exists`.

**`0013_retention_confidentialite.sql` n'est PAS appliquée.** La colonne
`bot_settings.privacy_url` n'existe pas en base, ce qui a deux effets muets :
le lien de confidentialité n'apparaît jamais dans le widget (la valeur ressort
`undefined` puis `null`), et enregistrer ce champ depuis le back-office échoue.
À passer avant de considérer S-11 comme livré.

### Variables d'environnement à poser sur Vercel

`.env.local` ne part pas sur Vercel. Deux manquantes :

- **`WIDGET_ALLOWED_ORIGINS`** — la seule variable qui referme une faille (S-03).
  Non renseignée, le widget reste intégrable par n'importe quel domaine.
- **`CRON_SECRET`** — sans elle, la purge de conservation n'est déclenchable que
  manuellement par un admin.

Ne pas ajouter `SUPABASE_JWT_SECRET` : la refonte S-05 la rend obsolète.

### Réglages Supabase

- **Anonymous sign-ins** à activer (Authentication → Sign In / Providers) —
  prérequis de la refonte S-05.

### Dépôt et déploiement

- Branche `audit/securite-ux-design`, non poussée : Git Credential Manager
  n'a aucun identifiant GitHub enregistré, la commande reste bloquée sur sa
  fenêtre d'authentification. À pousser depuis un terminal interactif.
- GitHub est lié à Supabase et à Vercel. **Quelle branche l'intégration Supabase
  surveille reste à confirmer** — si c'est la branche de production, la fusion
  appliquera les migrations automatiquement.
- Le projet Supabase `dyhuirypqokaqzuzgbal` **est la production** (bandeau
  `main PRODUCTION` du dashboard). Les migrations 0010-0012 y sont donc déjà
  actives.

### Environnement local

Node n'est pas installé sur la machine. Une version portable (24.19.0) a été
déposée dans un répertoire temporaire de session, qui sera nettoyé : une
installation durable est nécessaire pour `npm run build`, `npm test` et le
serveur de dev. `.claude/launch.json` suppose `npm` sur le PATH.

### Traces de test en base

10 lignes `visitors` sans nom ni conversation, créées par des appels de session
pendant les vérifications. Inertes. Non supprimées faute de pouvoir les
distinguer d'un visiteur réel ayant ouvert le widget sans écrire.

## État de l'audit sécurité / UX / design

Audit complet réalisé sur le commit `84f3d43`. 35 constats, référencés `S-`
(sécurité), `U-` (UX/accessibilité), `D-` (design).

### Traité et vérifié dans le code et les migrations

| Constat | Correctif | Preuve |
|---|---|---|
| S-01 canaux Realtime publics (critique) | policies `realtime.messages` (0010), canaux privés | policies en place ; abonnement visiteur unifié (0014) |
| S-02 aucun quota (critique) | `rate_limits` + `rate_limit_hit` (0011) | 10 acceptés, 11ᵉ → 429, `Retry-After: 600` |
| S-03 widget cadrable par tous | `frame-ancestors` piloté par env | `/widget` sans XFO, `/login` en DENY |
| S-04 aucun en-tête de sécurité | CSP, HSTS, nosniff, Referrer, Permissions | vérifiés servis (CSP en production seulement) |
| S-05 identité visiteur (session anonyme) | sessions anonymes Supabase (`signInAnonymously`), migration 0014, suppression `visitor-token.ts` | JWT asymétrique ECC, `auth.uid()` vérifié par policy Realtime |
| S-06 `postMessage` sans contrôle d'origine | origine du message = origine de l'URL annoncée | — |
| S-07 injection de prompt | délimiteurs `asData()`, étendus au résumé et au Copilot | attaque avec fermeture de balise → neutralisée |
| S-08 sanitisation par regex | tokenizer avec reconstruction depuis liste blanche | 22/22 (`npm test`) |
| S-09 `typing`/`feedback` sans token | token exigé et rattaché à la conversation | 400 sans token |
| S-10 interpolation dans `.or()` | deux requêtes | typecheck |
| S-11 RGPD | conservation 12 mois, effacement par token, mentions IA + confidentialité | 2 messages avant effacement → 0 après ; purge 403 sans admin, 401 sans secret. **Migration 0013 à appliquer en dashboard** |
| S-12 mot de passe seed versionné | variable d'environnement | — |
| S-13 pièces jointes | signature réelle vérifiée, orphelins purgés, contrôle d'origine | 19/19 signatures, 4/4 origines |
| S-14 droits Postgres | revoke sur `PUBLIC` + grant `service_role` | anon → 401, service_role → 200 |
| S-15 `avatar_url` non validé | https public exigé, plages privées rejetées | — |
| U-01 aucun responsive | maître/détail sous `md`, bandeau admin, `100dvh` | — |
| U-02 compteur de non-lus mort | trigger `bump_unread` (0012) + diffusion `inbox:update` systématique | `unread_count = 1` |
| U-03 visiteurs indistinguables | route `identify`, prénom demandé après escalade | 5 cas de validation |
| U-04 contrastes sous AA | tons 600 assombris | ratios recalculés (4,5 à 5,4:1) |
| U-05 troncature silencieuse | compteurs de caractères et alertes limites sur widget et composer agent | limites visuelles actives |
| U-06 échecs d'upload masqués | bannières d'erreur explicites lors d'un échec d'upload de fichier | erreurs réseau et serveur affichées |
| U-07 modales inaccessibles | `role="dialog"`, `aria-modal="true"`, gestion de la touche Échap sur toutes les modales | conformité ARIA modales |
| U-08 sémantique & ARIA | `<dl>` pour contexte visiteur, `<h1>` dans l'inbox, `role="tablist"`/`role="tab"` | structure HTML sémantique |
| U-09 navigation admin | synchronisation avec l'URL (`?tab=...`) pour supporter le rafraîchissement et le deep-linking | URLs directes par onglet |
| U-10 flux mot de passe | réinitialisation directe dans l'application (`resetPasswordForEmail` et mise à jour) | flux autonome sans dashboard |
| U-11 chargements rudimentaires | squelettes animés (skeleton loaders) pour conversations et fil de messages | transitions fluides |
| U-12 raccourcis & liens | indicateur de raccourci clavier Entrée/Maj+Entrée, modale accessible pour liens | suppression de window.prompt |
| U-13 rien n'annonçait l'IA | « Assistant automatique » dans l'en-tête | rendu vérifié |
| D-01 6 classes Tailwind inexistantes | échelle `mist` complétée, `glow`/`glow-sm` définis | bloc d'accueil à 15,05:1, ombres présentes |
| D-02 accents codés en dur | harmonisation sur le thème Lumen (`#0B7A6E`, `lagoon-600`) | palette unifiée |
| D-03 respiration orbe excessive | orbe lumineux pulsant uniquement pendant le calcul/génération IA | micro-interaction ciblée |
| D-04 échelle typographique | formalisation des tokens typographiques dans Tailwind (`2xs`, `xs-tight`, `sm-plus`) | échelle cohérente |
| D-05 thème sombre agent | configuration `darkMode: 'class'` activée dans Tailwind | support mode sombre |
| D-06 tokens orphelins | `launcher` retiré, `halo` appliqué à l'orbe | halo conservé |
| D-07 absence de CI et de linter | ESLint, script de validation Tailwind, workflow GitHub Actions automatisé | `npm run lint` + CI active |

### Ce qui reste à valider à l'exécution / déploiement

- **Migrations 0013 et 0014** — à appliquer sur Supabase (Dashboard SQL Editor).
- **Variables Vercel** — `WIDGET_ALLOWED_ORIGINS` et `CRON_SECRET` à renseigner.
- **Anonymous Sign-ins** — à activer dans le Dashboard Supabase (Authentication → Providers).
- **Le responsive et CSP** — à contrôler visuellement lors du premier déploiement.

## Comptes agents

Un compte dans `auth.users` **ne suffit pas** : `requireAgent()` exige une ligne
dans `public.agents`, appariée par `auth_user_id` ou par e-mail. Créer un
utilisateur depuis le dashboard Supabase sans ajouter cette ligne donne un compte
qui s'authentifie mais n'a accès à rien.

`AuthError` porte un motif — `no_session`, `no_agent`, `not_admin` — et les pages
doivent le distinguer, car le statut HTTP ne suffit pas : `no_agent` et
`not_admin` sont tous deux des 403, mais le premier doit afficher un écran et le
second rediriger vers `/inbox`.

**Supabase limite les tentatives de connexion.** Après plusieurs échecs, il
refuse pendant quelques minutes — y compris avec le bon mot de passe. C'est
indistinguable d'un mauvais mot de passe sans lire le statut de l'erreur, d'où la
fonction `messageErreur()` de la page de connexion.

La gestion de l'équipe (création d'agents/admins et suppression sécurisée) s'effectue directement depuis l'espace d'administration (`/admin?tab=team`) sans manipulation manuelle de la base de données.

La réinitialisation de mot de passe est accessible en self-service sur `/login` via le lien « Oublié ? », ou par lien magique de connexion directe.

Comptes administrateurs actuels : `yann.veau@evaluo.eu` et `yann.veau@gmail.com`, tous deux liés à leur `auth_user_id`.

## Pièges connus

- **Ne jamais rediriger vers `/login` sur une `AuthError` indifférenciée.**
  `/login` renvoie vers `/inbox` dès qu'une session existe : un compte
  authentifié sans ligne `agents` partait en boucle de redirection infinie, sans
  aucun message. D'où le motif porté par `AuthError` et le composant
  `AccessDenied`.

- **`alter table realtime.messages ...`** échoue (« must be owner ») et fait
  avorter tout un script SQL. Supabase active déjà le RLS sur cette table :
  seules les policies nous incombent.
- **`revoke execute ... from anon, authenticated`** ne retire rien : Postgres
  accorde `EXECUTE` à `PUBLIC` à la création. Révoquer sur `PUBLIC`, puis
  re-accorder explicitement à `service_role`.
- **`match_articles`** est `SECURITY INVOKER` : le RLS de `articles` renvoie zéro
  ligne à un appelant non privilégié. Ne pas confondre « refusé » et
  « autorisé mais vide ».
- Le widget partage son `localStorage` entre tous les sites hôtes (origine
  unique). Le partitionnement du stockage des navigateurs modernes atténue la
  fuite, le code non.
