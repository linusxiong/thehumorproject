begin;

alter table public.humor_entries drop column if exists likes;
grant delete on public.caption_votes to service_role;

commit;
