-- 0007 — Seed (valeurs par défaut, voir branding.config.ts)
-- Contient : réglages du bot, horaires, articles d'exemple (sans embeddings —
-- ils sont indexés via l'admin « Régénérer les index » ou automatiquement à
-- la prochaine édition).

insert into public.bot_settings (id, bot_name, avatar_url, welcome_message, fallback_message,
                                 offline_message, tone, reply_length, small_talk_enabled,
                                 accent_color, suggestions)
values (
  1,
  'Lumi',
  null,
  'Bonjour 👋 Je suis Lumi, votre assistant. Posez-moi votre question sur vos évaluations, convocations ou résultats — je réponds instantanément, et un membre de l’équipe peut prendre le relais si besoin.',
  'Je préfère laisser un membre de l’équipe vous répondre pour ne pas vous induire en erreur. Je viens de transmettre votre demande — un agent vous répond ici très vite.',
  'Nos agents ne sont pas disponibles pour le moment. Votre question est bien en file d’attente, nous y répondrons dès notre retour.',
  'casual',
  'normal',
  true,
  '#0E8C7D',
  '["Comment se déroule un examen supervisé ?", "Quand vais-je recevoir ma convocation ?", "Comment récupérer mes résultats ?"]'::jsonb
)
on conflict (id) do nothing;

insert into public.business_hours (id, timezone, weekly, holidays)
values (
  1,
  'Europe/Paris',
  '{"monday": [["09:00","12:30"],["14:00","18:00"]], "tuesday": [["09:00","12:30"],["14:00","18:00"]], "wednesday": [["09:00","12:30"],["14:00","18:00"]], "thursday": [["09:00","12:30"],["14:00","18:00"]], "friday": [["09:00","12:30"],["14:00","17:00"]], "saturday": [], "sunday": []}'::jsonb,
  '[{"date": "2026-12-25", "name": "Noël"}, {"date": "2027-01-01", "name": "Jour de l’an"}]'::jsonb
)
on conflict (id) do nothing;

-- ── Articles d'exemple pour démarrer la base de connaissances ─────────────
-- (embeddings générés ensuite via Mistral — voir bouton « Régénérer les index »)
insert into public.articles (title, content, category, tags) values
(
  'Déroulement d’un examen supervisé à distance',
  'Un examen supervisé à distance se déroule en quatre étapes. 1) Vous recevez une convocation par e-mail avec la date, l’heure et un lien de connexion. 2) Dix minutes avant le début, vous rejoignez la salle virtuelle et un superviseur vérifie votre identité (pièce d’identité + caméra). 3) Vous composez l’examen dans un environnement sécurisé : partage d’écran actif, caméra et micro ouverts. 4) À la fin, le superviseur confirme la clôture de la session et vous recevez un accusé de réception par e-mail. En cas de problème technique pendant l’épreuve, contactez immédiatement le superviseur via le chat intégré.',
  'Examens',
  '{examen,supervision,distance}'
),
(
  'Recevoir ou retrouver sa convocation',
  'Votre convocation est envoyée par e-mail au plus tard 72 heures avant la date de l’évaluation. Elle contient la date, l’heure, le lien de connexion et la liste des prérequis techniques. Si vous ne la trouvez pas, vérifiez vos courriers indésirables puis contactez l’équipe en précisant votre nom complet et la session concernée. Vous pouvez également demander un renvoi de convocation depuis votre espace candidat.',
  'Planification',
  '{convocation,email,planification}'
),
(
  'Prérequis techniques pour un examen en ligne',
  'Pour passer un examen supervisé dans de bonnes conditions : un ordinateur (Mac ou Windows) avec un navigateur récent (Chrome, Edge, Safari ou Firefox à jour), une connexion Internet stable (fibre ou 4G recommandée), une webcam fonctionnelle et un micro. Les téléphones et tablettes ne sont pas compatibles avec la supervision, sauf indication contraire de votre recruteur. Pensez à fermer les autres applications et à désactiver les mises à jour pendant l’épreuve.',
  'Technique',
  '{technique,mac,windows,desktop,mobile}'
),
(
  'Récupérer ses résultats',
  'Les résultats sont transmis à l’organisme qui a commandé votre évaluation, généralement sous 5 jours ouvrés après la session. Selon le processus de votre recruteur, vous pouvez recevoir une copie directement ou être invité à consulter votre espace candidat. Si vous avez besoin de votre rapport, contactez l’équipe en indiquant la date de votre session.',
  'Résultats',
  '{resultats,rapport}'
),
(
  'Reporter ou annuler une session',
  'Une demande de report doit être formulée au moins 48 heures avant la date prévue, sauf cas de force majeure. Le report est possible une fois sans frais ; au-delà, l’accord de votre recruteur est nécessaire. Pour annuler ou reporter, contactez l’équipe via ce chat ou par e-mail en précisant votre nom, la date de la session et le motif.',
  'Planification',
  '{report,annulation,planification}'
),
(
  'Problème technique pendant une session',
  'Si vous rencontrez un problème technique pendant une session (coupure Internet, caméra ou micro défaillant) : 1) restez dans la salle virtuelle si possible, 2) prévenez immédiatement le superviseur via le chat intégré, 3) si la connexion est perdue, reconnectez-vous avec le même lien dans les 10 minutes. Le temps perdu est compensé à la discrétion du superviseur. Sur mobile ou tablette, la supervision n’est pas disponible : utilisez un ordinateur Mac ou Windows.',
  'Technique',
  '{technique,panne,mobile,mac,windows}'
)
on conflict do nothing;
