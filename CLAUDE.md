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

## État de l'audit sécurité / UX / design

Audit complet réalisé sur le commit `84f3d43`. 35 constats, référencés `S-`
(sécurité), `U-` (UX/accessibilité), `D-` (design).

### Traité et vérifié contre la base réelle

| Constat | Correctif | Preuve |
|---|---|---|
| S-01 canaux Realtime publics (critique) | policies `realtime.messages` (0010), canaux privés | policies en place ; abonnement visiteur non testé (voir chantier) |
| S-02 aucun quota (critique) | `rate_limits` + `rate_limit_hit` (0011) | 10 acceptés, 11ᵉ → 429, `Retry-After: 600` |
| S-03 widget cadrable par tous | `frame-ancestors` piloté par env | `/widget` sans XFO, `/login` en DENY |
| S-04 aucun en-tête de sécurité | CSP, HSTS, nosniff, Referrer, Permissions | vérifiés servis (CSP en production seulement) |
| S-06 `postMessage` sans contrôle d'origine | origine du message = origine de l'URL annoncée | — |
| S-07 injection de prompt | délimiteurs `asData()`, étendus au résumé et au Copilot | attaque avec fermeture de balise → neutralisée |
| S-08 sanitisation par regex | tokenizer avec reconstruction depuis liste blanche | 22/22 (`npm test`) |
| S-09 `typing`/`feedback` sans token | token exigé et rattaché à la conversation | 400 sans token |
| S-10 interpolation dans `.or()` | deux requêtes | typecheck |
| S-12 mot de passe seed versionné | variable d'environnement | — |
| S-14 droits Postgres | revoke sur `PUBLIC` + grant `service_role` | anon → 401, service_role → 200 |
| S-15 `avatar_url` non validé | https public exigé, plages privées rejetées | — |
| U-01 aucun responsive | maître/détail sous `md`, bandeau admin, `100dvh` | **non vérifié visuellement** |
| U-02 compteur de non-lus mort | trigger `bump_unread` (0012) + diffusion `inbox:update` systématique | `unread_count = 1` |
| U-03 visiteurs indistinguables | route `identify`, prénom demandé après escalade | 5 cas de validation |
| U-04 contrastes sous AA | tons 600 assombris | ratios recalculés (4,5 à 5,4:1) |
| S-11 RGPD | conservation 12 mois, effacement par token, mentions IA + confidentialité | 2 messages avant effacement → 0 après ; purge 403 sans admin, 401 sans secret |
| S-13 pièces jointes | signature réelle vérifiée, orphelins purgés, contrôle d'origine | 19/19 signatures, 4/4 origines |
| U-13 rien n'annonçait l'IA | « Assistant automatique » dans l'en-tête | rendu vérifié |
| D-01 6 classes Tailwind inexistantes | échelle `mist` complétée, `glow`/`glow-sm` définis | bloc d'accueil à 15,05:1, ombres présentes |
| D-06 tokens orphelins | `launcher` retiré, `halo` appliqué à l'orbe | corrige aussi la perte du halo sous `prefers-reduced-motion` |

### Chantier en cours

**Temps réel des visiteurs — à refondre par session anonyme.**
`src/lib/visitor-token.ts` signe un JWT en HS256 avec le secret partagé
Supabase. Or le projet a basculé sur des clés ECC : ce secret est une *clé
précédente*, et sa révocation casserait tous les jetons visiteurs.

Cible : `supabase.auth.signInAnonymously()` côté widget — Supabase signe avec sa
clé courante, le visiteur obtient une session vérifiable, et la policy Realtime
compare `auth.uid()` au visiteur propriétaire de la conversation. À faire :
colonne `visitors.auth_user_id`, policy réécrite, vérification du jeton côté
serveur, suppression de `visitor-token.ts`. Prérequis : activer *Anonymous
sign-ins* dans Authentication → Sign In / Providers.

Cela traite au passage une partie de **S-05** (le token visiteur est aujourd'hui
généré par le client, sans signature, sans expiration, sans rotation).

### Non traité

- **S-05** identité visiteur — voir ci-dessus. Seul constat de sécurité restant.
- **U-05** troncature silencieuse (2 000 / 4 000 / 8 000 caractères sans
  compteur ni avertissement).
- **U-06** échecs d'upload avalés par un `catch` vide.
- **U-07** modales sans piège de focus, sans Échap, sans `role="dialog"`.
- **U-08** ARIA : `aria-live` sur tout le fil du widget, `dt`/`dd` hors `dl`,
  onglets sans `role="tab"`, pas de `h1` dans l'inbox.
- **U-09** navigation admin en `useState` : pas d'URL par section.
- **U-10** pas de réinitialisation de mot de passe, pas de MFA.
- **U-11** états de chargement rudimentaires, pas de squelettes.
- **U-12** Entrée envoie sans indication, `window.prompt` pour les liens.
- **D-02** accent codé en dur par endroits (`conversation.tsx`, `embed.js`).
- **D-03** peu de micro-interactions ; l'orbe respire en permanence au lieu
  d'être réservé au travail du bot.
- **D-04** échelle typographique non formalisée (tailles en pixels arbitraires).
- **D-05** pas de thème sombre pour l'espace agent.
- **D-07** ni ESLint, ni CI. `npm test` et `npm run typecheck` existent mais ne
  sont exécutés par aucun workflow.

### Ce qui n'a jamais été vérifié à l'exécution

- **Le responsive** — `/inbox` et `/admin` exigent une session agent.
- **Les canaux privés côté agent** — même raison. Les policies sont en place.
- **La CSP** — active en production seulement, donc jamais exercée. Surveiller
  la console au premier déploiement.

## Comptes agents

Un compte dans `auth.users` **ne suffit pas** : `requireAgent()` exige une ligne
dans `public.agents`, appariée par `auth_user_id` ou par e-mail. Créer un
utilisateur depuis le dashboard Supabase sans ajouter cette ligne donne un compte
qui s'authentifie mais n'a accès à rien.

`AuthError` porte un motif — `no_session`, `no_agent`, `not_admin` — et les pages
doivent le distinguer, car le statut HTTP ne suffit pas : `no_agent` et
`not_admin` sont tous deux des 403, mais le premier doit afficher un écran et le
second rediriger vers `/inbox`.

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
