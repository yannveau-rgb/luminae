-- 0006 — Fonctions & triggers

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tout nouveau message rafraîchit la date d'activité de sa conversation
-- (tri de la boîte de réception).
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_conversations_updated on public.conversations;
create trigger trg_conversations_updated
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_messages_touch on public.messages;
create trigger trg_messages_touch
  after insert on public.messages
  for each row execute function public.touch_conversation();

drop trigger if exists trg_articles_updated on public.articles;
create trigger trg_articles_updated
  before update on public.articles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_canned_updated on public.canned_responses;
create trigger trg_canned_updated
  before update on public.canned_responses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_bot_settings_updated on public.bot_settings;
create trigger trg_bot_settings_updated
  before update on public.bot_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_business_hours_updated on public.business_hours;
create trigger trg_business_hours_updated
  before update on public.business_hours
  for each row execute function public.set_updated_at();

