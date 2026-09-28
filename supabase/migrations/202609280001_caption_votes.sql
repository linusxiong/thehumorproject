begin;

-- Each story's punchline is its caption; reuse the existing story ID.
create table public.caption_votes (
  id bigint generated always as identity primary key,
  caption_id bigint not null references public.humor_entries(id) on delete cascade,
  user_id text not null check (length(user_id) > 0),
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now()
);

create index caption_votes_caption_id_idx on public.caption_votes (caption_id);

-- Better Auth sessions are verified by the app server, not Supabase Auth.
-- Leave RLS disabled and deny direct browser access using table privileges.
revoke all on public.caption_votes from public, anon, authenticated;
revoke all on sequence public.caption_votes_id_seq from public, anon, authenticated;
grant select, insert on public.caption_votes to service_role;
grant usage on sequence public.caption_votes_id_seq to service_role;

commit;
