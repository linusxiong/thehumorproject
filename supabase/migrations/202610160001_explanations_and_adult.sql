begin;

-- Adult humor is allowed and labeled 18+. An accepted explanation of what makes the joke funny is shown on its card,
-- credited by first name to the author (while sharing) or to the community member who supplied it later.
alter table public.jokes
  add column adult boolean not null default false,
  add column explanation text check (length(explanation) between 1 and 500),
  add column explained_by text check (length(explained_by) between 1 and 100);
grant update (adult, explanation, explained_by) on public.jokes to service_role;

-- Every explanation a member supplies for an existing joke, accepted or rejected; it drives the daily limit.
create table public.joke_explanations (
  id bigint generated always as identity primary key,
  joke_id bigint not null references public.jokes (id) on delete cascade,
  user_id text not null check (length(user_id) > 0),
  author_name text not null check (length(author_name) between 1 and 100),
  explanation text not null check (length(explanation) between 1 and 500),
  accepted boolean not null,
  created_at timestamptz not null default now()
);
create index joke_explanations_user_created_idx on public.joke_explanations (user_id, created_at desc);
create index joke_explanations_joke_idx on public.joke_explanations (joke_id);

-- Only the app server's secret key may read or change explanations.
alter table public.joke_explanations enable row level security;
revoke all on public.joke_explanations from public, anon, authenticated;
grant select, insert, delete on public.joke_explanations to service_role;
grant usage on sequence public.joke_explanations_id_seq to service_role;

-- Same feed as before, plus the 18+ flag and the accepted explanation with its credit.
create or replace function public.joke_feed(p_user_id text default null, p_joke_id bigint default null, p_limit int default 50)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(feed.joke order by feed.created_at desc, feed.id desc), '[]'::jsonb)
  from (
    select j.id, j.created_at, jsonb_build_object(
      'id', j.id,
      'body', j.body,
      'source_language', j.source_language,
      'origin', j.origin,
      'source_label', j.source_label,
      'author_name', j.author_name,
      'author_avatar_path', case when p.avatar_source = 'upload' then p.avatar_path end,
      'author_google_url', p.google_url,
      'created_at', j.created_at,
      'adult', j.adult,
      'explanation', j.explanation,
      'explained_by', j.explained_by,
      'adaptations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'audience', a.audience,
          'body', a.body,
          'gloss', a.gloss,
          'punchline_core', a.punchline_core,
          'notes', a.notes,
          'funny', s.funny,
          'not_funny', s.not_funny,
          'user_rating', s.user_rating
        ) order by array_position(array['en', 'es', 'zh'], a.audience))
        from public.joke_adaptations a
        cross join lateral (
          select (count(*) filter (where r.funny))::int as funny,
            (count(*) filter (where not r.funny))::int as not_funny,
            bool_or(r.funny) filter (where r.user_id = p_user_id) as user_rating
          from public.adaptation_ratings r
          where r.adaptation_id = a.id
        ) s
        where a.joke_id = j.id
      ), '[]'::jsonb)
    ) as joke
    from public.jokes j
    left join public.user_profiles p on p.user_id = j.author_id
    where p_joke_id is null or j.id = p_joke_id
    order by j.created_at desc, j.id desc
    limit greatest(p_limit, 0)
  ) feed;
$$;
revoke all on function public.joke_feed(text, bigint, int) from public, anon, authenticated;
grant execute on function public.joke_feed(text, bigint, int) to service_role;

-- Store a joke, its 18+ flag, its optional explanation, and all of its generated versions atomically.
drop function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz);
create function public.create_joke(
  p_author_id text,
  p_author_name text,
  p_body text,
  p_source_language text,
  p_adaptations jsonb,
  p_origin text default 'member',
  p_source_label text default null,
  p_created_at timestamptz default now(),
  p_adult boolean default false,
  p_explanation text default null,
  p_explained_by text default null
)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  new_id bigint;
begin
  if jsonb_typeof(p_adaptations) is distinct from 'array' or jsonb_array_length(p_adaptations) = 0 then
    raise exception 'create_joke needs at least one adaptation';
  end if;
  insert into public.jokes (author_id, author_name, body, source_language, origin, source_label, created_at, adult, explanation, explained_by)
  values (p_author_id, p_author_name, p_body, p_source_language, p_origin, p_source_label, p_created_at, p_adult, p_explanation, p_explained_by)
  returning id into new_id;
  insert into public.joke_adaptations (joke_id, audience, body, gloss, punchline_core, notes, created_at)
  select new_id, x.audience, x.body, x.gloss, x.punchline_core, x.notes, p_created_at
  from jsonb_to_recordset(p_adaptations)
    as x(audience text, body text, gloss jsonb, punchline_core jsonb, notes jsonb);
  return new_id;
end;
$$;
revoke all on function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz, boolean, text, text) from public, anon, authenticated;
grant execute on function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz, boolean, text, text) to service_role;

-- Apply a community member's accepted explanation: record it, credit it on the joke, and replace every version.
-- Deleting the old versions also deletes their ratings, because the content they rated has changed.
create function public.readapt_joke(
  p_joke_id bigint,
  p_user_id text,
  p_author_name text,
  p_explanation text,
  p_adult boolean,
  p_adaptations jsonb
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if jsonb_typeof(p_adaptations) is distinct from 'array' or jsonb_array_length(p_adaptations) = 0 then
    raise exception 'readapt_joke needs at least one adaptation';
  end if;
  update public.jokes set adult = p_adult, explanation = p_explanation, explained_by = p_author_name
  where id = p_joke_id;
  if not found then
    raise exception 'joke % does not exist', p_joke_id using errcode = 'no_data_found';
  end if;
  insert into public.joke_explanations (joke_id, user_id, author_name, explanation, accepted)
  values (p_joke_id, p_user_id, p_author_name, p_explanation, true);
  delete from public.joke_adaptations where joke_id = p_joke_id;
  insert into public.joke_adaptations (joke_id, audience, body, gloss, punchline_core, notes)
  select p_joke_id, x.audience, x.body, x.gloss, x.punchline_core, x.notes
  from jsonb_to_recordset(p_adaptations)
    as x(audience text, body text, gloss jsonb, punchline_core jsonb, notes jsonb);
end;
$$;
revoke all on function public.readapt_joke(bigint, text, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.readapt_joke(bigint, text, text, text, boolean, jsonb) to service_role;

commit;
