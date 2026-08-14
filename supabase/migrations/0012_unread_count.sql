-- 0012 — Compteur de messages non lus
--
-- `conversations.unread_count` etait remis a zero en trois endroits et
-- incremente nulle part : le badge ne s'affichait donc jamais, l'action
-- « read » ne servait a rien, et rien ne distinguait visuellement une
-- conversation qui attend une reponse. C'est le repere principal d'une boite
-- de reception, et il etait absent (constat U-02).
--
-- Regle retenue : le compteur suit les messages du VISITEUR non encore lus par
-- un agent, y compris pendant la phase bot. On pourrait n'incrementer qu'apres
-- escalade, mais un agent verrait alors 0 sur une conversation active — le
-- statut « Bot » suffit a lui indiquer qu'il peut l'ignorer, tandis qu'un
-- compteur qui reste a zero se lit comme « rien de nouveau », ce qui est faux.
--
-- La remise a zero reste geree cote application : action `read` a l'ouverture
-- de la conversation, et reponse d'un agent (qui vaut lecture).

create or replace function public.bump_unread()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Les notes internes ne viennent jamais du visiteur, mais la garde rend
  -- l'intention explicite si le modele evolue.
  if new.sender = 'visitor' and new.internal_note = false then
    update public.conversations
       set unread_count = unread_count + 1
     where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_bump_unread on public.messages;
create trigger trg_messages_bump_unread
  after insert on public.messages
  for each row execute function public.bump_unread();

-- Rattrapage : compter les messages visiteur posterieurs a la derniere
-- intervention d'un agent, pour que les conversations deja en base ne
-- demarrent pas toutes a zero.
update public.conversations c
   set unread_count = (
     select count(*)
       from public.messages m
      where m.conversation_id = c.id
        and m.sender = 'visitor'
        and m.internal_note = false
        and m.created_at > coalesce(
          (
            select max(a.created_at)
              from public.messages a
             where a.conversation_id = c.id
               and a.sender = 'agent'
          ),
          '-infinity'::timestamptz
        )
   )
 where c.status <> 'resolved';
